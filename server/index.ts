import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupRealtime } from "./lib/realtime";
import { sportsApi } from "./services/sportsApi";
import { SportsDataService } from "./sportsDataService";
import { storage } from "./storage";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

const app = express();

// Replit Autoscale (and most managed hosts) terminate TLS at a proxy and
// forward plain HTTP to the app. Without this, Express thinks the request
// is insecure and refuses to set cookies marked `secure: true`, which
// silently breaks session-based login in production.
app.set("trust proxy", 1);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Persist sessions in PostgreSQL so they survive server restarts
const PgSession = connectPgSimple(session);
const pgPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const sessionMiddleware = session({
  store: new PgSession({
    pool: pgPool,
    createTableIfMissing: true,
    tableName: "session",
  }),
  secret: (() => {
    if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET environment variable must be set in production");
    }
    console.warn("⚠️  SESSION_SECRET not set — using dev fallback. Set this in production.");
    return "tw-dev-secret-change-in-prod";
  })(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
});

app.use(sessionMiddleware);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);
  setupRealtime(server, sessionMiddleware);

  // Background sync — runs inside the web server so scores stay current
  // whether or not the dedicated live-score worker is running.
  // In production with a Reserved VM worker, set DISABLE_WEB_SYNC=true to
  // avoid redundant ESPN calls (the worker does more sophisticated scheduling).
  if (process.env.DISABLE_WEB_SYNC !== "true") {
    const sportsDataService = new SportsDataService(storage);

    // Initial sync shortly after startup so the first page load shows fresh data.
    setTimeout(async () => {
      try {
        log("auto-sync: initial MLB/NBA/NFL game + standings sync");
        await Promise.all([
          sportsApi.syncMLBGames(1, 2),
          sportsApi.syncNBAGames(1, 1),
          sportsDataService.updateMLBStandings(),
          sportsDataService.updateNBAStandings(),
        ]);
        log("auto-sync: initial sync complete");
      } catch (err) {
        log("auto-sync: initial sync error:", err);
      }
    }, 10_000); // 10 seconds after boot

    // Recurring sync every 5 minutes to keep scores and standings current.
    setInterval(async () => {
      try {
        const now = new Date();
        const hour = now.getHours();
        // Skip the 2–6 AM quiet window to reduce unnecessary ESPN load overnight.
        if (hour >= 2 && hour < 6) return;
        await Promise.all([
          sportsApi.syncMLBGames(1, 2),
          sportsApi.syncNBAGames(1, 1),
          sportsDataService.updateMLBStandings(),
          sportsDataService.updateNBAStandings(),
        ]);
      } catch (err) {
        log("auto-sync error:", err);
      }
    }, 5 * 60 * 1000); // every 5 minutes
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();

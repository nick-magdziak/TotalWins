import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Persist sessions in PostgreSQL so they survive server restarts
const PgSession = connectPgSimple(session);
const pgPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

app.use(session({
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
}));

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

  // Initialize ESPN API sports data service
  try {
    const { SportsDataService } = await import("./sportsDataService");
    const { storage } = await import("./storage");
    const { sportsApi } = await import("./services/sportsApi");
    const sportsService = new SportsDataService(storage);
    
    // Initial data update on startup
    await sportsService.updateMLBStandings();
    await sportsService.updateNFLStandings();
    await sportsService.updateNBAStandings();
    await sportsApi.syncMLBGames();
    await sportsApi.syncNBAGames();
    await sportsApi.syncCurrentNFLGames();
    await sportsApi.syncNextWeekNFLGames();

    // Sync team win/loss records directly from ESPN standings — more reliable
    // than computing from our partial games table
    await sportsApi.syncTeamStandingsFromESPN();

    // World Cup sync
    try {
      const { worldCupDataService } = await import("./services/worldCupService");
      await worldCupDataService.syncWorldCupGames();
      log("World Cup data service initialized");
    } catch (wcError) {
      console.error("Failed to initialize World Cup data service:", wcError);
    }

    log("ESPN API sports data service initialized (MLB, NFL, NBA & World Cup)");
    
    // Set up automatic live game updates every 2 minutes during active hours
    const startLiveUpdates = () => {
      setInterval(async () => {
        try {
          // Only sync during reasonable hours (6 AM to 2 AM ET)
          const now = new Date();
          const hour = now.getHours();
          if (hour >= 6 || hour <= 2) {
            await sportsApi.syncMLBGames();
            await sportsApi.syncNBAGames();
            await sportsApi.syncCurrentNFLGames();
            await sportsApi.syncNextWeekNFLGames();
            // Sync World Cup during tournament period (June-July 2026)
            const month = now.getMonth() + 1;
            const year = now.getFullYear();
            if (year === 2026 && month >= 6 && month <= 7) {
              const { worldCupDataService } = await import("./services/worldCupService");
              await worldCupDataService.syncWorldCupGames();
            }
            console.log("🔄 Auto-synced live MLB, NBA, NFL, and World Cup games");
          }
        } catch (error) {
          console.error("Auto-sync error:", error);
        }
      }, 120000); // 2 minutes
    };
    
    // Start live updates after initial sync
    startLiveUpdates();
    log("Live game auto-sync enabled (2 minute intervals)");
    
  } catch (error) {
    console.error("Failed to initialize sports data service:", error);
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

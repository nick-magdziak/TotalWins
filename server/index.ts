import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
    await sportsApi.syncMLBGames();
    await sportsApi.syncCurrentNFLGames();
    await sportsApi.syncNextWeekNFLGames();
    log("ESPN API sports data service initialized (MLB & NFL)");
    
    // Set up automatic live game updates every 2 minutes during active hours
    const startLiveUpdates = () => {
      setInterval(async () => {
        try {
          // Only sync during reasonable hours (6 AM to 2 AM ET)
          const now = new Date();
          const hour = now.getHours();
          if (hour >= 6 || hour <= 2) {
            await sportsApi.syncMLBGames();
            await sportsApi.syncCurrentNFLGames();
            await sportsApi.syncNextWeekNFLGames();
            console.log("🔄 Auto-synced live MLB and NFL games (current + next week)");
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

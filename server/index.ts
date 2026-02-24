import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import pgSession from "connect-pg-simple";
import pg from "pg";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { seedDatabase } from "./seed";

const app = express();

// Trust proxy for production (Replit is behind a proxy)
app.set("trust proxy", 1);

// Configure session store based on environment
const isProduction = process.env.NODE_ENV === "production";
let sessionStore: session.Store;

if (isProduction && process.env.DATABASE_URL) {
  // Use PostgreSQL store in production for multi-instance support
  const PgStore = pgSession(session);
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
  sessionStore = new PgStore({
    pool,
    tableName: 'session',
    createTableIfMissing: true,
  });
  log("Using PostgreSQL session store for production");
} else {
  // Use memory store for development
  const MemoryStore = createMemoryStore(session);
  sessionStore = new MemoryStore({
    checkPeriod: 86400000,
  });
  log("Using memory session store for development");
}

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || "default-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
    },
  })
);

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  limit: '50mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Serve static files from uploads directory (for tenant logos)
import nodePath from "path";
app.use("/uploads", express.static(nodePath.join(process.cwd(), "uploads")));

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

  // Seed database on startup (creates master user if none exists)
  log("Starting seed...");
  await seedDatabase();
  log("Seed completed!");

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
  }, async () => {
    log(`serving on port ${port}`);
    
    // Start background runners
    const { csvSplitRunner } = await import("./csv-split-runner");
    csvSplitRunner.start();
    log("CSV Split background runner started");

    const { startDataRetention } = await import("./data-retention");
    startDataRetention();
    log("Data retention background runner started");

    const { startAppointmentReminder } = await import("./appointment-reminder");
    startAppointmentReminder();
    log("Appointment reminder background runner started");
  });
})();

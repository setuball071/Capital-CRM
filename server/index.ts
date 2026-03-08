import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

app.set("trust proxy", 1);

const isProduction = process.env.NODE_ENV === "production";

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
  // Step 1: Set up session store — use memory initially, upgrade to PG async after listen
  const MemoryStore = createMemoryStore(session);
  const memorySessionStore = new MemoryStore({
    checkPeriod: 86400000,
  });

  let activeStore: session.Store = memorySessionStore;

  const sessionMiddleware = session({
    store: memorySessionStore,
    secret: process.env.SESSION_SECRET || "default-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
    },
  });

  app.use((req, res, next) => {
    sessionMiddleware(req, res, next);
  });

  if (!isProduction) {
    log("Using memory session store for development");
  }

  // Step 2: Register routes (no DB calls here, just route definitions)
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Step 3: Start listening FIRST — health check passes immediately
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    log(`serving on port ${port}`);

    // Step 4: Now do async initialization (DB seed, session store upgrade, background jobs)
    try {
      // Upgrade to PostgreSQL session store in production (async, non-blocking)
      if (isProduction && process.env.DATABASE_URL) {
        try {
          const pgSession = (await import("connect-pg-simple")).default;
          const pg = (await import("pg")).default;
          const PgStore = pgSession(session);
          const pool = new pg.Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false },
            max: 5,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
          });
          const pgStore = new PgStore({
            pool,
            tableName: 'session',
            createTableIfMissing: true,
          });
          // Swap the store on the existing session middleware
          (sessionMiddleware as any).store = pgStore;
          activeStore = pgStore;
          log("Upgraded to PostgreSQL session store");
        } catch (pgErr) {
          log("Failed to initialize PostgreSQL session store, keeping memory store");
          console.error(pgErr);
        }
      }

      // Database seed
      const { seedDatabase } = await import("./seed");
      log("Starting seed...");
      await seedDatabase();
      log("Seed completed!");

      // Background runners
      const { csvSplitRunner } = await import("./csv-split-runner");
      csvSplitRunner.start();
      log("CSV Split background runner started");

      const { startDataRetention } = await import("./data-retention");
      startDataRetention();
      log("Data retention background runner started");

      const { startAppointmentReminder } = await import("./appointment-reminder");
      startAppointmentReminder();
      log("Appointment reminder background runner started");
    } catch (initErr) {
      console.error("Error during post-startup initialization:", initErr);
    }
  });
})();

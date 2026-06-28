import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import helmet from "helmet";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import {
  globalApiRateLimiter,
  botDetection,
  additionalSecurityHeaders,
  requireSessionForUploads,
} from "./security";

const app = express();

app.set("trust proxy", 1);

const isProduction = process.env.NODE_ENV === "production";

// ─────────────────────────────────────────────────────────────────────────────
// VALIDAÇÃO DA SESSION_SECRET
// Em produção, exige variável de ambiente obrigatória — sem fallback.
// ─────────────────────────────────────────────────────────────────────────────
const SESSION_SECRET = process.env.SESSION_SECRET;
if (isProduction && !SESSION_SECRET) {
  console.error(
    "[FATAL] SESSION_SECRET não definido. " +
    "Configure a variável de ambiente SESSION_SECRET com uma string aleatória de 64+ chars. " +
    "Gere com: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""
  );
  process.exit(1);
}
const sessionSecret =
  SESSION_SECRET ||
  "dev-only-secret-NOT-for-production-" + Math.random().toString(36);

if (!isProduction && !SESSION_SECRET) {
  console.warn(
    "[AVISO] SESSION_SECRET não definido. " +
    "Usando secret temporário de desenvolvimento. " +
    "Defina SESSION_SECRET no ambiente para sessões persistentes."
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELMET — Headers de segurança HTTP
// ─────────────────────────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // desabilitado pois o frontend usa inline styles (Tailwind/shadcn)
    crossOriginEmbedderPolicy: false, // necessário para PDFs e iframes
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// CORS — Restringe origens das requisições
// ─────────────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Em desenvolvimento: permite tudo
      if (!isProduction) return callback(null, true);

      // Sem origin (ex: chamadas server-to-server, curl): só bloqueia em prod se não vier de origens conhecidas
      if (!origin) return callback(null, false);

      // Sempre permite o próprio domínio Replit/Railway e dominios configurados.
      // OBS: os assets buildados são servidos com <script crossorigin>, o que faz
      // o navegador mandar Origin (mesmo same-origin) e EXIGIR Access-Control-Allow-Origin.
      // Sem liberar o domínio do Railway aqui, o CORS bloqueava o JS → tela branca.
      const replitPattern = /\.replit\.app$/;
      const railwayPattern = /\.up\.railway\.app$/;
      if (
        replitPattern.test(origin) ||
        railwayPattern.test(origin) ||
        allowedOrigins.some((allowed) => origin.includes(allowed))
      ) {
        return callback(null, true);
      }

      // Bloqueia outras origens em produção
      callback(new Error("Origem não permitida pelo CORS"));
    },
    credentials: true, // necessário para cookies de sessão
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// HEADERS ADICIONAIS DE SEGURANÇA
// ─────────────────────────────────────────────────────────────────────────────
app.use(additionalSecurityHeaders);

// ─────────────────────────────────────────────────────────────────────────────
// DETECÇÃO DE BOTS (aplica antes de qualquer rota /api)
// Rotas do Lemit Worker são isentas — têm autenticação própria por chave
// ─────────────────────────────────────────────────────────────────────────────
app.use("/api", botDetection);

// ─────────────────────────────────────────────────────────────────────────────
// RATE LIMITING GLOBAL (todas as rotas /api)
// ─────────────────────────────────────────────────────────────────────────────
app.use("/api", globalApiRateLimiter);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "50mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false, limit: "50mb" }));

import nodePath from "path";

// Static público (logos etc.) — não exige sessão
app.use(express.static(nodePath.join(process.cwd(), "public")));

// Assets do cliente buildado (JS/CSS hasheados) — servidos AQUI, ANTES do
// middleware de sessão. Arquivos estáticos não precisam de sessão; passar pela
// sessão fazia uma query no banco por request e, sob a rajada concorrente do
// carregamento da página (js+css+favicon juntos) + jobs em background, o pool
// esgotava e a query de sessão falhava → 500 em /assets/* → tela branca.
// `index: false` mantém o "/" passando pelo fluxo normal (check de tenant).
if (isProduction) {
  app.use(
    express.static(nodePath.join(import.meta.dirname, "public"), {
      index: false,
      maxAge: "1y",
      immutable: true,
    }),
  );
}
// NOTA: /uploads (protegido) é registrado DEPOIS do middleware de sessão,
// dentro do IIFE — caso contrário req.session ainda não existe e tudo cai em 401.

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
    secret: sessionSecret,
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

  // /uploads protegido — registrado AQUI (após a sessão) para que req.session exista.
  // Arquivos públicos (logos) passam pelo bypass dentro de requireSessionForUploads.
  app.use("/uploads", requireSessionForUploads);
  app.use("/uploads", express.static(nodePath.join(process.cwd(), "uploads")));

  if (!isProduction) {
    log("Using memory session store for development");
  }

  // Step 2: Register routes (no DB calls here, just route definitions)
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    // Em produção: mensagem genérica (não vaza stack trace)
    const message = isProduction
      ? status >= 500
        ? "Erro interno do servidor."
        : err.message || "Erro na requisição."
      : err.message || "Internal Server Error";
    res.status(status).json({ message });
    if (!isProduction) throw err;
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Step 3: Start listening FIRST — health check passes immediately
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    async () => {
      log(`serving on port ${port}`);

      // Step 4: Now do async initialization (DB seed, session store upgrade, background jobs)
      try {
        // Upgrade to PostgreSQL session store in production (async, non-blocking)
        if (isProduction && process.env.DATABASE_URL) {
          try {
            const pgSession = (await import("connect-pg-simple")).default;
            // Reaproveita o pool compartilhado do storage (SSL configurável por env),
            // em vez de criar um segundo pool com SSL fixo.
            const { pool } = await import("./storage");
            const PgStore = pgSession(session);
            const pgStore = new PgStore({
              pool,
              tableName: "session",
              createTableIfMissing: true,
            });
            // Swap the store on the existing session middleware
            (sessionMiddleware as any).store = pgStore;
            activeStore = pgStore;
            log("Upgraded to PostgreSQL session store");
          } catch (pgErr) {
            log(
              "Failed to initialize PostgreSQL session store, keeping memory store"
            );
            console.error(pgErr);
          }
        }

        // Auto-migrations (idempotentes — IF NOT EXISTS)
        try {
          const { db: migDb } = await import("./storage");
          const { sql: migSql } = await import("drizzle-orm");
          await migDb.execute(migSql`
            ALTER TABLE clientes_pessoa
              ADD COLUMN IF NOT EXISTS lemit_data JSONB,
              ADD COLUMN IF NOT EXISTS lemit_consultado_em TIMESTAMP
          `);
          await migDb.execute(migSql`
            CREATE TABLE IF NOT EXISTS lemit_jobs (
              id            SERIAL PRIMARY KEY,
              tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              pessoa_id     INTEGER REFERENCES clientes_pessoa(id) ON DELETE CASCADE,
              cpf           VARCHAR(20) NOT NULL,
              requested_by  INTEGER,
              status        VARCHAR(20) NOT NULL DEFAULT 'pending',
              error_msg     TEXT,
              created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
              started_at    TIMESTAMP,
              done_at       TIMESTAMP
            )
          `);
          await migDb.execute(migSql`CREATE INDEX IF NOT EXISTS idx_lemit_jobs_status ON lemit_jobs(status)`);
          await migDb.execute(migSql`CREATE INDEX IF NOT EXISTS idx_lemit_jobs_cpf ON lemit_jobs(cpf)`);
          // Storage de anexos no Supabase: chave do objeto por documento
          await migDb.execute(migSql`
            ALTER TABLE proposal_documents
              ADD COLUMN IF NOT EXISTS storage_key TEXT
          `);
          log("Lemit migration OK");
        } catch (migErr) {
          console.error("Lemit migration error (non-fatal):", migErr);
        }

        // Auto-migrations — Contratos (status configuráveis, fases, ADE refin)
        try {
          const { db: migDb } = await import("./storage");
          const { sql: migSql } = await import("drizzle-orm");

          await migDb.execute(migSql`
            ALTER TABLE proposals ADD COLUMN IF NOT EXISTS ade_refin VARCHAR(100)
          `);

          // Portabilidade — captura de origem/saldo/datas (dashboard Portabilidades)
          await migDb.execute(migSql`
            ALTER TABLE proposals
              ADD COLUMN IF NOT EXISTS banco_origem VARCHAR(255),
              ADD COLUMN IF NOT EXISTS saldo_informado DECIMAL(12,2),
              ADD COLUMN IF NOT EXISTS saldo_pago DECIMAL(12,2),
              ADD COLUMN IF NOT EXISTS data_cip TIMESTAMP,
              ADD COLUMN IF NOT EXISTS data_saldo TIMESTAMP
          `);

          await migDb.execute(migSql`
            CREATE TABLE IF NOT EXISTS contract_statuses (
              id                 SERIAL PRIMARY KEY,
              tenant_id          INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              key                VARCHAR(100) NOT NULL,
              label              VARCHAR(255) NOT NULL,
              color              VARCHAR(50) NOT NULL DEFAULT 'zinc',
              ordem              INTEGER NOT NULL DEFAULT 0,
              is_default         BOOLEAN NOT NULL DEFAULT false,
              allows_vendor_edit BOOLEAN NOT NULL DEFAULT false,
              created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
              UNIQUE(tenant_id, key)
            )
          `);
          await migDb.execute(migSql`
            ALTER TABLE contract_statuses ADD COLUMN IF NOT EXISTS allows_vendor_edit BOOLEAN NOT NULL DEFAULT false
          `);
          await migDb.execute(migSql`
            ALTER TABLE contract_statuses ADD COLUMN IF NOT EXISTS is_final BOOLEAN NOT NULL DEFAULT false
          `);
          await migDb.execute(migSql`
            ALTER TABLE contract_statuses ADD COLUMN IF NOT EXISTS return_status_key VARCHAR(100)
          `);
          await migDb.execute(migSql`
            ALTER TABLE proposal_documents ADD COLUMN IF NOT EXISTS storage_key TEXT
          `);
          await migDb.execute(migSql`
            CREATE TABLE IF NOT EXISTS partners (
              id         SERIAL PRIMARY KEY,
              tenant_id  INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              name       VARCHAR(255) NOT NULL,
              is_active  BOOLEAN NOT NULL DEFAULT true,
              created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          await migDb.execute(migSql`
            ALTER TABLE proposals ADD COLUMN IF NOT EXISTS parceiro_id INTEGER
          `);
          await migDb.execute(migSql`
            ALTER TABLE producoes_contratos ADD COLUMN IF NOT EXISTS proposal_id INTEGER
          `);
          await migDb.execute(migSql`
            ALTER TABLE proposals ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP
          `);
          await migDb.execute(migSql`
            ALTER TABLE proposals ADD COLUMN IF NOT EXISTS unificada_em_id INTEGER
          `);
          await migDb.execute(migSql`
            ALTER TABLE proposals ADD COLUMN IF NOT EXISTS valor_pre_unificacao DECIMAL(12,2)
          `);
          await migDb.execute(migSql`
            CREATE TABLE IF NOT EXISTS metas_digitacao_semanal (
              id                SERIAL PRIMARY KEY,
              tenant_id         INTEGER NOT NULL,
              semana_referencia DATE NOT NULL,
              meta              DECIMAL(14,2) NOT NULL DEFAULT 0,
              created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
              UNIQUE(tenant_id, semana_referencia)
            )
          `);

          await migDb.execute(migSql`
            CREATE TABLE IF NOT EXISTS contract_phases (
              id         SERIAL PRIMARY KEY,
              tenant_id  INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              name       VARCHAR(255) NOT NULL,
              color      VARCHAR(50) NOT NULL DEFAULT 'blue',
              statuses   TEXT[] NOT NULL DEFAULT '{}',
              ordem      INTEGER NOT NULL DEFAULT 0,
              created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          // API Keys externas
          await migDb.execute(migSql`
            CREATE TABLE IF NOT EXISTS api_keys (
              id                 SERIAL PRIMARY KEY,
              tenant_id          INTEGER NOT NULL,
              nome               VARCHAR(255) NOT NULL,
              chave_hash         VARCHAR(64) NOT NULL UNIQUE,
              prefixo            VARCHAR(12),
              ativo              BOOLEAN NOT NULL DEFAULT true,
              escopos            JSONB NOT NULL DEFAULT '["margens","contratos"]'::jsonb,
              ultimo_uso         TIMESTAMP,
              total_requisicoes  INTEGER NOT NULL DEFAULT 0,
              criado_por         INTEGER,
              created_at         TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          await migDb.execute(migSql`
            ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS escopos JSONB NOT NULL DEFAULT '["margens","contratos"]'::jsonb
          `);
          await migDb.execute(migSql`CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id)`);

          log("Contratos migration OK");
        } catch (migErr) {
          console.error("Contratos migration error (non-fatal):", migErr);
        }

        // Normaliza nomeCorretor para UPPER (elimina duplicatas de caixa)
        try {
          await migDb.execute(migSql`
            UPDATE producoes_contratos
            SET nome_corretor = UPPER(TRIM(nome_corretor))
            WHERE nome_corretor IS NOT NULL
              AND nome_corretor <> UPPER(TRIM(nome_corretor))
          `);
          log("nomeCorretor normalization OK");
        } catch (migErr) {
          console.error("nomeCorretor normalization error (non-fatal):", migErr);
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

        const { startAppointmentReminder } = await import(
          "./appointment-reminder"
        );
        startAppointmentReminder();
        log("Appointment reminder background runner started");

        // Portfolio cleanup: mark expired entries as EXPIRADO every 24h
        const { updateExpiredPortfolios } = await import("./portfolio");
        const runPortfolioCleanup = async () => {
          try {
            const count = await updateExpiredPortfolios();
            if (count > 0)
              log(
                `Portfolio cleanup: ${count} entradas marcadas como EXPIRADO`
              );
          } catch (err) {
            console.error("Portfolio cleanup error (non-fatal):", err);
          }
        };
        runPortfolioCleanup();
        setInterval(runPortfolioCleanup, 24 * 60 * 60 * 1000);
        log("Portfolio expiry cleanup runner started");
      } catch (initErr) {
        console.error("Error during post-startup initialization:", initErr);
      }
    }
  );
})();

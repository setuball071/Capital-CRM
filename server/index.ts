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

        // Auto-migrations — Onboarding do Entrante (espelha migrations/onboarding-entrante.sql)
        try {
          const { db: migDb } = await import("./storage");
          const { sql: migSql } = await import("drizzle-orm");
          await migDb.execute(migSql`
            ALTER TABLE vendedores_academia
              ADD COLUMN IF NOT EXISTS experiencia_declarada BOOLEAN,
              ADD COLUMN IF NOT EXISTS bagagem_origem VARCHAR(255),
              ADD COLUMN IF NOT EXISTS onboarding_etapa VARCHAR(30) NOT NULL DEFAULT 'entrada',
              ADD COLUMN IF NOT EXISTS tour_concluido BOOLEAN NOT NULL DEFAULT FALSE,
              ADD COLUMN IF NOT EXISTS produto_inicial VARCHAR(50) DEFAULT 'portabilidade',
              ADD COLUMN IF NOT EXISTS baseline_nota DECIMAL(5,2),
              ADD COLUMN IF NOT EXISTS baseline_nivel VARCHAR(30),
              ADD COLUMN IF NOT EXISTS liberado_para_prospectar BOOLEAN NOT NULL DEFAULT FALSE,
              ADD COLUMN IF NOT EXISTS liberado_em TIMESTAMP,
              ADD COLUMN IF NOT EXISTS liberado_por INTEGER REFERENCES users(id)
          `);
          await migDb.execute(migSql`
            ALTER TABLE quiz_tentativas ADD COLUMN IF NOT EXISTS origem VARCHAR(40)
          `);
          log("Onboarding migration OK");
        } catch (migErr) {
          console.error("Onboarding migration error (non-fatal):", migErr);
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
          // Recebimento de comissão via relatório de parceiro (D7/Gold/AMF/Bevi)
          await migDb.execute(migSql`
            ALTER TABLE producoes_contratos
              ADD COLUMN IF NOT EXISTS data_recebimento VARCHAR(20),
              ADD COLUMN IF NOT EXISTS parceiro_relatorio VARCHAR(100)
          `);
          // Proventos e Descontos — conta corrente interna do corretor
          await migDb.execute(migSql`
            CREATE TABLE IF NOT EXISTS lancamentos_corretor (
              id                SERIAL PRIMARY KEY,
              tenant_id         INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              data              VARCHAR(20) NOT NULL,
              nome_corretor     VARCHAR(255) NOT NULL,
              tipo              VARCHAR(20) NOT NULL,
              categoria         VARCHAR(100),
              valor             DECIMAL(14,2) NOT NULL,
              valor_compensado  DECIMAL(14,2) NOT NULL DEFAULT 0,
              observacao        TEXT,
              criado_por        INTEGER,
              criado_por_nome   VARCHAR(255),
              status            VARCHAR(30) NOT NULL DEFAULT 'Pendente',
              created_at        TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          await migDb.execute(migSql`
            CREATE TABLE IF NOT EXISTS lancamentos_compensacoes (
              id             SERIAL PRIMARY KEY,
              tenant_id      INTEGER NOT NULL,
              lancamento_id  INTEGER NOT NULL REFERENCES lancamentos_corretor(id) ON DELETE CASCADE,
              pagamento_id   INTEGER,
              valor          DECIMAL(14,2) NOT NULL,
              data           VARCHAR(20),
              usuario_id     INTEGER,
              usuario_nome   VARCHAR(255),
              created_at     TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          await migDb.execute(migSql`
            CREATE INDEX IF NOT EXISTS idx_lancamentos_corretor_tenant ON lancamentos_corretor(tenant_id, nome_corretor)
          `);
          // Campanhas: remove atribuições duplicadas (mesmo lead 2x na mesma campanha,
          // causado por distribuições concorrentes) — mantém a não-'novo' ou a mais antiga.
          // Depois cria índice único que impede novas duplicatas e recalcula contadores.
          await migDb.execute(migSql`
            DELETE FROM sales_lead_assignments WHERE id IN (
              SELECT id FROM (
                SELECT id, ROW_NUMBER() OVER (
                  PARTITION BY campaign_id, lead_id
                  ORDER BY CASE WHEN status <> 'novo' THEN 0 ELSE 1 END, id
                ) rn FROM sales_lead_assignments
              ) t WHERE rn > 1
            )
          `);
          await migDb.execute(migSql`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_sla_campanha_lead ON sales_lead_assignments(campaign_id, lead_id)
          `);
          await migDb.execute(migSql`
            UPDATE sales_campaigns c SET
              leads_distribuidos = (SELECT COUNT(*) FROM sales_lead_assignments a WHERE a.campaign_id = c.id),
              leads_disponiveis = GREATEST(0, c.total_leads - (SELECT COUNT(*) FROM sales_lead_assignments a WHERE a.campaign_id = c.id))
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
          // Acompanhamento operacional: última consulta do contrato no banco
          await migDb.execute(migSql`ALTER TABLE proposals ADD COLUMN IF NOT EXISTS ultima_consulta TIMESTAMP`);
          await migDb.execute(migSql`ALTER TABLE proposals ADD COLUMN IF NOT EXISTS ultima_consulta_por VARCHAR(255)`);
          // Material de apoio: suporte a arquivo enviado (Storage) além de link
          await migDb.execute(migSql`ALTER TABLE materials ADD COLUMN IF NOT EXISTS storage_key TEXT`);
          await migDb.execute(migSql`ALTER TABLE materials ADD COLUMN IF NOT EXISTS file_name TEXT`);
          await migDb.execute(migSql`ALTER TABLE materials ALTER COLUMN url DROP NOT NULL`);
          // Limpeza: zera a data CIP de propostas que NÃO estão num status de CIP.
          // O contador de CIP só vale enquanto aguardando o retorno; ao sair da fase a data fica obsoleta.
          // Guarda: só mexe em tenants que têm um status com "CIP" no rótulo (evita apagar em quem não usa CIP).
          // Auto-limitante: após rodar, essas linhas ficam sem dataCip → 0 linhas nos boots seguintes.
          await migDb.execute(migSql`
            UPDATE proposals p
            SET client_meta = p.client_meta - 'dataCip'
            WHERE (p.client_meta ->> 'dataCip') IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM contract_statuses cs2
                WHERE cs2.tenant_id = p.tenant_id AND lower(cs2.label) LIKE '%cip%'
              )
              AND p.status NOT IN (
                SELECT cs.key FROM contract_statuses cs
                WHERE cs.tenant_id = p.tenant_id AND lower(cs.label) LIKE '%cip%'
              )
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
          const { db: normDb } = await import("./storage");
          const { sql: normSql } = await import("drizzle-orm");
          await normDb.execute(normSql`
            UPDATE producoes_contratos
            SET nome_corretor = UPPER(TRIM(nome_corretor))
            WHERE nome_corretor IS NOT NULL
              AND nome_corretor <> UPPER(TRIM(nome_corretor))
          `);
          log("nomeCorretor normalization OK");
        } catch (migErr) {
          console.error("nomeCorretor normalization error (non-fatal):", migErr);
        }

        // Simulador de portabilidade: novos campos em regras de bancos + cotações salvas
        try {
          const { db: simMigDb } = await import("./storage");
          const { sql: simMigSql } = await import("drizzle-orm");
          await simMigDb.execute(simMigSql`
            ALTER TABLE portability_bank_rules
              ADD COLUMN IF NOT EXISTS pagas_min_portar INTEGER DEFAULT 0,
              ADD COLUMN IF NOT EXISTS pagas_min_remunerar INTEGER DEFAULT 0,
              ADD COLUMN IF NOT EXISTS une_saldo_negativo BOOLEAN DEFAULT FALSE,
              ADD COLUMN IF NOT EXISTS excecoes_origem JSONB
          `);
          await simMigDb.execute(simMigSql`
            CREATE TABLE IF NOT EXISTS cotacoes_simulador (
              id           SERIAL PRIMARY KEY,
              tenant_id    INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              user_id      INTEGER,
              cpf          VARCHAR(20) NOT NULL,
              nome_cliente VARCHAR(255),
              descricao    VARCHAR(500),
              dados        JSONB NOT NULL,
              criado_em    TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          await simMigDb.execute(simMigSql`CREATE INDEX IF NOT EXISTS idx_cotacoes_sim_cpf ON cotacoes_simulador(tenant_id, cpf)`);
          log("Simulador migration OK");
        } catch (migErr) {
          console.error("Simulador migration error (non-fatal):", migErr);
        }

        // ===== IA INTERNA (MASCOTE) — base de conhecimento =====
        try {
          const { db: migDb } = await import("./storage");
          const { sql: migSql } = await import("drizzle-orm");
          // pgvector: no Supabase a extensão vive no schema "extensions" (que está no search_path)
          try {
            await migDb.execute(migSql`CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions`);
          } catch {
            await migDb.execute(migSql`CREATE EXTENSION IF NOT EXISTS vector`);
          }
          await migDb.execute(migSql`
            CREATE TABLE IF NOT EXISTS kb_artigos (
              id            SERIAL PRIMARY KEY,
              tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              titulo        VARCHAR(255) NOT NULL,
              conteudo      TEXT NOT NULL,
              categoria     VARCHAR(30) NOT NULL,
              banco         VARCHAR(100),
              status        VARCHAR(20) NOT NULL DEFAULT 'rascunho',
              origem        VARCHAR(30) NOT NULL DEFAULT 'manual',
              origem_ref    VARCHAR(100),
              criado_por    INTEGER REFERENCES users(id),
              created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
              updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          await migDb.execute(migSql`
            CREATE TABLE IF NOT EXISTS kb_chunks (
              id            SERIAL PRIMARY KEY,
              artigo_id     INTEGER NOT NULL REFERENCES kb_artigos(id) ON DELETE CASCADE,
              ordem         INTEGER NOT NULL DEFAULT 0,
              texto         TEXT NOT NULL,
              embedding     vector(768),
              created_at    TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          await migDb.execute(migSql`
            CREATE INDEX IF NOT EXISTS kb_chunks_embedding_idx ON kb_chunks
              USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50)
          `);
          await migDb.execute(migSql`CREATE INDEX IF NOT EXISTS kb_chunks_artigo_idx ON kb_chunks(artigo_id)`);
          await migDb.execute(migSql`
            CREATE TABLE IF NOT EXISTS kb_sugestoes (
              id                     SERIAL PRIMARY KEY,
              tenant_id              INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              titulo_proposto        VARCHAR(255) NOT NULL,
              conteudo_proposto      TEXT NOT NULL,
              categoria_proposta     VARCHAR(30),
              banco_proposto         VARCHAR(100),
              origem                 VARCHAR(30) NOT NULL,
              origem_ref             VARCHAR(100),
              payload_bruto          TEXT,
              artigo_conflitante_id  INTEGER REFERENCES kb_artigos(id) ON DELETE SET NULL,
              status                 VARCHAR(20) NOT NULL DEFAULT 'pendente',
              decidido_por           INTEGER REFERENCES users(id),
              decidido_em            TIMESTAMP,
              criado_por             INTEGER REFERENCES users(id),
              created_at             TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          await migDb.execute(migSql`
            CREATE TABLE IF NOT EXISTS assistente_conversas (
              id            SERIAL PRIMARY KEY,
              tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              iniciada_em   TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          await migDb.execute(migSql`
            CREATE TABLE IF NOT EXISTS assistente_mensagens (
              id            SERIAL PRIMARY KEY,
              conversa_id   INTEGER NOT NULL REFERENCES assistente_conversas(id) ON DELETE CASCADE,
              role          VARCHAR(10) NOT NULL,
              conteudo      TEXT NOT NULL,
              chunks_usados JSONB,
              tokens        INTEGER,
              feedback      VARCHAR(5),
              sem_resposta  BOOLEAN NOT NULL DEFAULT FALSE,
              criada_em     TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          await migDb.execute(migSql`CREATE INDEX IF NOT EXISTS idx_kb_sugestoes_status ON kb_sugestoes(tenant_id, status)`);
          await migDb.execute(migSql`CREATE INDEX IF NOT EXISTS idx_assistente_msgs_conversa ON assistente_mensagens(conversa_id)`);
          log("✓ Migração IA interna (kb_*, assistente_*) ok");
        } catch (e) {
          log(`⚠ Migração IA interna falhou (non-fatal): ${e}`);
        }

        // ===== JARVIS — canal de avisos de contrato =====
        try {
          const { db: avDb } = await import("./storage");
          const { sql: avSql } = await import("drizzle-orm");
          await avDb.execute(avSql`
            CREATE TABLE IF NOT EXISTS assistente_avisos (
              id          SERIAL PRIMARY KEY,
              tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              tipo        VARCHAR(30) NOT NULL,
              titulo      VARCHAR(255) NOT NULL,
              mensagem    TEXT NOT NULL,
              proposal_id INTEGER,
              lida        BOOLEAN NOT NULL DEFAULT FALSE,
              criada_em   TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          await avDb.execute(avSql`CREATE INDEX IF NOT EXISTS idx_assistente_avisos_user ON assistente_avisos(user_id, lida)`);
          log("✓ Migração assistente_avisos ok");
        } catch (e) {
          log(`⚠ Migração assistente_avisos falhou (non-fatal): ${e}`);
        }

        // ===== ADMIN SAAS — Fase 1: interno, planos/módulos, Asaas =====
        try {
          const { db: saasDb } = await import("./storage");
          const { sql: saasSql } = await import("drizzle-orm");
          await saasDb.execute(saasSql`
            ALTER TABLE tenants
              ADD COLUMN IF NOT EXISTS interno BOOLEAN NOT NULL DEFAULT false,
              ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT
          `);
          // Capital Go (tenant 4) é o ambiente interno do dono — time próprio, não paga assinatura
          await saasDb.execute(saasSql`UPDATE tenants SET interno = true WHERE id = 4 AND interno = false`);
          await saasDb.execute(saasSql`
            CREATE TABLE IF NOT EXISTS planos (
              id            SERIAL PRIMARY KEY,
              tenant_id     INTEGER,
              nome          VARCHAR(100) NOT NULL,
              descricao     TEXT,
              preco_mensal  DECIMAL(10,2) NOT NULL DEFAULT 0,
              ativo         BOOLEAN NOT NULL DEFAULT true,
              created_at    TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          await saasDb.execute(saasSql`
            CREATE TABLE IF NOT EXISTS plano_modulos (
              plano_id   INTEGER NOT NULL REFERENCES planos(id) ON DELETE CASCADE,
              modulo_key VARCHAR(50) NOT NULL,
              PRIMARY KEY (plano_id, modulo_key)
            )
          `);
          await saasDb.execute(saasSql`
            CREATE TABLE IF NOT EXISTS tenant_modulos (
              tenant_id  INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              modulo_key VARCHAR(50) NOT NULL,
              ativo      BOOLEAN NOT NULL DEFAULT true,
              PRIMARY KEY (tenant_id, modulo_key)
            )
          `);
          await saasDb.execute(saasSql`
            CREATE TABLE IF NOT EXISTS cobrancas (
              id          SERIAL PRIMARY KEY,
              tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              tipo        VARCHAR(20) NOT NULL,
              ref_id      INTEGER,
              asaas_id    TEXT,
              valor       DECIMAL(10,2) NOT NULL,
              status      VARCHAR(30) NOT NULL DEFAULT 'pendente',
              metodo      VARCHAR(30),
              vencimento  DATE,
              pago_em     TIMESTAMP,
              created_at  TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          await saasDb.execute(saasSql`CREATE INDEX IF NOT EXISTS idx_cobrancas_tenant ON cobrancas(tenant_id)`);
          await saasDb.execute(saasSql`CREATE INDEX IF NOT EXISTS idx_cobrancas_asaas ON cobrancas(asaas_id)`);
          // Central de Atualizações: aviso de nível plataforma alcança usuários de todos os ambientes
          await saasDb.execute(saasSql`
            ALTER TABLE system_updates ADD COLUMN IF NOT EXISTS nivel VARCHAR(20) NOT NULL DEFAULT 'tenant'
          `);
          log("✓ Migração Admin SaaS (interno/planos/tenant_modulos/cobrancas) ok");
        } catch (e) {
          log(`⚠ Migração Admin SaaS falhou (non-fatal): ${e}`);
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

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
  requireSessionForSimuladores,
  ehSimuladorProtegido,
  SIMULADORES_PROTEGIDOS,
} from "./security";
import nodeFs from "fs";

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
  cors((req: any, callback: (err: Error | null, options?: any) => void) => {
    const origin = req.headers.origin as string | undefined;
    const base = {
      credentials: true, // necessário para cookies de sessão
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    };

    // Em desenvolvimento: permite tudo
    if (!isProduction) return callback(null, { ...base, origin: true });

    // Sem origin (ex: chamadas server-to-server, curl): só bloqueia em prod se não vier de origens conhecidas
    if (!origin) return callback(null, { ...base, origin: false });

    // Sempre permite o próprio domínio Replit/Railway e dominios configurados.
    // OBS: os assets buildados são servidos com <script crossorigin>, o que faz
    // o navegador mandar Origin (mesmo same-origin) e EXIGIR Access-Control-Allow-Origin.
    // Sem liberar o domínio do Railway aqui, o CORS bloqueava o JS → tela branca.
    //
    // Como cada cliente tem o SEU domínio (app.consigcore.com.br, crm.empresa...),
    // lista fixa nunca daria conta: se o Origin é o mesmo host da requisição,
    // é same-origin de fato e não há nada de cross-origin para barrar.
    let mesmoHost = false;
    try {
      mesmoHost = new URL(origin).host === req.headers.host;
    } catch {
      // Origin malformado: cai nas regras abaixo.
    }

    const replitPattern = /\.replit\.app$/;
    const railwayPattern = /\.up\.railway\.app$/;
    if (
      mesmoHost ||
      replitPattern.test(origin) ||
      railwayPattern.test(origin) ||
      allowedOrigins.some((allowed) => origin.includes(allowed))
    ) {
      return callback(null, { ...base, origin: true });
    }

    // Bloqueia outras origens em produção
    callback(new Error("Origem não permitida pelo CORS"));
  }),
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

// Os simuladores saem daqui: sao servidos mais abaixo, ja depois da sessao.
// Sem este desvio o express.static entregaria o arquivo antes do guard rodar.
const semSimuladores =
  (mw: any) => (req: Request, res: Response, next: NextFunction) =>
    ehSimuladorProtegido(req.path) ? next() : mw(req, res, next);

// Static público (logos etc.) — não exige sessão
app.use(semSimuladores(express.static(nodePath.join(process.cwd(), "public"))));

// Assets do cliente buildado (JS/CSS hasheados) — servidos AQUI, ANTES do
// middleware de sessão. Arquivos estáticos não precisam de sessão; passar pela
// sessão fazia uma query no banco por request e, sob a rajada concorrente do
// carregamento da página (js+css+favicon juntos) + jobs em background, o pool
// esgotava e a query de sessão falhava → 500 em /assets/* → tela branca.
// `index: false` mantém o "/" passando pelo fluxo normal (check de tenant).
if (isProduction) {
  app.use(
    semSimuladores(express.static(nodePath.join(import.meta.dirname, "public"), {
      index: false,
      // Assets com hash no nome (JS/CSS/imgs em /assets) são imutáveis → cache longo.
      // HTML (ex.: simuladores em client/public) NÃO pode ser immutable, senão o
      // navegador trava numa versão por 1 ano e nem hard refresh atualiza.
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache");
        } else {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    })),
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

  // Simuladores — registrados AQUI, depois da sessao, para o guard ver req.session.
  // Vem antes do vite/serveStatic, entao ganham deles tambem em desenvolvimento.
  app.get(SIMULADORES_PROTEGIDOS, requireSessionForSimuladores, (req, res, next) => {
    const nome = nodePath.basename(req.path);
    const candidatos = [
      nodePath.join(import.meta.dirname, "public", nome),   // build de producao
      nodePath.join(process.cwd(), "public", nome),
      nodePath.join(process.cwd(), "client", "public", nome),
    ];
    const achado = candidatos.find((p) => nodeFs.existsSync(p));
    if (!achado) return next();
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(achado);
  });

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
      // reusePort não existe no Windows (ENOTSUP) e derruba o `npm run dev` local;
      // no Linux do Railway segue ligado como antes.
      reusePort: process.platform !== "win32",
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
          // Controle individual de produção e comissões (módulo do vendedor individual)
          await migDb.execute(migSql`
            ALTER TABLE vendedor_contratos
              ADD COLUMN IF NOT EXISTS comissao_prevista        NUMERIC(10,2),
              ADD COLUMN IF NOT EXISTS comissao_recebida        NUMERIC(10,2),
              ADD COLUMN IF NOT EXISTS data_prevista_pagamento  DATE,
              ADD COLUMN IF NOT EXISTS data_recebimento         DATE,
              ADD COLUMN IF NOT EXISTS parceiro_nome            VARCHAR(150),
              ADD COLUMN IF NOT EXISTS data_pagamento_contrato  DATE
          `);
          await migDb.execute(migSql`
            CREATE TABLE IF NOT EXISTS minha_producao_parceiros (
              id          SERIAL PRIMARY KEY,
              tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              vendedor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              nome        VARCHAR(150) NOT NULL,
              created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
              CONSTRAINT uq_minha_producao_parceiro UNIQUE (tenant_id, vendedor_id, nome)
            )
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

        // Auto-migrations — Modelos de permissão (espelha migrations/user-permission-templates.sql)
        try {
          const { db: migDb } = await import("./storage");
          const { sql: migSql } = await import("drizzle-orm");
          await migDb.execute(migSql`
            CREATE TABLE IF NOT EXISTS user_permission_templates (
              id          SERIAL PRIMARY KEY,
              tenant_id   INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
              nome        VARCHAR(120) NOT NULL,
              role        VARCHAR(50) NOT NULL,
              permissions JSONB NOT NULL,
              created_by  INTEGER REFERENCES users(id),
              created_at  TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          log("Permission templates migration OK");
        } catch (migErr) {
          console.error("Permission templates migration error (non-fatal):", migErr);
        }

        // Auto-migrations — ASSINATURA POR USUARIO (substitui a por ambiente).
        // Tres conceitos separados: a assinatura (plano, preco, vencimento,
        // desconto, regras), cada cobranca mensal (com boleto e quitacao) e o
        // registro de eventos (quem fez o que, com valor anterior e novo).
        // As tabelas antigas (subscriptions/cobrancas) ficam intactas: cobrancas
        // tambem atende compra de lista avulsa e nao deve misturar com mensalidade.
        try {
          const { db: migDb } = await import("./storage");
          const { sql: migSql } = await import("drizzle-orm");
          await migDb.execute(migSql`
            CREATE TABLE IF NOT EXISTS assinaturas (
              id                          SERIAL PRIMARY KEY,
              user_id                     INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
              plano_id                    INTEGER REFERENCES planos(id),
              status                      VARCHAR(30) NOT NULL DEFAULT 'ativa',
              valor_mensal                NUMERIC(12,2) NOT NULL DEFAULT 0,
              dia_vencimento              INTEGER NOT NULL DEFAULT 10,
              data_inicio                 DATE NOT NULL DEFAULT CURRENT_DATE,
              proximo_vencimento          DATE,
              desconto_tipo               VARCHAR(12),
              desconto_valor              NUMERIC(12,2),
              desconto_inicio             DATE,
              desconto_fim                DATE,
              desconto_parcelas_restantes INTEGER,
              desconto_motivo             TEXT,
              tolerancia_dias             INTEGER NOT NULL DEFAULT 3,
              suspensao_automatica        BOOLEAN NOT NULL DEFAULT true,
              forma_pagamento             VARCHAR(30),
              isenta_ate                  DATE,
              observacoes                 TEXT,
              criado_por                  INTEGER REFERENCES users(id),
              created_at                  TIMESTAMP NOT NULL DEFAULT NOW(),
              updated_at                  TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          await migDb.execute(migSql`
            CREATE TABLE IF NOT EXISTS assinatura_cobrancas (
              id                   SERIAL PRIMARY KEY,
              assinatura_id        INTEGER NOT NULL REFERENCES assinaturas(id) ON DELETE CASCADE,
              user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              competencia          VARCHAR(7) NOT NULL,
              valor_original       NUMERIC(12,2) NOT NULL,
              desconto             NUMERIC(12,2) NOT NULL DEFAULT 0,
              acrescimo            NUMERIC(12,2) NOT NULL DEFAULT 0,
              valor_final          NUMERIC(12,2) NOT NULL,
              emitida_em           TIMESTAMP NOT NULL DEFAULT NOW(),
              vencimento           DATE NOT NULL,
              status               VARCHAR(20) NOT NULL DEFAULT 'aberta',
              pago_em              DATE,
              valor_pago           NUMERIC(12,2),
              forma_pagamento      VARCHAR(30),
              boleto_arquivo       VARCHAR(500),
              boleto_link          TEXT,
              linha_digitavel      VARCHAR(120),
              pix_copia_cola       TEXT,
              comprovante_arquivo  VARCHAR(500),
              observacoes          TEXT,
              created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
              updated_at           TIMESTAMP NOT NULL DEFAULT NOW(),
              UNIQUE (assinatura_id, competencia)
            )
          `);
          await migDb.execute(migSql`
            CREATE TABLE IF NOT EXISTS assinatura_eventos (
              id            SERIAL PRIMARY KEY,
              assinatura_id INTEGER REFERENCES assinaturas(id) ON DELETE CASCADE,
              cobranca_id   INTEGER REFERENCES assinatura_cobrancas(id) ON DELETE SET NULL,
              titular_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
              acao          VARCHAR(40) NOT NULL,
              antes         JSONB,
              depois        JSONB,
              por_user_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
              criado_em     TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          await migDb.execute(migSql`
            CREATE INDEX IF NOT EXISTS idx_assinatura_cobrancas_aberta
              ON assinatura_cobrancas (assinatura_id, status, vencimento)
          `);
          await migDb.execute(migSql`
            CREATE INDEX IF NOT EXISTS idx_assinatura_eventos_assinatura
              ON assinatura_eventos (assinatura_id, criado_em DESC)
          `);
          log("Assinatura por usuario migration OK");
        } catch (migErr) {
          console.error("Assinatura por usuario migration error (non-fatal):", migErr);
        }

        // Auto-migrations — rotina diaria de assinaturas.
        // rotina_execucoes reserva o DIA antes de rodar (UNIQUE rotina+data):
        // setInterval sozinho nao serve, porque cada deploy zera o contador e
        // duas instancias rodariam em dobro.
        // assinatura_avisos_enviados: cada aviso sai uma vez por mensalidade.
        try {
          const { db: migDb } = await import("./storage");
          const { sql: migSql } = await import("drizzle-orm");
          await migDb.execute(migSql`
            CREATE TABLE IF NOT EXISTS rotina_execucoes (
              id            SERIAL PRIMARY KEY,
              rotina        VARCHAR(60) NOT NULL,
              data          DATE NOT NULL,
              origem        VARCHAR(20) NOT NULL DEFAULT 'agendada',
              iniciada_em   TIMESTAMP NOT NULL DEFAULT NOW(),
              terminada_em  TIMESTAMP,
              resultado     JSONB,
              erro          TEXT
            )
          `);
          // Trava so a execucao agendada: a manual (botao do master) pode repetir.
          await migDb.execute(migSql`
            CREATE UNIQUE INDEX IF NOT EXISTS rotina_execucoes_agendada_uq
              ON rotina_execucoes (rotina, data) WHERE origem = 'agendada'
          `);
          await migDb.execute(migSql`
            CREATE TABLE IF NOT EXISTS assinatura_avisos_enviados (
              id             SERIAL PRIMARY KEY,
              assinatura_id  INTEGER NOT NULL REFERENCES assinaturas(id) ON DELETE CASCADE,
              cobranca_id    INTEGER REFERENCES assinatura_cobrancas(id) ON DELETE CASCADE,
              tipo           VARCHAR(40) NOT NULL,
              enviado_em     TIMESTAMP NOT NULL DEFAULT NOW(),
              UNIQUE (cobranca_id, tipo)
            )
          `);
          // Dados do pagador para emitir o boleto no banco (copiar e colar).
          await migDb.execute(migSql`
            ALTER TABLE assinaturas
              ADD COLUMN IF NOT EXISTS pagador_nome VARCHAR(200),
              ADD COLUMN IF NOT EXISTS pagador_documento VARCHAR(30),
              ADD COLUMN IF NOT EXISTS pagador_email VARCHAR(200),
              ADD COLUMN IF NOT EXISTS pagador_telefone VARCHAR(30)
          `);
          // "Ja paguei" do titular fica marcado na mensalidade (sinal na central).
          await migDb.execute(migSql`
            ALTER TABLE assinatura_cobrancas ADD COLUMN IF NOT EXISTS pagamento_informado_em TIMESTAMP
          `);
          // Chave geral da suspensao automatica (comeca DESLIGADA = simulacao).
          await migDb.execute(migSql`
            CREATE TABLE IF NOT EXISTS assinatura_config (
              chave       VARCHAR(60) PRIMARY KEY,
              valor       JSONB,
              updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
              updated_by  INTEGER
            )
          `);
          log("Rotina de assinaturas migration OK");
        } catch (migErr) {
          console.error("Rotina de assinaturas migration error (non-fatal):", migErr);
        }

        // Auto-migrations — libera sessao simultanea para UM usuario especifico.
        // Excecao por pessoa, nao por ambiente: desligar a trava do ambiente
        // inteiro abriria a porta para todos os acessos dele.
        try {
          const { db: migDb } = await import("./storage");
          const { sql: migSql } = await import("drizzle-orm");
          await migDb.execute(migSql`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS sessao_simultanea BOOLEAN NOT NULL DEFAULT false
          `);
          log("Sessao simultanea por usuario migration OK");
        } catch (migErr) {
          console.error("Sessao simultanea migration error (non-fatal):", migErr);
        }

        // Auto-migrations — preferencias do usuario (ordem das abas etc).
        // Coluna generica de proposito: a proxima preferencia nao precisa de
        // outra migracao nem de outra coluna.
        try {
          const { db: migDb } = await import("./storage");
          const { sql: migSql } = await import("drizzle-orm");
          await migDb.execute(migSql`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS preferencias JSONB NOT NULL DEFAULT '{}'::jsonb
          `);
          log("Preferencias do usuario migration OK");
        } catch (migErr) {
          console.error("Preferencias migration error (non-fatal):", migErr);
        }

        // Auto-migrations — sessao ativa do usuario no BANCO. Antes vivia so num
        // Map em memoria, que morre a cada deploy: ate ser repovoado, varias
        // sessoes simultaneas voltavam a passar.
        try {
          const { db: migDb } = await import("./storage");
          const { sql: migSql } = await import("drizzle-orm");
          await migDb.execute(migSql`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS active_session_id VARCHAR(255)
          `);
          log("Sessao ativa persistida migration OK");
        } catch (migErr) {
          console.error("Sessao ativa migration error (non-fatal):", migErr);
        }

        // Auto-migrations — FONTE do telefone e aviso de NAO ME PERTURBE.
        // A ficha mostra a origem ao passar o mouse (LEMIT / ANATEL / SERASA;
        // vazio = ANATEL) e um "!" quando o numero esta no cadastro Nao Me
        // Perturbe. E so aviso: nada bloqueia o numero. A marcacao vem do
        // Bigdata (Bigdata/_scripts/marcar_telefones_crm.py), que guarda a
        // lista de 16 milhoes -- ela nao sobe inteira para nao pesar no disco.
        try {
          const { db: migDb } = await import("./storage");
          const { sql: migSql } = await import("drizzle-orm");
          await migDb.execute(migSql`
            ALTER TABLE clientes_telefones
              ADD COLUMN IF NOT EXISTS fonte VARCHAR(20),
              ADD COLUMN IF NOT EXISTS nao_perturbe BOOLEAN NOT NULL DEFAULT FALSE
          `);
          await migDb.execute(migSql`
            ALTER TABLE client_contacts
              ADD COLUMN IF NOT EXISTS nao_perturbe BOOLEAN NOT NULL DEFAULT FALSE
          `);
          log("Telefone fonte / nao_perturbe migration OK");
        } catch (migErr) {
          console.error("Telefone fonte / nao_perturbe migration error (non-fatal):", migErr);
        }

        // Auto-migrations — meta por PRODUCAO ou por RENTABILIDADE.
        // Nasce sempre 'producao' para que toda meta ja existente continue
        // significando exatamente o que significava antes.
        try {
          const { db: migDb } = await import("./storage");
          const { sql: migSql } = await import("drizzle-orm");
          for (const tabela of ["metas_equipe", "metas_individuais"]) {
            await migDb.execute(migSql`
              ALTER TABLE ${migSql.raw(tabela)}
              ADD COLUMN IF NOT EXISTS tipo_meta VARCHAR(20) NOT NULL DEFAULT 'producao'
            `);
          }
          await migDb.execute(migSql`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS meta_tipo VARCHAR(20) NOT NULL DEFAULT 'producao'
          `);
          log("Tipo de meta (producao/rentabilidade) migration OK");
        } catch (migErr) {
          console.error("Tipo de meta migration error (non-fatal):", migErr);
        }

        // Auto-migrations — pedidos_lista nasceu SEM ambiente: a tela de Filtros de
        // Base mostrava os pedidos de todos os clientes para qualquer um, com os
        // filtros usados, o volume e o valor pago. Coluna nova + preenchimento dos
        // antigos pelo ambiente de quem pediu.
        try {
          const { db: migDb } = await import("./storage");
          const { sql: migSql } = await import("drizzle-orm");
          await migDb.execute(migSql`
            ALTER TABLE pedidos_lista ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id)
          `);
          await migDb.execute(migSql`
            UPDATE pedidos_lista p SET tenant_id = sub.tenant_id
            FROM (
              SELECT ut.user_id, MIN(ut.tenant_id) AS tenant_id
              FROM user_tenants ut GROUP BY ut.user_id
            ) sub
            WHERE p.tenant_id IS NULL AND sub.user_id = p.coordenador_id
          `);
          await migDb.execute(migSql`
            CREATE INDEX IF NOT EXISTS idx_pedidos_lista_tenant ON pedidos_lista (tenant_id, criado_em DESC)
          `);
          log("Pedidos lista tenant_id migration OK");
        } catch (migErr) {
          console.error("Pedidos lista tenant_id migration error (non-fatal):", migErr);
        }

        // Auto-migrations — Confirmacao de conferencia antes de gerar proposta.
        // Guarda QUEM confirmou, QUANDO e qual versao do aviso estava no ar, para
        // a empresa conseguir provar depois que o corretor foi alertado.
        try {
          const { db: migDb } = await import("./storage");
          const { sql: migSql } = await import("drizzle-orm");
          await migDb.execute(migSql`
            CREATE TABLE IF NOT EXISTS confirmacoes_documento (
              id            SERIAL PRIMARY KEY,
              tenant_id     INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
              user_id       INTEGER REFERENCES users(id),
              tipo          VARCHAR(60) NOT NULL,
              versao_aviso  VARCHAR(40) NOT NULL,
              referencia    VARCHAR(120),
              ip            VARCHAR(60),
              criado_em     TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          await migDb.execute(migSql`
            CREATE INDEX IF NOT EXISTS idx_confirmacoes_documento_tenant_data
              ON confirmacoes_documento (tenant_id, criado_em DESC)
          `);
          log("Confirmacoes de documento migration OK");
        } catch (migErr) {
          console.error("Confirmacoes de documento migration error (non-fatal):", migErr);
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
          // Portabilidade com refin na mesma operação: a produção deve usar a ADE do
          // refin (é a que consta no relatório de comissão). Corrige registros já pagos
          // que ficaram com a ADE da portabilidade. Idempotente e evita colisão com o
          // índice único (contrato_id, tenant_id).
          await migDb.execute(migSql`
            UPDATE producoes_contratos pc
            SET contrato_id = pa.ade_refin
            FROM proposals pa
            WHERE pc.proposal_id = pa.id
              AND pa.ade_refin IS NOT NULL AND pa.ade_refin <> ''
              AND pc.contrato_id = pa.ade
              AND pc.contrato_id <> pa.ade_refin
              AND NOT EXISTS (
                SELECT 1 FROM producoes_contratos p2
                WHERE p2.tenant_id = pc.tenant_id AND p2.contrato_id = pa.ade_refin AND p2.id <> pc.id
              )
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
          // ── Financeiro Empresarial: caixa, contas a pagar, planejamento ──
          await migDb.execute(migSql`
            CREATE TABLE IF NOT EXISTS fin_contas_bancarias (
              id                 SERIAL PRIMARY KEY,
              tenant_id          INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              nome               VARCHAR(100) NOT NULL,
              banco              VARCHAR(100),
              cor                VARCHAR(20) DEFAULT '#7c3aed',
              saldo_inicial      DECIMAL(14,2) NOT NULL DEFAULT 0,
              data_saldo_inicial VARCHAR(10),
              ativa              BOOLEAN NOT NULL DEFAULT true,
              created_at         TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          await migDb.execute(migSql`
            CREATE TABLE IF NOT EXISTS fin_categorias (
              id          SERIAL PRIMARY KEY,
              tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              nome        VARCHAR(100) NOT NULL,
              tipo        VARCHAR(10) NOT NULL,
              cor         VARCHAR(20) DEFAULT '#6b7280',
              teto_mensal DECIMAL(14,2),
              created_at  TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          await migDb.execute(migSql`
            ALTER TABLE fin_categorias ADD COLUMN IF NOT EXISTS especial VARCHAR(20)
          `);
          await migDb.execute(migSql`
            CREATE TABLE IF NOT EXISTS fin_regras_categorizacao (
              id           SERIAL PRIMARY KEY,
              tenant_id    INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              padrao_texto VARCHAR(255) NOT NULL,
              categoria_id INTEGER NOT NULL REFERENCES fin_categorias(id) ON DELETE CASCADE,
              created_at   TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          await migDb.execute(migSql`
            CREATE TABLE IF NOT EXISTS fin_lancamentos (
              id             SERIAL PRIMARY KEY,
              tenant_id      INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              conta_id       INTEGER NOT NULL REFERENCES fin_contas_bancarias(id) ON DELETE CASCADE,
              data           VARCHAR(10) NOT NULL,
              valor          DECIMAL(14,2) NOT NULL,
              descricao      TEXT,
              fitid          VARCHAR(255),
              categoria_id   INTEGER REFERENCES fin_categorias(id) ON DELETE SET NULL,
              conta_pagar_id INTEGER,
              origem         VARCHAR(20) NOT NULL DEFAULT 'ofx',
              created_at     TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          await migDb.execute(migSql`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_fin_lanc_fitid ON fin_lancamentos(conta_id, fitid)
          `);
          await migDb.execute(migSql`
            CREATE INDEX IF NOT EXISTS idx_fin_lanc_tenant_data ON fin_lancamentos(tenant_id, data)
          `);
          await migDb.execute(migSql`
            CREATE TABLE IF NOT EXISTS fin_contas_pagar (
              id                 SERIAL PRIMARY KEY,
              tenant_id          INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              descricao          VARCHAR(255) NOT NULL,
              fornecedor         VARCHAR(255),
              categoria_id       INTEGER REFERENCES fin_categorias(id) ON DELETE SET NULL,
              conta_id           INTEGER REFERENCES fin_contas_bancarias(id) ON DELETE SET NULL,
              valor              DECIMAL(14,2) NOT NULL,
              vencimento         VARCHAR(10) NOT NULL,
              tipo               VARCHAR(20) NOT NULL DEFAULT 'avista',
              parcela_num        INTEGER,
              parcela_total      INTEGER,
              grupo_parcelamento VARCHAR(50),
              recorrente         BOOLEAN NOT NULL DEFAULT false,
              status             VARCHAR(20) NOT NULL DEFAULT 'aberta',
              data_pagamento     VARCHAR(10),
              lancamento_id      INTEGER,
              boleto_codigo      VARCHAR(60),
              observacao         TEXT,
              criado_por         INTEGER,
              created_at         TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          await migDb.execute(migSql`
            CREATE INDEX IF NOT EXISTS idx_fin_cp_tenant_venc ON fin_contas_pagar(tenant_id, vencimento)
          `);
          await migDb.execute(migSql`
            ALTER TABLE fin_contas_pagar ADD COLUMN IF NOT EXISTS valor_pago DECIMAL(14,2)
          `);
          // Contratos transferidos DEPOIS de pagos ficavam com o corretor antigo na
          // produção (esteira mostrava um nome, financeiro outro). Realinha pelo
          // vendedor atual da proposta vinculada.
          await migDb.execute(migSql`
            UPDATE producoes_contratos pc
            SET vendedor_id = pa.vendor_id,
                vendedor_nome = u.name,
                nome_corretor = UPPER(TRIM(u.name))
            FROM proposals pa
            JOIN users u ON u.id = pa.vendor_id
            WHERE pc.proposal_id = pa.id
              AND pc.tenant_id = pa.tenant_id
              AND pa.vendor_id IS NOT NULL
              AND (pc.vendedor_id IS DISTINCT FROM pa.vendor_id)
          `);
          // Recebimento parcial: parceiro abate estorno/acordo da comissão.
          await migDb.execute(migSql`
            ALTER TABLE producoes_contratos ADD COLUMN IF NOT EXISTS valor_recebido DECIMAL(14,2)
          `);
          await migDb.execute(migSql`
            ALTER TABLE producoes_contratos ADD COLUMN IF NOT EXISTS obs_recebimento TEXT
          `);
          // Cartão marcado PAGO no Operacional entrava na produção sem a flag
          // is_cartao (só o import de planilha preenchia), então sumia do card
          // Cartão da meta e do ranking. Recupera os já pagos pelo tipo.
          await migDb.execute(migSql`
            UPDATE producoes_contratos
            SET is_cartao = true
            WHERE COALESCE(is_cartao, false) = false
              AND (LOWER(COALESCE(tipo_contrato,'')) LIKE '%cart%'
                   OR LOWER(COALESCE(tipo_contrato,'')) LIKE '%saque complementar%')
          `);
          // Compra de Dívida de cartão é produção de CARTÃO. A linha da produção
          // nasce antes de alguém marcar a modalidade, então recupera as já pagas:
          // pela modalidade da proposta (RMC/RCC) ou pela tabela do Financeiro, que
          // já diz "Cartão" no nome. Idempotente: só mexe em quem está false.
          await migDb.execute(migSql`
            UPDATE producoes_contratos pc
            SET is_cartao = true
            FROM proposals p
            WHERE p.tenant_id = pc.tenant_id
              AND (p.id = pc.proposal_id OR (p.ade IS NOT NULL AND p.ade = pc.contrato_id))
              AND COALESCE(pc.is_cartao, false) = false
              AND UPPER(COALESCE(p.product, '')) = 'COMPRA_DIVIDA'
              AND (
                (p.client_meta->>'modalidadeCartao') IN ('RMC', 'RCC')
                OR LOWER(COALESCE(p.client_meta->>'tabelaNome', '')) LIKE '%cart%'
              )
          `);
          await migDb.execute(migSql`
            CREATE TABLE IF NOT EXISTS fin_planejamento (
              id             SERIAL PRIMARY KEY,
              tenant_id      INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              mes_referencia VARCHAR(7) NOT NULL,
              pct_reserva    DECIMAL(5,2) NOT NULL DEFAULT 0,
              tetos_json     JSONB,
              meta_margem    DECIMAL(5,2),
              observacao     TEXT,
              created_at     TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          await migDb.execute(migSql`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_fin_plan_mes ON fin_planejamento(tenant_id, mes_referencia)
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
              ADD COLUMN IF NOT EXISTS excecoes_origem JSONB,
              ADD COLUMN IF NOT EXISTS seguro NUMERIC(6,2) DEFAULT 0
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
          // Portabilidade multibanco (módulo novo, separado do simulador antigo).
          // Regras só-inserção e exceções nunca editadas: o histórico não muda.
          await simMigDb.execute(simMigSql`
            CREATE TABLE IF NOT EXISTS port_banks (
              id        SERIAL PRIMARY KEY,
              tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              nome      VARCHAR(100) NOT NULL,
              codigo    VARCHAR(20),
              ativo     BOOLEAN NOT NULL DEFAULT TRUE,
              ordem     INTEGER NOT NULL DEFAULT 0,
              criado_em TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          await simMigDb.execute(simMigSql`CREATE UNIQUE INDEX IF NOT EXISTS port_banks_tenant_nome ON port_banks(tenant_id, lower(nome))`);
          // por que o banco está desligado (ex.: "suspenso por problema técnico") e desde quando
          await simMigDb.execute(simMigSql`ALTER TABLE port_banks ADD COLUMN IF NOT EXISTS inativo_motivo TEXT`);
          await simMigDb.execute(simMigSql`ALTER TABLE port_banks ADD COLUMN IF NOT EXISTS inativo_em TIMESTAMP`);
          await simMigDb.execute(simMigSql`
            CREATE TABLE IF NOT EXISTS port_rule_sets (
              id              SERIAL PRIMARY KEY,
              tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              bank_id         INTEGER NOT NULL REFERENCES port_banks(id) ON DELETE CASCADE,
              convenio        VARCHAR(50) NOT NULL,
              regras          JSONB NOT NULL,
              hash            VARCHAR(64) NOT NULL,
              fonte_descricao TEXT,
              modelo_id       VARCHAR(80),
              vigencia_inicio TIMESTAMP NOT NULL DEFAULT NOW(),
              vigencia_fim    TIMESTAMP,
              criado_por      INTEGER,
              criado_em       TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          await simMigDb.execute(simMigSql`CREATE INDEX IF NOT EXISTS idx_port_rule_sets_vigente ON port_rule_sets(tenant_id, bank_id, convenio) WHERE vigencia_fim IS NULL`);
          await simMigDb.execute(simMigSql`
            CREATE TABLE IF NOT EXISTS port_rule_exceptions (
              id             SERIAL PRIMARY KEY,
              tenant_id      INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              bank_id        INTEGER NOT NULL REFERENCES port_banks(id) ON DELETE CASCADE,
              convenio       VARCHAR(50) NOT NULL,
              tipo           VARCHAR(40) NOT NULL,
              parametros     JSONB NOT NULL,
              motivo         TEXT,
              ativo          BOOLEAN NOT NULL DEFAULT TRUE,
              criado_por     INTEGER,
              criado_em      TIMESTAMP NOT NULL DEFAULT NOW(),
              desativado_por INTEGER,
              desativado_em  TIMESTAMP
            )
          `);
          await simMigDb.execute(simMigSql`
            CREATE TABLE IF NOT EXISTS port_analyses (
              id             SERIAL PRIMARY KEY,
              tenant_id      INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              cpf            VARCHAR(20),
              cotacao_id     INTEGER,
              engine_version VARCHAR(20) NOT NULL,
              entrada        JSONB NOT NULL,
              regras_usadas  JSONB NOT NULL,
              resultado      JSONB NOT NULL,
              criado_por     INTEGER,
              criado_em      TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          await simMigDb.execute(simMigSql`CREATE INDEX IF NOT EXISTS idx_port_analyses_cpf ON port_analyses(tenant_id, cpf)`);

          // ── CATALOGO GLOBAL (Fabio, 02/10/2026) ───────────────────────────
          // Regra de banco cadastrada na Capital Go vale para todos os ambientes.
          // tenant_id NULL = global. O ambiente so tem de seu: a comissao, o
          // liga/desliga e, se quiser, uma regra propria (que vence a global).
          for (const t of ["port_banks", "port_rule_sets", "port_rule_exceptions"]) {
            await simMigDb.execute(simMigSql`
              ALTER TABLE ${simMigSql.raw(t)} ALTER COLUMN tenant_id DROP NOT NULL
            `);
          }
          // nome unico tambem entre os globais (o indice antigo ignora NULL)
          await simMigDb.execute(simMigSql`
            CREATE UNIQUE INDEX IF NOT EXISTS port_banks_global_nome
              ON port_banks(lower(nome)) WHERE tenant_id IS NULL
          `);
          await simMigDb.execute(simMigSql`
            CREATE TABLE IF NOT EXISTS port_bank_config (
              id             SERIAL PRIMARY KEY,
              tenant_id      INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              bank_id        INTEGER NOT NULL REFERENCES port_banks(id) ON DELETE CASCADE,
              convenio       VARCHAR(50) NOT NULL DEFAULT 'SIAPE',
              ativo          BOOLEAN,          -- NULL = segue o catalogo
              inativo_motivo TEXT,
              inativo_em     TIMESTAMP,
              comissao       JSONB,            -- NULL = nao cadastrada (NUNCA herda a de outro)
              comissao_faixas JSONB,          -- [{minValor, percentual}] p/ bancos com faixa (Safra)
              atualizado_por INTEGER,
              atualizado_em  TIMESTAMP NOT NULL DEFAULT NOW(),
              UNIQUE (tenant_id, bank_id, convenio)
            )
          `);
          // quem edita o catalogo global
          await simMigDb.execute(simMigSql`
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS catalogo_portabilidade BOOLEAN NOT NULL DEFAULT FALSE
          `);

          // Promocao unica: se SO UM ambiente tem bancos cadastrados, ele e o
          // dono do catalogo e as regras dele viram globais. Com mais de um,
          // nao adivinha nada — fica tudo como esta e avisa no log.
          const donos = (await simMigDb.execute(simMigSql`
            SELECT DISTINCT tenant_id FROM port_banks WHERE tenant_id IS NOT NULL
          `)).rows as any[];
          const jaTemGlobal = (await simMigDb.execute(simMigSql`
            SELECT 1 FROM port_banks WHERE tenant_id IS NULL LIMIT 1
          `)).rows.length > 0;

          if (!jaTemGlobal && donos.length === 1) {
            const dono = Number(donos[0].tenant_id);
            // a comissao sai de dentro das regras e vira config DESTE ambiente
            await simMigDb.execute(simMigSql`
              INSERT INTO port_bank_config (tenant_id, bank_id, convenio, ativo, inativo_motivo, inativo_em, comissao, comissao_faixas)
              SELECT ${dono}, b.id, rs.convenio, b.ativo, b.inativo_motivo, b.inativo_em, rs.regras->'comissao',
                     (SELECT jsonb_agg(jsonb_build_object('minValor', f->'minValor', 'percentual', f->'comissaoPercentual'))
                        FROM jsonb_array_elements(COALESCE(rs.regras->'faixasRefin', '[]'::jsonb)) f
                       WHERE f->'comissaoPercentual' IS NOT NULL)
                FROM port_banks b
                JOIN port_rule_sets rs ON rs.bank_id = b.id AND rs.vigencia_fim IS NULL
               WHERE b.tenant_id = ${dono}
              ON CONFLICT (tenant_id, bank_id, convenio) DO NOTHING
            `);
            // bancos sem regra ainda: so o liga/desliga
            await simMigDb.execute(simMigSql`
              INSERT INTO port_bank_config (tenant_id, bank_id, convenio, ativo, inativo_motivo, inativo_em)
              SELECT ${dono}, b.id, 'SIAPE', b.ativo, b.inativo_motivo, b.inativo_em
                FROM port_banks b WHERE b.tenant_id = ${dono}
              ON CONFLICT (tenant_id, bank_id, convenio) DO NOTHING
            `);
            await simMigDb.execute(simMigSql`UPDATE port_rule_exceptions SET tenant_id = NULL WHERE tenant_id = ${dono}`);
            await simMigDb.execute(simMigSql`UPDATE port_rule_sets SET tenant_id = NULL WHERE tenant_id = ${dono}`);
            await simMigDb.execute(simMigSql`UPDATE port_banks SET tenant_id = NULL WHERE tenant_id = ${dono}`);
            await simMigDb.execute(simMigSql`UPDATE tenants SET catalogo_portabilidade = TRUE WHERE id = ${dono}`);
            log(`catalogo de portabilidade: regras do tenant ${dono} promovidas a globais`);
          } else if (!jaTemGlobal && donos.length > 1) {
            console.warn("[PORT] catalogo global NAO promovido: " + donos.length +
              " ambientes tem bancos cadastrados. Defina catalogo_portabilidade a mao.");
          }

          // Simulador de Compra: tabelas próprias (separadas do Financeiro). Só o master cadastra.
          await simMigDb.execute(simMigSql`
            CREATE TABLE IF NOT EXISTS compra_tabelas (
              id          SERIAL PRIMARY KEY,
              tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              banco       VARCHAR(100) NOT NULL,
              nome        VARCHAR(150),
              coeficiente NUMERIC(14,10) NOT NULL,
              percentual  NUMERIC(6,3),
              prazo       INTEGER,
              ativo       BOOLEAN NOT NULL DEFAULT TRUE,
              criado_por  INTEGER,
              criado_em   TIMESTAMP NOT NULL DEFAULT NOW(),
              atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          await simMigDb.execute(simMigSql`CREATE INDEX IF NOT EXISTS idx_compra_tabelas_tenant ON compra_tabelas(tenant_id, ativo)`);
          await simMigDb.execute(simMigSql`ALTER TABLE compra_tabelas ADD COLUMN IF NOT EXISTS convenio VARCHAR(50) NOT NULL DEFAULT 'SIAPE'`);

          // Viabilidade Inter: faixas de taxa ponderada e grade de comissionamento por convênio
          await simMigDb.execute(simMigSql`
            CREATE TABLE IF NOT EXISTS viabilidade_conv_rules (
              tenant_id  INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
              regras     JSONB NOT NULL,
              updated_by INTEGER,
              updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
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

        // Consumo de leads por ambiente e por mês. Conta tudo que é GERADO
        // (repetido ou não), que é a regra combinada com o Fábio.
        try {
          const { db: migDb } = await import("./storage");
          const { sql: migSql } = await import("drizzle-orm");
          await migDb.execute(migSql`
            CREATE TABLE IF NOT EXISTS consumo_leads (
              id             SERIAL PRIMARY KEY,
              tenant_id      INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              mes_referencia VARCHAR(7) NOT NULL,
              quantidade     INTEGER NOT NULL DEFAULT 0,
              atualizado_em  TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          await migDb.execute(migSql`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_consumo_leads_mes ON consumo_leads(tenant_id, mes_referencia)
          `);
          // Teto mensal de cada plano (jsonb limites.leadsMes)
          for (const [nome, teto] of [["Essencial", 4000], ["Profissional", 10000], ["Elite", 50000]] as const) {
            await migDb.execute(migSql`
              UPDATE planos
              SET limites = COALESCE(limites, '{}'::jsonb) || jsonb_build_object('leadsMes', ${teto})
              WHERE nome = ${nome} AND COALESCE(limites->>'leadsMes', '') = ''
            `);
          }
          log("✓ Migração consumo de leads + tetos por plano ok");
        } catch (e) {
          log(`⚠ Migração consumo de leads falhou (non-fatal): ${e}`);
        }

        // Agente de Listas (Jarvis que monta lista pelo Bigdata) + teto por usuário
        try {
          const { db: migDb } = await import("./storage");
          const { sql: migSql } = await import("drizzle-orm");
          await migDb.execute(migSql`ALTER TABLE users ADD COLUMN IF NOT EXISTS limite_leads_mes INTEGER`);
          await migDb.execute(migSql`
            CREATE TABLE IF NOT EXISTS consumo_leads_usuario (
              id             SERIAL PRIMARY KEY,
              tenant_id      INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              mes_referencia VARCHAR(7) NOT NULL,
              quantidade     INTEGER NOT NULL DEFAULT 0,
              atualizado_em  TIMESTAMP NOT NULL DEFAULT NOW(),
              UNIQUE (tenant_id, user_id, mes_referencia)
            )
          `);
          // Onde o agente está (ele se registra sozinho a cada 5 min)
          await migDb.execute(migSql`
            CREATE TABLE IF NOT EXISTS agente_listas_estado (
              id       INTEGER PRIMARY KEY,
              url      TEXT NOT NULL,
              versao   TEXT,
              modelo   TEXT,
              visto_em TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          // Auditoria: quem conversou, quantas mensagens, no que deu
          await migDb.execute(migSql`
            CREATE TABLE IF NOT EXISTS agente_listas_conversas (
              id                 SERIAL PRIMARY KEY,
              tenant_id          INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              agente_conversa_id TEXT NOT NULL,
              mensagens          INTEGER NOT NULL DEFAULT 0,
              criterios          TEXT,
              total_leads        INTEGER,
              campanha_id        INTEGER,
              pedido_id          INTEGER,
              criado_em          TIMESTAMP NOT NULL DEFAULT NOW(),
              atualizado_em      TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          log("✓ Migração agente de listas + teto por usuário ok");
        } catch (e) {
          log(`⚠ Migração agente de listas falhou (non-fatal): ${e}`);
        }

        // Endereço da Anatel vem quebrado (logradouro, número, bairro). A coluna
        // "endereco" só comporta o logradouro — sem estas duas, número e bairro
        // se perdiam na importação.
        try {
          const { db: migDb } = await import("./storage");
          const { sql: migSql } = await import("drizzle-orm");
          await migDb.execute(migSql`ALTER TABLE clientes_pessoa ADD COLUMN IF NOT EXISTS endereco_numero VARCHAR(20)`);
          await migDb.execute(migSql`ALTER TABLE clientes_pessoa ADD COLUMN IF NOT EXISTS endereco_bairro VARCHAR(120)`);
          await migDb.execute(migSql`ALTER TABLE clientes_pessoa ADD COLUMN IF NOT EXISTS nome_mae VARCHAR(200)`);
          log("✓ Migração endereço (numero/bairro) + filiação (nome_mae) ok");
        } catch (e) {
          log(`⚠ Migração endereço falhou (non-fatal): ${e}`);
        }

        // Permissões por item: telas que antes eram liberadas só por papel ganharam
        // chave própria (Contratos, Gestão Comercial, Caixa/Contas a Pagar...). Sem
        // isto, no primeiro deploy elas sumiriam de quem as usa hoje. Concede o que
        // cada um já enxergava; daí em diante quem manda é o painel de permissões.
        try {
          const { db: migDb } = await import("./storage");
          const { sql: migSql } = await import("drizzle-orm");
          const conceder = async (modulo: string, filtroPapel: string | null) => {
            await migDb.execute(migSql`
              INSERT INTO user_permissions (user_id, module, can_view, can_edit, can_delegate)
              SELECT u.id, ${modulo}, true, true, false
              FROM users u
              WHERE u.is_active = true
                ${filtroPapel ? migSql`AND u.role = ANY(${migSql.raw(filtroPapel)})` : migSql``}
                AND NOT EXISTS (
                  SELECT 1 FROM user_permissions up
                  WHERE up.user_id = u.id AND up.module = ${modulo}
                )
            `);
          };
          const GESTAO = `ARRAY['master','coordenacao']`;
          const BASE = `ARRAY['master','coordenacao','financeiro']`;
          // Minhas Propostas e Material de Apoio eram abertos a todo mundo
          await conceder("modulo_contratos", null);
          await conceder("modulo_roteiros.material_apoio", null);
          // Gestão Comercial e o financeiro da empresa eram de master/coordenação
          await conceder("modulo_gestao_comercial", GESTAO);
          for (const k of ["caixa", "contas_pagar", "planejamento", "revisao_custos"]) {
            await conceder(`modulo_financeiro.${k}`, GESTAO);
          }
          for (const k of ["dados_complementares", "observacoes_cpf"]) {
            await conceder(`modulo_base_clientes.${k}`, BASE);
          }
          log("✓ Migração de permissões por item (contratos/gestão comercial/financeiro) ok");
        } catch (e) {
          log(`⚠ Migração de permissões por item falhou (non-fatal): ${e}`);
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

        // ===== JARVIS — plantão de perguntas dos corretores =====
        try {
          const { db: perguntaDb } = await import("./storage");
          const { sql: perguntaSql } = await import("drizzle-orm");
          await perguntaDb.execute(perguntaSql`
            CREATE TABLE IF NOT EXISTS assistente_perguntas (
              id            SERIAL PRIMARY KEY,
              tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              corretor_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              pergunta      TEXT NOT NULL,
              status        VARCHAR(20) NOT NULL DEFAULT 'pendente',
              resposta      TEXT,
              respondida_por INTEGER REFERENCES users(id),
              respondida_em TIMESTAMP,
              artigo_id     INTEGER,
              created_at    TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          await perguntaDb.execute(perguntaSql`CREATE INDEX IF NOT EXISTS idx_assistente_perguntas_status ON assistente_perguntas(tenant_id, status)`);
          log("✓ Migração assistente_perguntas ok");
        } catch (e) {
          log(`⚠ Migração assistente_perguntas falhou (non-fatal): ${e}`);
        }

        // ===== ADMIN SAAS — Fase 1: interno, planos/módulos, Asaas =====
        try {
          const { db: saasDb } = await import("./storage");
          const { sql: saasSql } = await import("drizzle-orm");
          await saasDb.execute(saasSql`
            ALTER TABLE tenants
              ADD COLUMN IF NOT EXISTS interno BOOLEAN NOT NULL DEFAULT false,
              ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT,
              ADD COLUMN IF NOT EXISTS logo_url_dark VARCHAR(500),
              ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ativo',
              ADD COLUMN IF NOT EXISTS ultimo_acesso TIMESTAMP
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
          // Fase 0 (fechamento): módulo Funcionários removido; Fábio dispensou backup (11/07/2026).
          // CASCADE derruba só as FKs (users.employee_id / commercial_team_members.employee_id) — as colunas ficam.
          await saasDb.execute(saasSql`DROP TABLE IF EXISTS employees CASCADE`);
          // Fase 3 — Serviços & Cobrança: catálogo de produtos vendáveis, promoções e adicionais de assinatura.
          await saasDb.execute(saasSql`
            CREATE TABLE IF NOT EXISTS produtos (
              id          SERIAL PRIMARY KEY,
              tenant_id   INTEGER,
              nome        VARCHAR(255) NOT NULL,
              descricao   TEXT,
              tipo        VARCHAR(30) NOT NULL DEFAULT 'outro',
              preco       DECIMAL(10,2) NOT NULL DEFAULT 0,
              gratuito    BOOLEAN NOT NULL DEFAULT false,
              cobravel    BOOLEAN NOT NULL DEFAULT true,
              ativo       BOOLEAN NOT NULL DEFAULT true,
              created_at  TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          await saasDb.execute(saasSql`
            CREATE TABLE IF NOT EXISTS promocoes (
              id              SERIAL PRIMARY KEY,
              produto_id      INTEGER REFERENCES produtos(id) ON DELETE CASCADE,
              tipo            VARCHAR(30) NOT NULL,
              valor           DECIMAL(10,2),
              escopo          VARCHAR(20) NOT NULL DEFAULT 'global',
              tenant_alvo     INTEGER,
              vigencia_inicio DATE,
              vigencia_fim    DATE,
              ativo           BOOLEAN NOT NULL DEFAULT true,
              created_at      TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          await saasDb.execute(saasSql`
            CREATE TABLE IF NOT EXISTS assinatura_adicionais (
              id          SERIAL PRIMARY KEY,
              tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              produto_id  INTEGER REFERENCES produtos(id) ON DELETE SET NULL,
              cobranca_id INTEGER,
              ativo       BOOLEAN NOT NULL DEFAULT true,
              created_at  TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          await saasDb.execute(saasSql`CREATE INDEX IF NOT EXISTS idx_assinatura_adicionais_tenant ON assinatura_adicionais(tenant_id)`);
          // Fase 4 — garante as colunas de gateway na subscriptions (schema já as declara; banco pode ser anterior)
          await saasDb.execute(saasSql`
            ALTER TABLE subscriptions
              ADD COLUMN IF NOT EXISTS gateway_customer_id VARCHAR(255),
              ADD COLUMN IF NOT EXISTS gateway_subscription_id VARCHAR(255),
              ADD COLUMN IF NOT EXISTS payment_history JSONB DEFAULT '[]'::jsonb
          `);
          // Vínculo do pedido de lista com produto/cobrança (pedidos existentes ficam com produto_id NULL = lead implícito)
          await saasDb.execute(saasSql`
            ALTER TABLE pedidos_lista
              ADD COLUMN IF NOT EXISTS produto_id INTEGER,
              ADD COLUMN IF NOT EXISTS cobranca_id INTEGER
          `);
          // SP1 — Planos & Assinaturas: catálogo configurável + assinatura vinculada a plano
          await saasDb.execute(saasSql`
            ALTER TABLE planos
              ADD COLUMN IF NOT EXISTS ciclo VARCHAR(10) NOT NULL DEFAULT 'mensal',
              ADD COLUMN IF NOT EXISTS valor DECIMAL(10,2) NOT NULL DEFAULT 0,
              ADD COLUMN IF NOT EXISTS max_usuarios INTEGER,
              ADD COLUMN IF NOT EXISTS limites JSONB DEFAULT '{}'::jsonb
          `);
          await saasDb.execute(saasSql`UPDATE planos SET valor = preco_mensal WHERE valor = 0 AND preco_mensal > 0`);
          await saasDb.execute(saasSql`
            CREATE TABLE IF NOT EXISTS plano_produtos (
              plano_id   INTEGER NOT NULL REFERENCES planos(id) ON DELETE CASCADE,
              produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
              incluso    BOOLEAN NOT NULL DEFAULT true,
              PRIMARY KEY (plano_id, produto_id)
            )
          `);
          await saasDb.execute(saasSql`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plano_id INTEGER REFERENCES planos(id)`);
          await saasDb.execute(saasSql`
            CREATE TABLE IF NOT EXISTS assinatura_historico (
              id          SERIAL PRIMARY KEY,
              tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
              tipo        VARCHAR(30) NOT NULL,
              descricao   TEXT,
              por_user_id INTEGER REFERENCES users(id),
              criado_em   TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          await saasDb.execute(saasSql`CREATE INDEX IF NOT EXISTS idx_assinatura_hist_tenant ON assinatura_historico(tenant_id)`);
          // Oportunidades por CPF (cortes de base) — estrutura na área de observações
          await saasDb.execute(saasSql`
            ALTER TABLE client_observations
              ADD COLUMN IF NOT EXISTS categoria VARCHAR(30) NOT NULL DEFAULT 'observacao',
              ADD COLUMN IF NOT EXISTS etiqueta  VARCHAR(50),
              ADD COLUMN IF NOT EXISTS dados     JSONB DEFAULT '{}'::jsonb
          `);
          // A leitura por CPF normaliza a coluna com REGEXP_REPLACE e hoje faz seq scan;
          // índice funcional casa com essa expressão e evita varredura a cada ficha aberta.
          await saasDb.execute(saasSql`
            CREATE INDEX IF NOT EXISTS idx_client_obs_cpf_norm
              ON client_observations (tenant_id, (REGEXP_REPLACE(cpf, '[^0-9]', '', 'g')))
          `);
          // Seed dos planos legados (só se a tabela estiver vazia) — viram linhas editáveis
          const planosCountRow = (await saasDb.execute(saasSql`SELECT COUNT(*)::int AS n FROM planos`)).rows[0] as any;
          if (Number(planosCountRow.n) === 0) {
            const seedPlanos: [string, number][] = [
              ["Trial", 0], ["Básico", 127], ["Profissional", 197], ["Expert", 277], ["Enterprise", 0],
            ];
            for (const [nome, valor] of seedPlanos) {
              await saasDb.execute(saasSql`
                INSERT INTO planos (nome, valor, preco_mensal, ciclo, ativo)
                VALUES (${nome}, ${valor}, ${valor}, 'mensal', true)
              `);
            }
          }
          // Religa assinaturas existentes ao plano por nome (idempotente; só a interna existe hoje)
          await saasDb.execute(saasSql`
            UPDATE subscriptions s SET plano_id = p.id
            FROM planos p
            WHERE s.plano_id IS NULL AND (
              lower(p.nome) = lower(s.plan)
              OR (s.plan = 'basico' AND p.nome = 'Básico')
              OR (s.plan = 'profissional' AND p.nome = 'Profissional')
            )
          `);
          log("✓ Migração Admin SaaS (interno/planos/tenant_modulos/cobrancas/produtos/plano_produtos/assinatura_historico) ok");
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

        // Mensalidades: gera, vence, avisa. Uma vez por dia, travado no banco.
        const { startRotinaAssinaturas } = await import("./assinaturas");
        startRotinaAssinaturas();
        log("Rotina de assinaturas started");

        // Portfolio cleanup: mark expired entries as EXPIRADO every 24h
        const { updateExpiredPortfolios, CARTEIRA_EXPIRA } = await import("./portfolio");
        if (!CARTEIRA_EXPIRA) {
          // Carteira não expira mais (07/10/2026): devolve quem já tinha expirado.
          try {
            const { db: cartDb } = await import("./storage");
            const { sql: cartSql } = await import("drizzle-orm");
            const r = await cartDb.execute(cartSql`UPDATE client_portfolio SET status = 'ATIVO' WHERE status = 'EXPIRADO'`);
            const n = (r as any).rowCount || 0;
            if (n > 0) log(`Carteira: ${n} entradas expiradas reativadas`);
          } catch (err) {
            console.error("Carteira reativação error (non-fatal):", err);
          }
        }
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

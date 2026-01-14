# Simulador GoldCard - Cartão de Crédito e Benefício

## Overview

Simulador GoldCard is a web-based application designed for financial professionals in Brazil. It provides a credit card and benefits simulator to calculate loan offers, total contract values, and client refunds based on financial data and bank-specific coefficient tables. The project aims to deliver a fast, accurate, and production-ready tool for Brazilian financial institutions, adhering to Material Design principles. Key capabilities include real-time calculations, multi-format export (PDF/JPEG/PNG), hierarchical user management, bulk CSV import/export, and advanced AI-powered modules for sales CRM, banking roadmap intelligence, client database management, and sales training.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions

The application follows Material Design principles, utilizing Shadcn/ui components built on Radix UI primitives and styled with Tailwind CSS. It features a mobile-first, responsive design with theme support.

### Technical Implementations

The frontend is developed with React 18 and TypeScript, using Vite for development and optimized builds. Wouter manages routing, and React Hook Form with TanStack Query handles state. Zod schemas are used for form validation. The backend uses Node.js with Express and TypeScript, primarily for validation, with calculations performed client-side. Data storage is configured with Drizzle ORM for PostgreSQL, with an `IStorage` interface for flexibility. Authentication is session-based with RBAC, and a granular per-user module permission system controls access.

### Feature Specifications

*   **Simulation Engine**: Coefficient-based algorithm supporting percentage-based and fixed-value safety margins for calculating Liquid Payment, Total Contract Value, and Client Refund. Coefficient tables are hierarchical (Agreement → Operation Type → Bank → Term → Table).
*   **CRM de Vendas (Sales CRM)**: Campaign-based lead management system with lead distribution, transfer, status tracking, contact history, scheduling, and user-defined tags. Integrates with the client database for campaign creation.
*   **Roteiro Bancário Inteligente**: Intelligent search and management of bank-specific procedures, including JSON import, metadata editing, and AI-powered natural language search (using OpenAI GPT-4.1-mini) with a two-stage query interpreter and module-specific responders (e.g., bank comparison, rule explanation, best operation recommendation).
*   **Base de Clientes (Client CRM)**: Comprehensive client database management supporting Excel/CSV imports, filtering, and purchase list requests with a package-based pricing model. Handles detailed client, payroll, and contract data, including sophisticated deduplication and fallback logic for legacy spreadsheets.
*   **Massive-Scale Import System**: Streaming import infrastructure for handling 10M+ row files with pause/resume capability. Features:
    - Three import types: `folha` (payroll), `d8` (contracts), `contatos` (contacts)
    - Sequence dependency: folha → d8 → contatos (each requires previous data)
    - D8 layouts: "servidor" (basic) and "pensionista" (includes instituidor fields)
    - Streaming mechanics: 1M rows/execution limit, byte-offset resume, disk-based uploads (no memory loading)
    - Anchor table `clientes_vinculo` for many-to-many CPF↔matrícula relationships
    - API endpoints: `POST /imports/start`, `POST /imports/process/:id`, `GET /imports/status/:id`, `GET /imports/:id/errors`
    - Job tracking via `import_runs` table with status, progress, and error tracking via `import_errors` table
    - Unique indexes defined in schema.ts for consistent ON CONFLICT upserts:
      - `idx_vinculo_cpf_mat_orgao` on clientes_vinculo(cpf, matricula, orgao)
      - `idx_folha_mes_vinculo_competencia` on clientes_folha_mes(vinculo_id, competencia)
    - **Mandatory import_run_id traceability**: All final tables (clientes_pessoa, clientes_vinculo, clientes_folha_mes, clientes_contratos, client_contacts) have import_run_id column linking to the import that created/updated each record. Legacy imports (POST /api/bases/import) automatically create import_run records and populate import_run_id in all inserted/updated records.
    - **Cascading delete (transactional)**: DELETE /api/bases/:id uses a single atomic SQL CTE transaction that:
      1. Enforces tenant isolation (no cross-tenant data loss)
      2. Deletes folhas, contratos, contacts, vínculos scoped by base_tag + tenant
      3. Removes orphaned pessoas (without remaining folhas/contratos/vínculos/contacts)
      4. Physically deletes the import_run (not just marks as deleted)
      5. All operations are atomic - complete success or complete rollback
*   **Academia ConsigOne (Training Module)**: AI-powered sales training for credit consultants, including static fundamentals, quizzes, AI-powered chat roleplay simulations with real-time evaluation and message limits, AI script generation for sales approaches, and an admin dashboard for monitoring progress and generating AI feedback.
*   **High-Performance Client Database Export System**: Optimized streaming export system for generating client lists with package-based pricing. Features:
    - **Chunked/streaming processing**: 5,000 records per chunk to avoid memory issues with large datasets
    - **Optimized query patterns**: Single upfront COUNT query, then chunked data fetches with `skipCount: true`
    - **Bulk folha lookups**: `getLatestFolhaMesByPessoaIds()` uses DISTINCT ON for efficient single-query data fetch
    - **Deterministic pagination**: ORDER BY p.id ensures no duplicate/missing rows across chunks
    - **Package auto-limit**: When user selects package smaller than results (e.g., 5,000 package with 38,610 matches), system caps export at package limit
    - **API options**: `searchClientesPessoa()` supports `skipCount`, `countOnly`, `limit`, `offset` for flexible optimization

### System Design Choices

The architecture emphasizes client-side calculations for performance and determinism, a modular design for extensibility (e.g., `IStorage` interface), and robust authentication/authorization with granular control. AI integration is central to advanced features like intelligent search, sales training, and CRM functionalities.

### Permission System (Updated 2026-01-12)

The application uses a granular sub-item permission system with the following modules and sub-items:

| Module Key | Display Name | Sub-Items |
|------------|-------------|-----------|
| modulo_simulador | Simuladores | simulador_compra, simulador_amortizacao, simulador_portabilidade |
| modulo_roteiros | Operacional | convenios, bancos, tabelas_coeficientes, roteiros_bancarios |
| modulo_base_clientes | Base de Clientes | consulta, importacao, compra_lista |
| modulo_config_usuarios | Administração | usuarios, ambientes, precos |
| modulo_academia | Treinamento | fundamentos, quiz, roleplay, scripts, dashboard |
| modulo_alpha | ALPHA | campanhas, atendimento, pipeline, consulta, agenda, gestao_pipeline |

**Key permission behaviors:**
- `isMaster=true` flag grants full access (only global bypass - zero role inheritance)
- Non-master users require explicit permissions for each sub-item (format: `module.subitem`)
- Each sub-item has independent `canView` and `canEdit` flags
- Backwards compatibility: `hasSubItemAccess()` falls back to module-level permissions for legacy users
- UI: Accordion-based permission editor with expandable modules showing individual sub-item checkboxes
- Sidebar menu items are filtered based on sub-item permissions
- When a user is edited, legacy module permissions are migrated to sub-item permissions
- Backend validation rejects invalid module or sub-item keys

**Permission key format:**
- Sub-item level: `modulo_simulador.simulador_compra`
- Module level (legacy): `modulo_simulador`

**API Endpoints:**
- GET /api/permissions/structure - Returns full module/sub-item hierarchy
- GET /api/users/:id/permissions - Get user's permissions
- PUT /api/users/:id/permissions - Save user's permissions

### Multi-Tenant Branding System

The application supports comprehensive white-label branding per tenant:

**Customizable Elements:**
- System name, slogan, font family
- Login/app logos (PNG/SVG, max 2MB), favicon (ICO/PNG/SVG)
- Logo height (32-120px)
- showSystemName toggle (optional display of system name on login)
- showSlogan toggle (optional display of slogan on login)
- Welcome text, footer text for login page
- Theme colors (primaryColor, textColor, loginBgColor, etc.)
- **Sidebar customization** (sidebarBgColor, sidebarFontColor) - custom background and font colors for the navigation menu
- All toggle settings stored in themeJson for persistence

**Sidebar Color Customization:**
- sidebarBgColor: Background color of the sidebar navigation menu (hex format, e.g., #1e3a5f)
- sidebarFontColor: Font/icon color in the sidebar (hex format, e.g., #ffffff)
- Colors are converted from hex to HSL and applied to CSS variables --sidebar and --sidebar-foreground
- Proper contrast should be maintained between background and font colors

**Development Mode Tenant Persistence:**
After login, a `devTenantId` cookie is set that persists across logout. This ensures the login page shows the correct tenant branding for testing:
1. Session tenantId (authenticated users) - highest priority
2. devTenantId cookie (persists 7 days after logout)
3. First active tenant (final fallback)

**Cache Invalidation:**
- Logout invalidates `/api/tenant` query cache to force refetch with devTenantId cookie
- This prevents stale cached tenant data from showing after logout

## External Dependencies

### Third-Party UI Libraries

*   Radix UI
*   Shadcn/ui
*   Lucide React

### Form and Validation

*   React Hook Form
*   Zod
*   @hookform/resolvers

### Data Fetching

*   TanStack Query

### Database and ORM

*   Drizzle ORM
*   @neondatabase/serverless

### Styling and Utilities

*   Tailwind CSS
*   class-variance-authority
*   clsx
*   tailwind-merge

### Development Tools

*   Vite
*   TypeScript

### File Processing

*   PapaParse (CSV parsing)
*   html2canvas (DOM to image export)
*   jsPDF (PDF generation)

### Brazilian Market Specific

*   date-fns
*   Intl.NumberFormat

### Testing

*   Vitest (Unit testing)
*   Playwright (End-to-end testing)

### AI Integrations

*   OpenAI GPT-4.1-mini (via Replit AI Integrations)
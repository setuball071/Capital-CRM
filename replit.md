# Simulador GoldCard - Credit Card and Benefit Simulator

## Overview
Simulador GoldCard is a web-based application for Brazilian financial professionals, offering a credit card and benefits simulator. It calculates loan offers, total contract values, and client refunds using financial data and bank-specific coefficient tables. The project aims to be a fast, accurate, and production-ready tool for financial institutions in Brazil, adhering to Material Design principles. Key capabilities include real-time calculations, multi-format export, hierarchical user management, bulk CSV import/export, and advanced AI-powered modules for sales CRM, banking roadmap intelligence, client database management, and sales training. The business vision is to provide a comprehensive financial simulation and management platform, enhancing efficiency and accuracy for financial professionals in the Brazilian market.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The application employs Material Design principles, utilizing Shadcn/ui components (built on Radix UI) and styled with Tailwind CSS. It features a mobile-first, responsive design with theme support and customizable branding per tenant, including logos, fonts, colors, and login page elements.

### Technical Implementations
The frontend is built with React 18 and TypeScript, using Vite for development, Wouter for routing, and React Hook Form with TanStack Query for state management. Zod schemas handle form validation. The backend uses Node.js with Express and TypeScript, primarily for validation, with calculations performed client-side. Data is stored using Drizzle ORM for PostgreSQL, with an `IStorage` interface for flexibility. Authentication is session-based with Role-Based Access Control (RBAC) and a granular per-user module permission system.

### Feature Specifications
*   **Simulation Engine**: A coefficient-based algorithm calculates Liquid Payment, Total Contract Value, and Client Refund, supporting percentage-based and fixed-value safety margins. Coefficient tables are hierarchical (Agreement → Operation Type → Bank → Term → Table).
*   **CRM de Vendas (Sales CRM)**: Campaign-based lead management system with lead distribution, transfer, status tracking, and integration with the client database. Features tag-based client organization with CSV export (master/coordenacao only), "Lista Manual" (formerly "Atendimento") with "Sair da Lista" and "Próximo" confirmation dialog (Pular / Recusar), and RECUSADO lead marker for tracking refused clients in gestão de pipeline. **Consulta Individual** (`/vendas/consulta`) supports tagging any client via auto-created "Consulta Avulsa" campaign (origem `__consulta_avulsa__`) — if no existing lead matches the CPF, one is created automatically so TagManager always has a leadId.
*   **Roteiro Bancário Inteligente (Intelligent Banking Roadmap)**: Manages bank-specific procedures with JSON import, metadata editing, and AI-powered natural language search (using OpenAI GPT-4.1-mini) for bank comparison, rule explanation, and operation recommendations.
*   **Base de Clientes (Client CRM)**: Comprehensive client database management, supporting Excel/CSV imports, advanced filtering, purchase list requests with package-based pricing, and sophisticated deduplication logic. Includes a high-performance streaming export system for large datasets. **Compra Lista** features a "Base de Referência" selector that scopes folha and D8 contract filters to a specific competência (YYYYMM), ensuring users always query the desired import base. The selector derives `base_tag` suffixes (`fo` for folha, `d8` for contracts) from the selected YYYYMM reference. API endpoint `/api/clientes/filtros/bases` lists available bases.
*   **Massive-Scale Import System**: Streaming infrastructure for importing large files (10M+ rows) with pause/resume capabilities and sequential processing for payroll, contracts, and contacts, ensuring data integrity and traceability. Includes `safeVarchar()` field length protection to prevent varchar overflow crashes, and properly escaped PostgreSQL regex patterns in merge SQL for date parsing. **Import Templates**: Standard import (`POST /api/bases/import`) supports template selection: `federal` (SIAPE, default) and `estadual` (Governo Estadual). Estadual template uses `;` CSV delimiter, `ESTADUAL_COLUMN_MAP` for column mapping (CPF, NOME DO SERVIDOR, ORGAO_Secretaria, CARGO, FUNCAO, NATUREZA, TOTAL_VANTAGENS, SITUACAOFUNCIONAL, SEXO, DT_NASC, CIDADE, UF, CEP, NOME_MAE, CELULAR 1-3), synthetic matrícula (`EST_` + CPF), phone E+ scientific notation filtering, and stores cargo/funcao in `extrasVinculo`, sexo/cep/nome_mae/endereco in `extrasPessoa`. **Fast Import Estadual**: The Fast Import system (`POST /api/fast-imports/start` with `tipo_import=estadual`) also supports Governo Estadual imports via `FAST_ESTADUAL_COLUMN_MAP` in `fast-import-service.ts`. It reuses `staging_folha` table, generates synthetic matrícula (`EST_` + CPF), maps TOTAL_VANTAGENS to salario_bruto, CARGO+FUNCAO to instituidor field, NATUREZA to rjur field. Merge via `mergeEstadual()` upserts pessoa, vínculo, and folha_mes. Convênio uses UF selector (27 Brazilian states) in both standard and Fast Import UI, generating "Estadual - XX" format (e.g., "Estadual - MA"). Backend passes through the frontend-provided convênio value.
*   **Desenvolvimento (formerly Academia/Training Module)**: Renamed from "Treinamento" to "Desenvolvimento". Includes AI-powered sales training (Fundamentos, Roleplay IA, Abordagem IA), a **Profiler Comportamental DISC** (2-stage adjective selection test calculating D/I/S/C behavioral profile with EXE/COM/PLA/ANA results, saved to user profile), **Feedbacks** system (gestor→vendedor with types: elogio/melhoria/combinado/aviso, unread badge in sidebar, jsonb `lido_por` tracking), and **Perfis da Equipe** management view (master/coordenacao only). Routes under `/desenvolvimento/*`. Dashboard vendedor shows onboarding banner when DISC profiler is incomplete.
*   **Employees Module (Funcionários)**: Manages tenant staff with a multi-step form for personal, family, professional, banking data, document uploads, and system access creation with role assignment and unique CPF validation.
*   **Commercial Teams Module (Equipes Comerciais)**: Manages commercial teams with CRUD operations, coordinator assignment (references users.id), member management via user_id (not employee_id), simplified add-member form (user selection + role only), and tenant isolation. Coordinator reconciliation uses user_id.
*   **Metas Mensais (Monthly Goals Module)**: Tracks monthly goals for teams and individuals with distinct goal categories (General and Card), role-based visibility, and month locking for past periods. Team members are resolved via user_id in commercial_team_members, joined to users table.
*   **Dashboard do Gestor**: Team-focused dashboard for master/coordenacao showing team meta cards (Geral + Cartão with progress bars), Ranking Geral dos Corretores, and Ranking Cartão dos Corretores. Data from `GET /api/dashboard-gestor` aggregating `producoes_contratos` + `vendedor_contratos`. Users are isolated via `user_tenants` join table (users table has no tenant_id column).
*   **Dashboard do Vendedor (Ranking Badges)**: Individual seller dashboard with ranking position badges (#N/total) on Meta Geral and Meta Cartão cards. Position calculated by comparing production against all tenant vendedores. Data from `GET /api/dashboard-vendedor` which now includes `posicaoRankingGeral`, `posicaoRankingCartao`, `totalVendedores`.
*   **Relatórios (Reports Module)**: Two-tab reports page at `/vendas/gestao-comercial/relatorios` (master/coordenacao only). **Histórico de Produção** tab: month selector (last 12 months), empresa/equipe view toggle with equipe dropdown, meta cards + side-by-side ranking tables (reuses dashboard-gestor logic parametrized by month). Data from `GET /api/relatorios/historico-producao?mes=YYYY-MM&visao=empresa|equipe&equipeId=N`. **Dia a Dia** tab: date range selector (default = current week), equipe filter, table showing per-corretor metrics: clientes consultados (unique leads from `lead_interactions`), clientes etiquetados (`lead_tag_assignments` with tenant isolation via `lead_tags` join), pipeline changes, production, contracts, dias úteis, clients/day, clients/hour. Data from `GET /api/relatorios/dia-a-dia?de=YYYY-MM-DD&ate=YYYY-MM-DD&equipeId=N`.

### System Design Choices
The architecture prioritizes client-side calculations for performance, a modular design for extensibility, and robust authentication/authorization with granular control. AI integration is central to advanced features like intelligent search, sales training, and CRM functionalities. A granular permission system allows fine-grained control over user access to specific modules and sub-items. Multi-tenant branding provides extensive white-label customization for each tenant, with an audit system tracking all branding changes.

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
*   @neondatabase/serverless (for PostgreSQL)

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
*   Vitest
*   Playwright

### AI Integrations
*   OpenAI GPT-4.1-mini
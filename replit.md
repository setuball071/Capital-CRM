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

### System Design Choices

The architecture emphasizes client-side calculations for performance and determinism, a modular design for extensibility (e.g., `IStorage` interface), and robust authentication/authorization with granular control. AI integration is central to advanced features like intelligent search, sales training, and CRM functionalities.

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
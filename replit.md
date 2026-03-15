# Simulador GoldCard - Credit Card and Benefit Simulator

## Overview
Simulador GoldCard is a web-based application for Brazilian financial professionals, offering a credit card and benefits simulator. It calculates loan offers, total contract values, and client refunds using financial data and bank-specific coefficient tables. The project aims to be a fast, accurate, and production-ready tool for financial institutions in Brazil, enhancing efficiency and accuracy for financial professionals in the Brazilian market. Key capabilities include real-time calculations, multi-format export, hierarchical user management, bulk CSV import/export, and advanced AI-powered modules for sales CRM, banking roadmap intelligence, client database management, and sales training. The business vision is to provide a comprehensive financial simulation and management platform.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The application employs Material Design principles, utilizing Shadcn/ui components (built on Radix UI) and styled with Tailwind CSS. It features a mobile-first, responsive design with theme support and customizable branding per tenant, including logos, fonts, colors, and login page elements.

### Technical Implementations
The frontend is built with React 18 and TypeScript, using Vite for development, Wouter for routing, and React Hook Form with TanStack Query for state management. Zod schemas handle form validation. The backend uses Node.js with Express and TypeScript, primarily for validation, with calculations performed client-side. Data is stored using Drizzle ORM for PostgreSQL. Authentication is session-based with Role-Based Access Control (RBAC) and a granular per-user module permission system.

### Feature Specifications
*   **Simulation Engine**: A coefficient-based algorithm calculates Liquid Payment, Total Contract Value, and Client Refund, supporting percentage-based and fixed-value safety margins. Coefficient tables are hierarchical (Agreement → Operation Type → Bank → Term → Table).
*   **Simulador de Portabilidade**: Calculates "Contrato Novo" and "Contrato Final" after portability, featuring amortization strategy cards, month-by-month chronogram, and PDF export with client data and broker information.
*   **Material de Apoio (Support Materials)**: A resource library organized by categories (Tabelas, Criativos, Processos, Tutoriais). "Tabelas" category features an intelligent commission table simulator that ranks tables by profitability, with a management drawer (Sheet) for table listing/search/edit/delete and bulk CSV import with preview. "Criativos" category features a creative gallery module supporting personalizable (canvas-based customization) and direct download creatives, with direct image upload (drag-and-drop, up to 5MB).
*   **CRM de Vendas (Sales CRM)**: Campaign-based lead management system with lead distribution, status tracking, tag-based client organization, and CSV export/import for enriched leads.
*   **Roteiro Bancário Inteligente (Intelligent Banking Roadmap)**: Manages bank-specific procedures with JSON import, metadata editing, and AI-powered natural language search for bank comparison and operation recommendations.
*   **Base de Clientes (Client CRM)**: Comprehensive client database management supporting Excel/CSV imports, advanced filtering, purchase list requests with package-based pricing, sophisticated deduplication, and a bank exclusion filter.
*   **Massive-Scale Import System**: Streaming infrastructure for importing large files (10M+ rows) with pause/resume capabilities and sequential processing for payroll, contracts, and contacts, including support for federal and state-level import templates.
*   **Desenvolvimento (Training Module)**: Includes AI-powered sales training (Fundamentos, Roleplay IA, Abordagem IA), a DISC behavioral profiler, a feedback system, and team profiles management view.
*   **Employees Module (Funcionários)**: Manages tenant staff with forms for personal, professional, banking data, document uploads, and system access creation with role assignment.
*   **Commercial Teams Module (Equipes Comerciais)**: Manages commercial teams with CRUD operations, coordinator assignment, and member management.
*   **Metas Mensais (Monthly Goals Module)**: Tracks monthly goals for teams and individuals with distinct goal categories and role-based visibility.
*   **Dashboard do Gestor**: Team-focused dashboard for master/coordinator roles showing team goal progress, general ranking, and credit card ranking for brokers.
*   **Dashboard do Vendedor**: Individual seller dashboard displaying ranking badges for general and credit card goals.
*   **Relatórios (Reports Module)**: Provides "Histórico de Produção" (production history) and "Dia a Dia" (daily activity) reports for commercial management, with month/date range selectors and team filters.
*   **WhatsApp Integration**: "Meu WhatsApp" shortcut button in header opens external platform URL with `?crm_user_id={id}`. Env var: `VITE_WHATSAPP_PLATFORM_URL`.
*   **Criador de Criativos IA**: AI-powered creative image generator at `/criador-criativos`. Two-column layout: form (format, convenio, tema, headline, examples, CTA, visual style) and result grid (4 variants, selectable, downloadable, saveable to gallery). Uses DALL-E 3 via `OPENAI_API_KEY`. Daily quota: 5 generations per user. Tables: `creative_generations`, `creative_generation_quota`. Routes: `GET /api/creatives/quota`, `POST /api/creatives/generate`, `POST /api/creatives/save-generation`. Services: `server/services/creativePromptService.ts`, `server/services/imagenService.ts`.

### System Design Choices
The architecture prioritizes client-side calculations for performance, a modular design for extensibility, and robust authentication/authorization with granular control. AI integration is central to advanced features. A granular permission system allows fine-grained control. Multi-tenant branding provides extensive white-label customization with an audit system.

## External Dependencies

### Third-Party UI Libraries
*   Radix UI
*   Shadcn/ui
*   Lucide React

### Form and Validation
*   React Hook Form
*   Zod

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

### AI Integrations
*   OpenAI GPT-4.1-mini
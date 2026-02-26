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
*   **CRM de Vendas (Sales CRM)**: Campaign-based lead management system with lead distribution, transfer, status tracking, and integration with the client database.
*   **Roteiro Bancário Inteligente (Intelligent Banking Roadmap)**: Manages bank-specific procedures with JSON import, metadata editing, and AI-powered natural language search (using OpenAI GPT-4.1-mini) for bank comparison, rule explanation, and operation recommendations.
*   **Base de Clientes (Client CRM)**: Comprehensive client database management, supporting Excel/CSV imports, advanced filtering, purchase list requests with package-based pricing, and sophisticated deduplication logic. Includes a high-performance streaming export system for large datasets.
*   **Massive-Scale Import System**: Streaming infrastructure for importing large files (10M+ rows) with pause/resume capabilities and sequential processing for payroll, contracts, and contacts, ensuring data integrity and traceability. Includes `safeVarchar()` field length protection to prevent varchar overflow crashes, and properly escaped PostgreSQL regex patterns in merge SQL for date parsing.
*   **Academia ConsigOne (Training Module)**: AI-powered sales training featuring static content, quizzes, AI chat roleplay simulations with real-time evaluation, and AI script generation for sales approaches.
*   **Employees Module (Funcionários)**: Manages tenant staff with a multi-step form for personal, family, professional, banking data, document uploads, and system access creation with role assignment and unique CPF validation.
*   **Commercial Teams Module (Equipes Comerciais)**: Manages commercial teams with CRUD operations, coordinator assignment (references users.id), member management via user_id (not employee_id), simplified add-member form (user selection + role only), and tenant isolation. Coordinator reconciliation uses user_id.
*   **Metas Mensais (Monthly Goals Module)**: Tracks monthly goals for teams and individuals with distinct goal categories (General and Card), role-based visibility, and month locking for past periods. Team members are resolved via user_id in commercial_team_members, joined to users table.

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
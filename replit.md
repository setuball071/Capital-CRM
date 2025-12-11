# Simulador GoldCard - Cartão de Crédito e Benefício

## Overview

This project is a web-based simulator for Brazilian credit card and benefits. It enables financial professionals to calculate loan offers using bank-specific coefficient tables, determining total contract values and client refunds based on monthly payment capacity and outstanding balances. The application aims to provide a fast and accurate calculator for Brazilian financial institutions, adhering to Material Design principles. It is production-ready, featuring real-time calculations, multi-format export (PDF/JPEG/PNG), hierarchical user management, and bulk CSV import for coefficient tables.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is built with React 18 and TypeScript, using Vite for development and optimized builds. Wouter handles routing, and React Hook Form with TanStack Query manages state. UI is constructed using Shadcn/ui components atop Radix UI primitives, styled with Tailwind CSS following a custom Material Design-inspired theme. It features a mobile-first, responsive design with theme support. Zod schemas are used for form validation, shared between client and server.

### Backend

The backend uses Node.js with Express and TypeScript, primarily serving as a validation layer. Calculations are performed client-side. Key endpoints include `POST /api/validate-simulation`.

### Data Storage

Currently, data is stored in-memory using a `MemStorage` class. Drizzle ORM is configured for PostgreSQL integration, with schema defined in `shared/schema.ts` and migrations managed via `drizzle-kit`. An `IStorage` interface allows for easy migration to persistent storage.

### Calculation Engine

The core algorithm is coefficient-based, supporting two safety margin models: percentage-based (`percentual`) and fixed value (`fixo`). Calculations determine Liquid Payment (`Parcela Líquida`), Total Contract Value, and Client Refund. Coefficient tables are hierarchical (Agreement → Operation Type → Bank → Term → Table) and stored in the database, filtered by operation type (Credit Card, Benefit Card, Payroll Loan). Calculations are client-side for determinism and performance.

### Authentication and Authorization

A full authentication and authorization system is implemented, featuring session-based authentication with `express-session` and `connect-pg-simple`, password hashing with `bcrypt`, and role-based access control (RBAC). Roles include Master, Coordenação, Atendimento, Operacional, and Vendedor, each with hierarchical permissions for user and data management.

### Roteiro Bancário Inteligente

The banking roadmap module provides intelligent search and management of bank-specific procedures. Access is restricted to master, atendimento, and operacional roles. Features include:

- **JSON Import**: Bulk import of banking roadmaps from structured JSON
- **Metadata Editing**: Edit bank, agreement, segment, and operation type
- **Delete Functionality**: Remove roadmaps with confirmation dialog
- **AI-Powered Search**: Natural language search using OpenAI GPT-4.1-mini via Replit AI Integrations

### AI Search with 7 Advanced Modules

The AI search system uses a two-stage architecture:
1. **Query Interpreter**: Extracts filters (agreement, segment, operation type, age, keywords) and detects which response module to activate
2. **Module-Specific Responder**: Generates humanized responses tailored to the detected intent

Available modules:
- **modulo_1 (Comparação Bancos)**: Compares available banks for a profile
- **modulo_2 (Explicação Regras)**: Explains specific rules and restrictions
- **modulo_3 (Melhor Operação)**: Recommends the best operation type
- **modulo_4 (Documentação)**: Lists required documents
- **modulo_5 (Fluxo Operacional)**: Step-by-step operational flow
- **modulo_6 (Inconsistências)**: Detects incomplete data in roadmaps
- **modulo_7 (Resumo Geral)**: Provides a complete overview of agreement/bank

The system also generates contextual suggestions for follow-up queries based on the detected filters and module.

### Base de Clientes (CRM Module)

The client database module provides comprehensive management for client bases. Access restrictions:
- **Base Import**: Master only - import Excel/CSV files containing client data
- **Purchase Lists**: Master + Coordenação - filter and request client list exports

**Database Structure** (5 new tables):
- `clientes_pessoa`: Core client information (matricula, nome, cpf, convenio, orgao, banco_codigo, agencia, conta, etc.)
- `clientes_folha_mes`: Monthly payroll data (rubricas, descontos, liquido, margem with exact values from spreadsheet)
- `clientes_contratos`: Contract details (banco, numero_contrato, valor_parcela, saldo_devedor, parcelas_restantes)
- `bases_importadas`: Import tracking (nome, convenio, competencia, status)
- `pedidos_lista`: List request management (filtros, quantidade, status)

**Official Column Template** (SIAPE Import):

The import system uses a standardized column mapping (SIAPE_COLUMN_MAP in server/routes.ts) supporting both official template headers and legacy variations:

**Identification (clientes_pessoa)**:
- `CPF`, `MATRICULA`, `CONVENIO`, `ORGAO`, `UF`, `MUNICIPIO`, `SITUACAO_FUNCIONAL`, `DATA_NASCIMENTO`

**Contact**:
- `TELEFONE_1`, `TELEFONE_2`, `TELEFONE_3`, `EMAIL`

**Client's Salary Bank Account (clientes_pessoa)**:
- `BANCO_SALARIO` → `bancoCodigo` (client's bank where salary is deposited)
- `AGENCIA_SALARIO` → `agencia` (client's bank branch)
- `CONTA_SALARIO` → `conta` (client's bank account)
- Legacy aliases: `BANCO`, `AGENCIA`, `CONTA` also map to these fields

**Margins / Payroll Data (clientes_folha_mes)**:
- 70% margin: `MARGEM_70_BRUTA`, `MARGEM_70_UTILIZADA`, `MARGEM_70_SALDO`
- 35% margin: `MARGEM_35_BRUTA`, `MARGEM_35_UTILIZADA`, `MARGEM_35_SALDO`
- Credit card: `MARGEM_CARTAO_CREDITO_BRUTA`, `MARGEM_CARTAO_CREDITO_UTILIZADA`, `MARGEM_CARTAO_CREDITO_SALDO`
- Benefit card: `MARGEM_CARTAO_BENEFICIO_BRUTA`, `MARGEM_CARTAO_BENEFICIO_UTILIZADA`, `MARGEM_CARTAO_BENEFICIO_SALDO`
- Aggregate: `CREDITOS`, `DEBITOS`, `LIQUIDO`

**Contracts / Loans (clientes_contratos)**:
- `BANCO_EMPRESTIMO` → `banco` (lender bank: BMG, PAN, etc.)
- `TIPO_PRODUTO` → `tipoContrato` (consignado, cartao_credito, cartao_beneficio)
- `VALOR_PARCELA` → `valorParcela`
- `SALDO_DEVEDOR` → `saldoDevedor`
- `PRAZO_REMANESCENTE` → `parcelasRestantes` (exact remaining installments from spreadsheet)
- `NUMERO_CONTRATO` → `numeroContrato`
- `SITUACAO_CONTRATO` → `situacaoContrato`

**Contract Deduplication**: Composite key = CPF + matrícula + convênio + banco_emprestimo + numero_contrato

**Fallback Logic for Legacy Spreadsheets**:
- When `BANCO_EMPRESTIMO` is present: `BANCO` goes to client banking data (bancoCodigo), `BANCO_EMPRESTIMO` goes to contract (banco)
- When only `BANCO` is present with contract data (valor_parcela, saldo_devedor, numero_contrato): `BANCO` is used for BOTH client banking data AND contract banco (fallback for legacy SIAPE exports)

**Key Features**:
- Excel/CSV import with base64 encoding
- Filtering by convenio, orgao, UF, idade, situação funcional
- Simulation preview before creating purchase requests
- Status tracking for imports and requests

**Pricing Model** (Package-based):
The system uses a fixed PACKAGE-based pricing model instead of per-record pricing:
- 100 records: R$37.90
- 500 records: R$97.90
- 1000 records: R$197.90
- 2000 records: R$297.90
- 5000 records: R$597.90
- 8000 records: R$797.90
- 10000 records: R$897.90
- 15000 records: R$997.90

The `calculatePackagePrice()` function selects the appropriate package based on record quantity. Orders above 15,000 records use the largest package. Package configuration is defined in the `PACOTES_PRECO` constant in server/routes.ts.

### Academia ConsigOne (Training Module)

The training module provides AI-powered sales training for credit consultants. Features include:

**Database Structure** (6 tables):
- `vendedores_academia`: Vendor training profiles (nivelAtual, quizAprovado, totalSimulacoes, notaMediaGlobal)
- `quiz_tentativas`: Quiz attempt history (acertos, total, aprovado, respostas)
- `roleplay_sessoes`: Roleplay session tracking (nivel, totalMensagens, cenario, status, iniciadoEm, finalizadoEm)
- `roleplay_avaliacoes`: AI evaluation records (notaGlobal, notaHumanizacao, notaConsultivo, pontosFortes, pontosMelhorar)
- `abordagens_geradas`: Generated approach scripts (canal, tipoCliente, produtoFoco, scriptLigacao, scriptWhatsapp)
- `feedbacks_ia_historico`: AI feedback history for admin reviews (notaGeral, resumo, pontosFortes, areasDesenvolvimento, recomendacoes)

**Training Flow**:
1. **Fundamentos** (/academia/fundamentos): Static training content covering 5 levels (Descoberta, Explicação, Oferta, Objeções, Fechamento)
2. **Quiz** (/academia/quiz): Multiple choice quiz with 70% pass threshold - gates access to AI modules
3. **Roleplay** (/academia/roleplay): AI-powered chat simulation with client personas; includes real-time evaluation and 10-message limit per session
4. **Abordagem** (/academia/abordagem): AI script generator for WhatsApp and phone calls
5. **Admin** (/academia/admin): Dashboard for master users to monitor vendor progress

**Roleplay Message Limit**:
- Each roleplay session has a limit of 10 messages from the corretor
- Counter displayed as "X/10" in the session panel
- When limit is reached, session is automatically finalized and evaluation is triggered
- Sessions can also be manually finalized via "Finalizar e Ver Avaliação Completa" button
- `totalSimulacoes` is updated when session is finalized (either by limit or manually)

**API Endpoint**: POST /api/treinador-consigone with modes:
- `roleplay_cliente`: Generates client responses in sales simulation
- `avaliacao_roleplay`: Evaluates vendor performance with detailed scoring (humanização, consultivo, clareza, venda)
- `abordagem_ia`: Generates personalized sales scripts based on client type and product focus

**Access Control**:
- Fundamentos/Quiz: All authenticated users
- Roleplay/Abordagem: Requires quiz approval (quizAprovado = true)
- Admin: Master role only

**Admin Feedback IA**:
The admin dashboard includes AI-powered feedback generation for each vendedor:
- **Endpoint**: POST /api/academia/admin/feedback-ia/:userId
- **Metrics Collected**: Quiz attempts, roleplay sessions, abordagens, lesson progress
- **Feedback Sections**: Nota Geral, Resumo, Pontos Fortes, Áreas de Desenvolvimento, Recomendações, Próximos Passos
- **Response Time**: 5-10 seconds for AI generation

**AI Integration**: Uses OpenAI GPT-4.1-mini via Replit AI Integrations for roleplay simulation, evaluation, script generation, and personalized training feedback.

### Component Architecture

The UI adheres to Atomic Design principles using shadcn/ui. Key pages include the Calculator Page for simulations (with dynamic filtering, real-time calculations, and multi-format export), and Coefficient Tables Management for CRUD operations, bulk CSV import/export, filtering, and hierarchical grouping. User experience features include dynamic dropdowns, clear validation, responsive design, and smart search.

## External Dependencies

### Third-Party UI Libraries

- **Radix UI**: Headless component primitives for accessibility.
- **Shadcn/ui**: Customizable component library built on Radix and Tailwind.
- **Lucide React**: Icon library.

### Form and Validation

- **React Hook Form**: Form state management.
- **Zod**: Schema validation, integrated with Drizzle ORM.
- **@hookform/resolvers**: Connects React Hook Form with Zod.

### Data Fetching

- **TanStack Query**: Server state management with caching and background updates.

### Database and ORM

- **Drizzle ORM**: Type-safe SQL query builder for PostgreSQL.
- **@neondatabase/serverless**: PostgreSQL client optimized for serverless environments.

### Styling and Utilities

- **Tailwind CSS**: Utility-first CSS framework.
- **class-variance-authority**: Component variant management.
- **clsx + tailwind-merge**: Utilities for conditional `className` merging.

### Development Tools

- **Vite**: Build tool and dev server.
- **TypeScript**: Type safety across the stack.

### File Processing

- **PapaParse**: Client-side CSV parsing for bulk imports.
- **html2canvas**: Captures DOM elements as images for export (note: does not support CSS Color 4 functions).
- **jsPDF**: Client-side PDF generation.

### Brazilian Market Specific

- **date-fns**: Date utility library.
- **Intl.NumberFormat**: For Brazilian Real currency formatting.

### Testing

- **Vitest**: Unit testing for calculation logic and edge cases.
- **Playwright**: End-to-end testing for user workflows and validation.
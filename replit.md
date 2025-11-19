# Simulador de Portabilidade de Crédito Consignado

## Overview

This is a Brazilian payroll loan origination calculator web application. It helps loan officers and financial advisors calculate new loan offers for clients with existing payroll-deducted loans (crédito consignado). The application uses bank-specific coefficient tables to calculate the total contract value and client refund based on the client's monthly payment capacity and outstanding balance.

**Core Purpose**: Provide a fast, accurate coefficient-based calculator for Brazilian financial institutions to create loan origination simulations using Material Design principles optimized for financial applications.

**Target Market**: Brazilian financial professionals (loan officers, bank agents), with mobile-first design approach given Brazil's high mobile usage.

**Current Status**: Production-ready. All features implemented and tested. Calculator performs accurate coefficient-based calculations for Banco do Brasil, Caixa Econômica Federal, and Bradesco.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: React Hook Form for form state, TanStack Query for server state
- **UI Framework**: Shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with custom Material Design-inspired theme

**Design System**:
- Material Design principles adapted for financial applications
- Typography: Inter (primary), Roboto Mono (numbers/currency)
- Spacing: Consistent Tailwind units (2, 4, 6, 8, 12, 16)
- Mobile-first responsive layout with utility-first approach
- Theme support (light/dark) via CSS variables

**Form Validation**:
- Zod schemas for runtime validation
- React Hook Form with Zod resolver for form handling
- Shared validation schemas between client and server

### Backend Architecture

**Runtime**: Node.js with Express
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful endpoints under `/api` prefix
- **Development**: tsx for TypeScript execution in development

**Key Design Decisions**:
- Minimal backend - primarily for validation endpoints
- Calculations performed client-side using coefficient tables
- Server acts as validation layer and potential future data persistence point

**API Endpoints**:
- `POST /api/validate-simulation`: Validates simulation input against Zod schema

### Data Storage Solutions

**Current Implementation**: In-memory storage (`MemStorage` class)
- User data stored in Map structure
- Temporary/ephemeral storage for development

**Database Configuration**: Drizzle ORM configured for PostgreSQL
- Schema defined in `shared/schema.ts`
- Migration output directory: `./migrations`
- Ready for PostgreSQL integration via `@neondatabase/serverless`
- Connection via `DATABASE_URL` environment variable

**Storage Interface**: Abstracted via `IStorage` interface allowing easy migration from memory to persistent storage

### Calculation Engine

**Core Algorithm**: Coefficient-based loan calculation
- Formula: `Principal = Monthly Payment / Coefficient`
- Client Refund: `Principal - Outstanding Balance`
- Coefficient tables stored as static data (bank-specific, term-specific, table-specific)

**Available Data**:
- Three banks configured: Banco do Brasil, Caixa Econômica Federal, Bradesco
- Terms: 12, 24, 36, 48, 60, 72, 84 months
- Multiple coefficient tables per bank/term combination (Banco do Brasil has Tabela A and B, others have Tabela A)
- Total of 20+ coefficient entries covering common loan scenarios

**Rationale**: Financial calculations must be deterministic and transparent. Client-side calculation ensures instant feedback and reduces server load.

**Example Calculation**:
- Monthly Payment: R$ 1,000
- Outstanding Balance: R$ 40,000
- Bank: Banco do Brasil
- Term: 60 months
- Coefficient Table: Tabela A (coefficient = 0.0216)
- Result: Total Contract Value = R$ 46,296.30 | Client Refund = R$ 6,296.30

### Authentication and Authorization

**Current State**: Basic user schema defined but no active authentication
- User model includes: id, username (unique identifier)
- No password/session management implemented yet
- Infrastructure in place for future auth implementation

**Session Management**: connect-pg-simple configured for PostgreSQL session store (not currently active)

### Component Architecture

**UI Component Strategy**:
- Atomic design with shadcn/ui base components
- Custom business components in pages directory
- Separation of presentational and container components

**Key Pages**:
- Calculator Page: Main simulation interface with form inputs and results
  - Three-section layout: Client Data, Operation Data (two columns), Results
  - Real-time validation with form error handling
  - Toast notifications for submission feedback
- Not Found: 404 error page

**Shared Logic**:
- Formatters: Currency (Brazilian Real with R$ prefix), CPF auto-formatting (000.000.000-00)
- Calculations: Coefficient-based loan simulation logic
- Query Client: Configured TanStack Query instance

**User Experience Features**:
- CPF auto-formatting as user types
- Dynamic coefficient table dropdown based on bank + term selection
- Form validation with clear error messages via toast notifications
- Success confirmation on simulation creation
- Responsive mobile-first design

## External Dependencies

### Third-Party UI Libraries

**Radix UI**: Headless component primitives
- Provides accessible, unstyled components (dialogs, dropdowns, tooltips, etc.)
- Ensures WCAG compliance and keyboard navigation
- 20+ components imported (@radix-ui/react-*)

**Shadcn/ui**: Pre-styled Radix UI components
- Customizable component library built on Radix
- Configured via `components.json` with "new-york" style
- Tailwind integration with CSS variables for theming

**Lucide React**: Icon library for consistent iconography

### Form and Validation

**React Hook Form**: Form state management
- Performance-optimized with minimal re-renders
- Native validation support

**Zod**: Schema validation
- Runtime type checking
- Shared schemas between client/server
- Integration with Drizzle ORM via drizzle-zod

**@hookform/resolvers**: Bridges React Hook Form and Zod

### Data Fetching

**TanStack Query** (React Query): Server state management
- Caching, background updates, and request deduplication
- Custom query client configuration with conservative refetch settings
- Infinite stale time for calculator data (static coefficient tables)

### Database and ORM

**Drizzle ORM**: Type-safe SQL query builder
- PostgreSQL dialect configured
- Schema-first approach with type inference
- Migration management via drizzle-kit

**@neondatabase/serverless**: PostgreSQL client for serverless environments
- Optimized for edge/serverless deployments
- Connection pooling and WebSocket support

### Styling and Utilities

**Tailwind CSS**: Utility-first CSS framework
- PostCSS integration via autoprefixer
- Custom theme extensions in tailwind.config.ts
- CSS variable-based color system

**class-variance-authority**: Component variant management
- Type-safe variant API
- Used throughout UI components for consistent styling

**clsx + tailwind-merge**: Conditional className utilities
- Merged into single `cn()` utility function
- Prevents Tailwind class conflicts

### Development Tools

**Vite**: Build tool and dev server
- Fast HMR and optimized production builds
- Custom plugins: runtime error overlay, cartographer (Replit integration)
- Path aliases configured (@/, @shared, @assets)

**TypeScript**: Type safety across full stack
- Strict mode enabled
- Shared types between client/server
- Path mapping for clean imports

### Date Handling

**date-fns**: Date utility library
- Functional, immutable date operations
- Tree-shakeable (only imports used functions)

### Brazilian Market Specific

**CPF Validation**: Custom formatting for Brazilian tax ID (CPF)
- Format: 000.000.000-00
- Regex validation in Zod schema

**Currency Formatting**: Brazilian Real (BRL)
- Intl.NumberFormat configured for pt-BR locale
- Format: R$ 1.234,56

### Testing

**Vitest**: Test runner
- Unit tests for calculation logic covering:
  - Coefficient lookup for valid/invalid combinations
  - Available table retrieval
  - Simulation calculations with positive and negative refunds
  - Edge cases (zero coefficients, invalid banks)
- TypeScript support built-in
- All tests passing

**End-to-End Testing**: Playwright-based testing
- Complete user workflows tested across all three banks
- Form validation scenarios verified
- Calculation accuracy confirmed with real coefficient data
- Toast notification behavior validated
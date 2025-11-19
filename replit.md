# Simulador GoldCard - Cartão de Crédito e Benefício

## Overview

This is a Brazilian credit card and benefits simulator web application. It helps financial professionals calculate loan offers for clients with credit cards and benefits. The application uses bank-specific coefficient tables to calculate the total contract value and client refund based on the client's monthly payment capacity and outstanding balance.

**Core Purpose**: Provide a fast, accurate coefficient-based calculator for Brazilian financial institutions to create purchase simulations using Material Design principles optimized for financial applications.

**Target Market**: Brazilian financial professionals (loan officers, bank agents), with mobile-first design approach given Brazil's high mobile usage.

**Current Status**: Production-ready. All features implemented and tested. Calculator performs automatic real-time calculations with multi-format export ("Salvar" - PDF/JPEG/PNG). Includes hierarchical user management with create, edit, delete, and activate/deactivate functionality. Bulk CSV import for coefficient tables with Excel PT-BR compatibility.

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

**Current State**: Full authentication and authorization system implemented
- User model includes: id, name, email, passwordHash, role (master/coordenacao/vendedor), managerId, isActive
- Session-based authentication using express-session with PostgreSQL store
- Password hashing with bcrypt
- Role-based access control (RBAC) with hierarchical permissions

**Roles**:
- **Master**: Full system access (create/edit/delete any user, manage all data)
- **Coordenação**: Team management (create/edit/delete vendedores in their team, access team simulations)
- **Vendedor**: Simulation-only access (create simulations, view own data)

**User Management Features**:
- Create new users with role assignment
- Edit user information (name, email, password, role, manager, status)
- Delete users permanently (master can delete anyone except themselves, coordinators can delete their team members)
- Activate/deactivate users (soft delete alternative)
- Hierarchical visibility: master sees all, coordinator sees only their team
- Self-protection: users cannot delete themselves

**Session Management**: PostgreSQL session store with connect-pg-simple

### Component Architecture

**UI Component Strategy**:
- Atomic design with shadcn/ui base components
- Custom business components in pages directory
- Separation of presentational and container components

**Key Pages**:
- Calculator Page: Main simulation interface with form inputs and results
  - Three-section layout: Client Data, Operation Data (two columns), Results
  - Real-time automatic calculations when all fields are filled
  - Multi-format export via "Salvar" dropdown button (PDF, JPEG, PNG)
  - Toast notifications for feedback
- Not Found: 404 error page

**Shared Logic**:
- Formatters: Currency (Brazilian Real with R$ prefix)
- Calculations: Coefficient-based loan simulation logic
- Query Client: Configured TanStack Query instance

**User Experience Features**:
- Dynamic coefficient table dropdown based on bank + term selection
- Form validation with clear error messages via toast notifications
- Success confirmation on simulation creation
- Responsive mobile-first design
- Hierarchical user management with role-based access control
- Bulk import of coefficient tables via CSV spreadsheet:
  - Download template CSV with proper Excel PT-BR formatting (semicolon delimiters)
  - Upload and validate CSV files with row-level error reporting
  - Preview imported data before confirming
  - Batch creation of multiple tables in a single operation
- Free-text bank input with autocomplete suggestions for 20 common Brazilian banks/fintechs
- Brazilian decimal format support (comma or period) for coefficient values

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

### File Processing

**PapaParse**: CSV parsing and generation library
- Client-side CSV file parsing with header detection
- Configurable delimiter support (semicolon for Excel PT-BR)
- Used for bulk import of coefficient tables
- Error handling and data validation during parsing

**html2canvas**: Screenshot capture library
- Captures DOM elements as high-quality images (2x scale)
- Used for exporting simulation results
- Configurable background and logging options

**jsPDF**: PDF generation library
- Client-side PDF document creation
- A4 format with automatic scaling and centering
- Converts captured images to PDF format with proper margins

### Brazilian Market Specific

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
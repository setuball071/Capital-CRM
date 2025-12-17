# Guia de Instalação - Simulador GoldCard

## Requisitos

- Node.js 20+
- PostgreSQL 14+
- npm ou yarn

## Passo a Passo

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar banco de dados

Crie um banco PostgreSQL e configure a variável de ambiente:

```bash
export DATABASE_URL="postgresql://usuario:senha@host:5432/nome_do_banco"
export SESSION_SECRET="sua-chave-secreta-aqui"
```

### 3. Criar estrutura do banco

Opção A - Usar Drizzle (recomendado):
```bash
npm run db:push
```

Opção B - Usar arquivo SQL exportado:
```bash
psql $DATABASE_URL < database_export/schema.sql
```

### 4. Importar dados (opcional)

Se quiser restaurar os dados existentes:
```bash
psql $DATABASE_URL < database_export/data.sql
```

### 5. Iniciar aplicação

Desenvolvimento:
```bash
npm run dev
```

Produção:
```bash
npm run build
npm start
```

A aplicação estará disponível em http://localhost:5000

## Variáveis de Ambiente Necessárias

| Variável | Descrição |
|----------|-----------|
| DATABASE_URL | URL de conexão PostgreSQL |
| SESSION_SECRET | Chave secreta para sessões |
| OPENAI_API_KEY | Chave da API OpenAI (para recursos de IA) |

## Estrutura do Projeto

```
├── client/          # Frontend React
├── server/          # Backend Express
├── shared/          # Tipos e schemas compartilhados
├── database_export/ # Backup do banco de dados
└── attached_assets/ # Arquivos anexos
```

## Credenciais Padrão

- Email: admin@sistema.com
- Senha: Admin@2025

## Hospedagem Sugerida

- **Vercel** ou **Railway** - Para o app Node.js
- **Neon** ou **Supabase** - Para PostgreSQL gerenciado
- **Render** - Alternativa completa (app + banco)

## Suporte

O projeto usa:
- React 18 + TypeScript
- Express.js
- Drizzle ORM
- TanStack Query
- Shadcn/ui + Tailwind CSS

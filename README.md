# Cat Budget 🐱💰

A playful budgeting app that turns your savings goals into adorable cat piggy banks.

## Features

- **Cat Piggy Banks** - Organize money into cute cat-themed buckets
- **Bank Sync** - Connect NZ bank accounts via Akahu
- **Transaction Allocation** - Categorize spending to buckets
- **Scheduled Transactions** - Track upcoming bills
- **Offline Support** - PWA with IndexedDB caching
- **Auto-categorization** - Rules to auto-allocate transactions

## Tech Stack

- **Frontend**: Next.js 16, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL (via Supabase)
- **Auth**: Supabase Auth
- **Banking**: Akahu API (NZ open banking)
- **PWA**: next-pwa, IndexedDB

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase project
- An Akahu developer account (for bank sync)

### Environment Variables

Create a `.env` file:

```env
# Database (from Supabase)
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Akahu (NZ Bank Sync)
AKAHU_APP_TOKEN="your-app-token"
AKAHU_USER_TOKEN="your-user-token"
```

### Setup

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Run Supabase RLS migrations
# (Run supabase/migrations/20260105_rls_policies.sql in Supabase SQL Editor)

# Start dev server
npm run dev
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full deployment guide.

### Quick Deploy to Vercel

```bash
npx vercel
```

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
│   ├── api/            # API routes
│   ├── inbox/          # Transaction inbox
│   ├── upcoming/       # Scheduled transactions
│   └── settings/       # User settings
├── components/
│   ├── buckets/        # Cat piggy bank components
│   ├── transactions/   # Transaction UI
│   ├── layout/         # App shell, nav
│   └── ui/             # Shared UI components
├── lib/
│   ├── db.ts           # Prisma client
│   ├── supabase/       # Supabase clients
│   ├── offline/        # PWA/IndexedDB layer
│   └── *.ts            # Utility functions
└── types/              # TypeScript declarations
```

## License

MIT

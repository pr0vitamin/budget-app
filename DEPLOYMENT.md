# Deployment Guide

Deploy Cat Budget to Vercel (frontend) with Supabase (database + auth).

## Prerequisites

- GitHub account with repo pushed
- Vercel account
- Supabase project

---

## 1. Supabase Setup

### Create Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Note your **Project URL** and **anon key** (Settings → API)
3. Get **Database URL** (Settings → Database → Connection string → URI)

### Database Schema

Run Prisma migrations against Supabase:

```bash
# Set DATABASE_URL to your Supabase connection string
DATABASE_URL="postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres"

# Push schema
npx prisma db push
```

### RLS Policies

1. Go to Supabase Dashboard → SQL Editor
2. Run the contents of `supabase/migrations/20260105_rls_policies.sql`

### Auth Configuration

1. Go to Authentication → URL Configuration
2. Add your production URL to **Redirect URLs**:
   - `https://your-app.vercel.app/auth/callback`

---

## 2. Vercel Deployment

### Deploy from CLI

```bash
npx vercel
```

Follow prompts to link/create project.

### Or Deploy from GitHub

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repo
3. Vercel auto-detects Next.js

### Environment Variables

Add these in Vercel Dashboard → Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres?pgbouncer=true` |
| `DIRECT_URL` | `postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://[project].supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key |
| `AKAHU_APP_TOKEN` | Your Akahu app token |
| `AKAHU_USER_TOKEN` | Your Akahu user token |

### Custom Domain (Optional)

1. Vercel Dashboard → Settings → Domains
2. Add your domain
3. Update DNS records as instructed
4. Update Supabase redirect URLs

---

## 3. Post-Deployment Checklist

- [ ] App loads at production URL
- [ ] Can sign in/sign up
- [ ] Can create buckets and allocate
- [ ] Bank sync works (if using Akahu)
- [ ] PWA installs on mobile

---

## Troubleshooting

### "Invalid API Key" errors
- Verify SUPABASE keys are correct
- Check NEXT_PUBLIC_ prefix for client-side vars

### Database connection errors
- Use `?pgbouncer=true` in DATABASE_URL for Vercel serverless
- DIRECT_URL should NOT have pgbouncer param

### RLS errors
- Ensure all RLS policies are applied
- Check that tables have RLS enabled

### PWA not installing
- Must be on HTTPS
- Check manifest.json is served correctly
- Verify service worker is registered

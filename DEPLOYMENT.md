# Deployment Guide — Cat Budget (rebuild)

Deploy to **Vercel** (Next.js) + **Supabase** (Auth + Postgres). The app uses Supabase **only for
auth**; all data goes through **Prisma → Postgres** server-side. This is a **greenfield** deploy —
no data is migrated from the old app.

## Prerequisites

- The rebuild code on your deploy branch (see Step 0)
- A Vercel account (the old app's project can be reused)
- A new Supabase project for production
- Akahu personal-app tokens (developers section of my.akahu.nz)

---

## Step 0 — Get the code onto your deploy branch

The rebuild lives on a feature branch. Merge it into the branch Vercel builds (usually `main`):

```bash
git checkout main
git merge claude/serene-moser-84e111
git push origin main
```

(Deploying this replaces the old app. That's intended — and data starts fresh.)

---

## Step 1 — Create the Supabase project

1. [supabase.com](https://supabase.com) → **New Project**. Keep it **separate** from the old app's
   project. Choose a strong DB password and a nearby region.
2. **Project Settings → Data API → Security:**
   - **Enable Data API: OFF** — the app never uses PostgREST/supabase-js for data.
   - **Automatically expose new tables: OFF.**
   - **Enable automatic RLS: ON** — harmless safety net (Prisma bypasses RLS; we also add policies).

---

## Step 2 — Collect credentials

From **Settings → API**:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **Publishable key** (legacy: "anon") → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- **Secret key** (legacy: "service_role") → `SUPABASE_SECRET_KEY`

From **Settings → Database → Connection string**:
- **Transaction pooler** URI → `DATABASE_URL` (append `?pgbouncer=true`)
- **Session pooler / Direct** URI → `DIRECT_URL`

---

## Step 3 — Push the schema to the production database

We use `prisma db push` (the repo's `prisma/migrations/` are the *old* project's and don't match —
do **not** run `migrate deploy`). Run from your local checkout, pointing Prisma at prod via inline
env vars (don't edit your local `.env`):

```bash
DIRECT_URL="<prod DIRECT_URL>" DATABASE_URL="<prod DATABASE_URL>" npx prisma db push
```

Expected: "Your database is now in sync with your Prisma schema."

---

## Step 4 — Apply RLS policies (defense-in-depth)

Supabase Dashboard → **SQL Editor** → paste and run the contents of
`supabase/migrations/20260601_rls_v2.sql`.

---

## Step 5 — Configure Supabase Auth

**Authentication → URL Configuration:**
- **Site URL** = your production URL (set the real Vercel URL after Step 6 if you don't have a custom
  domain yet).
- Add the same URL to the **Redirect URLs** allow-list.

**Authentication → Email Templates** (the OTP / "Magic Link" template):
- The body **must include `{{ .Token }}`** — otherwise Supabase sends a magic *link*, not the code
  the login screen asks for.
- (Optional) **Providers → Email → Email OTP length**: match the login form's input length.

---

## Step 6 — Deploy to Vercel

1. [vercel.com/new](https://vercel.com/new) → import the GitHub repo (or reuse the existing project).
   Next.js is auto-detected; the build command is `prisma generate && next build` (from `package.json`).
2. **Settings → Environment Variables** (Production):

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key |
   | `SUPABASE_SECRET_KEY` | secret key |
   | `DATABASE_URL` | transaction pooler URI + `?pgbouncer=true` |
   | `DIRECT_URL` | session pooler / direct URI |
   | `AKAHU_APP_TOKEN` | Akahu app token |
   | `AKAHU_USER_TOKEN` | Akahu user token |
   | `NEXT_PUBLIC_APP_URL` | your production URL |

   **Do NOT set `AUTH_DEV_BYPASS`.** (It's hard-disabled in production regardless, but leave it unset.)
3. Deploy.

---

## Step 7 — Finalize URLs

Once you know the production URL (Vercel domain or custom domain):
- Set `NEXT_PUBLIC_APP_URL` to it and **redeploy** if it changed.
- Update Supabase **Site URL** + **Redirect URLs** to match.
- Custom domain: Vercel → Settings → Domains, then update DNS and the Supabase URLs.

---

## Step 8 — Smoke test (the important one)

1. Open the production URL → you should hit `/login`. Enter your email, get the **code**, sign in.
2. On the **Cats** page → Manage → create a Clowder, add a Cat with a top-up.
3. **Transactions** → Add transaction → income (e.g. $200). Back to Cats → **Feed** a cat.
4. **Settings → Bank accounts** → Connect / sync accounts → **Sync now**.
5. On **Transactions**, allocate a synced expense (try a split). Then **Sync now again** and confirm
   the allocation is **still there** — this verifies the headline fix (sync never unallocates).
6. On mobile, install the PWA (Add to Home Screen) over HTTPS.

---

## Troubleshooting

- **Prepared-statement / pooler errors:** ensure `DATABASE_URL` has `?pgbouncer=true`; keep
  `DIRECT_URL` on the session/direct port (no pgbouncer param).
- **"Invalid API key":** check the `NEXT_PUBLIC_` prefix on client vars and that keys match the prod project.
- **Login sends a link, not a code:** add `{{ .Token }}` to the email template (Step 5).
- **Akahu sync returns 0 / errors:** verify `AKAHU_APP_TOKEN` + `AKAHU_USER_TOKEN`; first sync only
  pulls a recent window — use **Full refresh** in Settings to widen it.
- **PWA won't install:** must be HTTPS; confirm `/manifest.json` and the service worker load.

# Running the rebuild locally (hosted Supabase + local Postgres)

The rebuilt app uses **Supabase only for auth**; all data lives in your **local Postgres**
(`cat_budget`). You don't need to deploy anything to run it locally.

## Quickest path: local-dev auth bypass (no Supabase at all)

`.env` ships with `AUTH_DEV_BYPASS=true`. With it on, the app skips Supabase entirely and treats
every request as a fixed local user (`dev@localhost`). Just:

```bash
brew services start postgresql@16   # if not already running
npm run dev                         # http://localhost:3000 — straight into the app, no login
```

The bypass is **hard-disabled in production** (it also requires `NODE_ENV !== production`), so it
can never ship live. To exercise the real Supabase login flow instead, set `AUTH_DEV_BYPASS` to
anything but `true` (or remove it) and follow the Supabase setup below.

---

## Prerequisites (already set up on this machine)

- Postgres 16 via Homebrew, running as a service. If it isn't running:
  `brew services start postgresql@16`
- The `cat_budget` database with the current schema. If you ever need to re-apply the schema:
  `npm run db:push`
- `.env` exists (gitignored) with `DATABASE_URL` / `DIRECT_URL` pointing at local Postgres. **Leave
  those pointing at local Postgres** — do NOT point them at your production Supabase.

## One-time Supabase setup (for auth)

1. Create a **new, separate** Supabase project at https://supabase.com (keep it distinct from the
   live app's project so nothing touches your real data). Wait for it to finish provisioning.
2. In the project: **Settings → API**. Copy these into `.env`, replacing the placeholders:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (legacy name: "anon" key) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - **Secret key** (legacy name: "service_role" key) → `SUPABASE_SECRET_KEY`
3. **Authentication → URL Configuration**: set **Site URL** to `http://localhost:3000`.
4. **Authentication → Email template** (the "Magic Link"/OTP template): make sure the body
   includes the token, e.g. `Your code is {{ .Token }}`. Without `{{ .Token }}` Supabase only sends
   a magic *link* and you'll never receive a typeable code — the login screen expects a **code**.
5. (Optional) **Authentication → Providers → Email**: set **Email OTP length** to match the login
   form. If the form expects 8 digits, set 8; otherwise the default 6 is fine.

> RLS is NOT needed locally: Prisma connects directly to local Postgres and bypasses RLS. The
> `supabase/migrations/20260601_rls_v2.sql` policies only matter once you host the database on
> Supabase for production.

## Run it

```bash
npm run dev
# open http://localhost:3000 → redirected to /login → enter your email →
# check email for the code → enter it → you're in.
```

On first sign-in, a `User` row is created in local Postgres keyed by your Supabase auth id
(`ensureUserExists`). Then create a group + some cat buckets and try feeding them.

## What works vs. not, at this stage (end of Phase 2)

- ✅ Buckets, cash stuffing (tap-to-feed, Feed All, confetti), inbox allocation + auto-remainder,
  manual transaction entry, settings, bucket/group management.
- ⛔ **Bank sync (Akahu) is Phase 3** — not built yet. No Akahu env needed to test Phase 2. Add
  income/expenses via manual entry to exercise the budget.

## Going to production later

Point `DATABASE_URL`/`DIRECT_URL` at a Supabase Postgres, run `npm run db:push` against it, apply
`supabase/migrations/20260601_rls_v2.sql` in the Supabase SQL editor, set the same env vars in
Vercel, and deploy.

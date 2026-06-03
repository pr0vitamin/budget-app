// Local-development auth bypass.
//
// Lets `npm run dev` run with NO Supabase by treating every request as a fixed
// local user. It is HARD-DISABLED in production: it requires BOTH a
// non-production NODE_ENV AND an explicit opt-in env flag, so even if
// AUTH_DEV_BYPASS leaked into a production environment it would stay off.

export const DEV_USER = {
  id: '00000000-0000-0000-0000-000000000000',
  email: 'dev@localhost',
};

/** True only outside production AND when AUTH_DEV_BYPASS is explicitly "true". */
export function isAuthBypassEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.AUTH_DEV_BYPASS === 'true';
}

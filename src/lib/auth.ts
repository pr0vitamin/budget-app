import { createClient } from '@/lib/supabase/server';
import { ensureUserExists } from '@/lib/ensure-user';
import { DEV_USER, isAuthBypassEnabled } from '@/lib/dev-auth';

/**
 * Resolve the authenticated user's id for a route handler, ensuring a matching
 * row exists in our User table. Returns null when unauthenticated so the caller
 * can respond 401.
 */
export async function getAuthedUserId(): Promise<string | null> {
  // Local-dev only (see dev-auth.ts) — never active in production.
  if (isAuthBypassEnabled()) {
    await ensureUserExists(DEV_USER);
    return DEV_USER.id;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  await ensureUserExists(user);
  return user.id;
}

import { createClient } from '@/lib/supabase/server';
import { ensureUserExists } from '@/lib/ensure-user';

/**
 * Resolve the authenticated user's id for a route handler, ensuring a matching
 * row exists in our User table. Returns null when unauthenticated so the caller
 * can respond 401.
 */
export async function getAuthedUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  await ensureUserExists(user);
  return user.id;
}

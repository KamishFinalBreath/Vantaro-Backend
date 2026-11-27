import { createClient, type User } from '@supabase/supabase-js';
import { env } from './env.js';

// Anonymous client used to validate incoming user access tokens.
// No session is persisted; we only call auth.getUser(token) per request.
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

/**
 * Verifies a Supabase Auth access token (JWT) and returns the user.
 * Throws if the token is missing/invalid/expired.
 */
export async function verifySupabaseToken(token: string): Promise<User> {
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw error ?? new Error('Invalid Supabase access token');
  }
  return data.user;
}
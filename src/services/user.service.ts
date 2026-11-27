import type { User as PrismaUser } from '@prisma/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { prisma } from '../config/prisma.js';

/**
 * Upsert a Supabase Auth user into our local `users` table keyed by the
 * Supabase user id (the JWT `sub` claim). Safe to call on every request.
 */
export async function syncUserFromSupabase(supabaseUser: SupabaseUser): Promise<PrismaUser> {
  const metadata = (supabaseUser.user_metadata ?? {}) as Record<string, unknown>;
  const email = supabaseUser.email ?? (metadata.email as string | undefined) ?? null;
  const firstName =
    (metadata.first_name as string | undefined) ??
    (metadata.firstName as string | undefined) ??
    null;
  const lastName =
    (metadata.last_name as string | undefined) ??
    (metadata.lastName as string | undefined) ??
    null;
  const imageUrl =
    (metadata.avatar_url as string | undefined) ??
    (metadata.picture as string | undefined) ??
    null;

  const data = { email, firstName, lastName, imageUrl };

  return prisma.user.upsert({
    where: { id: supabaseUser.id },
    update: data,
    create: { id: supabaseUser.id, ...data },
  });
}

export async function getUserById(id: string): Promise<PrismaUser | null> {
  return prisma.user.findUnique({ where: { id } });
}
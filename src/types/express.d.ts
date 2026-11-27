import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { User as PrismaUser } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      /** Local DB user row, populated by the sync middleware. */
      vantaroUser?: PrismaUser;
      /** Full Supabase Auth user object, populated by the sync middleware. */
      supabaseUser?: SupabaseUser;
    }
  }
}

export {};
import type { User as PrismaUser } from '@prisma/client';
import type { User as ClerkUser } from '@clerk/backend';

declare global {
  namespace Express {
    interface Request {
      /** Local DB user row, populated by the sync middleware. */
      vantaroUser?: PrismaUser;
      /** Full Clerk user object, populated by the sync middleware. */
      clerkUser?: ClerkUser;
    }
  }
}

export {};
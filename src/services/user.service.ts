import type { User } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export interface ClerkUserLike {
  id: string;
  emailAddresses?: Array<{ emailAddress: string }>;
  primaryEmailAddressId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
}

function pickEmail(user: ClerkUserLike): string | null {
  const primary = user.primaryEmailAddressId
    ? user.emailAddresses?.find((e) => e.emailAddress && user.primaryEmailAddressId)
    : undefined;
  if (primary?.emailAddress) return primary.emailAddress;
  return user.emailAddresses?.[0]?.emailAddress ?? null;
}

/**
 * Upsert a Clerk user into our local `users` table keyed by clerkId.
 * Safe to call on every authenticated request; returns the local user row.
 */
export async function syncUserFromClerk(clerkUser: ClerkUserLike): Promise<User> {
  const data = {
    email: pickEmail(clerkUser),
    firstName: clerkUser.firstName ?? null,
    lastName: clerkUser.lastName ?? null,
    imageUrl: clerkUser.imageUrl ?? null,
  };

  return prisma.user.upsert({
    where: { clerkId: clerkUser.id },
    update: data,
    create: { clerkId: clerkUser.id, ...data },
  });
}

export async function getUserByClerkId(clerkId: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { clerkId } });
}
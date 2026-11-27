import { clerkClient, getAuth } from '@clerk/express';
import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { syncUserFromClerk } from '../services/user.service.js';

/**
 * Verifies the Clerk session token (populated by the global clerkMiddleware)
 * and rejects unauthenticated requests with a JSON 401 instead of a redirect.
 * Mount on every protected route.
 */
export const requireClerkAuth = (req: Request, _res: Response, next: NextFunction) => {
  const auth = getAuth(req);
  if (!auth?.userId) {
    next(ApiError.unauthorized('Missing or invalid Clerk session'));
    return;
  }
  next();
};

/**
 * After requireClerkAuth, loads the full Clerk user, syncs it to the local DB,
 * and attaches both `req.clerkUser` and `req.vantaroUser` for downstream use.
 */
export const syncClerkUser = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const auth = getAuth(req);
    if (!auth?.userId) {
      throw ApiError.unauthorized('Missing Clerk session');
    }

    const clerkUser = await clerkClient.users.getUser(auth.userId);
    const localUser = await syncUserFromClerk({
      id: clerkUser.id,
      emailAddresses: clerkUser.emailAddresses.map((e) => ({
        emailAddress: e.emailAddress,
      })),
      primaryEmailAddressId: clerkUser.primaryEmailAddressId,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      imageUrl: clerkUser.imageUrl,
    });

    req.clerkUser = clerkUser;
    req.vantaroUser = localUser;
    next();
  },
);
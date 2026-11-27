import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { NextFunction, Request, Response } from 'express';
import { verifySupabaseToken } from '../config/supabase.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { syncUserFromSupabase } from '../services/user.service.js';

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

/**
 * Rejects requests without a Bearer token with a JSON 401.
 * Mount on every protected route (before syncSupabaseUser).
 */
export const requireSupabaseAuth = (req: Request, _res: Response, next: NextFunction) => {
  if (!extractBearer(req)) {
    next(ApiError.unauthorized('Missing Bearer access token'));
    return;
  }
  next();
};

/**
 * Verifies the Supabase access token, syncs the user to the local DB, and
 * attaches `req.supabaseUser` and `req.vantaroUser` for downstream use.
 */
export const syncSupabaseUser = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const token = extractBearer(req);
    if (!token) throw ApiError.unauthorized('Missing Bearer access token');

    let supabaseUser: SupabaseUser;
    try {
      supabaseUser = await verifySupabaseToken(token);
    } catch {
      throw ApiError.unauthorized('Invalid or expired access token');
    }

    const localUser = await syncUserFromSupabase(supabaseUser);

    req.supabaseUser = supabaseUser;
    req.vantaroUser = localUser;
    next();
  },
);
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: 'NotFound',
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: err.name,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'ValidationError',
      message: 'Invalid request payload',
      details: err.issues,
    });
    return;
  }

  // Prisma unique-constraint / known errors
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: string }).code;
    if (code === 'P2002') {
      res.status(409).json({
        error: 'Conflict',
        message: 'A record with the same unique value already exists',
      });
      return;
    }
  }

  console.error('[unhandled error]', err);
  res.status(500).json({
    error: 'InternalServerError',
    message: 'Something went wrong',
  });
}
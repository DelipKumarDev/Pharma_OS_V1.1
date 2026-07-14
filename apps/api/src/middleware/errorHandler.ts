import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { sendError } from '../utils/response';
import { logger } from '../utils/logger';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400,
    public errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  logger.error(`${req.method} ${req.path} - ${err.message}`, { stack: err.stack });

  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode, err.errors);
    return;
  }

  if (err instanceof ZodError) {
    const errors: Record<string, string[]> = {};
    err.errors.forEach(e => {
      const key = e.path.join('.');
      errors[key] = errors[key] ?? [];
      errors[key]!.push(e.message);
    });
    sendError(res, 'Validation failed', 422, errors);
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      sendError(res, 'A record with this value already exists', 409);
      return;
    }
    if (err.code === 'P2025') {
      sendError(res, 'Record not found', 404);
      return;
    }
    sendError(res, 'Database error', 500);
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    sendError(res, 'Invalid data provided', 400);
    return;
  }

  sendError(res, 'Internal server error', 500);
}

export function notFound(req: Request, res: Response): void {
  sendError(res, `Route ${req.method} ${req.path} not found`, 404);
}

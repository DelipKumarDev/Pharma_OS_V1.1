import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';

// Money columns are Decimal in the DB, so Prisma returns Prisma.Decimal objects.
// The API contract (and the frontend) expect plain JS numbers, so every response
// payload is deep-walked and any Decimal is converted to a number. This keeps the
// exactness at rest (DB + aggregation) while preserving the number-based API.
function decimalsToNumbers(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Prisma.Decimal.isDecimal(value)) return (value as Prisma.Decimal).toNumber();
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(decimalsToNumbers);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = decimalsToNumbers(v);
    return out;
  }
  return value;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
  timestamp: string;
  requestId: string;
}

export interface PaginatedData<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200,
): void {
  const requestId = (res.locals['requestId'] as string | undefined) ?? uuidv4();
  res.status(statusCode).json({
    success: true,
    data: decimalsToNumbers(data) as T,
    message,
    timestamp: new Date().toISOString(),
    requestId,
  } satisfies ApiResponse<T>);
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 400,
  errors?: Record<string, string[]>,
): void {
  const requestId = (res.locals['requestId'] as string | undefined) ?? uuidv4();
  res.status(statusCode).json({
    success: false,
    message,
    errors,
    timestamp: new Date().toISOString(),
    requestId,
  } satisfies ApiResponse<never>);
}

export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedData<T> {
  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

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
    data,
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

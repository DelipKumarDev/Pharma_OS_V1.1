import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { sendError } from '../utils/response';

export function validate(schema: ZodSchema, target: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const errors: Record<string, string[]> = {};
      result.error.errors.forEach(e => {
        const key = e.path.join('.') || 'value';
        errors[key] = errors[key] ?? [];
        errors[key]!.push(e.message);
      });
      sendError(res, 'Validation failed', 422, errors);
      return;
    }
    req[target] = result.data;
    next();
  };
}

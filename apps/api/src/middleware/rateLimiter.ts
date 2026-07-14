import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { sendError } from '../utils/response';
import { Response, RequestHandler } from 'express';

// express-rate-limit v7 ships express v5 typings; cast back to the v4 RequestHandler

export const apiLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res: Response) => {
    sendError(res, 'Too many requests, please try again later.', 429);
  },
}) as unknown as RequestHandler;

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res: Response) => {
    sendError(res, 'Too many login attempts. Please try again in 15 minutes.', 429);
  },
}) as unknown as RequestHandler;

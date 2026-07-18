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
  // Only failed logins count toward the limit. Successful logins must never
  // trip it, or pharmacies behind a single shared public IP (multiple staff on
  // one counter terminal) get locked out during a normal morning. Per-account
  // lockout after 5 failures (auth.service) remains the primary defense.
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res: Response) => {
    sendError(res, 'Too many failed login attempts from this network. Please try again in 15 minutes.', 429);
  },
}) as unknown as RequestHandler;

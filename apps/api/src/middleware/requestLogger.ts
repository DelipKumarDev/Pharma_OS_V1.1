import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import type { AuthRequest } from './authenticate';

// Per-request correlation + structured access log. A client may supply its own
// X-Request-ID (propagated through logs and echoed back); otherwise one is
// generated. We log ONLY non-sensitive fields — never the body, Authorization
// header, cookies, or query string (which can carry PII).
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.get('x-request-id');
  const requestId = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : uuidv4();
  res.locals['requestId'] = requestId;
  res.setHeader('X-Request-ID', requestId);

  // originalUrl is preserved across router mounts (req.path/req.url get rewritten
  // by sub-routers), and we drop the query string (may carry PII).
  const routePath = (req.originalUrl || req.url).split('?')[0];
  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const user = (req as AuthRequest).user;
    const meta: Record<string, unknown> = {
      requestId,
      method: req.method,
      route: routePath,
      status: res.statusCode,
      durationMs,
      ip: req.ip,
      // Safe context only, present once authenticated. No tokens/emails/PII.
      ...(user ? { userId: user.sub, tenantId: user.tenantId } : {}),
    };
    const msg = `${req.method} ${routePath} ${res.statusCode} ${durationMs}ms`;
    // Status-based severity so auth failures (401/403) and server errors surface
    // for alerting instead of hiding in info-level noise.
    if (res.statusCode >= 500) logger.error(msg, meta);
    else if (res.statusCode >= 400) logger.warn(msg, meta);
    else logger.info(msg, meta);
  });
  next();
}

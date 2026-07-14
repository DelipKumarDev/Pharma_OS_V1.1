import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JwtPayload } from '../utils/jwt';
import { sendError } from '../utils/response';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    sendError(res, 'Authentication required', 401);
    return;
  }

  const token = authHeader.slice(7);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    sendError(res, 'Invalid or expired token', 401);
  }
}

export function requirePermission(module: string, action: string) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const hasPermission = user.permissions.includes(`${module}:${action}`) ||
      user.permissions.includes(`${module}:*`) ||
      user.permissions.includes('*:*');
    if (!hasPermission) {
      sendError(res, 'Insufficient permissions', 403);
      return;
    }
    next();
  };
}

export function requireRoles(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const hasRole = roles.some(role => user.roles.includes(role));
    if (!hasRole) {
      sendError(res, 'Insufficient role', 403);
      return;
    }
    next();
  };
}

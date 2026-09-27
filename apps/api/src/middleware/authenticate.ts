import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JwtPayload } from '../utils/jwt';
import { sendError } from '../utils/response';
import { prisma } from '../config/database';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    sendError(res, 'Authentication required', 401);
    return;
  }

  const token = authHeader.slice(7);
  let payload: JwtPayload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    sendError(res, 'Invalid or expired token', 401);
    return;
  }

  try {
    // Server-side session + account check. A valid signature is NOT enough: the
    // session must still be active AND the user must still exist and be active.
    // This is what makes logout, password-change, account-disable and account-
    // delete take effect immediately on the ACCESS token — not only at refresh.
    const session = await prisma.userSession.findUnique({
      where: { id: payload.sessionId },
      select: { isActive: true, user: { select: { status: true, deletedAt: true, tenant: { select: { status: true, deletedAt: true } } } } },
    });
    if (!session || !session.isActive) {
      sendError(res, 'Session is no longer valid. Please sign in again.', 401);
      return;
    }
    if (session.user.deletedAt) {
      sendError(res, 'Account no longer exists', 401);
      return;
    }
    if (session.user.status !== 'active') {
      sendError(res, 'Account is not active', 403);
      return;
    }
    // Tenant-level gate — a suspended/deactivated pharmacy blocks all its users
    // immediately (not only at token expiry).
    const t = session.user.tenant;
    if (t.deletedAt || (t.status !== 'active' && t.status !== 'trial')) {
      sendError(res, 'This pharmacy account is not active. Contact your provider.', 403);
      return;
    }
    req.user = payload;
    next();
  } catch (err) {
    next(err);
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

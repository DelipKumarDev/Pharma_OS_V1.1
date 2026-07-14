import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface JwtPayload {
  sub: string;
  tenantId: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
  sessionId: string;
}

export interface RefreshPayload {
  sub: string;
  tokenId: string;
}

export function signAccessToken(payload: Omit<JwtPayload, never>): string {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function signRefreshToken(payload: RefreshPayload): string {
  return jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, config.JWT_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): RefreshPayload {
  return jwt.verify(token, config.JWT_REFRESH_SECRET) as RefreshPayload;
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    return jwt.decode(token) as JwtPayload;
  } catch {
    return null;
  }
}

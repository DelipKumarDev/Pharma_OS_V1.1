import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { sendSuccess, sendError } from '../../utils/response';
import { AuthRequest } from '../../middleware/authenticate';

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ipAddress = req.ip ?? req.socket.remoteAddress;
    const deviceInfo = req.get('user-agent');
    const { accessToken, refreshToken, user } = await authService.login(req.body, ipAddress, deviceInfo);
    sendSuccess(res, {
      user,
      tokens: { accessToken, refreshToken, expiresIn: 900 },
    }, 'Login successful');
  } catch (err) {
    next(err);
  }
}

export async function logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken } = req.body as { refreshToken: string };
    if (!req.user) { sendError(res, 'Unauthorized', 401); return; }
    await authService.logout(req.user.sub, refreshToken, req.user.tenantId);
    sendSuccess(res, null, 'Logged out successfully');
  } catch (err) {
    next(err);
  }
}

export async function refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { accessToken, refreshToken: newRefresh, user } = await authService.refreshTokens(req.body);
    sendSuccess(res, {
      user,
      tokens: { accessToken, refreshToken: newRefresh, expiresIn: 900 },
    });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) { sendError(res, 'Unauthorized', 401); return; }
    const user = await authService.getMe(req.user.sub);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.forgotPassword(req.body);
    sendSuccess(res, null, 'If your email is registered, you will receive a password reset OTP.');
  } catch (err) {
    next(err);
  }
}

export async function sendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.sendOtp(req.body);
    sendSuccess(res, null, 'OTP sent successfully.');
  } catch (err) {
    next(err);
  }
}

export async function verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const valid = await authService.verifyOtp(req.body);
    if (!valid) { sendError(res, 'Invalid or expired OTP', 400); return; }
    sendSuccess(res, { verified: true }, 'OTP verified successfully');
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.resetPassword(req.body);
    sendSuccess(res, null, 'Password reset successfully. Please login with your new password.');
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) { sendError(res, 'Unauthorized', 401); return; }
    await authService.changePassword(req.user.sub, req.user.tenantId, req.body);
    sendSuccess(res, null, 'Password changed successfully.');
  } catch (err) {
    next(err);
  }
}

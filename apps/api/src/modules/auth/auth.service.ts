import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { comparePassword, hashPassword, generateOtp } from '../../utils/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import { createAuditLog } from '../../utils/audit';
import { sendOtpEmail } from '../../utils/mailer';
import { v4 as uuidv4 } from 'uuid';
import type {
  LoginInput,
  RefreshInput,
  ForgotPasswordInput,
  SendOtpInput,
  VerifyOtpInput,
  ResetPasswordInput,
  ChangePasswordInput,
} from './auth.schema';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const OTP_EXPIRES_MINUTES = 10;

async function buildTokensForUser(user: { id: string; tenantId: string; email: string; name: string }, sessionId: string) {
  const userRoles = await prisma.userRole.findMany({
    where: { userId: user.id },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });

  const roles = userRoles.map(ur => ur.role.name);
  const permissions = Array.from(
    new Set(
      userRoles.flatMap(ur =>
        ur.role.permissions.map(rp => `${rp.permission.module}:${rp.permission.action}`)
      )
    )
  );

  const accessToken = signAccessToken({
    sub: user.id,
    tenantId: user.tenantId,
    email: user.email,
    name: user.name,
    roles,
    permissions,
    sessionId,
  });

  return { accessToken, roles, permissions };
}

export async function login(
  input: LoginInput,
  ipAddress?: string,
  deviceInfo?: string,
) {
  const user = await prisma.user.findFirst({
    where: { email: input.email, deletedAt: null },
    include: { tenant: true },
  });

  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  // Check lock
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    throw new AppError(`Account locked. Try again in ${minutesLeft} minutes.`, 423);
  }

  if (user.status === 'locked') {
    throw new AppError('Account is locked. Contact your administrator.', 423);
  }

  if (user.status === 'inactive' || user.status === 'suspended') {
    throw new AppError('Account is inactive. Contact your administrator.', 403);
  }

  const passwordValid = await comparePassword(input.password, user.passwordHash);
  if (!passwordValid) {
    const newFailedAttempts = user.failedLoginAttempts + 1;
    const shouldLock = newFailedAttempts >= MAX_FAILED_ATTEMPTS;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: newFailedAttempts,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCK_DURATION_MS) : null,
      },
    });

    await createAuditLog({
      tenantId: user.tenantId,
      userId: user.id,
      userName: user.name,
      module: 'auth',
      action: 'login_failed',
      description: `Failed login attempt for ${user.email} from IP ${ipAddress ?? 'unknown'}`,
      ipAddress,
      deviceInfo,
      severity: 'critical',
      status: 'failed',
    });

    if (shouldLock) {
      throw new AppError('Too many failed attempts. Account locked for 15 minutes.', 423);
    }
    throw new AppError('Invalid email or password', 401);
  }

  // Reset failed attempts
  const sessionId = uuidv4();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      status: user.status === 'pending' ? 'active' : user.status,
    },
  });

  const { accessToken, roles, permissions } = await buildTokensForUser(user, sessionId);

  // Refresh token
  const tokenId = uuidv4();
  const refreshToken = signRefreshToken({ sub: user.id, tokenId });
  const refreshExpiry = new Date();
  refreshExpiry.setDate(refreshExpiry.getDate() + 7);

  await prisma.refreshToken.create({
    data: {
      id: tokenId,
      userId: user.id,
      token: refreshToken,
      expiresAt: refreshExpiry,
      deviceInfo,
      ipAddress,
    },
  });

  // Create session
  await prisma.userSession.create({
    data: {
      tenantId: user.tenantId,
      userId: user.id,
      userName: user.name,
      userRole: roles[0],
      deviceInfo,
      ipAddress,
      isActive: true,
    },
  });

  await createAuditLog({
    tenantId: user.tenantId,
    userId: user.id,
    userName: user.name,
    userRole: roles[0],
    module: 'auth',
    action: 'login',
    description: `Login from ${deviceInfo ?? 'unknown device'} — IP ${ipAddress ?? 'unknown'}`,
    ipAddress,
    deviceInfo,
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      avatar: user.avatarUrl,
      tenantId: user.tenantId,
      tenantName: user.tenant.name,
      tenantSlug: user.tenant.slug,
      supportContact: user.tenant.supportContact ?? undefined,
      roles,
      permissions,
      mfaEnabled: user.mfaEnabled,
      lastLoginAt: user.lastLoginAt?.toISOString(),
      passwordChangedAt: user.passwordChangedAt?.toISOString(),
    },
  };
}

export async function logout(userId: string, refreshToken: string, tenantId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, token: refreshToken },
    data: { revokedAt: new Date() },
  });

  await prisma.userSession.updateMany({
    where: { userId, isActive: true },
    data: { isActive: false, logoutAt: new Date() },
  });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  await createAuditLog({
    tenantId,
    userId,
    userName: user?.name,
    module: 'auth',
    action: 'logout',
    description: `User logged out`,
  });
}

export async function refreshTokens(input: RefreshInput) {
  let payload;
  try {
    payload = verifyRefreshToken(input.refreshToken);
  } catch {
    throw new AppError('Invalid refresh token', 401);
  }

  const storedToken = await prisma.refreshToken.findFirst({
    where: { id: payload.tokenId, userId: payload.sub, revokedAt: null },
    include: { user: { include: { tenant: true } } },
  });

  if (!storedToken || storedToken.expiresAt < new Date()) {
    throw new AppError('Refresh token expired or revoked', 401);
  }

  const { user } = storedToken;
  if (user.status !== 'active') {
    throw new AppError('Account is no longer active', 403);
  }

  const sessionId = uuidv4();
  const { accessToken, roles, permissions } = await buildTokensForUser(user, sessionId);

  // Rotate refresh token
  await prisma.refreshToken.update({ where: { id: storedToken.id }, data: { revokedAt: new Date() } });

  const tokenId = uuidv4();
  const newRefreshToken = signRefreshToken({ sub: user.id, tokenId });
  const refreshExpiry = new Date();
  refreshExpiry.setDate(refreshExpiry.getDate() + 7);
  await prisma.refreshToken.create({
    data: { id: tokenId, userId: user.id, token: newRefreshToken, expiresAt: refreshExpiry },
  });

  return {
    accessToken,
    refreshToken: newRefreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      avatar: user.avatarUrl,
      tenantId: user.tenantId,
      tenantName: user.tenant.name,
      tenantSlug: user.tenant.slug,
      supportContact: user.tenant.supportContact ?? undefined,
      roles,
      permissions,
      mfaEnabled: user.mfaEnabled,
    },
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
    include: {
      tenant: true,
      userRoles: {
        include: {
          role: { include: { permissions: { include: { permission: true } } } },
        },
      },
    },
  });

  if (!user) throw new AppError('User not found', 404);

  const roles = user.userRoles.map(ur => ur.role.name);
  const permissions = Array.from(
    new Set(user.userRoles.flatMap(ur => ur.role.permissions.map(rp => `${rp.permission.module}:${rp.permission.action}`)))
  );

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    avatar: user.avatarUrl,
    tenantId: user.tenantId,
    tenantName: user.tenant.name,
    tenantSlug: user.tenant.slug,
    roles,
    permissions,
    mfaEnabled: user.mfaEnabled,
    lastLoginAt: user.lastLoginAt?.toISOString(),
    passwordChangedAt: user.passwordChangedAt?.toISOString(),
  };
}

export async function forgotPassword(input: ForgotPasswordInput): Promise<void> {
  const user = await prisma.user.findFirst({ where: { email: input.email, deletedAt: null } });
  // Always succeed to prevent email enumeration
  if (!user) return;

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);

  // Invalidate old OTPs
  await prisma.otpCode.updateMany({
    where: { userId: user.id, purpose: 'password_reset', usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.otpCode.create({
    data: { userId: user.id, code: otp, purpose: 'password_reset', expiresAt },
  });

  await sendOtpEmail(input.email, otp, 'password_reset');
}

export async function sendOtp(input: SendOtpInput): Promise<void> {
  const user = await prisma.user.findFirst({ where: { email: input.email, deletedAt: null } });
  if (!user) return;

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);

  await prisma.otpCode.updateMany({
    where: { userId: user.id, purpose: input.purpose, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.otpCode.create({
    data: { userId: user.id, code: otp, purpose: input.purpose, expiresAt },
  });

  await sendOtpEmail(input.email, otp, input.purpose);
}

export async function verifyOtp(input: VerifyOtpInput): Promise<boolean> {
  const user = await prisma.user.findFirst({ where: { email: input.email, deletedAt: null } });
  if (!user) return false;

  const otpRecord = await prisma.otpCode.findFirst({
    where: {
      userId: user.id,
      code: input.otp,
      purpose: input.purpose,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  return !!otpRecord;
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const user = await prisma.user.findFirst({ where: { email: input.email, deletedAt: null } });
  if (!user) throw new AppError('Invalid request', 400);

  const otpRecord = await prisma.otpCode.findFirst({
    where: {
      userId: user.id,
      code: input.otp,
      purpose: 'password_reset',
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otpRecord) throw new AppError('Invalid or expired OTP', 400);

  const passwordHash = await hashPassword(input.newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordChangedAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    }),
    prisma.otpCode.update({ where: { id: otpRecord.id }, data: { usedAt: new Date() } }),
    prisma.refreshToken.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } }),
  ]);

  await createAuditLog({
    tenantId: user.tenantId,
    userId: user.id,
    userName: user.name,
    module: 'auth',
    action: 'update',
    description: 'Password reset via OTP',
    severity: 'critical',
  });
}

export async function changePassword(userId: string, tenantId: string, input: ChangePasswordInput): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found', 404);

  const valid = await comparePassword(input.currentPassword, user.passwordHash);
  if (!valid) throw new AppError('Current password is incorrect', 400);

  const passwordHash = await hashPassword(input.newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, passwordChangedAt: new Date() },
  });

  await prisma.refreshToken.updateMany({ where: { userId }, data: { revokedAt: new Date() } });

  await createAuditLog({
    tenantId,
    userId,
    userName: user.name,
    module: 'auth',
    action: 'update',
    description: 'Password changed by user',
    severity: 'critical',
  });
}

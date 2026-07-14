import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
  tenantId: z.string().optional(),
  rememberMe: z.boolean().optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email'),
});

export const sendOtpSchema = z.object({
  email: z.string().email('Invalid email'),
  purpose: z.enum(['password_reset', 'mfa', 'email_verification']).default('password_reset'),
});

export const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6, 'OTP must be 6 digits'),
  purpose: z.enum(['password_reset', 'mfa', 'email_verification']).default('password_reset'),
});

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[a-z]/, 'Must contain lowercase letter')
    .regex(/[0-9]/, 'Must contain number')
    .regex(/[@$!%*?&#]/, 'Must contain special character'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/)
    .regex(/[@$!%*?&#]/),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

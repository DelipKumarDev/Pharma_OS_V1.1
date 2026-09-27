import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('4000').transform(Number),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_ROUNDS: z.string().default('12').transform(Number),
  CORS_ORIGIN: z.string().default('http://localhost:3001'),
  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform(Number),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100').transform(Number),
  AUTH_RATE_LIMIT_MAX: z.string().default('5').transform(Number),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE_MB: z.string().default('10').transform(Number),
  LOG_LEVEL: z.string().default('info'),
  LOG_DIR: z.string().default('./logs'),
  SUPER_ADMIN_EMAIL: z.string().email().optional(),
  SUPER_ADMIN_PASSWORD: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional().transform(v => v ? Number(v) : 587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional().default('noreply@pharmaos.in'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;

// ─── Production configuration safety ────────────────────────────────────────
// Beyond type validation, production must refuse to start with unsafe config:
// placeholder/weak secrets, wildcard or localhost CORS, a default DB password, or
// http URLs. Returns issues rather than throwing so callers can log + fail fast.
// IMPORTANT: never include a secret VALUE in an issue string — only describe it.
export interface ConfigIssues { errors: string[]; warnings: string[]; }

const PLACEHOLDER = /change[\s_-]?me|placeholder|example|your[\s_-]|replace[\s_-]?me|xxxx|generate-a/i;

export function checkProductionConfig(cfg: Config = config): ConfigIssues {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (cfg.NODE_ENV !== 'production') return { errors, warnings };

  // Secrets — strong, non-placeholder, and distinct.
  if (cfg.JWT_SECRET.length < 32) errors.push('JWT_SECRET must be at least 32 characters');
  if (PLACEHOLDER.test(cfg.JWT_SECRET)) errors.push('JWT_SECRET looks like a placeholder — set a real random secret');
  if (PLACEHOLDER.test(cfg.JWT_REFRESH_SECRET)) errors.push('JWT_REFRESH_SECRET looks like a placeholder — set a real random secret');
  if (cfg.JWT_SECRET === cfg.JWT_REFRESH_SECRET) errors.push('JWT_SECRET and JWT_REFRESH_SECRET must be different values');

  // CORS — never wildcard or localhost in production; prefer https.
  const origins = cfg.CORS_ORIGIN.split(',').map(o => o.trim()).filter(Boolean);
  if (origins.length === 0) errors.push('CORS_ORIGIN must be set in production');
  if (origins.some(o => o === '*')) errors.push('CORS_ORIGIN must not be "*" in production');
  if (origins.some(o => /localhost|127\.0\.0\.1/i.test(o))) errors.push('CORS_ORIGIN must not point at localhost/127.0.0.1 in production');
  if (origins.some(o => o.startsWith('http://'))) warnings.push('CORS_ORIGIN uses http:// — production traffic should be https://');

  // Database — reject the example placeholder and obvious weak passwords.
  if (/USER:PASSWORD/.test(cfg.DATABASE_URL)) errors.push('DATABASE_URL still contains the example USER:PASSWORD placeholder');
  if (/:(postgres|password|admin|root|changeme|123456)@/i.test(cfg.DATABASE_URL)) errors.push('DATABASE_URL uses a weak/default database password');

  // Email — non-fatal (a console fallback exists), but surface it clearly.
  if (!cfg.SMTP_HOST || !process.env['SMTP_USER'] || !process.env['SMTP_PASS']) {
    warnings.push('SMTP not fully configured — invite/OTP/alert emails will be logged to console, not delivered');
  }

  return { errors, warnings };
}

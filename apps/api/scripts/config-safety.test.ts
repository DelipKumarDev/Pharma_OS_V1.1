/**
 * Production configuration & secrets safety suite (Phase 4).
 *
 * 1. checkProductionConfig() must PASS a well-formed production config and FLAG
 *    each unsafe setting (placeholder/weak/duplicate secrets, wildcard/localhost
 *    CORS, default DB password).
 * 2. In non-production it must be a no-op.
 * 3. The demo seed must REFUSE to run when NODE_ENV=production (spawned).
 *
 * Run: npx tsx scripts/config-safety.test.ts
 */
import 'dotenv/config';
import { spawnSync } from 'child_process';
import { checkProductionConfig, type Config } from '../src/config';

type R = { id: string; expected: string; actual: string; pass: boolean };
const results: R[] = [];
const rec = (r: R) => results.push(r);

// A well-formed production config baseline.
const good: Config = {
  NODE_ENV: 'production',
  PORT: 4000,
  DATABASE_URL: 'postgresql://pharmaos:Str0ng-Rand0m-Pass-9x7q@db:5432/pharmaos?schema=public',
  JWT_SECRET: 'k8Jd2p9Qw7Zx3Vb6Nm1Lc4Rt5Yh0Gf8Ss2Aa1Bb', // 40 chars, random-ish
  JWT_REFRESH_SECRET: 'Zp1Qm7Wd3Kx9Vc2Nb6Lr4Th5Yg0Ff8Ee2Dd1Cc9', // different
  JWT_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  BCRYPT_ROUNDS: 12,
  CORS_ORIGIN: 'https://app.pharmacy.example.com',
  RATE_LIMIT_WINDOW_MS: 60000,
  RATE_LIMIT_MAX_REQUESTS: 1200,
  AUTH_RATE_LIMIT_MAX: 10,
  UPLOAD_DIR: 'uploads',
  MAX_FILE_SIZE_MB: 10,
  LOG_LEVEL: 'info',
  LOG_DIR: 'logs',
  SUPER_ADMIN_EMAIL: undefined,
  SUPER_ADMIN_PASSWORD: undefined,
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: 587,
  SMTP_USER: 'user',
  SMTP_PASS: 'pass',
  SMTP_FROM: 'noreply@pharmaos.in',
};

function expectErrorContains(id: string, cfg: Config, needle: string) {
  const { errors } = checkProductionConfig(cfg);
  const hit = errors.some(e => e.toLowerCase().includes(needle.toLowerCase()));
  rec({ id, expected: `error ~ "${needle}"`, actual: hit ? 'flagged' : `NOT flagged (${errors.length} errors)`, pass: hit });
}

function main() {
  console.log('\n🔧 Production config & secrets safety suite\n');

  // 1. Good production config → no errors.
  {
    const { errors } = checkProductionConfig(good);
    rec({ id: 'GOOD-config-passes', expected: '0 errors', actual: `${errors.length} errors: ${errors.join('; ')}`, pass: errors.length === 0 });
  }
  // 2. Non-production → no-op even with junk.
  {
    const { errors } = checkProductionConfig({ ...good, NODE_ENV: 'development', JWT_SECRET: 'change-me', CORS_ORIGIN: '*' });
    rec({ id: 'DEV-noop', expected: '0 errors (dev)', actual: `${errors.length} errors`, pass: errors.length === 0 });
  }
  // 3. Each unsafe setting is flagged.
  expectErrorContains('WEAK-jwt-short', { ...good, JWT_SECRET: 'short' }, 'at least 32');
  expectErrorContains('PLACEHOLDER-jwt', { ...good, JWT_SECRET: 'CHANGE-ME-generate-a-long-random-secret-here' }, 'placeholder');
  expectErrorContains('DUPLICATE-secrets', { ...good, JWT_REFRESH_SECRET: good.JWT_SECRET }, 'must be different');
  expectErrorContains('WILDCARD-cors', { ...good, CORS_ORIGIN: '*' }, 'must not be "*"');
  expectErrorContains('LOCALHOST-cors', { ...good, CORS_ORIGIN: 'http://localhost:3000' }, 'localhost');
  expectErrorContains('EXAMPLE-dburl', { ...good, DATABASE_URL: 'postgresql://USER:PASSWORD@localhost:5432/pharmaos' }, 'USER:PASSWORD');
  expectErrorContains('WEAK-dbpass', { ...good, DATABASE_URL: 'postgresql://pharmaos:postgres@db:5432/pharmaos' }, 'weak/default database password');
  // 4. http CORS is a warning, not an error.
  {
    const { errors, warnings } = checkProductionConfig({ ...good, CORS_ORIGIN: 'http://app.example.com' });
    rec({ id: 'HTTP-cors-warning', expected: 'warning, not error', actual: `errors=${errors.length} warnings=${warnings.length}`, pass: errors.length === 0 && warnings.some(w => w.includes('http://')) });
  }

  // 5. Seed guard: spawning the seed with NODE_ENV=production must refuse (exit 1).
  {
    const proc = spawnSync('npx', ['tsx', 'prisma/seed.ts'], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: 'production', ALLOW_PROD_SEED: '' },
      encoding: 'utf8', shell: true, timeout: 60000,
    });
    const out = `${proc.stdout ?? ''}${proc.stderr ?? ''}`;
    const refused = proc.status === 1 && /Refusing to seed/i.test(out);
    rec({ id: 'SEED-guard-prod', expected: 'exit 1 + refusal', actual: `exit=${proc.status} refused=${/Refusing to seed/i.test(out)}`, pass: refused });
  }

  const pass = results.filter(r => r.pass).length;
  const fail = results.filter(r => !r.pass);
  console.log('ID                     | RESULT | EXPECTED                    | ACTUAL');
  console.log('-'.repeat(100));
  for (const r of results) console.log(`${r.id.padEnd(22)} | ${(r.pass ? 'PASS' : 'FAIL').padEnd(6)} | ${r.expected.padEnd(27)} | ${r.actual}`);
  console.log('-'.repeat(100));
  console.log(`\nTOTAL ${results.length}  |  PASS ${pass}  |  FAIL ${fail.length}\n`);
  if (fail.length > 0) process.exit(1);
}

main();

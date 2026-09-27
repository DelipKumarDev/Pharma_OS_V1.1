/**
 * PHASE 11 — Application security probes (code-level protections).
 * Complements the cross-tenant (32/32) and auth (14/14) suites with: SQL-injection,
 * mass-assignment, security headers, CORS, sensitive-data exposure, path traversal.
 * Synthetic data; self-cleaning. Run: npx tsx scripts/security-scan.test.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
const prisma = new PrismaClient();
const API = process.env['API_BASE'] ?? 'http://localhost:4000';
const SLUG = 'zz-sec-scan', PW = 'Sec@12345';

type R = { id: string; expected: string; actual: string; pass: boolean };
const results: R[] = [];
const rec = (r: R) => results.push(r);

async function raw(method: string, path: string, token?: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  let json: any = null; try { json = await res.json(); } catch { /* */ }
  return { status: res.status, json, headers: res.headers };
}

async function cleanup() {
  const t = await prisma.tenant.findFirst({ where: { slug: SLUG }, select: { id: true } });
  if (!t) return; const where = { tenantId: t.id };
  const users = await prisma.user.findMany({ where, select: { id: true } });
  await prisma.userSession.deleteMany({ where }).catch(() => {});
  await prisma.userRole.deleteMany({ where: { userId: { in: users.map(u => u.id) } } }).catch(() => {});
  const roles = await prisma.role.findMany({ where, select: { id: true } });
  await prisma.rolePermission.deleteMany({ where: { roleId: { in: roles.map(r => r.id) } } }).catch(() => {});
  await prisma.role.deleteMany({ where }).catch(() => {});
  await prisma.auditLog.deleteMany({ where }).catch(() => {});
  await prisma.medicine.deleteMany({ where }).catch(() => {});
  await prisma.user.deleteMany({ where }).catch(() => {});
  await prisma.tenant.deleteMany({ where: { id: t.id } }).catch(() => {});
}

async function main() {
  console.log(`\n🛡️  Security probe suite → ${API}\n`);
  await cleanup();
  const tenant = await prisma.tenant.create({ data: { name: 'ZZ SecScan', slug: SLUG, type: 'retail', status: 'active', plan: 'starter' } });
  const perms = await prisma.permission.findMany({ where: { module: { not: 'platform' } }, select: { id: true } });
  const role = await prisma.role.create({ data: { tenantId: tenant.id, name: 'Admin', isSystem: false } });
  await prisma.rolePermission.createMany({ data: perms.map(p => ({ roleId: role.id, permissionId: p.id })) });
  const admin = await prisma.user.create({ data: { tenantId: tenant.id, name: 'sec', email: 'sec@zz.test', passwordHash: await bcrypt.hash(PW, 10), status: 'active' } });
  await prisma.userRole.create({ data: { userId: admin.id, roleId: role.id } });
  await prisma.medicine.create({ data: { tenantId: tenant.id, name: 'Aspirin', mrp: 10, purchasePrice: 5, sellingPrice: 9, gstRate: 12 } });
  const token = (await raw('POST', '/api/auth/login', undefined, { email: 'sec@zz.test', password: PW })).json?.data?.tokens?.accessToken;
  if (!token) throw new Error('login failed');

  // 1. SQL injection via search — parameterized; must not error or dump rows, and table survives.
  {
    const inj = await raw('GET', `/api/medicines?search=${encodeURIComponent("' OR '1'='1")}`, token);
    const drop = await raw('GET', `/api/medicines?search=${encodeURIComponent("x'; DROP TABLE medicines; --")}`, token);
    const stillWorks = await raw('GET', '/api/medicines?limit=1', token);
    rec({ id: 'SQLI-search', expected: '200, no injection, table intact', actual: `orInj=${inj.status} drop=${drop.status} after=${stillWorks.status}`, pass: inj.status === 200 && drop.status === 200 && stillWorks.status === 200 });
  }
  // 2. Mass assignment — self tenant PATCH must ignore status/plan/slug.
  {
    const before = await prisma.tenant.findUnique({ where: { id: tenant.id } });
    const r = await raw('PATCH', `/api/tenants/${tenant.id}`, token, { name: 'Renamed Pharmacy', status: 'active', plan: 'enterprise', slug: 'hacked-slug', deletedAt: new Date().toISOString() });
    const after = await prisma.tenant.findUnique({ where: { id: tenant.id } });
    const nameChanged = after?.name === 'Renamed Pharmacy';
    const protectedUnchanged = after?.status === before?.status && after?.plan === before?.plan && after?.slug === before?.slug && !after?.deletedAt;
    rec({ id: 'MASS-ASSIGN', expected: 'name editable; status/plan/slug ignored', actual: `status=${r.status} name=${nameChanged} plan=${after?.plan} status=${after?.status} slug=${after?.slug}`, pass: r.status === 200 && nameChanged && protectedUnchanged });
  }
  // 3. Security headers (helmet) present on API responses.
  {
    const r = await raw('GET', '/health', token);
    const nosniff = r.headers.get('x-content-type-options');
    const noPoweredBy = !r.headers.get('x-powered-by');
    rec({ id: 'SEC-HEADERS', expected: 'nosniff + no x-powered-by', actual: `x-content-type-options=${nosniff} x-powered-by=${r.headers.get('x-powered-by') ?? 'absent'}`, pass: nosniff === 'nosniff' && noPoweredBy });
  }
  // 4. CORS — a disallowed origin must not be reflected.
  {
    const r = await raw('GET', '/health', token, undefined, { Origin: 'http://evil.example.com' });
    const acao = r.headers.get('access-control-allow-origin');
    rec({ id: 'CORS', expected: 'evil origin not reflected', actual: `ACAO=${acao ?? 'absent'}`, pass: acao !== 'http://evil.example.com' });
  }
  // 5. Sensitive-data exposure — errors are generic, no stack trace leaked.
  {
    const malformed = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad json' });
    const mj: any = await malformed.json().catch(() => ({}));
    const notFound = await raw('GET', '/api/medicines/does-not-exist-id', token);
    const noStack = !JSON.stringify(mj).toLowerCase().includes('at ') && !JSON.stringify(notFound.json ?? '').toLowerCase().includes('stack');
    rec({ id: 'NO-STACK-LEAK', expected: 'generic errors, no stack', actual: `malformed=${malformed.status} msg="${mj.message ?? ''}" 404=${notFound.status}`, pass: malformed.status === 400 && noStack });
  }
  // 6. Path traversal via export type — unknown/traversal type must not read files.
  {
    const r = await raw('GET', `/api/settings/export/${encodeURIComponent('../../../../etc/passwd')}`, token);
    const body = JSON.stringify(r.json ?? '');
    const leaked = body.includes('root:') || body.includes('/bin/');
    rec({ id: 'PATH-TRAVERSAL', expected: 'rejected, no file contents', actual: `status=${r.status} leaked=${leaked}`, pass: (r.status === 400 || r.status === 404 || r.status === 422) && !leaked });
  }
  // 7. Auth required — protected route without token is denied.
  {
    const r = await raw('GET', '/api/reports?days=1');
    rec({ id: 'AUTH-REQUIRED', expected: '401 without token', actual: `status=${r.status}`, pass: r.status === 401 });
  }

  const pass = results.filter(r => r.pass).length, fail = results.filter(r => !r.pass);
  console.log('ID                | RESULT | EXPECTED                              | ACTUAL');
  console.log('-'.repeat(115));
  for (const r of results) console.log(`${r.id.padEnd(17)} | ${(r.pass ? 'PASS' : 'FAIL').padEnd(6)} | ${r.expected.padEnd(37)} | ${r.actual}`);
  console.log('-'.repeat(115));
  console.log(`\nTOTAL ${results.length}  |  PASS ${pass}  |  FAIL ${fail.length}\n`);
  await cleanup();
  await prisma.$disconnect();
  if (fail.length > 0) process.exit(1);
}
main().catch(async e => { console.error('SUITE ERROR:', e); await cleanup().catch(() => {}); await prisma.$disconnect().catch(() => {}); process.exit(2); });

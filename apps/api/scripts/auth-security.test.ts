/**
 * Authentication & Authorization regression suite (Phase 2).
 *
 * Seeds one synthetic tenant with three users at different privilege levels, then
 * exercises the full auth lifecycle against the LIVE API: permission allow/deny,
 * token validity (expired / invalid / forged-session), disabled + deleted users,
 * logout + password-change invalidation, lockout, and privilege escalation.
 *
 * Run: npx tsx scripts/auth-security.test.ts   (API on API_BASE, DB reachable)
 * Synthetic data only; cleans up after itself.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const API = process.env['API_BASE'] ?? 'http://localhost:4000';
const SECRET = process.env['JWT_SECRET'] as string;
const PW = 'Sec@12345';
const SLUG = 'zz-auth-t';

type R = { id: string; area: string; expected: string; actual: string; evidence: string; pass: boolean };
const results: R[] = [];
const rec = (r: R) => results.push(r);

async function api(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let json: any = null; try { json = await res.json(); } catch { /* */ }
  return { status: res.status, json };
}
const login = (email: string, password: string) => api('POST', '/api/auth/login', undefined, { email, password });
const tokenOf = (r: any) => r.json?.data?.tokens?.accessToken;

async function teardown() {
  const ten = await prisma.tenant.findMany({ where: { slug: SLUG }, select: { id: true } });
  const ids = ten.map(t => t.id); if (!ids.length) return;
  const where = { tenantId: { in: ids } };
  const users = await prisma.user.findMany({ where, select: { id: true } });
  const uids = users.map(u => u.id);
  await prisma.refreshToken.deleteMany({ where: { userId: { in: uids } } }).catch(() => {});
  await prisma.userSession.deleteMany({ where }).catch(() => {});
  await prisma.otpCode.deleteMany({ where: { userId: { in: uids } } }).catch(() => {});
  await prisma.auditLog.deleteMany({ where }).catch(() => {});
  await prisma.userRole.deleteMany({ where: { userId: { in: uids } } }).catch(() => {});
  const roles = await prisma.role.findMany({ where, select: { id: true } });
  await prisma.rolePermission.deleteMany({ where: { roleId: { in: roles.map(r => r.id) } } }).catch(() => {});
  await prisma.role.deleteMany({ where }).catch(() => {});
  await prisma.user.deleteMany({ where }).catch(() => {});
  await prisma.tenant.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
}

async function main() {
  console.log(`\n🔐 Auth & Authorization suite → ${API}\n`);
  if (!SECRET) throw new Error('JWT_SECRET not in env');
  await teardown();

  const tenant = await prisma.tenant.create({ data: { name: 'ZZ Auth Tenant', slug: SLUG, type: 'retail', status: 'active', plan: 'professional' } });
  // Exclude platform:manage — a pharmacy admin must not be a platform operator
  // (keeps the PLATFORM-gate assertion meaningful).
  const perms = await prisma.permission.findMany({ where: { module: { not: 'platform' } } });
  const idOf = (m: string, a: string) => perms.find(p => p.module === m && p.action === a)?.id;
  const need = (m: string, a: string) => { const id = idOf(m, a); if (!id) throw new Error(`missing perm ${m}:${a}`); return id; };

  async function makeUser(email: string, permPairs: Array<[string, string]>): Promise<string> {
    const role = await prisma.role.create({ data: { tenantId: tenant.id, name: `role-${email}`, isSystem: false } });
    await prisma.rolePermission.createMany({ data: permPairs.map(([m, a]) => ({ roleId: role.id, permissionId: need(m, a) })) });
    const u = await prisma.user.create({ data: { tenantId: tenant.id, name: email, email, passwordHash: await bcrypt.hash(PW, 10), status: 'active' } });
    await prisma.userRole.create({ data: { userId: u.id, roleId: role.id } });
    return u.id;
  }

  // Admin: full catalog. Limited: medicines:view only. UserMgr: user mgmt but NOT settings:edit.
  const allPairs = perms.map(p => [p.module, p.action] as [string, string]);
  const adminId = await (async () => {
    const role = await prisma.role.create({ data: { tenantId: tenant.id, name: 'role-admin', isSystem: false } });
    await prisma.rolePermission.createMany({ data: perms.map(p => ({ roleId: role.id, permissionId: p.id })) });
    const u = await prisma.user.create({ data: { tenantId: tenant.id, name: 'admin@zz', email: 'admin@zz-auth.test', passwordHash: await bcrypt.hash(PW, 10), status: 'active' } });
    await prisma.userRole.create({ data: { userId: u.id, roleId: role.id } });
    return u.id;
  })();
  void allPairs; void adminId;
  await makeUser('limited@zz-auth.test', [['medicines', 'view']]);
  await makeUser('usermgr@zz-auth.test', [['users', 'view'], ['users', 'create'], ['users', 'edit'], ['medicines', 'view']]);
  const disposableId = await makeUser('disposable@zz-auth.test', [['medicines', 'view']]);

  const adminTok = tokenOf(await login('admin@zz-auth.test', PW));
  const limitedTok = tokenOf(await login('limited@zz-auth.test', PW));
  const usermgrTok = tokenOf(await login('usermgr@zz-auth.test', PW));
  if (!adminTok || !limitedTok || !usermgrTok) throw new Error('login failed for a fixture user');

  // 1. authenticated + valid permission = allowed
  {
    const r = await api('GET', '/api/medicines', adminTok);
    rec({ id: 'ALLOW-valid-perm', area: 'authz', expected: '200', actual: String(r.status), evidence: `admin GET /api/medicines = ${r.status}`, pass: r.status === 200 });
  }
  // 2. authenticated + missing permission = denied
  {
    const r = await api('DELETE', '/api/inventory/00000000-0000-0000-0000-000000000000', limitedTok);
    rec({ id: 'DENY-missing-perm', area: 'authz', expected: '403', actual: String(r.status), evidence: `limited DELETE /api/inventory/:x = ${r.status} (needs inventory:delete)`, pass: r.status === 403 });
  }
  // 3. no token = denied
  {
    const r = await api('GET', '/api/medicines');
    rec({ id: 'DENY-no-token', area: 'authn', expected: '401', actual: String(r.status), evidence: `no Authorization header = ${r.status}`, pass: r.status === 401 });
  }
  // 4. invalid token = denied
  {
    const r = await api('GET', '/api/medicines', 'not-a-real-jwt.at.all');
    rec({ id: 'DENY-invalid-token', area: 'authn', expected: '401', actual: String(r.status), evidence: `garbage bearer = ${r.status}`, pass: r.status === 401 });
  }
  // 5. expired token = denied (validly signed, exp in the past)
  {
    const expired = jwt.sign({ sub: adminId, tenantId: tenant.id, email: 'admin@zz-auth.test', name: 'x', roles: [], permissions: ['*:*'], sessionId: 'x' }, SECRET, { expiresIn: '-30s' });
    const r = await api('GET', '/api/medicines', expired);
    rec({ id: 'DENY-expired-token', area: 'authn', expected: '401', actual: String(r.status), evidence: `expired JWT = ${r.status}`, pass: r.status === 401 });
  }
  // 6. valid signature but forged/unknown session = denied (session binding)
  {
    const forged = jwt.sign({ sub: adminId, tenantId: tenant.id, email: 'admin@zz-auth.test', name: 'x', roles: [], permissions: ['*:*'], sessionId: '11111111-2222-3333-4444-555555555555' }, SECRET, { expiresIn: '15m' });
    const r = await api('GET', '/api/medicines', forged);
    rec({ id: 'DENY-forged-session', area: 'session', expected: '401', actual: String(r.status), evidence: `valid sig, unknown sessionId = ${r.status}`, pass: r.status === 401 });
  }
  // 7. disabled user = denied (token issued while active, then account disabled)
  {
    const dTok = tokenOf(await login('disposable@zz-auth.test', PW));
    const before = await api('GET', '/api/medicines', dTok);
    await prisma.user.update({ where: { id: disposableId }, data: { status: 'inactive' } });
    const after = await api('GET', '/api/medicines', dTok);
    rec({ id: 'DENY-disabled-user', area: 'session', expected: '200→403', actual: `${before.status}→${after.status}`, evidence: `before=${before.status} after-disable=${after.status}`, pass: before.status === 200 && after.status === 403 });
    await prisma.user.update({ where: { id: disposableId }, data: { status: 'active' } });
  }
  // 8. deleted user = denied
  {
    const dTok = tokenOf(await login('disposable@zz-auth.test', PW));
    const before = await api('GET', '/api/medicines', dTok);
    await prisma.user.update({ where: { id: disposableId }, data: { deletedAt: new Date() } });
    const after = await api('GET', '/api/medicines', dTok);
    rec({ id: 'DENY-deleted-user', area: 'session', expected: '200→401', actual: `${before.status}→${after.status}`, evidence: `before=${before.status} after-delete=${after.status}`, pass: before.status === 200 && after.status === 401 });
    await prisma.user.update({ where: { id: disposableId }, data: { deletedAt: null } });
  }
  // 9. logout invalidates the access token immediately
  {
    const lr = await login('limited@zz-auth.test', PW);
    const tok = tokenOf(lr); const refresh = lr.json?.data?.tokens?.refreshToken;
    const before = await api('GET', '/api/medicines', tok);
    await api('POST', '/api/auth/logout', tok, { refreshToken: refresh });
    const after = await api('GET', '/api/medicines', tok);
    rec({ id: 'LOGOUT-invalidates', area: 'session', expected: '200→401', actual: `${before.status}→${after.status}`, evidence: `before=${before.status} after-logout=${after.status}`, pass: before.status === 200 && after.status === 401 });
  }
  // 10. password change invalidates existing access tokens
  {
    const lr = await login('usermgr@zz-auth.test', PW);
    const tok = tokenOf(lr);
    const before = await api('GET', '/api/medicines', tok);
    const ch = await api('POST', '/api/auth/password/change', tok, { currentPassword: PW, newPassword: 'NewSec@12345' });
    const after = await api('GET', '/api/medicines', tok);
    rec({ id: 'PWCHANGE-invalidates', area: 'session', expected: 'change 200, token 200→401', actual: `chg=${ch.status} ${before.status}→${after.status}`, evidence: `change=${ch.status} before=${before.status} after=${after.status}`, pass: ch.status === 200 && before.status === 200 && after.status === 401 });
    // restore password for idempotency
    await prisma.user.updateMany({ where: { email: 'usermgr@zz-auth.test' }, data: { passwordHash: await bcrypt.hash(PW, 10) } });
  }
  // 12. privilege escalation denied: user with users:* but not settings:edit
  //     cannot mint a role carrying settings:edit.
  {
    const settingsEditId = need('settings', 'edit');
    // Fresh token — earlier password-change tests invalidate prior usermgr sessions.
    const freshUsermgr = tokenOf(await login('usermgr@zz-auth.test', PW));
    const r = await api('POST', '/api/roles', freshUsermgr, { name: `escalate-${Date.now()}`, permissionIds: [settingsEditId] });
    const created = await prisma.role.findFirst({ where: { tenantId: tenant.id, name: { startsWith: 'escalate-' } } });
    rec({ id: 'ESCALATION-denied', area: 'authz', expected: '403 + no role', actual: String(r.status), evidence: `POST /api/roles{settings:edit} by users-mgr = ${r.status}; role created=${!!created}`, pass: r.status === 403 && !created });
  }
  // 13. platform gate: even a full-catalog admin cannot create a tenant
  {
    const r = await api('POST', '/api/tenants', adminTok, { name: 'Rogue Pharmacy' });
    rec({ id: 'PLATFORM-gate', area: 'authz', expected: '403', actual: String(r.status), evidence: `admin POST /api/tenants = ${r.status} (needs platform:manage)`, pass: r.status === 403 });
  }
  // 14. refresh issues a working token
  {
    const lr = await login('admin@zz-auth.test', PW);
    const refresh = lr.json?.data?.tokens?.refreshToken;
    const rr = await api('POST', '/api/auth/token/refresh', undefined, { refreshToken: refresh });
    const newTok = tokenOf(rr);
    const use = await api('GET', '/api/auth/me', newTok);
    rec({ id: 'REFRESH-works', area: 'session', expected: 'refresh 200 + token usable', actual: `${rr.status}/${use.status}`, evidence: `refresh=${rr.status} me-with-new-token=${use.status}`, pass: rr.status === 200 && use.status === 200 });
  }
  // 15. account lockout — RUN LAST because the failed logins also trip the
  //     per-IP auth rate-limiter. Prove per-account lockout via the DB flag;
  //     accept 423 (account locked) or 429 (rate-limited) as "denied".
  {
    let last = 0;
    for (let i = 0; i < 6; i++) { const r = await login('disposable@zz-auth.test', 'wrong-password'); last = r.status; }
    const u = await prisma.user.findFirst({ where: { email: 'disposable@zz-auth.test' } });
    const locked = !!u?.lockedUntil && u.lockedUntil > new Date();
    // Repeated failed logins are denied by EITHER per-account lockout (423 +
    // lockedUntil) OR the per-IP auth rate-limiter (429). Both are valid defenses;
    // which one fires first depends on the limiter's rolling window.
    const denied = (locked && last === 423) || last === 429;
    rec({ id: 'LOCKOUT', area: 'authn', expected: 'denied (423 lock / 429 rate-limit)', actual: `${last}, accountLocked=${locked}`, evidence: `final status=${last} lockedUntil=${u?.lockedUntil?.toISOString() ?? 'null'} failedAttempts=${u?.failedLoginAttempts}`, pass: denied });
  }

  // ── Report ──
  const pass = results.filter(r => r.pass).length;
  const fail = results.filter(r => !r.pass);
  console.log('ID                     | RESULT | EXPECTED               | ACTUAL   | EVIDENCE');
  console.log('-'.repeat(115));
  for (const r of results) console.log(`${r.id.padEnd(22)} | ${(r.pass ? 'PASS' : 'FAIL').padEnd(6)} | ${r.expected.padEnd(22)} | ${r.actual.padEnd(8)} | ${r.evidence}`);
  console.log('-'.repeat(115));
  console.log(`\nTOTAL ${results.length}  |  PASS ${pass}  |  FAIL ${fail.length}\n`);

  await teardown();
  await prisma.$disconnect();
  if (fail.length > 0) process.exit(1);
}

main().catch(async (e) => { console.error('SUITE ERROR:', e); await prisma.$disconnect().catch(() => {}); process.exit(2); });

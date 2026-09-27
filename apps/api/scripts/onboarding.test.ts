/**
 * Customer tenant onboarding + platform lifecycle suite (Phase 8).
 * Drives the live API as a platform operator to provision a pharmacy, then
 * verifies idempotency, forced password change, the platform gate, suspend/
 * reactivate, admin reset, and audit logging. Synthetic data; self-cleaning.
 *
 * Run: npx tsx scripts/onboarding.test.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const API = process.env['API_BASE'] ?? 'http://localhost:4000';

const PLATFORM_EMAIL = 'ops@pharmaos.test';
const PLATFORM_PW = 'Platform@Ops123';
const SLUG = 'zz-onboard-test';
const OWNER_EMAIL = 'owner@zz-onboard.test';

type R = { id: string; expected: string; actual: string; pass: boolean };
const results: R[] = [];
const rec = (r: R) => results.push(r);

async function api(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let json: any = null; try { json = await res.json(); } catch { /* */ }
  return { status: res.status, json };
}
const login = (email: string, password: string) => api('POST', '/api/auth/login', undefined, { email, password });
const tok = (r: any) => r.json?.data?.tokens?.accessToken;

async function cleanup() {
  const t = await prisma.tenant.findFirst({ where: { slug: SLUG }, select: { id: true } });
  if (!t) return;
  const where = { tenantId: t.id };
  const users = await prisma.user.findMany({ where, select: { id: true } });
  const uids = users.map(u => u.id);
  await prisma.refreshToken.deleteMany({ where: { userId: { in: uids } } }).catch(() => {});
  await prisma.userSession.deleteMany({ where }).catch(() => {});
  await prisma.auditLog.deleteMany({ where }).catch(() => {});
  await prisma.userRole.deleteMany({ where: { userId: { in: uids } } }).catch(() => {});
  const roles = await prisma.role.findMany({ where, select: { id: true } });
  await prisma.rolePermission.deleteMany({ where: { roleId: { in: roles.map(r => r.id) } } }).catch(() => {});
  await prisma.role.deleteMany({ where }).catch(() => {});
  await prisma.user.deleteMany({ where }).catch(() => {});
  await prisma.tenant.deleteMany({ where: { id: t.id } }).catch(() => {});
}

const provisionBody = {
  name: 'ZZ Onboard Pharmacy', slug: SLUG, type: 'retail', plan: 'starter',
  city: 'Testville', state: 'TS', gstNumber: '29ZZTEST1234Z1Z5', drugLicenseNumber: 'DL-ZZ-001',
  ownerName: 'Onboard Owner', ownerEmail: OWNER_EMAIL, ownerPhone: '9000000000',
};

async function main() {
  console.log(`\n🏥 Tenant onboarding & platform lifecycle suite → ${API}\n`);
  await cleanup();

  const platformTok = tok(await login(PLATFORM_EMAIL, PLATFORM_PW));
  if (!platformTok) throw new Error('platform operator login failed — run scripts/create-platform-admin.ts first');

  // 1. Provision a new pharmacy.
  let tempPassword = '';
  {
    const r = await api('POST', '/api/tenants', platformTok, provisionBody);
    tempPassword = r.json?.data?.tempPassword ?? '';
    const ok = (r.status === 201) && !!tempPassword && r.json?.data?.owner?.email === OWNER_EMAIL && r.json?.data?.tenant?.slug === SLUG;
    rec({ id: 'PROVISION', expected: '201 + tempPassword + owner', actual: `status=${r.status} tempPw=${tempPassword ? 'yes' : 'no'} owner=${r.json?.data?.owner?.email}`, pass: ok });
  }
  // 2. Default roles created.
  {
    const t = await prisma.tenant.findFirst({ where: { slug: SLUG } });
    const roles = await prisma.role.findMany({ where: { tenantId: t!.id }, select: { name: true } });
    const names = roles.map(r => r.name).sort();
    const expected = ['Billing Assistant', 'Inventory Manager', 'Pharma Admin', 'Pharmacist', 'Reports Viewer'];
    rec({ id: 'DEFAULT-ROLES', expected: '5 default roles', actual: names.join(','), pass: expected.every(n => names.includes(n)) });
  }
  // 3. Owner created with must-change + pending, and Pharma Admin role.
  {
    const owner = await prisma.user.findFirst({ where: { email: OWNER_EMAIL }, include: { userRoles: { include: { role: true } } } });
    const hasAdmin = owner?.userRoles.some(ur => ur.role.name === 'Pharma Admin');
    rec({ id: 'OWNER-created', expected: 'mustChange + pending + admin role', actual: `mustChange=${owner?.mustChangePassword} status=${owner?.status} admin=${hasAdmin}`, pass: owner?.mustChangePassword === true && owner?.status === 'pending' && !!hasAdmin });
  }
  // 4. Owner can log in with temp password; response flags must-change.
  {
    const r = await login(OWNER_EMAIL, tempPassword);
    rec({ id: 'OWNER-login-mustchange', expected: '200 + mustChangePassword true', actual: `status=${r.status} mustChange=${r.json?.data?.user?.mustChangePassword}`, pass: r.status === 200 && r.json?.data?.user?.mustChangePassword === true });
  }
  // 5. Owner changes password → flag clears; new password works, old fails.
  {
    const lr = await login(OWNER_EMAIL, tempPassword);
    const ownerTok = tok(lr);
    const newPw = 'OwnerNew@12345';
    const ch = await api('POST', '/api/auth/password/change', ownerTok, { currentPassword: tempPassword, newPassword: newPw });
    const reLogin = await login(OWNER_EMAIL, newPw);
    const oldLogin = await login(OWNER_EMAIL, tempPassword);
    const pass = ch.status === 200 && reLogin.status === 200 && reLogin.json?.data?.user?.mustChangePassword === false && oldLogin.status === 401;
    rec({ id: 'FORCE-pwchange', expected: 'change 200, flag clears, old pw fails', actual: `chg=${ch.status} new=${reLogin.status}/${reLogin.json?.data?.user?.mustChangePassword} old=${oldLogin.status}`, pass });
  }
  // 6. Idempotency — provisioning again does NOT duplicate.
  {
    const r = await api('POST', '/api/tenants', platformTok, provisionBody);
    const tenantCount = await prisma.tenant.count({ where: { slug: SLUG } });
    const ownerCount = await prisma.user.count({ where: { email: OWNER_EMAIL } });
    rec({ id: 'IDEMPOTENT', expected: '200 alreadyExisted, no dupes', actual: `status=${r.status} alreadyExisted=${r.json?.data?.alreadyExisted} tenants=${tenantCount} owners=${ownerCount}`, pass: r.status === 200 && r.json?.data?.alreadyExisted === true && tenantCount === 1 && ownerCount === 1 });
  }
  // 7. Platform gate — a non-platform admin cannot provision.
  {
    const demoTok = tok(await login('admin@divyapharmacy.com', 'Admin@123'));
    const r = await api('POST', '/api/tenants', demoTok, { name: 'Rogue', ownerName: 'x', ownerEmail: 'x@x.test' });
    rec({ id: 'PLATFORM-GATE', expected: '403 for non-platform', actual: `status=${r.status}`, pass: r.status === 403 });
  }
  // 8. Tenant health/metadata (platform).
  {
    const t = await prisma.tenant.findFirst({ where: { slug: SLUG } });
    const r = await api('GET', `/api/tenants/${t!.id}/health`, platformTok);
    rec({ id: 'TENANT-HEALTH', expected: '200 + health metadata', actual: `status=${r.status} users=${r.json?.data?.health?.users} status=${r.json?.data?.status}`, pass: r.status === 200 && typeof r.json?.data?.health?.users === 'number' });
  }
  // 9. Suspend blocks the tenant's users immediately; reactivate restores access.
  {
    const t = await prisma.tenant.findFirst({ where: { slug: SLUG } });
    await api('PATCH', `/api/tenants/${t!.id}/status`, platformTok, { status: 'suspended' });
    const ownerTokAfterSuspend = tok(await login(OWNER_EMAIL, 'OwnerNew@12345'));
    const blocked = await api('GET', '/api/medicines', ownerTokAfterSuspend);
    await api('PATCH', `/api/tenants/${t!.id}/status`, platformTok, { status: 'active' });
    const ownerTokAfterReactivate = tok(await login(OWNER_EMAIL, 'OwnerNew@12345'));
    const allowed = await api('GET', '/api/medicines', ownerTokAfterReactivate);
    rec({ id: 'SUSPEND-REACTIVATE', expected: 'suspended→403, active→200', actual: `suspended=${blocked.status} active=${allowed.status}`, pass: blocked.status === 403 && allowed.status === 200 });
  }
  // 10. Reset tenant admin — new temp password, must-change, old fails.
  {
    const t = await prisma.tenant.findFirst({ where: { slug: SLUG } });
    const r = await api('POST', `/api/tenants/${t!.id}/reset-admin`, platformTok);
    const newTemp = r.json?.data?.tempPassword;
    const oldLogin = await login(OWNER_EMAIL, 'OwnerNew@12345');
    const newLogin = await login(OWNER_EMAIL, newTemp);
    rec({ id: 'RESET-ADMIN', expected: '200 temp; old fails; new mustChange', actual: `status=${r.status} old=${oldLogin.status} new=${newLogin.status}/${newLogin.json?.data?.user?.mustChangePassword}`, pass: r.status === 200 && !!newTemp && oldLogin.status === 401 && newLogin.status === 200 && newLogin.json?.data?.user?.mustChangePassword === true });
  }
  // 11. Platform actions are audited.
  {
    const t = await prisma.tenant.findFirst({ where: { slug: SLUG } });
    const count = await prisma.auditLog.count({ where: { tenantId: t!.id, module: 'platform' } });
    rec({ id: 'AUDIT-platform', expected: '>0 platform audit logs', actual: `count=${count}`, pass: count > 0 });
  }

  const pass = results.filter(r => r.pass).length;
  const fail = results.filter(r => !r.pass);
  console.log('ID                     | RESULT | EXPECTED                          | ACTUAL');
  console.log('-'.repeat(120));
  for (const r of results) console.log(`${r.id.padEnd(22)} | ${(r.pass ? 'PASS' : 'FAIL').padEnd(6)} | ${r.expected.padEnd(33)} | ${r.actual}`);
  console.log('-'.repeat(120));
  console.log(`\nTOTAL ${results.length}  |  PASS ${pass}  |  FAIL ${fail.length}\n`);

  await cleanup();
  await prisma.$disconnect();
  if (fail.length > 0) process.exit(1);
}

main().catch(async e => { console.error('SUITE ERROR:', e); await prisma.$disconnect().catch(() => {}); process.exit(2); });

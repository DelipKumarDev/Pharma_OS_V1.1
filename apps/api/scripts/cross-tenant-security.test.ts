/**
 * Cross-tenant isolation / IDOR-BOLA test suite (Phase 1).
 *
 * Seeds two synthetic tenants (A, B), each with a full-permission admin, plus one
 * record per resource in each tenant. Then, using Tenant A's token, it attempts to
 * READ and WRITE Tenant B's records by id. Every cross-tenant attempt must be
 * denied (403/404) and must NOT mutate Tenant B's data. Each attack is paired with
 * a same-tenant CONTROL (A → A's own record) that must succeed, proving the route,
 * method and permissions are correct — so a denied attack is the tenant guard doing
 * its job, not a broken route.
 *
 * Run against the live API:  npx tsx scripts/cross-tenant-security.test.ts
 * Requires: API on API_BASE (default http://localhost:4000) + a reachable DB.
 * Uses only synthetic data; cleans up after itself. No production data touched.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const API = process.env['API_BASE'] ?? 'http://localhost:4000';
const PW = 'Sec@12345';

type Result = { id: string; category: string; resource: string; op: string; expected: string; actual: string; evidence: string; pass: boolean };
const results: Result[] = [];
function record(r: Result) { results.push(r); }

async function api(method: string, path: string, token?: string, body?: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

const SLUGS = ['zz-sec-a', 'zz-sec-b'];

async function teardown() {
  const tenants = await prisma.tenant.findMany({ where: { slug: { in: SLUGS } }, select: { id: true } });
  const ids = tenants.map(t => t.id);
  if (ids.length === 0) return;
  const where = { tenantId: { in: ids } };
  // Child → parent order to respect FKs.
  await prisma.vendorPayment.deleteMany({ where }).catch(() => {});
  await prisma.purchaseInvoiceItem.deleteMany({ where: { invoice: { tenantId: { in: ids } } } }).catch(() => {});
  await prisma.purchaseInvoice.deleteMany({ where }).catch(() => {});
  await prisma.stockMovement.deleteMany({ where }).catch(() => {});
  await prisma.inventoryItem.deleteMany({ where }).catch(() => {});
  await prisma.reorderAlert.deleteMany({ where }).catch(() => {});
  await prisma.reorderItem.deleteMany({ where }).catch(() => {});
  await prisma.notification.deleteMany({ where }).catch(() => {});
  await prisma.billItem.deleteMany({ where: { bill: { tenantId: { in: ids } } } }).catch(() => {});
  await prisma.bill.deleteMany({ where }).catch(() => {});
  await prisma.medicine.deleteMany({ where }).catch(() => {});
  await prisma.customer.deleteMany({ where }).catch(() => {});
  await prisma.vendor.deleteMany({ where }).catch(() => {});
  await prisma.auditLog.deleteMany({ where }).catch(() => {});
  const users = await prisma.user.findMany({ where, select: { id: true } });
  const uids = users.map(u => u.id);
  await prisma.refreshToken.deleteMany({ where: { userId: { in: uids } } }).catch(() => {});
  await prisma.userSession.deleteMany({ where }).catch(() => {});
  await prisma.otpCode.deleteMany({ where: { userId: { in: uids } } }).catch(() => {});
  await prisma.userRole.deleteMany({ where: { userId: { in: uids } } }).catch(() => {});
  const roles = await prisma.role.findMany({ where, select: { id: true } });
  await prisma.rolePermission.deleteMany({ where: { roleId: { in: roles.map(r => r.id) } } }).catch(() => {});
  await prisma.role.deleteMany({ where }).catch(() => {});
  await prisma.user.deleteMany({ where }).catch(() => {});
  await prisma.tenant.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
}

interface Seeded {
  tenantId: string; slug: string; adminEmail: string;
  medicineId: string; inventoryId: string; vendorId: string; customerId: string;
  notificationId: string; reorderItemId: string; reorderAlertId: string;
  invoiceId: string; billId: string; roleId: string; adminUserId: string;
}

async function seedTenant(slug: string, name: string, allPermIds: string[]): Promise<Seeded> {
  const tenant = await prisma.tenant.create({ data: { name, slug, type: 'retail', status: 'active', plan: 'professional' } });
  const role = await prisma.role.create({ data: { tenantId: tenant.id, name: 'Sec Admin', isSystem: false } });
  await prisma.rolePermission.createMany({ data: allPermIds.map(pid => ({ roleId: role.id, permissionId: pid })) });
  const adminEmail = `admin-${slug}@sec.test`;
  const admin = await prisma.user.create({ data: { tenantId: tenant.id, name: `Admin ${slug}`, email: adminEmail, passwordHash: await bcrypt.hash(PW, 10), status: 'active' } });
  await prisma.userRole.create({ data: { userId: admin.id, roleId: role.id } });

  const medicine = await prisma.medicine.create({ data: { tenantId: tenant.id, name: `Paracetamol ${slug}`, mrp: 20, purchasePrice: 10, sellingPrice: 18, gstRate: 12 } });
  const vendor = await prisma.vendor.create({ data: { tenantId: tenant.id, name: `Vendor ${slug}` } });
  const customer = await prisma.customer.create({ data: { tenantId: tenant.id, name: `Customer ${slug}`, phone: '9000000000' } });
  const inventory = await prisma.inventoryItem.create({ data: { tenantId: tenant.id, medicineId: medicine.id, batchNumber: `B-${slug}`, quantity: 100, purchasePrice: 10, mrp: 20, sellingPrice: 18, expiryDate: new Date(Date.now() + 365 * 864e5) } });
  const notification = await prisma.notification.create({ data: { tenantId: tenant.id, title: `N ${slug}`, message: 'test', type: 'low_stock', category: 'inventory', isRead: false } });
  const reorderItem = await prisma.reorderItem.create({ data: { tenantId: tenant.id, medicineId: medicine.id, medicineName: medicine.name, reorderLevel: 10, status: 'pending' } });
  const reorderAlert = await prisma.reorderAlert.create({ data: { tenantId: tenant.id, medicineName: medicine.name, alertType: 'low_stock', isAcknowledged: false } });
  const invoice = await prisma.purchaseInvoice.create({ data: { tenantId: tenant.id, vendorId: vendor.id, vendorName: vendor.name, invoiceNumber: `INV-${slug}`, invoiceDate: new Date(), totalAmount: 1000, paidAmount: 0, pendingAmount: 1000 } });
  const bill = await prisma.bill.create({ data: { tenantId: tenant.id, billNumber: `BILL-${slug}`, status: 'completed', totalAmount: 100 } });

  return { tenantId: tenant.id, slug, adminEmail, medicineId: medicine.id, inventoryId: inventory.id, vendorId: vendor.id, customerId: customer.id, notificationId: notification.id, reorderItemId: reorderItem.id, reorderAlertId: reorderAlert.id, invoiceId: invoice.id, billId: bill.id, roleId: role.id, adminUserId: admin.id };
}

async function login(email: string, password: string, tenantId?: string) {
  return api('POST', '/api/auth/login', undefined, { email, password, ...(tenantId ? { tenantId } : {}) });
}

async function main() {
  console.log(`\n🔒 Cross-tenant isolation suite → ${API}\n`);
  await teardown();

  // All PHARMACY permissions (exclude platform:manage — a tenant admin is not a
  // platform operator; granting it would make them able to see all tenants).
  const perms = await prisma.permission.findMany({ where: { module: { not: 'platform' } }, select: { id: true } });
  if (perms.length === 0) throw new Error('No permissions in DB — run the seed first.');
  const permIds = perms.map(p => p.id);

  const A = await seedTenant('zz-sec-a', 'ZZ Sec Tenant A', permIds);
  const B = await seedTenant('zz-sec-b', 'ZZ Sec Tenant B', permIds);

  // Colliding email in BOTH tenants for login-disambiguation tests.
  const collide = 'collide@sec.test';
  await prisma.user.create({ data: { tenantId: A.tenantId, name: 'Collide A', email: collide, passwordHash: await bcrypt.hash(PW, 10), status: 'active' } });
  await prisma.user.create({ data: { tenantId: B.tenantId, name: 'Collide B', email: collide, passwordHash: await bcrypt.hash('Other@9999', 10), status: 'active' } });

  const la = await login(A.adminEmail, PW);
  const lb = await login(B.adminEmail, PW);
  const tokenA = la.json?.data?.tokens?.accessToken;
  const tokenB = lb.json?.data?.tokens?.accessToken;
  if (!tokenA || !tokenB) throw new Error(`Login failed: A=${la.status} B=${lb.status} ${JSON.stringify(la.json)}`);
  console.log(`✓ Logged in as Tenant A (${A.tenantId.slice(0,8)}) and Tenant B (${B.tenantId.slice(0,8)})\n`);

  // ── READ attacks: A token → B resource by id. Paired with A→A control. ──
  const reads: Array<{ resource: string; path: (s: Seeded) => string }> = [
    { resource: 'medicines', path: s => `/api/medicines/${s.medicineId}` },
    { resource: 'customers', path: s => `/api/customers/${s.customerId}` },
    { resource: 'vendors', path: s => `/api/vendors/${s.vendorId}` },
    { resource: 'billing', path: s => `/api/billing/${s.billId}` },
    { resource: 'purchase-invoices', path: s => `/api/purchase-invoices/${s.invoiceId}` },
    { resource: 'users', path: s => `/api/users/${s.adminUserId}` },
    { resource: 'roles', path: s => `/api/roles/${s.roleId}` },
    { resource: 'tenants', path: s => `/api/tenants/${s.tenantId}` },
  ];
  for (const r of reads) {
    const control = await api('GET', r.path(A), tokenA);
    const attack = await api('GET', r.path(B), tokenA);
    const controlOk = control.status === 200;
    const denied = attack.status === 404 || attack.status === 403;
    // Extra: ensure the attack body doesn't contain B's id (no data leak even if 200).
    const leaked = attack.status === 200 && JSON.stringify(attack.json ?? '').includes(B.tenantId);
    record({ id: `READ-${r.resource}`, category: 'cross-tenant-read', resource: r.resource, op: `GET ${r.path(B)}`, expected: '403/404', actual: String(attack.status), evidence: `control(A→A)=${control.status}${controlOk ? '' : ' [CONTROL FAILED]'} attack(A→B)=${attack.status}${leaked ? ' LEAKED' : ''}`, pass: controlOk && denied && !leaked });
  }

  // inventory batches is filtered by {tenantId, medicineId} — querying B's medicineId
  // under A's token must yield NO batches (tenant-scoped), i.e. no B data leak.
  {
    const control = await api('GET', `/api/inventory/batches/${A.medicineId}`, tokenA);
    const attack = await api('GET', `/api/inventory/batches/${B.medicineId}`, tokenA);
    const body = JSON.stringify(attack.json ?? '');
    const leaked = body.includes(B.inventoryId) || body.includes('B-zz-sec-b');
    record({ id: 'READ-inventory-batches', category: 'cross-tenant-read', resource: 'inventory-batches', op: 'GET /api/inventory/batches/:medIdB', expected: 'no B data', actual: leaked ? 'LEAKED' : 'clean', evidence: `control(A→A)=${control.status} attack(A→B)=${attack.status} containsB=${leaked}`, pass: control.status === 200 && !leaked });
  }

  // ── WRITE attacks: A token → mutate B resource. Verify B unchanged via Prisma. ──
  // Notification mark-read (fixed IDOR)
  {
    const before = await prisma.notification.findUnique({ where: { id: B.notificationId } });
    const attack = await api('PATCH', `/api/notifications/${B.notificationId}/read`, tokenA);
    const after = await prisma.notification.findUnique({ where: { id: B.notificationId } });
    const unchanged = after?.isRead === false && before?.isRead === false;
    record({ id: 'WRITE-notification-read', category: 'cross-tenant-write', resource: 'notifications', op: `PATCH /api/notifications/:idB/read`, expected: '403/404 + unchanged', actual: String(attack.status), evidence: `status=${attack.status} B.isRead ${before?.isRead}→${after?.isRead}`, pass: (attack.status === 404 || attack.status === 403) && unchanged });
  }
  // Reorder alert acknowledge (fixed IDOR)
  {
    const attack = await api('PATCH', `/api/reorder/alerts/${B.reorderAlertId}/acknowledge`, tokenA);
    const after = await prisma.reorderAlert.findUnique({ where: { id: B.reorderAlertId } });
    record({ id: 'WRITE-reorder-alert-ack', category: 'cross-tenant-write', resource: 'reorder', op: `PATCH /api/reorder/alerts/:idB/acknowledge`, expected: '403/404 + unchanged', actual: String(attack.status), evidence: `status=${attack.status} B.isAcknowledged=${after?.isAcknowledged}`, pass: (attack.status === 404 || attack.status === 403) && after?.isAcknowledged === false });
  }
  // Reorder item update (fixed IDOR + mass-assignment)
  {
    const attack = await api('PATCH', `/api/reorder/${B.reorderItemId}`, tokenA, { reorderLevel: 999, status: 'ordered' });
    const after = await prisma.reorderItem.findUnique({ where: { id: B.reorderItemId } });
    record({ id: 'WRITE-reorder-item', category: 'cross-tenant-write', resource: 'reorder', op: `PATCH /api/reorder/:idB`, expected: '403/404 + unchanged', actual: String(attack.status), evidence: `status=${attack.status} B.reorderLevel=${after?.reorderLevel} (expect 10) status=${after?.status}`, pass: (attack.status === 404 || attack.status === 403) && after?.reorderLevel === 10 && after?.status === 'pending' });
  }
  // Vendor payment referencing B's vendor + invoice (fixed IDOR)
  {
    const attack = await api('POST', `/api/vendor-payments`, tokenA, { vendorId: B.vendorId, invoiceId: B.invoiceId, amount: 500, paymentMode: 'neft' });
    const after = await prisma.purchaseInvoice.findUnique({ where: { id: B.invoiceId } });
    const noPay = (await prisma.vendorPayment.count({ where: { invoiceId: B.invoiceId } })) === 0;
    record({ id: 'WRITE-vendor-payment', category: 'cross-tenant-write', resource: 'vendor-payments', op: `POST /api/vendor-payments {vendorB,invoiceB}`, expected: '403/404 + unchanged', actual: String(attack.status), evidence: `status=${attack.status} B.invoice.paidAmount=${after?.paidAmount} (expect 0), payments=${noPay ? 0 : '>0'}`, pass: (attack.status === 404 || attack.status === 403) && Number(after?.paidAmount) === 0 && noPay });
  }
  // Medicine update (guarded service)
  {
    const attack = await api('PUT', `/api/medicines/${B.medicineId}`, tokenA, { name: 'HACKED' });
    const after = await prisma.medicine.findUnique({ where: { id: B.medicineId } });
    record({ id: 'WRITE-medicine-update', category: 'cross-tenant-write', resource: 'medicines', op: `PUT /api/medicines/:idB`, expected: '403/404 + unchanged', actual: String(attack.status), evidence: `status=${attack.status} B.name="${after?.name}"`, pass: (attack.status === 404 || attack.status === 403) && after?.name !== 'HACKED' });
  }
  // Inventory delete (guarded service)
  {
    const attack = await api('DELETE', `/api/inventory/${B.inventoryId}`, tokenA);
    const after = await prisma.inventoryItem.findUnique({ where: { id: B.inventoryId } });
    record({ id: 'WRITE-inventory-delete', category: 'cross-tenant-write', resource: 'inventory', op: `DELETE /api/inventory/:idB`, expected: '403/404 + not deleted', actual: String(attack.status), evidence: `status=${attack.status} B.deletedAt=${after?.deletedAt}`, pass: (attack.status === 404 || attack.status === 403) && !after?.deletedAt });
  }
  // Customer update (guarded service)
  {
    const attack = await api('PATCH', `/api/customers/${B.customerId}`, tokenA, { name: 'HACKED' });
    const after = await prisma.customer.findUnique({ where: { id: B.customerId } });
    record({ id: 'WRITE-customer-update', category: 'cross-tenant-write', resource: 'customers', op: `PATCH /api/customers/:idB`, expected: '403/404 + unchanged', actual: String(attack.status), evidence: `status=${attack.status} B.name="${after?.name}"`, pass: (attack.status === 404 || attack.status === 403) && after?.name !== 'HACKED' });
  }
  // Vendor deactivate (guarded service)
  {
    const attack = await api('DELETE', `/api/vendors/${B.vendorId}`, tokenA);
    const after = await prisma.vendor.findUnique({ where: { id: B.vendorId } });
    record({ id: 'WRITE-vendor-deactivate', category: 'cross-tenant-write', resource: 'vendors', op: `DELETE /api/vendors/:idB`, expected: '403/404 + active', actual: String(attack.status), evidence: `status=${attack.status} B.status=${after?.status}`, pass: (attack.status === 404 || attack.status === 403) && after?.status === 'active' });
  }
  // Role update (guarded service)
  {
    const attack = await api('PUT', `/api/roles/${B.roleId}`, tokenA, { name: 'HACKED' });
    const after = await prisma.role.findUnique({ where: { id: B.roleId } });
    record({ id: 'WRITE-role-update', category: 'cross-tenant-write', resource: 'roles', op: `PUT /api/roles/:idB`, expected: '403/404 + unchanged', actual: String(attack.status), evidence: `status=${attack.status} B.role.name="${after?.name}"`, pass: (attack.status === 404 || attack.status === 403) && after?.name !== 'HACKED' });
  }
  // User status change (guarded service)
  {
    const attack = await api('PATCH', `/api/users/${B.adminUserId}/status`, tokenA, { status: 'suspended' });
    const after = await prisma.user.findUnique({ where: { id: B.adminUserId } });
    record({ id: 'WRITE-user-status', category: 'cross-tenant-write', resource: 'users', op: `PATCH /api/users/:idB/status`, expected: '403/404 + unchanged', actual: String(attack.status), evidence: `status=${attack.status} B.user.status=${after?.status}`, pass: (attack.status === 404 || attack.status === 403) && after?.status === 'active' });
  }

  // ── LIST leakage: A's collections must not contain B's records. ──
  const lists: Array<{ resource: string; path: string; needle: (s: Seeded) => string }> = [
    { resource: 'medicines', path: '/api/medicines?limit=200', needle: s => s.medicineId },
    { resource: 'customers', path: '/api/customers?limit=200', needle: s => s.customerId },
    { resource: 'vendors', path: '/api/vendors?limit=200', needle: s => s.vendorId },
    { resource: 'notifications', path: '/api/notifications', needle: s => s.notificationId },
    { resource: 'audit', path: '/api/audit?limit=200', needle: s => s.tenantId },
    { resource: 'tenants', path: '/api/tenants', needle: s => s.tenantId },
  ];
  for (const l of lists) {
    const res = await api('GET', l.path, tokenA);
    const body = JSON.stringify(res.json ?? '');
    const leaked = body.includes(l.needle(B));
    record({ id: `LIST-${l.resource}`, category: 'cross-tenant-list', resource: l.resource, op: `GET ${l.path}`, expected: 'no B records', actual: leaked ? 'LEAKED' : 'clean', evidence: `status=${res.status} containsB=${leaked}`, pass: res.status === 200 && !leaked });
  }

  // ── Settings export must be tenant-scoped ──
  {
    const res = await api('GET', '/api/settings/export/customers', tokenA);
    const body = JSON.stringify(res.json ?? '');
    const leaked = body.includes('Customer zz-sec-b') || body.includes(B.customerId);
    record({ id: 'EXPORT-customers', category: 'cross-tenant-export', resource: 'exports', op: 'GET /api/settings/export/customers', expected: '200 + no B data', actual: leaked ? 'LEAKED' : 'clean', evidence: `status=${res.status} containsB=${leaked}`, pass: res.status === 200 && !leaked });
  }

  // ── Login tenant disambiguation (P0-01) ──
  {
    const ambiguous = await login(collide, PW); // no tenantId
    record({ id: 'LOGIN-ambiguous', category: 'login-resolution', resource: 'auth', op: 'login(collide) no tenantId', expected: '409', actual: String(ambiguous.status), evidence: `status=${ambiguous.status} msg="${ambiguous.json?.message ?? ''}"`, pass: ambiguous.status === 409 });

    const toA = await login(collide, PW, A.slug); // A's password + A slug
    const resolvedA = toA.status === 200 && toA.json?.data?.user?.tenantId === A.tenantId;
    record({ id: 'LOGIN-resolve-A', category: 'login-resolution', resource: 'auth', op: 'login(collide) tenantId=A.slug', expected: '200 + tenant A', actual: String(toA.status), evidence: `status=${toA.status} tenant=${toA.json?.data?.user?.tenantId?.slice(0,8)} (A=${A.tenantId.slice(0,8)})`, pass: resolvedA });

    // Supplying A's slug but B's password must NOT authenticate (tenantId can't grant access).
    const wrongPw = await login(collide, PW, B.slug); // B's password is different; PW is A's
    record({ id: 'LOGIN-no-grant', category: 'login-resolution', resource: 'auth', op: 'login(collide) tenantId=B.slug + A password', expected: '401', actual: String(wrongPw.status), evidence: `status=${wrongPw.status} (tenantId must not bypass password)`, pass: wrongPw.status === 401 });
  }

  // ── Same-tenant sanity (normal operations still work) ──
  {
    const own = await api('GET', `/api/medicines/${A.medicineId}`, tokenA);
    record({ id: 'SANITY-own-read', category: 'same-tenant', resource: 'medicines', op: 'GET own medicine', expected: '200', actual: String(own.status), evidence: `status=${own.status} name="${own.json?.data?.name ?? ''}"`, pass: own.status === 200 });
    const ownWrite = await api('PATCH', `/api/customers/${A.customerId}`, tokenA, { notes: 'ok' });
    record({ id: 'SANITY-own-write', category: 'same-tenant', resource: 'customers', op: 'PATCH own customer', expected: '200', actual: String(ownWrite.status), evidence: `status=${ownWrite.status}`, pass: ownWrite.status === 200 });
    const ownNotif = await api('PATCH', `/api/notifications/${A.notificationId}/read`, tokenA);
    const an = await prisma.notification.findUnique({ where: { id: A.notificationId } });
    record({ id: 'SANITY-own-notif', category: 'same-tenant', resource: 'notifications', op: 'PATCH own notification read', expected: '200 + isRead', actual: String(ownNotif.status), evidence: `status=${ownNotif.status} A.isRead=${an?.isRead}`, pass: ownNotif.status === 200 && an?.isRead === true });
  }

  // ── Report ──
  const pass = results.filter(r => r.pass).length;
  const fail = results.filter(r => !r.pass);
  console.log('ID                          | RESULT | EXPECTED         | ACTUAL | EVIDENCE');
  console.log('-'.repeat(120));
  for (const r of results) {
    console.log(`${r.id.padEnd(27)} | ${(r.pass ? 'PASS' : 'FAIL').padEnd(6)} | ${r.expected.padEnd(16)} | ${r.actual.padEnd(6)} | ${r.evidence}`);
  }
  console.log('-'.repeat(120));
  console.log(`\nTOTAL ${results.length}  |  PASS ${pass}  |  FAIL ${fail.length}\n`);

  // Emit machine-readable JSON for the report.
  console.log('JSON_RESULTS_START');
  console.log(JSON.stringify(results, null, 0));
  console.log('JSON_RESULTS_END');

  await teardown();
  await prisma.$disconnect();
  if (fail.length > 0) process.exit(1);
}

main().catch(async (e) => { console.error('SUITE ERROR:', e); await prisma.$disconnect().catch(() => {}); process.exit(2); });

/**
 * Database & data-integrity suite (Phase 3).
 *
 * Exercises the money/stock transaction paths under CONCURRENCY and failure
 * against the live API + PostgreSQL:
 *   - no oversell / negative stock when many tills bill the same batch at once
 *   - stock adjustments are atomic + race-safe (no lost update)
 *   - a failed multi-item bill rolls back completely (no partial writes)
 *   - concurrent bills get unique bill numbers (no duplicate/collision)
 *   - duplicate submits create independent bills but never corrupt stock
 *   - Float money precision risk (demonstrated at the DB layer)
 *
 * Run: npx tsx scripts/db-integrity.test.ts    Synthetic data only; self-cleaning.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const API = process.env['API_BASE'] ?? 'http://localhost:4000';
const PW = 'Sec@12345';
const SLUG = 'zz-int-t';

type R = { id: string; area: string; expected: string; actual: string; evidence: string; pass: boolean };
const results: R[] = [];
const rec = (r: R) => results.push(r);

async function api(method: string, path: string, token: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
  let json: any = null; try { json = await res.json(); } catch { /* */ }
  return { status: res.status, json };
}

async function teardown() {
  const ten = await prisma.tenant.findMany({ where: { slug: SLUG }, select: { id: true } });
  const ids = ten.map(t => t.id); if (!ids.length) return;
  const where = { tenantId: { in: ids } };
  await prisma.scheduleDrugRegister.deleteMany({ where }).catch(() => {});
  await prisma.billItem.deleteMany({ where: { bill: { tenantId: { in: ids } } } }).catch(() => {});
  await prisma.bill.deleteMany({ where }).catch(() => {});
  await prisma.stockMovement.deleteMany({ where }).catch(() => {});
  await prisma.inventoryItem.deleteMany({ where }).catch(() => {});
  await prisma.medicine.deleteMany({ where }).catch(() => {});
  await prisma.customer.deleteMany({ where }).catch(() => {});
  await prisma.documentCounter.deleteMany({ where }).catch(() => {});
  await prisma.auditLog.deleteMany({ where }).catch(() => {});
  const users = await prisma.user.findMany({ where, select: { id: true } });
  const uids = users.map(u => u.id);
  await prisma.refreshToken.deleteMany({ where: { userId: { in: uids } } }).catch(() => {});
  await prisma.userSession.deleteMany({ where }).catch(() => {});
  await prisma.userRole.deleteMany({ where: { userId: { in: uids } } }).catch(() => {});
  const roles = await prisma.role.findMany({ where, select: { id: true } });
  await prisma.rolePermission.deleteMany({ where: { roleId: { in: roles.map(r => r.id) } } }).catch(() => {});
  await prisma.role.deleteMany({ where }).catch(() => {});
  await prisma.user.deleteMany({ where }).catch(() => {});
  await prisma.tenant.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
}

let TENANT = '';
async function makeBatch(qty: number): Promise<{ medicineId: string; invId: string; batchNumber: string; expiry: string; sellingPrice: number }> {
  const med = await prisma.medicine.create({ data: { tenantId: TENANT, name: `Med-${Math.random().toString(36).slice(2, 8)}`, schedule: null, unitsPerPack: 1, reorderLevel: 5, mrp: 10, purchasePrice: 6, sellingPrice: 10 } });
  const expiry = new Date(Date.now() + 365 * 864e5);
  const inv = await prisma.inventoryItem.create({ data: { tenantId: TENANT, medicineId: med.id, batchNumber: `BN-${Math.random().toString(36).slice(2, 8)}`, quantity: qty, purchasePrice: 6, mrp: 10, sellingPrice: 10, expiryDate: expiry, batchStatus: 'active', status: 'available' } });
  return { medicineId: med.id, invId: inv.id, batchNumber: inv.batchNumber, expiry: expiry.toISOString(), sellingPrice: 10 };
}
function billBody(b: { medicineId: string; invId: string; batchNumber: string; expiry: string }, qty: number) {
  const line = { medicineId: b.medicineId, inventoryItemId: b.invId, medicineName: 'Med', batchNumber: b.batchNumber, expiryDate: b.expiry, quantity: qty, mrp: 10, sellingPrice: 10, gstRate: 0, gstAmount: 0, totalAmount: 10 * qty };
  return { items: [line], subtotal: 10 * qty, taxAmount: 0, totalAmount: 10 * qty, paidAmount: 10 * qty, paymentMethod: 'cash' };
}

async function main() {
  console.log(`\n🗄️  DB integrity & concurrency suite → ${API}\n`);
  await teardown();
  const tenant = await prisma.tenant.create({ data: { name: 'ZZ Integrity Tenant', slug: SLUG, type: 'retail', status: 'active', plan: 'professional' } });
  TENANT = tenant.id;
  const perms = await prisma.permission.findMany({ select: { id: true } });
  const role = await prisma.role.create({ data: { tenantId: TENANT, name: 'Full', isSystem: false } });
  await prisma.rolePermission.createMany({ data: perms.map(p => ({ roleId: role.id, permissionId: p.id })) });
  const admin = await prisma.user.create({ data: { tenantId: TENANT, name: 'admin', email: 'admin@zz-int.test', passwordHash: await bcrypt.hash(PW, 10), status: 'active' } });
  await prisma.userRole.create({ data: { userId: admin.id, roleId: role.id } });
  const lr = await (await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@zz-int.test', password: PW }) })).json();
  const token = lr?.data?.tokens?.accessToken;
  if (!token) throw new Error('login failed');

  // 1. Concurrent billing on ONE batch must not oversell / go negative.
  {
    const b = await makeBatch(10);
    const N = 20;
    const res = await Promise.all(Array.from({ length: N }, () => api('POST', '/api/billing', token, billBody(b, 1))));
    const ok = res.filter(r => r.status === 200 || r.status === 201).length;
    const fail = res.filter(r => r.status === 422).length;
    const after = await prisma.inventoryItem.findUnique({ where: { id: b.invId } });
    const pass = ok === 10 && fail === N - 10 && after?.quantity === 0;
    rec({ id: 'CONCURRENCY-oversell', area: 'stock', expected: '10 ok / 10 rejected / qty=0', actual: `ok=${ok} fail=${fail} qty=${after?.quantity}`, evidence: `${N} concurrent bills×1 on batch of 10 → sold=${ok}, rejected=${fail}, finalQty=${after?.quantity} (never <0)`, pass });
  }
  // 2. Concurrent stock adjustments (deductions) are atomic + race-safe.
  {
    const b = await makeBatch(100);
    const N = 20;
    const res = await Promise.all(Array.from({ length: N }, () => api('PATCH', `/api/inventory/${b.invId}/adjust`, token, { adjustmentType: 'damage', quantity: 10, notes: 'concurrency test' })));
    const ok = res.filter(r => r.status === 200).length;
    const after = await prisma.inventoryItem.findUnique({ where: { id: b.invId } });
    const moves = await prisma.stockMovement.count({ where: { inventoryItemId: b.invId, movementType: 'ADJUSTMENT' } });
    const pass = ok === 10 && after?.quantity === 0 && moves === 10;
    rec({ id: 'CONCURRENCY-adjust', area: 'stock', expected: '10 ok / qty=0 / 10 movements', actual: `ok=${ok} qty=${after?.quantity} moves=${moves}`, evidence: `${N} concurrent -10 adjustments on qty 100 → applied=${ok}, finalQty=${after?.quantity}, movements=${moves} (no lost update, never <0)`, pass });
  }
  // 3. A failed multi-item bill rolls back completely (no partial writes).
  {
    const good = await makeBatch(5);
    const bad = await makeBatch(1); // request 100 → insufficient → whole txn aborts
    const billsBefore = await prisma.bill.count({ where: { tenantId: TENANT } });
    const body = {
      items: [
        { medicineId: good.medicineId, inventoryItemId: good.invId, medicineName: 'Good', batchNumber: good.batchNumber, expiryDate: good.expiry, quantity: 2, mrp: 10, sellingPrice: 10, gstRate: 0, gstAmount: 0, totalAmount: 20 },
        { medicineId: bad.medicineId, inventoryItemId: bad.invId, medicineName: 'Bad', batchNumber: bad.batchNumber, expiryDate: bad.expiry, quantity: 100, mrp: 10, sellingPrice: 10, gstRate: 0, gstAmount: 0, totalAmount: 1000 },
      ], subtotal: 1020, taxAmount: 0, totalAmount: 1020, paidAmount: 1020, paymentMethod: 'cash',
    };
    const r = await api('POST', '/api/billing', token, body);
    const goodAfter = await prisma.inventoryItem.findUnique({ where: { id: good.invId } });
    const billsAfter = await prisma.bill.count({ where: { tenantId: TENANT } });
    const moves = await prisma.stockMovement.count({ where: { inventoryItemId: good.invId } });
    const pass = r.status === 422 && goodAfter?.quantity === 5 && billsAfter === billsBefore && moves === 0;
    rec({ id: 'ROLLBACK-atomic', area: 'transaction', expected: '422; good qty unchanged; no bill; no movement', actual: `status=${r.status} goodQty=${goodAfter?.quantity} bills+${billsAfter - billsBefore} moves=${moves}`, evidence: `2-item bill (item2 insufficient) → ${r.status}; item1 qty=${goodAfter?.quantity} (expect 5, NOT decremented); bills added=${billsAfter - billsBefore}; item1 movements=${moves}`, pass });
  }
  // 4. Duplicate/concurrent identical submits → independent bills, unique numbers, stock consistent.
  {
    const b = await makeBatch(10);
    const N = 5;
    const res = await Promise.all(Array.from({ length: N }, () => api('POST', '/api/billing', token, billBody(b, 1))));
    const okBills = res.filter(r => r.status === 200 || r.status === 201).map(r => r.json?.data?.billNumber).filter(Boolean);
    const uniqueNums = new Set(okBills).size;
    const after = await prisma.inventoryItem.findUnique({ where: { id: b.invId } });
    const pass = okBills.length === N && uniqueNums === N && after?.quantity === 10 - N;
    rec({ id: 'DUPLICATE-billnums', area: 'transaction', expected: `${N} bills, ${N} unique #s, qty=${10 - N}`, actual: `bills=${okBills.length} unique=${uniqueNums} qty=${after?.quantity}`, evidence: `${N} identical concurrent submits → bills=${okBills.length}, uniqueBillNumbers=${uniqueNums}, finalQty=${after?.quantity} (consistent; NO idempotency key — business note)`, pass });
  }
  // 5. DECIMAL storage — the money migration must make accumulation EXACT.
  //    Ten 0.1 increments on a DECIMAL(12,2) creditBalance column (via SQL
  //    increment) must sum to exactly 1.00 — no float drift. Also confirm the
  //    column type is numeric in information_schema.
  {
    const cust = await prisma.customer.create({ data: { tenantId: TENANT, name: 'Decimal Cust' } });
    for (let i = 0; i < 10; i++) await prisma.customer.update({ where: { id: cust.id }, data: { creditBalance: { increment: 0.1 } } });
    const c = await prisma.customer.findUnique({ where: { id: cust.id } });
    const bal = Number(c?.creditBalance ?? 0);
    const drift = Math.abs(bal - 1.0);
    const coltype = await prisma.$queryRaw<Array<{ data_type: string; numeric_scale: number }>>`
      SELECT data_type, numeric_scale FROM information_schema.columns
      WHERE table_name = 'customers' AND column_name = 'creditBalance'`;
    const isNumeric = coltype[0]?.data_type === 'numeric' && Number(coltype[0]?.numeric_scale) === 2;
    rec({ id: 'DECIMAL-no-drift', area: 'money', expected: 'exact 1.00; column numeric(_,2)', actual: `creditBalance=${bal} drift=${drift} colType=${coltype[0]?.data_type}(${coltype[0]?.numeric_scale})`, evidence: `10×0.1 increments on DECIMAL column → creditBalance=${bal} (drift=${drift}); column is ${coltype[0]?.data_type} scale ${coltype[0]?.numeric_scale}. Float drift eliminated.`, pass: drift < 1e-9 && isNumeric });
  }

  // ── Report ──
  const pass = results.filter(r => r.pass).length;
  const fail = results.filter(r => !r.pass);
  console.log('ID                       | RESULT | EXPECTED                              | ACTUAL');
  console.log('-'.repeat(125));
  for (const r of results) console.log(`${r.id.padEnd(24)} | ${(r.pass ? 'PASS' : 'FAIL').padEnd(6)} | ${r.expected.padEnd(37)} | ${r.actual}\n    ↳ ${r.evidence}`);
  console.log('-'.repeat(125));
  console.log(`\nTOTAL ${results.length}  |  PASS ${pass}  |  FAIL ${fail.length}\n`);

  await teardown();
  await prisma.$disconnect();
  if (fail.length > 0) process.exit(1);
}

main().catch(async (e) => { console.error('SUITE ERROR:', e); await prisma.$disconnect().catch(() => {}); process.exit(2); });

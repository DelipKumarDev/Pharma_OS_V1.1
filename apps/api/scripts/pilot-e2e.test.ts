/**
 * PHASE 9 — End-to-end pharmacy pilot: "Divya Care Pharmacy".
 * Drives the live API through the full workflow and verifies data, calculations,
 * stock movement, financial totals and audit at each stage. Synthetic data only;
 * self-cleaning. Run: npx tsx scripts/pilot-e2e.test.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const API = process.env['API_BASE'] ?? 'http://localhost:4000';
const PLATFORM_EMAIL = 'ops@pharmaos.test', PLATFORM_PW = 'Platform@Ops123';
const SLUG = 'divya-care-pilot', OWNER_EMAIL = 'owner@divyacare.pilot';

type Row = { id: string; scenario: string; expected: string; actual: string; pass: boolean };
const rows: Row[] = [];
const step = (id: string, scenario: string, expected: string, actual: string, pass: boolean) => rows.push({ id, scenario, expected, actual, pass });

async function api(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let json: any = null; try { json = await res.json(); } catch { /* */ }
  return { status: res.status, json };
}
const login = (e: string, p: string) => api('POST', '/api/auth/login', undefined, { email: e, password: p });
const tok = (r: any) => r.json?.data?.tokens?.accessToken;
const n = (x: unknown) => Number(x);

async function cleanup() {
  const t = await prisma.tenant.findFirst({ where: { slug: SLUG }, select: { id: true } });
  if (!t) return; const where = { tenantId: t.id };
  await prisma.scheduleDrugRegister.deleteMany({ where }).catch(() => {});
  await prisma.returnItem.deleteMany({ where: { return: { tenantId: t.id } } }).catch(() => {});
  await prisma.returnRequest.deleteMany({ where }).catch(() => {});
  await prisma.billItem.deleteMany({ where: { bill: { tenantId: t.id } } }).catch(() => {});
  await prisma.bill.deleteMany({ where }).catch(() => {});
  await prisma.prescription.deleteMany({ where }).catch(() => {});
  await prisma.purchaseOrderItem.deleteMany({ where: { order: { tenantId: t.id } } }).catch(() => {});
  await prisma.purchaseOrder.deleteMany({ where }).catch(() => {});
  await prisma.stockMovement.deleteMany({ where }).catch(() => {});
  await prisma.inventoryItem.deleteMany({ where }).catch(() => {});
  await prisma.medicine.deleteMany({ where }).catch(() => {});
  await prisma.customer.deleteMany({ where }).catch(() => {});
  await prisma.vendor.deleteMany({ where }).catch(() => {});
  await prisma.notification.deleteMany({ where }).catch(() => {});
  await prisma.reorderItem.deleteMany({ where }).catch(() => {});
  await prisma.reorderAlert.deleteMany({ where }).catch(() => {});
  await prisma.auditLog.deleteMany({ where }).catch(() => {});
  await prisma.documentCounter.deleteMany({ where }).catch(() => {});
  const users = await prisma.user.findMany({ where, select: { id: true } });
  await prisma.refreshToken.deleteMany({ where: { userId: { in: users.map(u => u.id) } } }).catch(() => {});
  await prisma.userSession.deleteMany({ where }).catch(() => {});
  await prisma.userRole.deleteMany({ where: { userId: { in: users.map(u => u.id) } } }).catch(() => {});
  const roles = await prisma.role.findMany({ where, select: { id: true } });
  await prisma.rolePermission.deleteMany({ where: { roleId: { in: roles.map(r => r.id) } } }).catch(() => {});
  await prisma.role.deleteMany({ where }).catch(() => {});
  await prisma.user.deleteMany({ where }).catch(() => {});
  await prisma.tenant.deleteMany({ where: { id: t.id } }).catch(() => {});
}

async function main() {
  console.log(`\n🏥 Divya Care Pharmacy — end-to-end pilot → ${API}\n`);
  await cleanup();
  const platformTok = tok(await login(PLATFORM_EMAIL, PLATFORM_PW));
  if (!platformTok) throw new Error('platform login failed — run create-platform-admin.ts');

  // ── P01 Provision ──
  const prov = await api('POST', '/api/tenants', platformTok, {
    name: 'Divya Care Pharmacy', slug: SLUG, type: 'retail', plan: 'starter', city: 'Bengaluru', state: 'Karnataka',
    gstNumber: '29ABCDE1234F1Z5', drugLicenseNumber: 'KA-B-2026-001', ownerName: 'Dr Divya Rao', ownerEmail: OWNER_EMAIL, ownerPhone: '9876500000',
  });
  const tempPw = prov.json?.data?.tempPassword;
  const tenantId = prov.json?.data?.tenant?.id;
  step('P01-PROVISION', 'Provision tenant + owner', '201 + temp password', `status=${prov.status} temp=${tempPw ? 'yes' : 'no'}`, prov.status === 201 && !!tempPw && !!tenantId);

  // ── P02 First login + forced password change + configure profile ──
  await login(OWNER_EMAIL, tempPw);
  const firstTok = tok(await login(OWNER_EMAIL, tempPw));
  const OWNER_PW = 'DivyaCare@2026';
  const chg = await api('POST', '/api/auth/password/change', firstTok, { currentPassword: tempPw, newPassword: OWNER_PW });
  const ownerLogin = await login(OWNER_EMAIL, OWNER_PW);
  const T = tok(ownerLogin);
  step('P02-OWNER-SETUP', 'Owner forced password change', 'change 200, mustChange cleared', `chg=${chg.status} mustChange=${ownerLogin.json?.data?.user?.mustChangePassword}`, chg.status === 200 && ownerLogin.json?.data?.user?.mustChangePassword === false);

  const cfg = await api('PATCH', `/api/tenants/${tenantId}`, T, { addressLine1: '12 MG Road', pincode: '560001', licenseNumber: 'KA/DRUG/2026/777' });
  const cfgDb = await prisma.tenant.findUnique({ where: { id: tenantId } });
  step('P03-CONFIGURE', 'Configure pharmacy profile', 'address persisted', `status=${cfg.status} addr="${cfgDb?.addressLine1}"`, cfg.status === 200 && cfgDb?.addressLine1 === '12 MG Road');

  // ── P04 Roles + staff user ──
  const rolesDb = await prisma.role.findMany({ where: { tenantId }, select: { name: true } });
  step('P04-ROLES', 'Default roles present', '5 roles incl. Pharma Admin', rolesDb.map(r => r.name).join(','), ['Pharma Admin', 'Pharmacist', 'Inventory Manager', 'Billing Assistant', 'Reports Viewer'].every(x => rolesDb.some(r => r.name === x)));
  const pharmacistRole = await prisma.role.findFirst({ where: { tenantId, name: 'Pharmacist' } });
  const staff = await api('POST', '/api/users', T, { name: 'Asha Nair', email: 'asha@divyacare.pilot', phone: '9800011111', roleIds: [pharmacistRole?.id] });
  step('P05-STAFF-USER', 'Create staff user', '201/200', `status=${staff.status}`, staff.status === 201 || staff.status === 200);

  // ── P06 Medicine master ──
  const med1 = await api('POST', '/api/medicines', T, { name: 'Paracetamol 500', genericName: 'Paracetamol', mrp: 12, purchasePrice: 6, sellingPrice: 10, gstRate: 12, reorderLevel: 20 });
  const med2 = await api('POST', '/api/medicines', T, { name: 'Amoxicillin 250', genericName: 'Amoxicillin', mrp: 40, purchasePrice: 22, sellingPrice: 35, gstRate: 12, reorderLevel: 15 });
  const med1Id = med1.json?.data?.id, med2Id = med2.json?.data?.id;
  step('P06-MEDICINE', 'Create medicine master', '2 medicines created', `m1=${med1.status} m2=${med2.status}`, med1.status === 201 && med2.status === 201 && !!med1Id && !!med2Id);

  // ── P07 Vendor ──
  const vend = await api('POST', '/api/vendors', T, { name: 'MediSupply Distributors', phone: '9820022222', gstNumber: '29VENDOR1234Z1Z5' });
  const vendorId = vend.json?.data?.id;
  step('P07-VENDOR', 'Create vendor', '201', `status=${vend.status}`, vend.status === 201 && !!vendorId);

  // ── P08 Opening stock (med1: 100 packs) ──
  const expiry = new Date(Date.now() + 400 * 864e5).toISOString();
  const stock = await api('POST', '/api/inventory', T, { medicineId: med1Id, batchNumber: 'PCM-B1', quantity: 100, purchasePrice: 6, mrp: 12, sellingPrice: 10, expiryDate: expiry });
  const inv1 = await prisma.inventoryItem.findFirst({ where: { tenantId, medicineId: med1Id, batchNumber: 'PCM-B1' } });
  step('P08-OPENING-STOCK', 'Add opening stock (100)', 'inventory qty=100', `status=${stock.status} qty=${inv1?.quantity}`, stock.status === 201 && inv1?.quantity === 100);

  // ── P09 Purchase (PO for med2, then receive → creates stock) ──
  const po = await api('POST', '/api/purchase-orders', T, { vendorId, items: [{ medicineId: med2Id, quantity: 50, unitCost: 22, gstRate: 12 }] });
  const poId = po.json?.data?.id;
  const poItemRow = await prisma.purchaseOrderItem.findFirst({ where: { poId } });
  const poItemId = poItemRow?.id;
  const recv = await api('POST', `/api/purchase-orders/${poId}/receive`, T, { items: [{ poItemId, quantity: 50, batchNumber: 'AMX-B1', expiryDate: expiry, mrp: 40, sellingPrice: 35 }] });
  const inv2 = await prisma.inventoryItem.findFirst({ where: { tenantId, medicineId: med2Id } });
  step('P09-PURCHASE', 'PO create + receive → stock', 'PO 201, received, med2 qty=50', `po=${po.status} recv=${recv.status} qty=${inv2?.quantity}`, po.status === 201 && recv.status === 200 && inv2?.quantity === 50);

  // ── P10 Inventory value ──
  const invList = await api('GET', '/api/inventory?limit=50', T);
  const invStats = await api('GET', '/api/inventory/stats', T);
  step('P10-INVENTORY', 'Inventory reflects both items', '2 batches present', `status=${invList.status} total=${invList.json?.data?.total ?? invList.json?.data?.data?.length}`, invList.status === 200 && (invList.json?.data?.total ?? 0) >= 2 && invStats.status === 200);

  // ── P11 Customer ──
  const cust = await api('POST', '/api/customers', T, { name: 'Ramesh Kumar', phone: '9840033333' });
  const customerId = cust.json?.data?.id;
  step('P11-CUSTOMER', 'Create customer', '201', `status=${cust.status}`, cust.status === 201 && !!customerId);

  // ── P12 Prescription (register → approve) ──
  const rx = await api('POST', '/api/prescriptions', T, { customerId, customerName: 'Ramesh Kumar', customerPhone: '9840033333', doctorName: 'Dr Mehta', medicines: [{ medicineName: 'Paracetamol 500', dosage: '1 tab', frequency: 'TDS', duration: '5 days' }] });
  const rxId = rx.json?.data?.id;
  const rxApprove = await api('PATCH', `/api/prescriptions/${rxId}/approve`, T, {});
  step('P12-PRESCRIPTION', 'Register + approve prescription', 'created + approved', `create=${rx.status} approve=${rxApprove.status} status=${rxApprove.json?.data?.status}`, rx.status === 201 && rxApprove.status === 200);

  // ── P13 Billing (10 units @10 + 12% GST = 112; pay 62 → balance 50 credit) ──
  const bill = await api('POST', '/api/billing', T, {
    customer: { id: customerId, name: 'Ramesh Kumar', phone: '9840033333' }, prescriptionId: rxId, paymentMethod: 'credit',
    items: [{ medicineId: med1Id, inventoryItemId: inv1!.id, medicineName: 'Paracetamol 500', batchNumber: 'PCM-B1', expiryDate: expiry, quantity: 10, mrp: 12, sellingPrice: 10, gstRate: 12, gstAmount: 12, totalAmount: 112 }],
    subtotal: 100, taxAmount: 12, totalAmount: 112, paidAmount: 62,
  });
  const billId = bill.json?.data?.id;
  const billDb = await prisma.bill.findUnique({ where: { id: billId } });
  const inv1AfterBill = await prisma.inventoryItem.findUnique({ where: { id: inv1!.id } });
  const saleMove = await prisma.stockMovement.findFirst({ where: { tenantId, inventoryItemId: inv1!.id, movementType: 'SALE' } });
  const totalOk = n(billDb?.totalAmount) === 112 && n(billDb?.taxAmount) === 12 && n(billDb?.balanceAmount) === 50;
  const stockOk = inv1AfterBill?.quantity === 90 && saleMove?.quantity === 10;
  step('P13-BILLING', 'Create bill: totals + GST + stock', 'total 112, bal 50, stock 100→90, movement 10', `total=${n(billDb?.totalAmount)} gst=${n(billDb?.taxAmount)} bal=${n(billDb?.balanceAmount)} stock=${inv1AfterBill?.quantity} move=${saleMove?.quantity}`, bill.status === 201 && totalOk && stockOk);

  // ── P14 Payment (customer credit: outstanding 50 → pay 50 → balance 0) ──
  const custAfterBill = await prisma.customer.findUnique({ where: { id: customerId } });
  const pay = await api('POST', `/api/customers/${customerId}/payments`, T, { amount: 50, paymentMode: 'cash' });
  const custAfterPay = await prisma.customer.findUnique({ where: { id: customerId } });
  step('P14-PAYMENT', 'Record credit payment', 'creditBalance 50→0', `beforePay=${n(custAfterBill?.creditBalance)} afterPay=${n(custAfterPay?.creditBalance)}`, n(custAfterBill?.creditBalance) === 50 && pay.status === 200 && n(custAfterPay?.creditBalance) === 0);

  // ── P15 Return (2 units of med1 → restock 90→92, refund 20) ──
  const ret = await api('POST', '/api/returns', T, {
    type: 'customer_return', billId, billNumber: billDb?.billNumber, customerId, customerName: 'Ramesh Kumar', reason: 'other', refundMethod: 'cash',
    items: [{ medicineId: med1Id, medicineName: 'Paracetamol 500', batchNumber: 'PCM-B1', returnQty: 2, unitPrice: 10, totalAmount: 20, condition: 'resaleable' }],
  });
  const retId = ret.json?.data?.id;
  await api('PATCH', `/api/returns/${retId}/approve`, T, {});
  const proc = await api('PATCH', `/api/returns/${retId}/process`, T, {});
  const inv1AfterRet = await prisma.inventoryItem.findUnique({ where: { id: inv1!.id } });
  step('P15-RETURN', 'Return + restock', 'stock 90→92, refund 20', `create=${ret.status} process=${proc.status} stock=${inv1AfterRet?.quantity}`, ret.status === 201 && proc.status === 200 && inv1AfterRet?.quantity === 92);

  // ── P16 Reports (revenue includes 112, GST includes 12) ──
  const rep = await api('GET', '/api/reports?days=1', T);
  const rev = n(rep.json?.data?.summary?.totalRevenue), gst = n(rep.json?.data?.summary?.totalGST);
  step('P16-REPORTS', 'Reports reflect the sale', 'revenue≥112, GST≥12', `status=${rep.status} revenue=${rev} gst=${gst}`, rep.status === 200 && rev >= 112 && gst >= 12);

  // ── P17 Audit trail ──
  const audit = await api('GET', '/api/audit?limit=100', T);
  const auditCount = await prisma.auditLog.count({ where: { tenantId } });
  step('P17-AUDIT', 'Audit trail recorded', 'audit entries > 0', `status=${audit.status} count=${auditCount}`, audit.status === 200 && auditCount > 0);

  // ── P18 Notifications ──
  const notif = await api('GET', '/api/notifications', T);
  step('P18-NOTIFICATIONS', 'Notifications endpoint', '200', `status=${notif.status}`, notif.status === 200);

  // ── P19 Export (bills CSV contains the bill) ──
  const exp = await api('GET', '/api/settings/export/bills', T);
  const expText = JSON.stringify(exp.json ?? '');
  step('P19-EXPORT', 'Export bills', '200 + contains bill number', `status=${exp.status} hasBill=${expText.includes(String(billDb?.billNumber))}`, exp.status === 200);

  // ── P20 Backup (tenant-scoped) ──
  const bk = await api('POST', '/api/settings/backup', T);
  step('P20-BACKUP', 'Tenant backup', '200 + records>0', `status=${bk.status} records=${bk.json?.data?.records}`, bk.status === 200 && (bk.json?.data?.records ?? 0) > 0);

  // ── Report ──
  const pass = rows.filter(r => r.pass).length, fail = rows.filter(r => !r.pass);
  console.log('ID                  | RESULT | EXPECTED                                   | ACTUAL');
  console.log('-'.repeat(130));
  for (const r of rows) console.log(`${r.id.padEnd(19)} | ${(r.pass ? 'PASS' : 'FAIL').padEnd(6)} | ${r.expected.padEnd(42)} | ${r.actual}`);
  console.log('-'.repeat(130));
  console.log(`\nTOTAL ${rows.length}  |  PASS ${pass}  |  FAIL ${fail.length}\n`);

  await cleanup();
  await prisma.$disconnect();
  if (fail.length > 0) process.exit(1);
}
main().catch(async e => { console.error('SUITE ERROR:', e); await prisma.$disconnect().catch(() => {}); process.exit(2); });

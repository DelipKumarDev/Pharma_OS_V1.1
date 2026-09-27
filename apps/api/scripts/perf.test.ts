/**
 * PHASE 10 — Performance & concurrency measurement.
 * Seeds a realistic single-pharmacy dataset in a throwaway tenant, then measures
 * endpoint latency (p50/p95) and concurrent throughput. Evidence-first: reports
 * numbers so we optimize only where a real problem shows. Self-cleaning.
 * Run: npx tsx scripts/perf.test.ts
 */
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
const prisma = new PrismaClient();
const API = process.env['API_BASE'] ?? 'http://localhost:4000';
const SLUG = 'zz-perf', PW = 'Perf@12345';

// Realistic single-store scale.
const N_MED = 1000, N_INV = 1000, N_CUST = 500, N_BILLS = 800;

async function api(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let json: any = null; try { json = await res.json(); } catch { /* */ }
  return { status: res.status, json };
}

async function cleanup() {
  const t = await prisma.tenant.findFirst({ where: { slug: SLUG }, select: { id: true } });
  if (!t) return; const where = { tenantId: t.id };
  await prisma.billItem.deleteMany({ where: { bill: { tenantId: t.id } } }).catch(() => {});
  await prisma.bill.deleteMany({ where }).catch(() => {});
  await prisma.inventoryItem.deleteMany({ where }).catch(() => {});
  await prisma.medicine.deleteMany({ where }).catch(() => {});
  await prisma.customer.deleteMany({ where }).catch(() => {});
  await prisma.stockMovement.deleteMany({ where }).catch(() => {});
  await prisma.auditLog.deleteMany({ where }).catch(() => {});
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

function pctl(arr: number[], p: number) { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))]; }

async function timeit(label: string, fn: () => Promise<{ status: number }>, k = 15) {
  const lat: number[] = []; let errors = 0;
  for (let i = 0; i < k; i++) { const s = performance.now(); const r = await fn(); lat.push(performance.now() - s); if (r.status >= 400) errors++; }
  return { label, p50: Math.round(pctl(lat, 50)), p95: Math.round(pctl(lat, 95)), errors };
}

async function main() {
  console.log(`\n⚡ Performance & concurrency → ${API}\n`);
  await cleanup();

  // ── Seed realistic data ──
  console.log('seeding…');
  const tenant = await prisma.tenant.create({ data: { name: 'ZZ Perf', slug: SLUG, type: 'retail', status: 'active', plan: 'professional' } });
  const perms = await prisma.permission.findMany({ where: { module: { not: 'platform' } }, select: { id: true } });
  const role = await prisma.role.create({ data: { tenantId: tenant.id, name: 'Full', isSystem: false } });
  await prisma.rolePermission.createMany({ data: perms.map(p => ({ roleId: role.id, permissionId: p.id })) });
  const admin = await prisma.user.create({ data: { tenantId: tenant.id, name: 'perf', email: 'perf@zz.test', passwordHash: await bcrypt.hash(PW, 10), status: 'active' } });
  await prisma.userRole.create({ data: { userId: admin.id, roleId: role.id } });

  const medIds: string[] = Array.from({ length: N_MED }, () => randomUUID());
  await prisma.medicine.createMany({ data: medIds.map((id, i) => ({ id, tenantId: tenant.id, name: `Medicine ${i} ${['Tab', 'Cap', 'Syrup'][i % 3]}`, genericName: `Generic ${i % 200}`, mrp: 10 + (i % 90), purchasePrice: 6 + (i % 50), sellingPrice: 9 + (i % 80), gstRate: [5, 12, 18][i % 3], reorderLevel: 10 })) });
  const expiry = new Date(Date.now() + 300 * 864e5);
  await prisma.inventoryItem.createMany({ data: Array.from({ length: N_INV }, (_, i) => ({ tenantId: tenant.id, medicineId: medIds[i % N_MED]!, batchNumber: `B${i}`, quantity: 50 + (i % 200), purchasePrice: 6 + (i % 50), mrp: 10 + (i % 90), sellingPrice: 9 + (i % 80), expiryDate: expiry, batchStatus: 'active', status: 'available' })) });
  await prisma.customer.createMany({ data: Array.from({ length: N_CUST }, (_, i) => ({ tenantId: tenant.id, name: `Customer ${i}`, phone: `9${String(100000000 + i).slice(0, 9)}`, totalSpend: i * 3.5, creditBalance: i % 7 === 0 ? 50.25 : 0 })) });

  const billIds = Array.from({ length: N_BILLS }, () => randomUUID());
  await prisma.bill.createMany({ data: billIds.map((id, i) => {
    const sub = 100 + (i % 500); const tax = Number((sub * 0.12).toFixed(2)); const total = Number((sub + tax).toFixed(2));
    const created = new Date(Date.now() - (i % 85) * 864e5); // spread across ~85 days
    return { id, tenantId: tenant.id, billNumber: `PERF${String(i).padStart(6, '0')}`, type: 'sale' as const, status: 'completed' as const, paymentMethod: (['cash', 'upi', 'card', 'credit'] as const)[i % 4], subtotal: sub, taxAmount: tax, totalAmount: total, paidAmount: total, createdAt: created, updatedAt: created };
  }) });
  await prisma.billItem.createMany({ data: billIds.map((bid, i) => {
    const sub = 100 + (i % 500); const tax = Number((sub * 0.12).toFixed(2));
    return { billId: bid, medicineId: medIds[i % N_MED]!, medicineName: `Medicine ${i % N_MED}`, batchNumber: `B${i % N_INV}`, expiryDate: expiry, quantity: 1 + (i % 10), mrp: 20, sellingPrice: 18, gstRate: 12, gstAmount: tax, totalAmount: Number((sub + tax).toFixed(2)) };
  }) });
  console.log(`seeded: ${N_MED} medicines, ${N_INV} inventory, ${N_CUST} customers, ${N_BILLS} bills\n`);

  const token = (await api('POST', '/api/auth/login', undefined, { email: 'perf@zz.test', password: PW })).json?.data?.tokens?.accessToken;
  if (!token) throw new Error('login failed');

  // ── Latency (p50/p95, ms) ──
  const measures = [
    await timeit('login', () => api('POST', '/api/auth/login', undefined, { email: 'perf@zz.test', password: PW }), 10),
    await timeit('GET /dashboard', () => api('GET', '/api/dashboard', token)),
    await timeit('GET /medicines?limit=20', () => api('GET', '/api/medicines?limit=20', token)),
    await timeit('GET /medicines?search=Medicine 5', () => api('GET', '/api/medicines?search=Medicine%205&limit=20', token)),
    await timeit('GET /search?q=Medicine', () => api('GET', '/api/search?q=Medicine&limit=10', token)),
    await timeit('GET /inventory?limit=50', () => api('GET', '/api/inventory?limit=50', token)),
    await timeit('GET /inventory/stats', () => api('GET', '/api/inventory/stats', token)),
    await timeit('GET /customers?limit=50', () => api('GET', '/api/customers?limit=50', token)),
    await timeit('GET /billing?limit=50', () => api('GET', '/api/billing?limit=50', token)),
    await timeit('GET /reports?days=30', () => api('GET', '/api/reports?days=30', token), 8),
    await timeit('GET /reports?days=90', () => api('GET', '/api/reports?days=90', token), 8),
  ];
  console.log('ENDPOINT                          | p50 ms | p95 ms | errors');
  console.log('-'.repeat(70));
  for (const m of measures) console.log(`${m.label.padEnd(33)} | ${String(m.p50).padStart(6)} | ${String(m.p95).padStart(6)} | ${m.errors}`);
  console.log('-'.repeat(70));

  // ── Concurrency ──
  async function concurrent(label: string, count: number, fn: () => Promise<{ status: number }>) {
    const s = performance.now();
    const rs = await Promise.all(Array.from({ length: count }, fn));
    const wall = Math.round(performance.now() - s);
    const ok = rs.filter(r => r.status < 400).length;
    console.log(`${label.padEnd(40)} | ${count} reqs | ${wall} ms wall | ${ok}/${count} ok | ${Math.round(count / (wall / 1000))} req/s`);
    return { wall, ok };
  }
  console.log('\nCONCURRENCY');
  await concurrent('30× GET /medicines', 30, () => api('GET', '/api/medicines?limit=20', token));
  await concurrent('30× GET /inventory', 30, () => api('GET', '/api/inventory?limit=50', token));
  await concurrent('20× GET /reports?days=30', 20, () => api('GET', '/api/reports?days=30', token));
  await concurrent('10× login (fresh)', 10, () => api('POST', '/api/auth/login', undefined, { email: 'perf@zz.test', password: PW }));

  // Flag slow endpoints (>800ms p95 at this scale).
  const slow = measures.filter(m => m.p95 > 800);
  console.log(`\n${slow.length === 0 ? '✅ No endpoint exceeded 800ms p95 at this scale.' : '⚠️  Slow endpoints (p95>800ms): ' + slow.map(m => `${m.label}=${m.p95}ms`).join(', ')}`);

  await cleanup();
  await prisma.$disconnect();
}
main().catch(async e => { console.error('SUITE ERROR:', e); await cleanup().catch(() => {}); await prisma.$disconnect().catch(() => {}); process.exit(2); });

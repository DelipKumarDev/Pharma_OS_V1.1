/**
 * Seed the "Divya Care Pharmacy" pilot (from the Pilot Testing plan) via the live
 * API: provision tenant + owner, configure profile, create 3 staff users,
 * 3 vendors, 20 medicines, opening stock for 10, and 5 customers. Leaves a clean
 * Day-1 launch baseline. Run after reset-data.ts + create-platform-admin.ts.
 *   npx tsx scripts/seed-pilot.ts
 */
import 'dotenv/config';

const API = process.env['API_BASE'] ?? 'http://localhost:4000';
const PLATFORM_EMAIL = 'ops@pharmaos.test', PLATFORM_PW = 'Platform@Ops123';
const OWNER_EMAIL = 'admin@divyacare.test', OWNER_PW = 'Divya@Care2026';

async function api(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let json: any = null; try { json = await res.json(); } catch { /* */ }
  return { status: res.status, json };
}
const login = (e: string, p: string) => api('POST', '/api/auth/login', undefined, { email: e, password: p });
const tok = (r: any) => r.json?.data?.tokens?.accessToken;
const eom = (mmYYYY: string) => { const [m, y] = mmYYYY.split('/').map(Number); return new Date(y!, m!, 0).toISOString(); };
let ok = 0, fail = 0;
const log = (label: string, pass: boolean, extra = '') => { console.log(`${pass ? '✓' : '✗'} ${label} ${extra}`); pass ? ok++ : fail++; };

async function main() {
  console.log(`\n🌱 Seeding Divya Care Pharmacy pilot → ${API}\n`);
  const platformTok = tok(await login(PLATFORM_EMAIL, PLATFORM_PW));
  if (!platformTok) throw new Error('platform login failed');

  // ── Provision ──
  const prov = await api('POST', '/api/tenants', platformTok, {
    name: 'Divya Care Pharmacy', slug: 'divya-care', type: 'retail', plan: 'starter',
    city: 'Bengaluru', state: 'Karnataka', gstNumber: '29ABCDE1234F1Z5',
    drugLicenseNumber: 'KA/RET/2026/TEST/001', ownerName: 'Divya Kumar',
    ownerEmail: OWNER_EMAIL, ownerPhone: '9876543210',
  });
  const tempPw = prov.json?.data?.tempPassword;
  const tenantId = prov.json?.data?.tenant?.id;
  log('Provision tenant + owner', prov.status === 201 && !!tempPw, `(tenant ${tenantId})`);

  // ── Owner first login → forced password change ──
  const firstTok = tok(await login(OWNER_EMAIL, tempPw));
  const chg = await api('POST', '/api/auth/password/change', firstTok, { currentPassword: tempPw, newPassword: OWNER_PW });
  log('Owner password set', chg.status === 200);
  const T = tok(await login(OWNER_EMAIL, OWNER_PW));
  if (!T) throw new Error('owner login failed after password change');

  // ── Configure pharmacy profile ──
  const cfg = await api('PATCH', `/api/tenants/${tenantId}`, T, {
    addressLine1: '24, 2nd Main Road, HSR Layout', pincode: '560102',
    licenseNumber: 'KA/RET/2026/TEST/001', phone: '9876543210', email: OWNER_EMAIL,
  });
  log('Configure pharmacy profile', cfg.status === 200);

  // ── Staff users (Cashier → Billing Assistant, the app's cashier role) ──
  const rolesRes = await api('GET', '/api/roles', T);
  const roles: any[] = rolesRes.json?.data?.data ?? [];
  const roleId = (name: string) => roles.find((r) => r.name === name)?.id;
  const users = [
    { name: 'Rahul Sharma', email: 'rahul.admin@divyacare.test', phone: '9876500011', role: 'Pharma Admin' },
    { name: 'Ananya Rao', email: 'ananya@divyacare.test', phone: '9876500012', role: 'Pharmacist' },
    { name: 'Suresh Kumar', email: 'suresh@divyacare.test', phone: '9876500013', role: 'Billing Assistant' },
  ];
  for (const u of users) {
    const r = await api('POST', '/api/users', T, { name: u.name, email: u.email, phone: u.phone, roleIds: [roleId(u.role)] });
    log(`User ${u.name} (${u.role})`, r.status === 201 || r.status === 200, `status=${r.status}`);
  }

  // ── Vendors ──
  const vendors = [
    { name: 'Apex Pharma Distributors', contactPerson: 'Rajesh Kumar', phone: '9000012345', email: 'sales@apexpharma.test', gstNumber: '29AABCA1234F1Z5', address: 'Peenya', city: 'Bengaluru' },
    { name: 'MedPlus Wholesale Supplies', contactPerson: 'Kiran Rao', phone: '9000012346', email: 'orders@medpluswholesale.test', gstNumber: '29AABCM5678G1Z2', address: 'Yeshwanthpur', city: 'Bengaluru' },
    { name: 'Karnataka Healthcare Supplies', contactPerson: 'Arjun Shetty', phone: '9000012347', email: 'supply@khs.test', gstNumber: '29AABCK9012H1Z7', address: 'Rajajinagar', city: 'Bengaluru' },
  ];
  for (const v of vendors) {
    const r = await api('POST', '/api/vendors', T, v);
    log(`Vendor ${v.name}`, r.status === 201, `status=${r.status}`);
  }

  // ── Medicines (20) ──  [name, generic, category, form|'', strength, gst, mrp, purchase]
  const meds: [string, string, string, string, string, number, number, number][] = [
    ['Paracetamol 650', 'Paracetamol', 'analgesic', 'tablet', '650 mg', 12, 30, 18],
    ['Pantop 40', 'Pantoprazole', 'gastroenterology', 'tablet', '40 mg', 12, 174.45, 120],
    ['Azithral 500', 'Azithromycin', 'antibiotic', 'tablet', '500 mg', 12, 120, 82],
    ['Cetirizine 10', 'Cetirizine', 'antihistamine', 'tablet', '10 mg', 12, 25, 15],
    ['Amoxicillin 500', 'Amoxicillin', 'antibiotic', 'capsule', '500 mg', 12, 95, 55],
    ['Metformin 500', 'Metformin', 'diabetes', 'tablet', '500 mg', 12, 35, 22],
    ['Amlodipine 5', 'Amlodipine', 'cardiovascular', 'tablet', '5 mg', 12, 45, 28],
    ['Atorvastatin 10', 'Atorvastatin', 'cardiovascular', 'tablet', '10 mg', 12, 60, 38],
    ['ORS Orange', 'Oral Rehydration Salts', 'other', 'powder', '—', 12, 25, 15],
    ['Pantop Syrup', 'Pantoprazole', 'gastroenterology', 'syrup', '20 mg/5ml', 12, 110, 65],
    ['Paracetamol Syrup', 'Paracetamol', 'analgesic', 'syrup', '250mg/5ml', 12, 80, 55],
    ['Antacid Suspension', 'Antacid', 'gastroenterology', 'suspension', '—', 12, 125, 85],
    ['Clotrimazole Cream', 'Clotrimazole', 'antifungal', 'cream', '1%', 12, 75, 50],
    ['Diclofenac Gel', 'Diclofenac', 'analgesic', 'gel', '1%', 12, 120, 70],
    ['Artificial Tears', 'Carboxymethylcellulose', 'ophthalmology', 'drops', '—', 12, 95, 55],
    ['Vitamin D3', 'Cholecalciferol', 'vitamins', 'capsule', '60K IU', 12, 150, 90],
    ['Multivitamin', 'Multivitamin', 'vitamins', 'tablet', '—', 12, 180, 110],
    ['Sunscreen SPF 50', 'Sunscreen', 'dermatology', 'lotion', 'SPF 50', 18, 450, 270],
    ['Hand Sanitizer', 'Isopropyl Alcohol', 'other', '', '100ml', 18, 90, 50],
    ['Disposable Syringe', 'Syringe', 'surgical', '', '5ml', 12, 10, 6],
  ];
  const medId: Record<string, string> = {};
  for (const [name, generic, category, form, strength, gst, mrp, purchase] of meds) {
    const body: Record<string, unknown> = { name, genericName: generic, category, strength, mrp, purchasePrice: purchase, sellingPrice: mrp, gstRate: gst, reorderLevel: 20 };
    if (form) body['form'] = form;
    const r = await api('POST', '/api/medicines', T, body);
    if (r.status === 201) medId[name] = r.json?.data?.id;
    log(`Medicine ${name}`, r.status === 201, r.status !== 201 ? `status=${r.status} ${JSON.stringify(r.json?.message)}` : '');
  }

  // ── Opening stock (10) ──  [medName, batch, expiryMMYYYY, qty, purchase, mrp, rack]
  const stock: [string, string, string, number, number, number, string][] = [
    ['Paracetamol 650', 'PCM26001', '06/2028', 100, 18, 30, 'A-01'],
    ['Pantop 40', 'PAN26001', '07/2028', 50, 120, 174.45, 'A-02'],
    ['Azithral 500', 'AZI26001', '04/2028', 40, 82, 120, 'A-03'],
    ['Cetirizine 10', 'CET26001', '09/2028', 75, 15, 25, 'A-04'],
    ['Metformin 500', 'MET26001', '12/2028', 100, 22, 35, 'B-01'],
    ['Amlodipine 5', 'AML26001', '11/2028', 80, 28, 45, 'B-02'],
    ['Atorvastatin 10', 'ATV26001', '10/2028', 60, 38, 60, 'B-03'],
    ['Paracetamol Syrup', 'PSY26001', '08/2027', 30, 55, 80, 'C-01'],
    ['Antacid Suspension', 'ANT26001', '03/2027', 25, 85, 125, 'C-02'],
    ['Clotrimazole Cream', 'CLO26001', '12/2027', 30, 50, 75, 'C-03'],
  ];
  for (const [medName, batch, exp, qty, purchase, mrp, rack] of stock) {
    const r = await api('POST', '/api/inventory', T, { medicineId: medId[medName], batchNumber: batch, quantity: qty, purchasePrice: purchase, mrp, sellingPrice: mrp, expiryDate: eom(exp), rackLocation: rack });
    log(`Opening stock ${medName} ×${qty}`, r.status === 201, r.status !== 201 ? `status=${r.status}` : '');
  }

  // ── Customers (5) ──
  const customers = [
    { name: 'Ramesh Kumar', phone: '9811100001', gender: 'male', address: 'HSR Layout, Bengaluru', customerType: 'regular' },
    { name: 'Priya Sharma', phone: '9811100002', gender: 'female', customerType: 'regular' },
    { name: 'Arjun Rao', phone: '9811100003', gender: 'male', customerType: 'regular' },
    { name: 'Sneha Reddy', phone: '9811100004', gender: 'female', customerType: 'regular' },
    { name: 'Walk-in Customer', phone: '9811100005', customerType: 'walk_in' },
  ];
  for (const c of customers) {
    const r = await api('POST', '/api/customers', T, c);
    log(`Customer ${c.name}`, r.status === 201, r.status !== 201 ? `status=${r.status}` : '');
  }

  console.log(`\n   OWNER LOGIN → ${OWNER_EMAIL} / ${OWNER_PW}`);
  console.log(`   RESULT → ${ok} ok, ${fail} failed\n`);
  if (fail) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });

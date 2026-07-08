import { http, HttpResponse, delay } from 'msw';
import type { Tenant } from '@pharmaos/types';

const TENANTS: Tenant[] = [
  {
    id: 'tnt_001', name: 'Divya Pharmacy', slug: 'divya-pharmacy', type: 'retail', status: 'active', plan: 'professional',
    phone: '+91-9876543210', email: 'admin@divyapharmacy.com',
    address: { line1: '12, MG Road', line2: 'Near Central Hospital', city: 'Bangalore', state: 'Karnataka', pincode: '560001', country: 'India' },
    licenseNumber: 'KA/DRUG/2023/1234', gstNumber: '29ABCDE1234F1Z5',
    drugLicenseNumber: 'DL-KA-20-00123', drugLicenseExpiry: '2026-12-31T00:00:00Z',
    settings: { currency: 'INR', timezone: 'Asia/Kolkata', dateFormat: 'DD/MM/YYYY', lowStockThreshold: 10, expiryAlertDays: 90, autoBackup: true, printBillDefault: true, requirePrescription: true, enableOfflineMode: true, gstEnabled: true },
    stats: { totalUsers: 7, totalMedicines: 38, totalInventoryItems: 25, monthlyRevenue: 284500, storageUsedMb: 120 },
    createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-06-01T00:00:00Z',
  },
  {
    id: 'tnt_002', name: 'Apollo Medical Store', slug: 'apollo-medical', type: 'retail', status: 'active', plan: 'enterprise',
    phone: '+91-9765432109', email: 'manager@apollomed.in',
    address: { line1: '45, Anna Salai', city: 'Chennai', state: 'Tamil Nadu', pincode: '600002', country: 'India' },
    licenseNumber: 'TN/DRUG/2022/5678', gstNumber: '33FGHIJ5678K2L6',
    drugLicenseNumber: 'DL-TN-20-00456', drugLicenseExpiry: '2025-06-30T00:00:00Z',
    settings: { currency: 'INR', timezone: 'Asia/Kolkata', dateFormat: 'DD/MM/YYYY', lowStockThreshold: 20, expiryAlertDays: 60, autoBackup: true, printBillDefault: false, requirePrescription: false, enableOfflineMode: true, gstEnabled: true },
    stats: { totalUsers: 15, totalMedicines: 125, totalInventoryItems: 200, monthlyRevenue: 1250000, storageUsedMb: 450 },
    createdAt: '2024-01-15T00:00:00Z', updatedAt: '2024-05-20T00:00:00Z',
  },
  {
    id: 'tnt_003', name: 'City Care Pharmacy', slug: 'city-care', type: 'retail', status: 'trial', plan: 'starter',
    phone: '+91-9654321098', email: 'hello@citycarepharma.com',
    address: { line1: '7, Park Street', city: 'Kolkata', state: 'West Bengal', pincode: '700016', country: 'India' },
    licenseNumber: 'WB/DRUG/2024/9012', drugLicenseNumber: 'DL-WB-20-00789', drugLicenseExpiry: '2026-03-31T00:00:00Z',
    settings: { currency: 'INR', timezone: 'Asia/Kolkata', dateFormat: 'DD/MM/YYYY', lowStockThreshold: 5, expiryAlertDays: 30, autoBackup: false, printBillDefault: true, requirePrescription: false, enableOfflineMode: false, gstEnabled: false },
    stats: { totalUsers: 2, totalMedicines: 12, totalInventoryItems: 18, monthlyRevenue: 45000, storageUsedMb: 15 },
    createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-06-10T00:00:00Z',
  },
  {
    id: 'tnt_004', name: 'Sanjivini Hospital Pharmacy', slug: 'sanjivini-hospital', type: 'hospital', status: 'active', plan: 'enterprise',
    phone: '+91-9543210987', email: 'pharmacy@sanjivini.hospital',
    address: { line1: 'Sanjivini Hospital Campus, Sector 14', city: 'Gurugram', state: 'Haryana', pincode: '122001', country: 'India' },
    licenseNumber: 'HR/DRUG/2021/3456', gstNumber: '06KLMNO3456P3M7',
    drugLicenseNumber: 'DL-HR-20-01234', drugLicenseExpiry: '2025-12-31T00:00:00Z',
    settings: { currency: 'INR', timezone: 'Asia/Kolkata', dateFormat: 'DD/MM/YYYY', lowStockThreshold: 50, expiryAlertDays: 120, autoBackup: true, printBillDefault: true, requirePrescription: true, enableOfflineMode: true, gstEnabled: true },
    stats: { totalUsers: 32, totalMedicines: 450, totalInventoryItems: 890, monthlyRevenue: 5600000, storageUsedMb: 2048 },
    createdAt: '2023-06-01T00:00:00Z', updatedAt: '2024-04-15T00:00:00Z',
  },
  {
    id: 'tnt_005', name: 'MedPlus Wellness', slug: 'medplus-wellness', type: 'chain', status: 'suspended', plan: 'professional',
    phone: '+91-9432109876', email: 'ops@medpluswellness.com',
    address: { line1: '101, Baner Road', city: 'Pune', state: 'Maharashtra', pincode: '411045', country: 'India' },
    licenseNumber: 'MH/DRUG/2022/7890', gstNumber: '27PQRST7890Q4N8',
    drugLicenseNumber: 'DL-MH-20-02345', drugLicenseExpiry: '2024-09-30T00:00:00Z',
    settings: { currency: 'INR', timezone: 'Asia/Kolkata', dateFormat: 'DD/MM/YYYY', lowStockThreshold: 15, expiryAlertDays: 90, autoBackup: false, printBillDefault: true, requirePrescription: true, enableOfflineMode: false, gstEnabled: true },
    stats: { totalUsers: 8, totalMedicines: 280, totalInventoryItems: 320, monthlyRevenue: 0, storageUsedMb: 380 },
    createdAt: '2023-10-01T00:00:00Z', updatedAt: '2026-03-01T00:00:00Z',
  },
];

export const tenantHandlers = [
  http.get('/api/tenants', async ({ request }) => {
    await delay(400);
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.toLowerCase() ?? '';
    let filtered = [...TENANTS];
    if (search) filtered = filtered.filter((t) => t.name.toLowerCase().includes(search) || t.email.toLowerCase().includes(search));
    return HttpResponse.json({ success: true, data: { data: filtered, total: filtered.length, page: 1, limit: 20, totalPages: 1 } });
  }),

  http.get('/api/tenants/:id', async ({ params }) => {
    await delay(200);
    const tenant = TENANTS.find((t) => t.id === params['id']);
    if (!tenant) return HttpResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    return HttpResponse.json({ success: true, data: tenant });
  }),

  http.put('/api/tenants/:id', async ({ params, request }) => {
    await delay(400);
    const idx = TENANTS.findIndex((t) => t.id === params['id']);
    if (idx === -1) return HttpResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    const body = await request.json() as Partial<Tenant>;
    TENANTS[idx] = { ...TENANTS[idx]!, ...body, updatedAt: new Date().toISOString() };
    return HttpResponse.json({ success: true, data: TENANTS[idx] });
  }),
];

import { http, HttpResponse, delay } from 'msw';

let SETTINGS = {
  profile: {
    pharmacyName: 'Divya Pharmacy',
    ownerName: 'Dr. Rajesh Kumar',
    pharmacyType: 'Retail Pharmacy',
    licenseNumber: 'MH-PHR-2024-0123',
    drugLicenseNumber: 'DL-MH-2024-0456',
    gstNumber: '27ABCDE1234F1Z5',
    address: '123 Main Street, Andheri West',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400053',
    phone: '022-26234567',
    mobile: '9876543210',
    email: 'info@divyapharmacy.com',
    website: 'www.divyapharmacy.com',
    logoUrl: null as string | null,
  },
  system: {
    timezone: 'Asia/Kolkata',
    dateFormat: 'DD/MM/YYYY',
    currency: 'INR',
    lowStockThreshold: 50,
    expiryAlertDays: 90,
    autoBackup: true,
    backupFrequency: 'daily',
    sessionTimeout: 30,
    language: 'en',
  },
  tax: {
    enableGST: true,
    gstRegistered: true,
    defaultGST: 12,
    gstSlabs: [
      { rate: 0, category: 'Exempt', examples: 'Life-saving drugs, ORS, essential antidiabetics' },
      { rate: 5, category: 'Basic medicines', examples: 'Analgesics, antibiotics, vitamins' },
      { rate: 12, category: 'Supplements', examples: 'Protein powders, health drinks, OTC topicals' },
      { rate: 18, category: 'Medical devices', examples: 'BP monitors, glucometers, thermometers' },
    ],
  },
  billing: {
    printReceiptOnSale: true,
    showGSTOnReceipt: true,
    showGenericName: true,
    termsOnReceipt: 'Medicines once sold will not be taken back. Verify before purchase. Valid prescription required for Schedule-H drugs.',
    thankYouMessage: 'Thank you for choosing Divya Pharmacy! Get well soon.',
    acceptCash: true,
    acceptUPI: true,
    acceptCard: true,
    acceptCredit: true,
    upiId: 'divyapharmacy@upi',
    creditLimit: 5000,
  },
  notifications: {
    lowStockAlert: true,
    expiryAlert: true,
    reorderAlert: true,
    dailyReport: true,
    weeklyReport: true,
    monthlyReport: false,
    emailAlerts: false,
    smsAlerts: false,
    whatsappAlerts: false,
    alertEmail: '',
    alertPhone: '',
  },
};

const IMPORT_TEMPLATES = {
  medicines: { columns: ['Medicine Name', 'Generic Name', 'Manufacturer', 'Category', 'Dosage Form', 'Strength', 'Schedule', 'MRP', 'Selling Price', 'HSN Code', 'GST %'], rows: 3 },
  inventory: { columns: ['Medicine Name', 'Batch Number', 'Qty', 'Purchase Price', 'MRP', 'Expiry Date (MM/YYYY)', 'Rack Location'], rows: 2 },
  customers: { columns: ['Name', 'Phone', 'Email', 'Address', 'City', 'Date of Birth', 'Notes'], rows: 3 },
  vendors: { columns: ['Company Name', 'Contact Person', 'Phone', 'Email', 'Address', 'GST Number', 'Payment Terms (days)', 'Credit Limit'], rows: 2 },
};

export const settingsHandlers = [
  http.get('/api/settings', async () => {
    await delay(300);
    return HttpResponse.json({ success: true, data: SETTINGS });
  }),

  // Operational subset used by the POS / receipts (no settings:view required).
  http.get('/api/settings/public', async () => {
    await delay(100);
    const s = SETTINGS as Record<string, unknown>;
    return HttpResponse.json({ success: true, data: { profile: s['profile'], billing: s['billing'], system: s['system'], receipt: s['receipt'] } });
  }),

  http.patch('/api/settings/:section', async ({ params, request }) => {
    const section = params.section as keyof typeof SETTINGS;
    const body = await request.json() as Record<string, unknown>;
    if (section in SETTINGS) {
      (SETTINGS[section] as Record<string, unknown>) = { ...(SETTINGS[section] as Record<string, unknown>), ...body };
    }
    await delay(300);
    return HttpResponse.json({ success: true, data: SETTINGS });
  }),

  http.post('/api/import/:type', async ({ params }) => {
    const type = params.type as string;
    await delay(1500 + Math.random() * 1000);
    const counts: Record<string, { imported: number; skipped: number; errors: number }> = {
      medicines: { imported: 1197, skipped: 3, errors: 0 },
      inventory: { imported: 842, skipped: 12, errors: 2 },
      customers: { imported: 312, skipped: 1, errors: 0 },
      vendors: { imported: 28, skipped: 0, errors: 0 },
      backup: { imported: 5847, skipped: 0, errors: 0 },
    };
    return HttpResponse.json({
      success: true,
      data: counts[type] ?? { imported: 100, skipped: 0, errors: 0 },
    });
  }),

  http.get('/api/export/:type', async ({ params }) => {
    await delay(500);
    const sizes: Record<string, string> = {
      medicines: '2.4 MB', inventory: '1.8 MB', customers: '340 KB',
      vendors: '120 KB', bills: '5.2 MB', backup: '12.6 MB',
    };
    return HttpResponse.json({
      success: true,
      data: { type: params.type, size: sizes[params.type as string] ?? '1 MB', generatedAt: new Date().toISOString() },
    });
  }),

  http.get('/api/import/template/:type', async ({ params }) => {
    const t = IMPORT_TEMPLATES[params.type as keyof typeof IMPORT_TEMPLATES];
    if (!t) return HttpResponse.json({ success: false }, { status: 404 });
    return HttpResponse.json({ success: true, data: { ...t, type: params.type } });
  }),

  http.post('/api/backup', async () => {
    await delay(2000);
    return HttpResponse.json({ success: true, data: { size: '12.6 MB', createdAt: new Date().toISOString(), records: 5847 } });
  }),
];

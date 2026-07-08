import { http, HttpResponse } from 'msw';
import type { Vendor, PurchaseInvoice, VendorPayment, VendorStats } from '@pharmaos/types';

const VENDORS: Vendor[] = [
  { id: 'v1', name: 'MedLine Distributors', gstNumber: '27AABCU9603R1ZX', phone: '9876543210', email: 'orders@medline.in', address: '14, Pharma Complex, MG Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', contactPerson: 'Rajesh Sharma', paymentTerms: 'Net 30', creditLimit: 200000, totalPurchases: 1540000, pendingPayment: 45000, lastOrderDate: new Date(Date.now() - 2 * 86400000).toISOString(), rating: 4.5, status: 'active', createdAt: new Date(Date.now() - 180 * 86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'v2', name: 'PharmaCorp India', gstNumber: '07AAACB1122C1Z5', phone: '9123456789', email: 'supply@pharmacorp.com', address: '22B, Industrial Estate, Naroda', city: 'Ahmedabad', state: 'Gujarat', pincode: '382330', contactPerson: 'Meena Patel', paymentTerms: 'Net 15', creditLimit: 100000, totalPurchases: 890000, pendingPayment: 22000, lastOrderDate: new Date(Date.now() - 5 * 86400000).toISOString(), rating: 4.2, status: 'active', createdAt: new Date(Date.now() - 120 * 86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'v3', name: 'National Medical Stores', gstNumber: '29AADCN3897G1Z1', phone: '8765432109', email: 'nm.stores@gmail.com', address: '5, Ring Road, Malviya Nagar', city: 'Bangalore', state: 'Karnataka', pincode: '560076', contactPerson: 'Suresh Kumar', paymentTerms: 'Net 45', creditLimit: 300000, totalPurchases: 2100000, pendingPayment: 87000, lastOrderDate: new Date(Date.now() - 1 * 86400000).toISOString(), rating: 4.8, status: 'active', createdAt: new Date(Date.now() - 200 * 86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'v4', name: 'Sunrise Pharma Distributors', gstNumber: '06AABCS5777B1ZR', phone: '9654321087', email: 'sunrise@pharma.net', address: '88, Sector 18, Gurugram', city: 'Gurugram', state: 'Haryana', pincode: '122015', contactPerson: 'Vikram Singh', paymentTerms: 'Net 30', creditLimit: 150000, totalPurchases: 670000, pendingPayment: 0, lastOrderDate: new Date(Date.now() - 10 * 86400000).toISOString(), rating: 3.9, status: 'active', createdAt: new Date(Date.now() - 90 * 86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'v5', name: 'Apollo Pharmaceuticals', gstNumber: '33AABCA3408M1ZE', phone: '7890123456', email: 'purchase@apollo-dist.com', address: '12, Anna Nagar', city: 'Chennai', state: 'Tamil Nadu', pincode: '600040', contactPerson: 'Priya Rajan', paymentTerms: 'Net 21', creditLimit: 250000, totalPurchases: 1230000, pendingPayment: 31000, lastOrderDate: new Date(Date.now() - 3 * 86400000).toISOString(), rating: 4.6, status: 'active', createdAt: new Date(Date.now() - 150 * 86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'v6', name: 'Wellness Pharma Supply', gstNumber: '21AAHCW4261M1ZH', phone: '8123456789', email: 'supply@wellness.co.in', address: '3, Bhubaneswar Plaza', city: 'Bhubaneswar', state: 'Odisha', pincode: '751001', contactPerson: 'Amit Das', paymentTerms: 'Cash', creditLimit: 50000, totalPurchases: 340000, pendingPayment: 12000, lastOrderDate: new Date(Date.now() - 15 * 86400000).toISOString(), rating: 3.5, status: 'inactive', createdAt: new Date(Date.now() - 60 * 86400000).toISOString(), updatedAt: new Date().toISOString() },
];

const PURCHASE_INVOICES: PurchaseInvoice[] = [
  { id: 'pi1', vendorId: 'v1', vendorName: 'MedLine Distributors', invoiceNumber: 'ML-2026-0541', invoiceDate: new Date(Date.now() - 2 * 86400000).toISOString().substring(0, 10), status: 'confirmed', items: [{ id: 'pii1', medicineName: 'Paracetamol 500mg', batchNumber: 'PCM2026A', expiryDate: '2028-03-31', quantity: 500, receivedQuantity: 500, purchasePrice: 8.5, mrp: 14.5, sellingPrice: 13.0, gstRate: 12, gstAmount: 510, totalAmount: 4750 }, { id: 'pii2', medicineName: 'Amoxicillin 500mg', batchNumber: 'AMX2025B', expiryDate: '2027-06-30', quantity: 200, receivedQuantity: 200, purchasePrice: 38.0, mrp: 65.0, sellingPrice: 60.0, gstRate: 12, gstAmount: 912, totalAmount: 8512 }], subtotal: 12250, discountAmount: 250, taxAmount: 1422, totalAmount: 13422, paidAmount: 13422, pendingAmount: 0, ocrStatus: 'completed', mismatchFlag: false, createdBy: 'u1', createdAt: new Date(Date.now() - 2 * 86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'pi2', vendorId: 'v3', vendorName: 'National Medical Stores', invoiceNumber: 'NMS-2026-0128', invoiceDate: new Date(Date.now() - 1 * 86400000).toISOString().substring(0, 10), status: 'pending_review', items: [{ id: 'pii3', medicineName: 'Atorvastatin 10mg', batchNumber: 'ATV2025C', expiryDate: '2027-12-31', quantity: 300, receivedQuantity: 280, purchasePrice: 55.0, mrp: 95.0, sellingPrice: 88.0, gstRate: 12, gstAmount: 1848, totalAmount: 17248, mismatch: true }], subtotal: 16500, discountAmount: 500, taxAmount: 1848, totalAmount: 17848, paidAmount: 0, pendingAmount: 17848, paymentDueDate: new Date(Date.now() + 44 * 86400000).toISOString().substring(0, 10), ocrStatus: 'completed', mismatchFlag: true, createdBy: 'u1', createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'pi3', vendorId: 'v2', vendorName: 'PharmaCorp India', invoiceNumber: 'PC-2026-0892', invoiceDate: new Date(Date.now() - 5 * 86400000).toISOString().substring(0, 10), status: 'completed', items: [{ id: 'pii4', medicineName: 'Metformin 500mg', batchNumber: 'MTF2026A', expiryDate: '2028-05-31', quantity: 400, receivedQuantity: 400, purchasePrice: 22.0, mrp: 38.0, sellingPrice: 35.0, gstRate: 5, gstAmount: 440, totalAmount: 9240 }], subtotal: 8800, discountAmount: 0, taxAmount: 440, totalAmount: 9240, paidAmount: 9240, pendingAmount: 0, ocrStatus: 'completed', mismatchFlag: false, createdBy: 'u1', createdAt: new Date(Date.now() - 5 * 86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'pi4', vendorId: 'v5', vendorName: 'Apollo Pharmaceuticals', invoiceNumber: 'AP-2026-1204', invoiceDate: new Date().toISOString().substring(0, 10), status: 'draft', items: [], subtotal: 0, discountAmount: 0, taxAmount: 0, totalAmount: 0, paidAmount: 0, pendingAmount: 0, ocrStatus: 'processing', mismatchFlag: false, createdBy: 'u1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

const PAYMENTS: VendorPayment[] = [
  { id: 'vp1', vendorId: 'v1', invoiceId: 'pi1', amount: 13422, paymentDate: new Date(Date.now() - 1 * 86400000).toISOString().substring(0, 10), paymentMode: 'neft', referenceNumber: 'NEFT20260624001', createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'vp2', vendorId: 'v2', invoiceId: 'pi3', amount: 9240, paymentDate: new Date(Date.now() - 4 * 86400000).toISOString().substring(0, 10), paymentMode: 'upi', referenceNumber: 'UPI20260621009', createdAt: new Date(Date.now() - 4 * 86400000).toISOString() },
  { id: 'vp3', vendorId: 'v5', amount: 15000, paymentDate: new Date(Date.now() - 7 * 86400000).toISOString().substring(0, 10), paymentMode: 'cheque', referenceNumber: 'CHQ-004521', notes: 'Partial advance payment', createdAt: new Date(Date.now() - 7 * 86400000).toISOString() },
];

const VENDOR_STATS: VendorStats = {
  totalVendors: 6,
  activeVendors: 5,
  totalPurchasesThisMonth: 485000,
  pendingPayments: 197000,
  overduePayments: 31000,
  topVendorName: 'National Medical Stores',
  invoicesPendingReview: 1,
};

export const vendorHandlers = [
  http.get('/api/vendors/stats', () => HttpResponse.json({ success: true, data: VENDOR_STATS })),

  http.get('/api/vendors', ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.toLowerCase() ?? '';
    const status = url.searchParams.get('status');
    let vendors = [...VENDORS];
    if (search) vendors = vendors.filter(v => v.name.toLowerCase().includes(search) || v.gstNumber?.toLowerCase().includes(search) || v.city.toLowerCase().includes(search));
    if (status) vendors = vendors.filter(v => v.status === status);
    return HttpResponse.json({ success: true, data: { data: vendors, total: vendors.length } });
  }),

  http.get('/api/vendors/:id', ({ params }) => {
    const vendor = VENDORS.find(v => v.id === params.id);
    if (!vendor) return HttpResponse.json({ success: false, message: 'Vendor not found' }, { status: 404 });
    return HttpResponse.json({ success: true, data: vendor });
  }),

  http.post('/api/vendors', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const newVendor = Object.assign({ id: `v${Date.now()}`, totalPurchases: 0, pendingPayment: 0, rating: 4.0, status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, body) as unknown as Vendor;
    VENDORS.push(newVendor);
    return HttpResponse.json({ success: true, data: newVendor }, { status: 201 });
  }),

  http.patch('/api/vendors/:id', async ({ params, request }) => {
    const idx = VENDORS.findIndex(v => v.id === params.id);
    const vendor = VENDORS[idx];
    if (idx === -1 || !vendor) return HttpResponse.json({ success: false, message: 'Vendor not found' }, { status: 404 });
    const body = await request.json() as Partial<Vendor>;
    VENDORS[idx] = { ...vendor, ...body, updatedAt: new Date().toISOString() };
    return HttpResponse.json({ success: true, data: VENDORS[idx] });
  }),

  http.delete('/api/vendors/:id', ({ params }) => {
    const idx = VENDORS.findIndex(v => v.id === params.id);
    const vendor = VENDORS[idx];
    if (idx === -1 || !vendor) return HttpResponse.json({ success: false, message: 'Vendor not found' }, { status: 404 });
    vendor.status = 'inactive';
    return HttpResponse.json({ success: true, message: 'Vendor deactivated' });
  }),

  http.get('/api/vendors/:id/invoices', ({ params }) => {
    const invoices = PURCHASE_INVOICES.filter(i => i.vendorId === params.id);
    return HttpResponse.json({ success: true, data: { data: invoices, total: invoices.length } });
  }),

  http.get('/api/vendors/:id/payments', ({ params }) => {
    const payments = PAYMENTS.filter(p => p.vendorId === params.id);
    return HttpResponse.json({ success: true, data: { data: payments, total: payments.length } });
  }),

  http.get('/api/purchase-invoices', ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const vendorId = url.searchParams.get('vendorId');
    let invoices = [...PURCHASE_INVOICES];
    if (status) invoices = invoices.filter(i => i.status === status);
    if (vendorId) invoices = invoices.filter(i => i.vendorId === vendorId);
    return HttpResponse.json({ success: true, data: { data: invoices, total: invoices.length } });
  }),

  http.get('/api/purchase-invoices/:id', ({ params }) => {
    const inv = PURCHASE_INVOICES.find(i => i.id === params.id);
    if (!inv) return HttpResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    return HttpResponse.json({ success: true, data: inv });
  }),

  http.post('/api/purchase-invoices', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const vendor = VENDORS.find(v => v.id === (body as { vendorId?: string }).vendorId);
    const newInvoice = Object.assign({
      id: `pi${Date.now()}`, vendorName: vendor?.name ?? 'Unknown', status: 'draft', items: [], subtotal: 0, discountAmount: 0,
      taxAmount: 0, totalAmount: 0, paidAmount: 0, pendingAmount: 0, ocrStatus: 'pending', mismatchFlag: false,
      createdBy: 'u1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }, body) as unknown as PurchaseInvoice;
    PURCHASE_INVOICES.push(newInvoice);
    return HttpResponse.json({ success: true, data: newInvoice }, { status: 201 });
  }),

  http.patch('/api/purchase-invoices/:id/confirm', ({ params }) => {
    const idx = PURCHASE_INVOICES.findIndex(i => i.id === params.id);
    const inv = PURCHASE_INVOICES[idx];
    if (idx === -1 || !inv) return HttpResponse.json({ success: false }, { status: 404 });
    inv.status = 'confirmed';
    return HttpResponse.json({ success: true, data: inv });
  }),

  http.post('/api/vendor-payments', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const payment = Object.assign({ id: `vp${Date.now()}`, createdAt: new Date().toISOString() }, body) as unknown as VendorPayment;
    PAYMENTS.push(payment);
    return HttpResponse.json({ success: true, data: payment }, { status: 201 });
  }),
];

import { http, HttpResponse } from 'msw';
import type { ReturnRequest, ReturnStats } from '@pharmaos/types';

const RETURNS: ReturnRequest[] = [
  {
    id: 'ret1', returnNumber: 'RET-2026-0012', type: 'customer_return', status: 'processed',
    billId: 'bill_003', billNumber: 'INV000003',
    customerName: 'Sunita Devi', customerPhone: '9988776655',
    items: [
      { id: 'ri1', medicineName: 'Glimepiride 2mg', batchNumber: 'GLM2024T', expiryDate: '2025-10-01', returnQty: 1, unitPrice: 68, totalAmount: 68, condition: 'resaleable', restocked: true },
    ],
    totalAmount: 68, refundAmount: 68, refundMethod: 'cash',
    reason: 'patient_condition_changed', reasonNotes: 'Doctor changed medication after review',
    processedBy: 'usr_001', processedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    createdBy: 'usr_002', createdAt: new Date(Date.now() - 1 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: 'ret2', returnNumber: 'RET-2026-0011', type: 'customer_return', status: 'pending',
    billId: 'bill_006', billNumber: 'INV000006',
    customerName: 'Priya Sharma', customerPhone: '9811223344',
    items: [
      { id: 'ri2', medicineName: 'Montelukast 10mg', batchNumber: 'MTK2024O', expiryDate: '2026-03-01', returnQty: 1, unitPrice: 138, totalAmount: 138, condition: 'resaleable', restocked: false },
    ],
    totalAmount: 138, refundAmount: 138, refundMethod: 'credit_note',
    reason: 'wrong_medicine', reasonNotes: 'Dispensed 10mg instead of prescribed 5mg',
    createdBy: 'usr_003', createdAt: new Date(Date.now() - 2 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'ret3', returnNumber: 'RET-2026-0010', type: 'vendor_return', status: 'approved',
    vendorId: 'v3', vendorName: 'National Medical Stores',
    purchaseInvoiceId: 'pi2', purchaseInvoiceNumber: 'NMS-2026-0128',
    items: [
      { id: 'ri3', medicineName: 'Atorvastatin 10mg', batchNumber: 'ATV2025C', expiryDate: '2027-12-31', returnQty: 20, unitPrice: 55, totalAmount: 1100, condition: 'resaleable', restocked: false },
    ],
    totalAmount: 1100, refundAmount: 1100,
    reason: 'excess_stock', reasonNotes: 'Short supply received — 280 instead of 300 units. Returning 20 units received in error batch.',
    processedBy: 'usr_001', processedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    createdBy: 'usr_001', createdAt: new Date(Date.now() - 3 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 'ret4', returnNumber: 'RET-2026-0009', type: 'customer_return', status: 'rejected',
    billId: 'bill_002', billNumber: 'INV000002',
    customerName: 'Rajesh Kumar', customerPhone: '9123456789',
    items: [
      { id: 'ri4', medicineName: 'Amoxicillin 250mg', batchNumber: 'AMX2024B', expiryDate: '2026-03-01', returnQty: 3, unitPrice: 48, totalAmount: 144, condition: 'damaged', restocked: false },
    ],
    totalAmount: 144, refundAmount: 0,
    reason: 'damaged', reasonNotes: 'Strip packaging opened and damaged — cannot restock or refund',
    processedBy: 'usr_001', processedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    createdBy: 'usr_002', createdAt: new Date(Date.now() - 5 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 'ret5', returnNumber: 'RET-2026-0008', type: 'vendor_return', status: 'processed',
    vendorId: 'v6', vendorName: 'Wellness Pharma Supply',
    items: [
      { id: 'ri5', medicineName: 'Vitamin D3 1000IU', batchNumber: 'VD32024H', expiryDate: '2025-01-01', returnQty: 15, unitPrice: 200, totalAmount: 3000, condition: 'expired', restocked: false },
    ],
    totalAmount: 3000, refundAmount: 3000,
    reason: 'expired', reasonNotes: 'Batch expired Jan 2025 — returning for credit',
    processedBy: 'usr_001', processedAt: new Date(Date.now() - 8 * 86400000).toISOString(),
    createdBy: 'usr_001', createdAt: new Date(Date.now() - 8 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 8 * 86400000).toISOString(),
  },
];

const STATS: ReturnStats = {
  totalReturns: 5,
  pendingApproval: 1,
  processedToday: 0,
  totalRefundedThisMonth: 4168,
  customerReturns: 3,
  vendorReturns: 2,
};

export const returnsHandlers = [
  http.get('/api/returns/stats', () => HttpResponse.json({ success: true, data: STATS })),

  http.get('/api/returns', ({ request }) => {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search')?.toLowerCase() ?? '';
    let items = [...RETURNS];
    if (type) items = items.filter((r) => r.type === type);
    if (status) items = items.filter((r) => r.status === status);
    if (search) items = items.filter((r) =>
      (r.customerName ?? '').toLowerCase().includes(search) ||
      (r.vendorName ?? '').toLowerCase().includes(search) ||
      r.returnNumber.toLowerCase().includes(search) ||
      (r.billNumber ?? '').toLowerCase().includes(search)
    );
    return HttpResponse.json({ success: true, data: { data: items, total: items.length } });
  }),

  http.get('/api/returns/:id', ({ params }) => {
    const item = RETURNS.find((r) => r.id === params.id);
    if (!item) return HttpResponse.json({ success: false }, { status: 404 });
    return HttpResponse.json({ success: true, data: item });
  }),

  http.post('/api/returns', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const newReturn = Object.assign({
      id: `ret${Date.now()}`,
      returnNumber: `RET-2026-${String(RETURNS.length + 13).padStart(4, '0')}`,
      status: 'pending',
      totalAmount: 0,
      refundAmount: 0,
      createdBy: 'usr_001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, body) as unknown as ReturnRequest;
    RETURNS.unshift(newReturn);
    STATS.totalReturns++;
    STATS.pendingApproval++;
    return HttpResponse.json({ success: true, data: newReturn }, { status: 201 });
  }),

  http.patch('/api/returns/:id/approve', ({ params }) => {
    const idx = RETURNS.findIndex((r) => r.id === params.id);
    const item = RETURNS[idx];
    if (idx === -1 || !item) return HttpResponse.json({ success: false }, { status: 404 });
    item.status = 'approved';
    item.updatedAt = new Date().toISOString();
    STATS.pendingApproval = Math.max(0, STATS.pendingApproval - 1);
    return HttpResponse.json({ success: true, data: item });
  }),

  http.patch('/api/returns/:id/process', ({ params }) => {
    const idx = RETURNS.findIndex((r) => r.id === params.id);
    const item = RETURNS[idx];
    if (idx === -1 || !item) return HttpResponse.json({ success: false }, { status: 404 });
    item.status = 'processed';
    item.processedBy = 'usr_001';
    item.processedAt = new Date().toISOString();
    item.items = item.items.map((i) => ({ ...i, restocked: i.condition === 'resaleable' }));
    item.updatedAt = new Date().toISOString();
    STATS.processedToday++;
    STATS.totalRefundedThisMonth += item.refundAmount;
    return HttpResponse.json({ success: true, data: item });
  }),

  http.patch('/api/returns/:id/reject', async ({ params, request }) => {
    const idx = RETURNS.findIndex((r) => r.id === params.id);
    const item = RETURNS[idx];
    if (idx === -1 || !item) return HttpResponse.json({ success: false }, { status: 404 });
    const body = await request.json() as { notes?: string };
    item.status = 'rejected';
    item.reasonNotes = body.notes ?? item.reasonNotes;
    item.refundAmount = 0;
    item.processedBy = 'usr_001';
    item.processedAt = new Date().toISOString();
    item.updatedAt = new Date().toISOString();
    STATS.pendingApproval = Math.max(0, STATS.pendingApproval - 1);
    return HttpResponse.json({ success: true, data: item });
  }),
];

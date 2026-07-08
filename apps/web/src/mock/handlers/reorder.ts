import { http, HttpResponse } from 'msw';
import type { ReorderItem, ReorderAlert, ReorderStats } from '@pharmaos/types';

const REORDER_ITEMS: ReorderItem[] = [
  { id: 'r1', medicineId: 'm1', medicineName: 'Paracetamol 500mg', genericName: 'Paracetamol', currentStock: 12, reorderLevel: 50, suggestedQty: 500, priority: 'critical', status: 'pending', lastSaleQty30Days: 380, daysStockLeft: 1, preferredVendor: 'MedLine Distributors', lastPurchasePrice: 8.5, vendorSuggestions: [{ vendorId: 'v1', vendorName: 'MedLine Distributors', lastPrice: 8.5, lastOrderDate: '2026-05-20', leadTimeDays: 1, reliability: 'excellent' }, { vendorId: 'v3', vendorName: 'National Medical Stores', lastPrice: 8.8, lastOrderDate: '2026-04-10', leadTimeDays: 2, reliability: 'good' }], addedAt: new Date(Date.now() - 2 * 86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'r2', medicineId: 'm2', medicineName: 'Metformin 500mg', genericName: 'Metformin HCl', currentStock: 35, reorderLevel: 100, suggestedQty: 400, priority: 'critical', status: 'pending', lastSaleQty30Days: 280, daysStockLeft: 3, preferredVendor: 'PharmaCorp India', lastPurchasePrice: 22.0, vendorSuggestions: [{ vendorId: 'v2', vendorName: 'PharmaCorp India', lastPrice: 22.0, lastOrderDate: '2026-06-01', leadTimeDays: 2, reliability: 'good' }], addedAt: new Date(Date.now() - 1 * 86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'r3', medicineId: 'm3', medicineName: 'Atorvastatin 10mg', genericName: 'Atorvastatin', currentStock: 48, reorderLevel: 75, suggestedQty: 300, priority: 'high', status: 'pending', lastSaleQty30Days: 195, daysStockLeft: 7, preferredVendor: 'National Medical Stores', lastPurchasePrice: 55.0, vendorSuggestions: [{ vendorId: 'v3', vendorName: 'National Medical Stores', lastPrice: 55.0, lastOrderDate: '2026-06-05', leadTimeDays: 1, reliability: 'excellent' }, { vendorId: 'v5', vendorName: 'Apollo Pharmaceuticals', lastPrice: 56.5, lastOrderDate: '2026-05-15', leadTimeDays: 3, reliability: 'good' }], addedAt: new Date(Date.now() - 3 * 86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'r4', medicineId: 'm4', medicineName: 'Amlodipine 5mg', genericName: 'Amlodipine Besylate', currentStock: 62, reorderLevel: 80, suggestedQty: 200, priority: 'high', status: 'pending', lastSaleQty30Days: 140, daysStockLeft: 13, vendorSuggestions: [{ vendorId: 'v1', vendorName: 'MedLine Distributors', lastPrice: 14.0, lastOrderDate: '2026-05-28', leadTimeDays: 1, reliability: 'excellent' }], addedAt: new Date(Date.now() - 4 * 86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'r5', medicineId: 'm5', medicineName: 'Azithromycin 500mg', genericName: 'Azithromycin', currentStock: 95, reorderLevel: 100, suggestedQty: 200, priority: 'medium', status: 'ordered', lastSaleQty30Days: 120, daysStockLeft: 23, preferredVendor: 'Apollo Pharmaceuticals', lastPurchasePrice: 95.0, vendorSuggestions: [{ vendorId: 'v5', vendorName: 'Apollo Pharmaceuticals', lastPrice: 95.0, lastOrderDate: '2026-06-10', leadTimeDays: 2, reliability: 'excellent' }], notes: 'Ordered from Apollo — expected in 2 days', addedAt: new Date(Date.now() - 5 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 1 * 86400000).toISOString() },
  { id: 'r6', medicineId: 'm6', medicineName: 'ORS Sachet', genericName: 'Oral Rehydration Salts', currentStock: 88, reorderLevel: 120, suggestedQty: 300, priority: 'medium', status: 'pending', lastSaleQty30Days: 210, daysStockLeft: 12, vendorSuggestions: [{ vendorId: 'v1', vendorName: 'MedLine Distributors', lastPrice: 7.5, lastOrderDate: '2026-06-08', leadTimeDays: 1, reliability: 'excellent' }], addedAt: new Date(Date.now() - 2 * 86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'r7', medicineId: 'm7', medicineName: 'Cetirizine 10mg', genericName: 'Cetirizine HCl', currentStock: 145, reorderLevel: 150, suggestedQty: 200, priority: 'low', status: 'pending', lastSaleQty30Days: 98, daysStockLeft: 44, vendorSuggestions: [{ vendorId: 'v2', vendorName: 'PharmaCorp India', lastPrice: 18.0, lastOrderDate: '2026-05-20', leadTimeDays: 2, reliability: 'good' }], addedAt: new Date(Date.now() - 1 * 86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'r8', medicineId: 'm8', medicineName: 'Vitamin B12 500mcg', genericName: 'Cyanocobalamin', currentStock: 0, reorderLevel: 30, suggestedQty: 100, priority: 'critical', status: 'pending', lastSaleQty30Days: 65, daysStockLeft: 0, vendorSuggestions: [{ vendorId: 'v3', vendorName: 'National Medical Stores', lastPrice: 32.0, lastOrderDate: '2026-05-25', leadTimeDays: 1, reliability: 'excellent' }], addedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

const REORDER_ALERTS: ReorderAlert[] = [
  { id: 'ra1', medicineId: 'm8', medicineName: 'Vitamin B12 500mcg', alertType: 'out_of_stock', currentQty: 0, threshold: 30, severity: 'critical', isAcknowledged: false, createdAt: new Date().toISOString() },
  { id: 'ra2', medicineId: 'm1', medicineName: 'Paracetamol 500mg', alertType: 'critical_stock', currentQty: 12, threshold: 50, severity: 'critical', isAcknowledged: false, createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
  { id: 'ra3', medicineId: 'm2', medicineName: 'Metformin 500mg', alertType: 'low_stock', currentQty: 35, threshold: 100, severity: 'warning', isAcknowledged: false, createdAt: new Date(Date.now() - 1 * 86400000).toISOString() },
  { id: 'ra4', medicineId: 'm3', medicineName: 'Atorvastatin 10mg', alertType: 'low_stock', currentQty: 48, threshold: 75, severity: 'warning', isAcknowledged: true, createdAt: new Date(Date.now() - 3 * 86400000).toISOString() },
  { id: 'ra5', medicineId: 'm9', medicineName: 'Cefixime 200mg', alertType: 'expiry_risk', currentQty: 120, threshold: 30, severity: 'warning', isAcknowledged: false, createdAt: new Date(Date.now() - 1 * 86400000).toISOString() },
];

const REORDER_STATS: ReorderStats = {
  totalPending: 7,
  criticalItems: 3,
  highPriorityItems: 2,
  orderedToday: 1,
  outOfStock: 1,
  totalAlerts: 5,
  avgLeadTimeDays: 1.8,
};

export const reorderHandlers = [
  http.get('/api/reorder/stats', () => HttpResponse.json({ success: true, data: REORDER_STATS })),

  http.get('/api/reorder', ({ request }) => {
    const url = new URL(request.url);
    const priority = url.searchParams.get('priority');
    const status = url.searchParams.get('status');
    let items = [...REORDER_ITEMS];
    if (priority) items = items.filter(i => i.priority === priority);
    if (status) items = items.filter(i => i.status === status);
    items.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.priority] - order[b.priority];
    });
    return HttpResponse.json({ success: true, data: { data: items, total: items.length } });
  }),

  http.get('/api/reorder/alerts', ({ request }) => {
    const url = new URL(request.url);
    const acknowledged = url.searchParams.get('acknowledged');
    let alerts = [...REORDER_ALERTS];
    if (acknowledged === 'false') alerts = alerts.filter(a => !a.isAcknowledged);
    return HttpResponse.json({ success: true, data: { data: alerts, total: alerts.length } });
  }),

  http.patch('/api/reorder/:id', async ({ params, request }) => {
    const idx = REORDER_ITEMS.findIndex(r => r.id === params.id);
    const item = REORDER_ITEMS[idx];
    if (idx === -1 || !item) return HttpResponse.json({ success: false }, { status: 404 });
    const body = await request.json() as Partial<ReorderItem>;
    REORDER_ITEMS[idx] = { ...item, ...body, updatedAt: new Date().toISOString() };
    return HttpResponse.json({ success: true, data: REORDER_ITEMS[idx] });
  }),

  http.patch('/api/reorder/alerts/:id/acknowledge', ({ params }) => {
    const idx = REORDER_ALERTS.findIndex(a => a.id === params.id);
    const alert = REORDER_ALERTS[idx];
    if (idx !== -1 && alert) alert.isAcknowledged = true;
    return HttpResponse.json({ success: true });
  }),
];

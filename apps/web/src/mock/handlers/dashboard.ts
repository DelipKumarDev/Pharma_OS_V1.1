import { http, HttpResponse, delay } from 'msw';

const MOCK_DASHBOARD = {
  kpis: {
    todayRevenue: 18450,
    todayBills: 47,
    lowStockItems: 23,
    expiringItems: 12,
    totalMedicines: 1842,
    activeCustomers: 312,
    todayRevenueChange: 12.5,
    todayBillsChange: 8.3,
    pendingPrescriptions: 2,
    pendingReturns: 1,
  },
  revenueChart: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0],
    revenue: Math.floor(12000 + Math.random() * 10000),
    bills: Math.floor(30 + Math.random() * 30),
  })),
  topMedicines: [
    { name: 'Paracetamol 500mg', qty: 482, revenue: 9640 },
    { name: 'Amoxicillin 250mg', qty: 312, revenue: 15600 },
    { name: 'Pantoprazole 40mg', qty: 287, revenue: 11480 },
    { name: 'Metformin 500mg', qty: 264, revenue: 5280 },
    { name: 'Cetirizine 10mg', qty: 241, revenue: 4820 },
  ],
  salesByCategory: [
    { category: 'Antibiotic', value: 28 },
    { category: 'Analgesic', value: 22 },
    { category: 'Gastro', value: 16 },
    { category: 'Diabetes', value: 14 },
    { category: 'Cardio', value: 11 },
    { category: 'Others', value: 9 },
  ],
  alerts: [
    { id: '1', type: 'expiry', message: '12 batches expiring within 30 days', severity: 'warning' },
    { id: '2', type: 'stock', message: 'Paracetamol 500mg below reorder level', severity: 'error' },
    { id: '3', type: 'stock', message: 'Amoxicillin 250mg — only 4 strips left', severity: 'critical' },
    { id: '4', type: 'license', message: 'Drug license expires in 45 days', severity: 'warning' },
  ],
};

export const dashboardHandlers = [
  http.get('/api/dashboard', async () => {
    await delay(500);
    return HttpResponse.json({ success: true, data: MOCK_DASHBOARD });
  }),
];

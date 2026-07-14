import { http, HttpResponse, delay } from 'msw';

// ─── Helpers ────────────────────────────────────────────────────────────────

function rnd(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function seeded(seed: number, min: number, max: number) {
  const x = Math.sin(seed + 1) * 10000;
  return Math.floor((x - Math.floor(x)) * (max - min + 1)) + min;
}

function buildDailySales(days: number) {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(Date.now() - (days - 1 - i) * 86400000);
    const base = 14000 + seeded(i, -3000, 4000);
    const revenue = Math.max(base, 5000);
    const bills = Math.floor(revenue / seeded(i + 50, 280, 380));
    const gst = Math.round(revenue * 0.094);
    const cash = Math.round(revenue * (0.44 + seeded(i + 10, 0, 12) / 100));
    const upi = Math.round(revenue * (0.30 + seeded(i + 20, 0, 8) / 100));
    const card = Math.round(revenue * (0.14 + seeded(i + 30, 0, 6) / 100));
    const credit = Math.max(0, revenue - cash - upi - card);
    return {
      date: date.toISOString().substring(0, 10),
      revenue,
      bills,
      gst,
      avgBillValue: Math.round(revenue / bills),
      cash,
      upi,
      card,
      credit,
    };
  });
}

const DAILY_90 = buildDailySales(90);

const TOP_MEDICINES = [
  { name: 'Paracetamol 500mg', generic: 'Paracetamol', category: 'Analgesic', qtySold: 1842, revenue: 36840, margin: 18.2, scheduleH: false },
  { name: 'Amoxicillin 250mg', generic: 'Amoxicillin', category: 'Antibiotic', qtySold: 964, revenue: 48200, margin: 22.4, scheduleH: true },
  { name: 'Pantoprazole 40mg', generic: 'Pantoprazole', category: 'Gastro', qtySold: 887, revenue: 35480, margin: 26.1, scheduleH: false },
  { name: 'Metformin 500mg', generic: 'Metformin', category: 'Diabetes', qtySold: 742, revenue: 14840, margin: 19.8, scheduleH: false },
  { name: 'Cetirizine 10mg', generic: 'Cetirizine', category: 'Antiallergic', qtySold: 698, revenue: 13960, margin: 24.3, scheduleH: false },
  { name: 'Atorvastatin 10mg', generic: 'Atorvastatin', category: 'Cardio', qtySold: 612, revenue: 30600, margin: 21.7, scheduleH: false },
  { name: 'Azithromycin 500mg', generic: 'Azithromycin', category: 'Antibiotic', qtySold: 534, revenue: 26700, margin: 28.4, scheduleH: true },
  { name: 'Metronidazole 400mg', generic: 'Metronidazole', category: 'Antibiotic', qtySold: 488, revenue: 9760, margin: 16.5, scheduleH: false },
  { name: 'Omeprazole 20mg', generic: 'Omeprazole', category: 'Gastro', qtySold: 456, revenue: 13680, margin: 23.8, scheduleH: false },
  { name: 'Amlodipine 5mg', generic: 'Amlodipine', category: 'Cardio', qtySold: 412, revenue: 12360, margin: 20.1, scheduleH: false },
];

const CATEGORIES = [
  { category: 'Antibiotic', revenue: 124660, bills: 287, margin: 22.4, gst: 11688, pct: 28 },
  { category: 'Analgesic', revenue: 88240, bills: 412, margin: 18.2, gst: 4412, pct: 20 },
  { category: 'Gastro', revenue: 71340, bills: 198, margin: 25.1, gst: 3567, pct: 16 },
  { category: 'Diabetes', revenue: 62180, bills: 156, margin: 19.6, gst: 0, pct: 14 },
  { category: 'Cardio', revenue: 54820, bills: 134, margin: 21.3, gst: 2741, pct: 12 },
  { category: 'Antiallergic', revenue: 22440, bills: 98, margin: 24.1, gst: 1122, pct: 5 },
  { category: 'Others', revenue: 22040, bills: 76, margin: 17.8, gst: 1102, pct: 5 },
];

const GST_SLABS = [
  { rate: 0, description: 'Exempt (life-saving, unbranded generics)', taxable: 248600, gst: 0, cgst: 0, sgst: 0, igst: 0, pct: 56 },
  { rate: 5, description: 'OTC drugs, vitamins, health supplements', taxable: 118400, gst: 5920, cgst: 2960, sgst: 2960, igst: 0, pct: 27 },
  { rate: 12, description: 'Branded generics, medical devices', taxable: 58200, gst: 6984, cgst: 3492, sgst: 3492, igst: 0, pct: 13 },
  { rate: 18, description: 'Cosmetics, FMCG medicines, dental', taxable: 17420, gst: 3136, cgst: 1568, sgst: 1568, igst: 0, pct: 4 },
];

const SCHEDULE_H_LOG = [
  { date: '2026-06-25', medicine: 'Amoxicillin 250mg', qty: 30, prescriptionNo: 'RX-2406-0142', doctorName: 'Dr. S. Mehta', doctorReg: 'MH-54321', patientName: 'Ravi Kumar', address: 'Andheri West, Mumbai' },
  { date: '2026-06-25', medicine: 'Azithromycin 500mg', qty: 6, prescriptionNo: 'RX-2406-0139', doctorName: 'Dr. P. Iyer', doctorReg: 'MH-67890', patientName: 'Priya Sharma', address: 'Dadar, Mumbai' },
  { date: '2026-06-24', medicine: 'Amoxicillin 250mg', qty: 21, prescriptionNo: 'RX-2406-0131', doctorName: 'Dr. A. Khan', doctorReg: 'MH-11234', patientName: 'Mohammed Ali', address: 'Kurla, Mumbai' },
  { date: '2026-06-23', medicine: 'Ciprofloxacin 500mg', qty: 14, prescriptionNo: 'RX-2406-0122', doctorName: 'Dr. S. Mehta', doctorReg: 'MH-54321', patientName: 'Sunita Desai', address: 'Bandra, Mumbai' },
  { date: '2026-06-22', medicine: 'Azithromycin 500mg', qty: 3, prescriptionNo: 'RX-2406-0118', doctorName: 'Dr. R. Nair', doctorReg: 'MH-98765', patientName: 'Arun Pillai', address: 'Chembur, Mumbai' },
];

const DEAD_STOCK = [
  { name: 'Ranitidine 150mg', category: 'Gastro', qty: 240, value: 3600, lastSoldDays: 142, batchExpiry: '2027-03-01' },
  { name: 'Nimesulide 100mg', category: 'Analgesic', qty: 180, value: 2700, lastSoldDays: 98, batchExpiry: '2026-09-15' },
  { name: 'Norfloxacin 400mg', category: 'Antibiotic', qty: 96, value: 2880, lastSoldDays: 112, batchExpiry: '2026-12-01' },
  { name: 'Famotidine 20mg', category: 'Gastro', qty: 144, value: 1584, lastSoldDays: 87, batchExpiry: '2027-01-15' },
  { name: 'Aceclofenac 100mg', category: 'Analgesic', qty: 60, value: 1200, lastSoldDays: 95, batchExpiry: '2027-02-28' },
];

const TOP_CUSTOMERS = [
  { name: 'Rajesh Gupta', phone: '9820012345', visits: 18, totalSpend: 28640, loyaltyPts: 286, lastVisit: '2026-06-24' },
  { name: 'Anita Sharma', phone: '9867543210', visits: 14, totalSpend: 21480, loyaltyPts: 214, lastVisit: '2026-06-22' },
  { name: 'Mohammed Rafi', phone: '9821098765', visits: 12, totalSpend: 18920, loyaltyPts: 189, lastVisit: '2026-06-25' },
  { name: 'Sunita Pillai', phone: '9834567890', visits: 11, totalSpend: 16240, loyaltyPts: 162, lastVisit: '2026-06-20' },
  { name: 'Arun Kumar', phone: '9845678901', visits: 10, totalSpend: 14780, loyaltyPts: 148, lastVisit: '2026-06-23' },
];

const HOURLY_PATTERN = [
  { hour: '8am', bills: 4 }, { hour: '9am', bills: 12 }, { hour: '10am', bills: 18 },
  { hour: '11am', bills: 22 }, { hour: '12pm', bills: 16 }, { hour: '1pm', bills: 8 },
  { hour: '2pm', bills: 10 }, { hour: '3pm', bills: 19 }, { hour: '4pm', bills: 24 },
  { hour: '5pm', bills: 28 }, { hour: '6pm', bills: 26 }, { hour: '7pm', bills: 20 },
  { hour: '8pm', bills: 14 }, { hour: '9pm', bills: 6 },
];

function buildSummary(days: number) {
  const slice = DAILY_90.slice(-days);
  const totalRevenue = slice.reduce((s, d) => s + d.revenue, 0);
  const totalBills = slice.reduce((s, d) => s + d.bills, 0);
  const totalGST = slice.reduce((s, d) => s + d.gst, 0);
  const totalCash = slice.reduce((s, d) => s + d.cash, 0);
  const totalUPI = slice.reduce((s, d) => s + d.upi, 0);
  const totalCard = slice.reduce((s, d) => s + d.card, 0);
  const totalCredit = slice.reduce((s, d) => s + d.credit, 0);
  const bestDay = slice.reduce((best, d) => d.revenue > best.revenue ? d : best, slice[0]!);
  return {
    totalRevenue,
    totalBills,
    avgBillValue: Math.round(totalRevenue / totalBills),
    totalGST,
    grossProfit: Math.round(totalRevenue * 0.218),
    grossMarginPct: 21.8,
    paymentMethods: { cash: totalCash, upi: totalUPI, card: totalCard, credit: totalCredit },
    bestDay: { date: bestDay?.date ?? '', revenue: bestDay?.revenue ?? 0 },
    newCustomers: Math.round(days * 0.6),
    returningCustomers: Math.round(days * 1.8),
    deadStockValue: 11964,
    totalStockValue: 842000,
  };
}

// ─── Handler ────────────────────────────────────────────────────────────────

export const reportsHandlers = [
  http.get('/api/reports', async ({ request }) => {
    await delay(600);
    const url = new URL(request.url);
    const days = Number(url.searchParams.get('days') ?? '30');
    const clampedDays = Math.min(Math.max(days, 7), 90);
    const slice = DAILY_90.slice(-clampedDays);

    return HttpResponse.json({
      success: true,
      data: {
        summary: buildSummary(clampedDays),
        dailySales: slice,
        topMedicines: TOP_MEDICINES,
        categories: CATEGORIES,
        gstSlabs: GST_SLABS,
        gstTotals: {
          totalTaxable: GST_SLABS.reduce((s, r) => s + r.taxable, 0),
          totalGST: GST_SLABS.reduce((s, r) => s + r.gst, 0),
          cgst: GST_SLABS.reduce((s, r) => s + r.cgst, 0),
          sgst: GST_SLABS.reduce((s, r) => s + r.sgst, 0),
          igst: 0,
          effectiveRate: 9.4,
        },
        scheduleHLog: SCHEDULE_H_LOG,
        deadStock: DEAD_STOCK,
        topCustomers: TOP_CUSTOMERS,
        hourlyPattern: HOURLY_PATTERN,
      },
    });
  }),
];

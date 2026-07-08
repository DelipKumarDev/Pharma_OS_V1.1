import { http, HttpResponse } from 'msw';
import type { Prescription, PrescriptionStats } from '@pharmaos/types';

const PRESCRIPTIONS: Prescription[] = [
  {
    id: 'rx1', prescriptionNumber: 'RX-2026-0041', customerName: 'Ramesh Gupta', customerPhone: '9876543210',
    customerId: 'c1', doctorName: 'Dr. Anjali Singh', doctorRegNumber: 'MCI-12345',
    hospitalName: 'City Hospital', prescriptionDate: new Date(Date.now() - 1 * 86400000).toISOString().substring(0, 10),
    validUntil: new Date(Date.now() + 29 * 86400000).toISOString().substring(0, 10),
    status: 'pending_review', imageType: 'image',
    medicines: [
      { id: 'rxm1', medicineName: 'Metformin 500mg', genericName: 'Metformin HCl', dosage: '500mg', frequency: 'Twice daily', duration: '30 days', quantity: 60, instructions: 'After meals', dispensed: false },
      { id: 'rxm2', medicineName: 'Amlodipine 5mg', genericName: 'Amlodipine Besylate', dosage: '5mg', frequency: 'Once daily', duration: '30 days', quantity: 30, instructions: 'Morning', dispensed: false },
    ],
    createdBy: 'usr_001', createdAt: new Date(Date.now() - 1 * 86400000).toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'rx2', prescriptionNumber: 'RX-2026-0040', customerName: 'Sunita Devi', customerPhone: '7654321098',
    customerId: 'c4', doctorName: 'Dr. Mukesh Pandey', doctorRegNumber: 'MCI-67890',
    hospitalName: 'Apollo Clinic', prescriptionDate: new Date(Date.now() - 2 * 86400000).toISOString().substring(0, 10),
    validUntil: new Date(Date.now() + 28 * 86400000).toISOString().substring(0, 10),
    status: 'pending_review', imageType: 'image',
    medicines: [
      { id: 'rxm3', medicineName: 'Etoricoxib 90mg', dosage: '90mg', frequency: 'Once daily', duration: '10 days', quantity: 10, instructions: 'With food', dispensed: false },
      { id: 'rxm4', medicineName: 'Calcium + Vitamin D3', dosage: '500mg+250IU', frequency: 'Once daily', duration: '60 days', quantity: 60, dispensed: false },
    ],
    createdBy: 'usr_002', createdAt: new Date(Date.now() - 2 * 86400000).toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'rx3', prescriptionNumber: 'RX-2026-0039', customerName: 'Priya Sharma', customerPhone: '9123456789',
    customerId: 'c2', doctorName: 'Dr. Rohit Verma', doctorRegNumber: 'MCI-24680',
    hospitalName: 'Fortis Hospital', prescriptionDate: new Date(Date.now() - 3 * 86400000).toISOString().substring(0, 10),
    validUntil: new Date(Date.now() + 27 * 86400000).toISOString().substring(0, 10),
    status: 'approved', imageType: 'image',
    medicines: [
      { id: 'rxm5', medicineName: 'Montelukast 10mg', genericName: 'Montelukast Sodium', dosage: '10mg', frequency: 'Once daily at bedtime', duration: '30 days', quantity: 30, dispensed: false },
      { id: 'rxm6', medicineName: 'Salbutamol Inhaler', dosage: '100mcg/dose', frequency: '2 puffs as needed', duration: 'PRN', dispensed: false },
    ],
    reviewedBy: 'usr_001', reviewedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    createdBy: 'usr_002', createdAt: new Date(Date.now() - 3 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'rx4', prescriptionNumber: 'RX-2026-0038', customerName: 'Kavita Reddy', customerPhone: '9876001122',
    doctorName: 'Dr. Prakash Kumar', hospitalName: 'NIMHANS',
    prescriptionDate: new Date(Date.now() - 5 * 86400000).toISOString().substring(0, 10),
    validUntil: new Date(Date.now() + 25 * 86400000).toISOString().substring(0, 10),
    status: 'dispensed', imageType: 'pdf',
    medicines: [
      { id: 'rxm7', medicineName: 'Insulin Glargine 300IU', genericName: 'Insulin Glargine', dosage: '10 units', frequency: 'Once daily at bedtime', duration: '30 days', quantity: 1, instructions: 'Refrigerate', dispensed: true },
      { id: 'rxm8', medicineName: 'Folic Acid 5mg', dosage: '5mg', frequency: 'Once daily', duration: '90 days', quantity: 90, dispensed: true },
    ],
    billId: 'bill_008', billNumber: 'INV000008',
    reviewedBy: 'usr_001', reviewedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    createdBy: 'usr_003', createdAt: new Date(Date.now() - 5 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: 'rx5', prescriptionNumber: 'RX-2026-0037', customerName: 'Mohan Lal', customerPhone: '8765432109',
    customerId: 'c3', doctorName: 'Dr. Suresh Iyer',
    prescriptionDate: new Date(Date.now() - 7 * 86400000).toISOString().substring(0, 10),
    validUntil: new Date(Date.now() + 23 * 86400000).toISOString().substring(0, 10),
    status: 'rejected', imageType: 'image',
    medicines: [
      { id: 'rxm9', medicineName: 'Codeine Cough Syrup 100ml', dosage: '10ml', frequency: 'Thrice daily', duration: '7 days', quantity: 1, dispensed: false },
    ],
    reviewedBy: 'usr_001', reviewedAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    rejectionReason: 'Prescription appears tampered — doctor signature does not match records',
    createdBy: 'usr_002', createdAt: new Date(Date.now() - 7 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
  {
    id: 'rx6', prescriptionNumber: 'RX-2026-0036', customerName: 'Amit Singh', customerPhone: '9900112233',
    doctorName: 'Dr. Meera Krishnan', hospitalName: 'General Hospital',
    prescriptionDate: new Date(Date.now() - 10 * 86400000).toISOString().substring(0, 10),
    validUntil: new Date(Date.now() + 20 * 86400000).toISOString().substring(0, 10),
    status: 'dispensed', imageType: 'image',
    medicines: [
      { id: 'rxm10', medicineName: 'Azithromycin 500mg', dosage: '500mg', frequency: 'Once daily', duration: '5 days', quantity: 5, dispensed: true },
    ],
    billId: 'bill_007', billNumber: 'INV000007',
    reviewedBy: 'usr_002', reviewedAt: new Date(Date.now() - 9 * 86400000).toISOString(),
    createdBy: 'usr_001', createdAt: new Date(Date.now() - 10 * 86400000).toISOString(), updatedAt: new Date(Date.now() - 9 * 86400000).toISOString(),
  },
];

const STATS: PrescriptionStats = {
  total: 6,
  pendingReview: 2,
  approved: 1,
  dispensedToday: 0,
  rejected: 1,
  expiringSoon: 0,
};

export const prescriptionHandlers = [
  http.get('/api/prescriptions/stats', () => HttpResponse.json({ success: true, data: STATS })),

  http.get('/api/prescriptions', ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search')?.toLowerCase() ?? '';
    let rxs = [...PRESCRIPTIONS];
    if (status) rxs = rxs.filter((r) => r.status === status);
    if (search) rxs = rxs.filter((r) =>
      r.customerName.toLowerCase().includes(search) ||
      r.doctorName.toLowerCase().includes(search) ||
      r.prescriptionNumber.toLowerCase().includes(search)
    );
    return HttpResponse.json({ success: true, data: { data: rxs, total: rxs.length } });
  }),

  http.get('/api/prescriptions/:id', ({ params }) => {
    const rx = PRESCRIPTIONS.find((r) => r.id === params.id);
    if (!rx) return HttpResponse.json({ success: false }, { status: 404 });
    return HttpResponse.json({ success: true, data: rx });
  }),

  http.post('/api/prescriptions', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const newRx = Object.assign({
      id: `rx${Date.now()}`,
      prescriptionNumber: `RX-2026-${String(PRESCRIPTIONS.length + 42).padStart(4, '0')}`,
      status: 'pending_review',
      medicines: [],
      createdBy: 'usr_001',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, body) as unknown as Prescription;
    PRESCRIPTIONS.unshift(newRx);
    STATS.total++;
    STATS.pendingReview++;
    return HttpResponse.json({ success: true, data: newRx }, { status: 201 });
  }),

  http.patch('/api/prescriptions/:id/approve', ({ params }) => {
    const rx = PRESCRIPTIONS.find((r) => r.id === params.id);
    if (!rx) return HttpResponse.json({ success: false }, { status: 404 });
    rx.status = 'approved';
    rx.reviewedBy = 'usr_001';
    rx.reviewedAt = new Date().toISOString();
    rx.updatedAt = new Date().toISOString();
    STATS.pendingReview = Math.max(0, STATS.pendingReview - 1);
    STATS.approved++;
    return HttpResponse.json({ success: true, data: rx });
  }),

  http.patch('/api/prescriptions/:id/reject', async ({ params, request }) => {
    const rx = PRESCRIPTIONS.find((r) => r.id === params.id);
    if (!rx) return HttpResponse.json({ success: false }, { status: 404 });
    const body = await request.json() as { reason?: string };
    rx.status = 'rejected';
    rx.reviewedBy = 'usr_001';
    rx.reviewedAt = new Date().toISOString();
    rx.rejectionReason = body.reason ?? 'Invalid prescription';
    rx.updatedAt = new Date().toISOString();
    STATS.pendingReview = Math.max(0, STATS.pendingReview - 1);
    STATS.rejected++;
    return HttpResponse.json({ success: true, data: rx });
  }),

  http.patch('/api/prescriptions/:id/dispense', ({ params }) => {
    const rx = PRESCRIPTIONS.find((r) => r.id === params.id);
    if (!rx) return HttpResponse.json({ success: false }, { status: 404 });
    rx.status = 'dispensed';
    rx.medicines = rx.medicines.map((m) => ({ ...m, dispensed: true }));
    rx.updatedAt = new Date().toISOString();
    STATS.approved = Math.max(0, STATS.approved - 1);
    STATS.dispensedToday++;
    return HttpResponse.json({ success: true, data: rx });
  }),
];

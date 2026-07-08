import { http, HttpResponse } from 'msw';
import type { Customer, CustomerStats, CustomerPurchase } from '@pharmaos/types';

const CUSTOMERS: Customer[] = [
  { id: 'c1', name: 'Ramesh Gupta', phone: '9876543210', email: 'ramesh.g@gmail.com', address: '12 Gandhi Nagar, Sector 5', dateOfBirth: '1975-06-15', gender: 'male', doctorName: 'Dr. Anjali Singh', medicalConditions: ['Diabetes', 'Hypertension'], loyaltyPoints: 1250, totalPurchases: 85, totalSpend: 42500, creditBalance: 0, lastVisitDate: new Date(Date.now() - 3 * 86400000).toISOString(), totalVisits: 85, customerType: 'vip', status: 'active', createdAt: new Date(Date.now() - 365 * 86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'c2', name: 'Priya Sharma', phone: '9123456789', email: 'priya.sharma@yahoo.com', address: '45 MG Road, Koramangala', dateOfBirth: '1988-03-22', gender: 'female', doctorName: 'Dr. Rohit Verma', medicalConditions: ['Asthma'], loyaltyPoints: 680, totalPurchases: 34, totalSpend: 18900, creditBalance: 0, lastVisitDate: new Date(Date.now() - 7 * 86400000).toISOString(), totalVisits: 34, customerType: 'regular', status: 'active', createdAt: new Date(Date.now() - 180 * 86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'c3', name: 'Mohan Lal', phone: '8765432109', email: undefined, address: '8 Civil Lines', dateOfBirth: '1960-11-08', gender: 'male', loyaltyPoints: 220, totalPurchases: 12, totalSpend: 8800, creditBalance: 1200, lastVisitDate: new Date(Date.now() - 14 * 86400000).toISOString(), totalVisits: 12, customerType: 'credit', status: 'active', notes: 'Monthly credit account — pays by 5th', createdAt: new Date(Date.now() - 90 * 86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'c4', name: 'Sunita Devi', phone: '7654321098', email: 'sunita@outlook.com', address: '23 Patel Nagar', dateOfBirth: '1945-08-30', gender: 'female', doctorName: 'Dr. Mukesh Pandey', medicalConditions: ['Arthritis', 'Thyroid'], loyaltyPoints: 3400, totalPurchases: 156, totalSpend: 89000, creditBalance: 0, lastVisitDate: new Date(Date.now() - 1 * 86400000).toISOString(), totalVisits: 156, customerType: 'vip', status: 'active', createdAt: new Date(Date.now() - 730 * 86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'c5', name: 'Ankit Mehta', phone: '6543210987', email: 'ankit.mehta@company.com', address: '7 Business Park, Whitefield', gender: 'male', loyaltyPoints: 90, totalPurchases: 5, totalSpend: 2200, creditBalance: 0, lastVisitDate: new Date(Date.now() - 45 * 86400000).toISOString(), totalVisits: 5, customerType: 'regular', status: 'active', createdAt: new Date(Date.now() - 60 * 86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'c6', name: 'Kavya Nair', phone: '9988776655', email: 'kavya.nair@gmail.com', address: '99 Techno Park Colony, Trivandrum', dateOfBirth: '1992-07-14', gender: 'female', doctorName: 'Dr. Sreeja Menon', loyaltyPoints: 430, totalPurchases: 22, totalSpend: 11500, creditBalance: 500, lastVisitDate: new Date(Date.now() - 20 * 86400000).toISOString(), totalVisits: 22, customerType: 'credit', status: 'active', createdAt: new Date(Date.now() - 120 * 86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'c7', name: 'Deepak Yadav', phone: '8899001122', email: undefined, address: 'Village Sitapur, UP', gender: 'male', loyaltyPoints: 0, totalPurchases: 2, totalSpend: 450, creditBalance: 0, lastVisitDate: new Date(Date.now() - 60 * 86400000).toISOString(), totalVisits: 2, customerType: 'walk_in', status: 'active', createdAt: new Date(Date.now() - 65 * 86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'c8', name: 'Meera Krishnan', phone: '7766554433', email: 'meera.k@rediff.com', address: '34 Anna Colony, Madurai', dateOfBirth: '1968-12-25', gender: 'female', medicalConditions: ['Diabetes', 'Kidney Issue'], loyaltyPoints: 1800, totalPurchases: 74, totalSpend: 61000, creditBalance: 2500, lastVisitDate: new Date(Date.now() - 5 * 86400000).toISOString(), totalVisits: 74, customerType: 'credit', status: 'active', notes: 'Senior citizen — high-value diabetic patient', createdAt: new Date(Date.now() - 400 * 86400000).toISOString(), updatedAt: new Date().toISOString() },
];

const CUSTOMER_PURCHASES: Record<string, CustomerPurchase[]> = {
  c1: [
    { id: 'cp1', billNumber: 'B-2026-0421', billDate: new Date(Date.now() - 3 * 86400000).toISOString(), items: [{ medicineName: 'Metformin 500mg', quantity: 60, amount: 2100 }, { medicineName: 'Amlodipine 5mg', quantity: 30, amount: 480 }], totalAmount: 2580, paymentMethod: 'upi', status: 'completed' },
    { id: 'cp2', billNumber: 'B-2026-0398', billDate: new Date(Date.now() - 33 * 86400000).toISOString(), items: [{ medicineName: 'Metformin 500mg', quantity: 60, amount: 2100 }, { medicineName: 'Telmisartan 40mg', quantity: 30, amount: 720 }], totalAmount: 2820, paymentMethod: 'cash', status: 'completed' },
  ],
  c4: [
    { id: 'cp3', billNumber: 'B-2026-0422', billDate: new Date(Date.now() - 1 * 86400000).toISOString(), items: [{ medicineName: 'Etoricoxib 90mg', quantity: 10, amount: 1350 }, { medicineName: 'Calcium+Vit D3', quantity: 30, amount: 520 }], totalAmount: 1870, paymentMethod: 'cash', status: 'completed' },
  ],
};

const CUSTOMER_STATS: CustomerStats = {
  totalCustomers: 8,
  regularCustomers: 2,
  vipCustomers: 2,
  walkInToday: 4,
  creditCustomers: 3,
  totalCreditOutstanding: 4200,
  newThisMonth: 1,
  averageSpend: 29306,
};

export const customerHandlers = [
  http.get('/api/customers/stats', () => HttpResponse.json({ success: true, data: CUSTOMER_STATS })),

  http.get('/api/customers', ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.toLowerCase() ?? '';
    const type = url.searchParams.get('type');
    let customers = [...CUSTOMERS];
    if (search) customers = customers.filter(c => c.name.toLowerCase().includes(search) || (c.phone ?? '').includes(search) || c.email?.toLowerCase().includes(search));
    if (type) customers = customers.filter(c => (c as { customerType?: string }).customerType === type);
    return HttpResponse.json({ success: true, data: { data: customers, total: customers.length } });
  }),

  http.get('/api/customers/:id', ({ params }) => {
    const customer = CUSTOMERS.find(c => c.id === params.id);
    if (!customer) return HttpResponse.json({ success: false, message: 'Customer not found' }, { status: 404 });
    return HttpResponse.json({ success: true, data: customer });
  }),

  http.post('/api/customers', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const newCustomer = Object.assign({
      id: `c${Date.now()}`, loyaltyPoints: 0, totalPurchases: 0, totalSpend: 0, creditBalance: 0,
      totalVisits: 0, customerType: 'regular', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }, body) as unknown as Customer;
    CUSTOMERS.push(newCustomer);
    return HttpResponse.json({ success: true, data: newCustomer }, { status: 201 });
  }),

  http.patch('/api/customers/:id', async ({ params, request }) => {
    const idx = CUSTOMERS.findIndex(c => c.id === params.id);
    const existing = CUSTOMERS[idx];
    if (idx === -1 || !existing) return HttpResponse.json({ success: false }, { status: 404 });
    const body = await request.json() as Partial<Customer>;
    CUSTOMERS[idx] = { ...existing, ...body, updatedAt: new Date().toISOString() };
    return HttpResponse.json({ success: true, data: CUSTOMERS[idx] });
  }),

  http.get('/api/customers/:id/purchases', ({ params }) => {
    const purchases = CUSTOMER_PURCHASES[params.id as string] ?? [];
    return HttpResponse.json({ success: true, data: { data: purchases, total: purchases.length } });
  }),
];

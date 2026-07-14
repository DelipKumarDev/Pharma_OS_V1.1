import { Prisma, CustomerType, CustomerStatus, Gender } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { paginate } from '../../utils/response';

export async function getCustomerStats(tenantId: string) {
  const [total, regular, vip, credit, outstanding] = await Promise.all([
    prisma.customer.count({ where: { tenantId, deletedAt: null } }),
    prisma.customer.count({ where: { tenantId, customerType: 'regular', deletedAt: null } }),
    prisma.customer.count({ where: { tenantId, customerType: 'vip', deletedAt: null } }),
    prisma.customer.count({ where: { tenantId, customerType: 'credit', deletedAt: null } }),
    prisma.customer.aggregate({ where: { tenantId, deletedAt: null }, _sum: { creditBalance: true } }),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const walkInToday = await prisma.customer.count({
    where: { tenantId, customerType: 'walk_in', lastVisitDate: { gte: today }, deletedAt: null },
  });

  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);
  const newThisMonth = await prisma.customer.count({
    where: { tenantId, createdAt: { gte: thisMonth }, deletedAt: null },
  });

  const avgSpendResult = await prisma.customer.aggregate({
    where: { tenantId, deletedAt: null },
    _avg: { totalSpend: true },
  });

  return {
    totalCustomers: total,
    regularCustomers: regular,
    vipCustomers: vip,
    creditCustomers: credit,
    walkInToday,
    totalCreditOutstanding: outstanding._sum.creditBalance ?? 0,
    newThisMonth,
    averageSpend: avgSpendResult._avg.totalSpend ?? 0,
  };
}

export async function listCustomers(tenantId: string, query: Record<string, string | undefined>) {
  const page = Number(query['page'] ?? 1);
  const limit = Math.min(Number(query['limit'] ?? 20), 100);
  const skip = (page - 1) * limit;

  const where: Prisma.CustomerWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query['type'] ? { customerType: query['type'] as CustomerType } : {}),
    ...(query['status'] ? { status: query['status'] as CustomerStatus } : {}),
    ...(query['search']
      ? {
          OR: [
            { name: { contains: query['search'], mode: 'insensitive' } },
            { phone: { contains: query['search'] } },
            { email: { contains: query['search'], mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
    prisma.customer.count({ where }),
  ]);

  return paginate(customers, total, page, limit);
}

export async function getCustomerById(tenantId: string, id: string) {
  const customer = await prisma.customer.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!customer) throw new AppError('Customer not found', 404);
  return customer;
}

export async function createCustomer(tenantId: string, input: Record<string, unknown>, userId: string) {
  const name = input['name'] as string | undefined;
  if (!name?.trim()) throw new AppError('Customer name is required', 422);

  const phone = input['phone'] as string | undefined;
  if (phone !== undefined) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) throw new AppError('Phone number must be at least 10 digits', 422);
  }

  if (phone) {
    const dup = await prisma.customer.findFirst({ where: { tenantId, phone, deletedAt: null } });
    if (dup) throw new AppError('A customer with this phone number already exists', 409);
  }

  return prisma.customer.create({
    data: {
      tenantId,
      name: input['name'] as string,
      phone: input['phone'] as string | undefined,
      email: input['email'] as string | undefined,
      address: input['address'] as string | undefined,
      dateOfBirth: input['dateOfBirth'] ? new Date(input['dateOfBirth'] as string) : null,
      gender: (input['gender'] as Gender | undefined) ?? null,
      doctorName: input['doctorName'] as string | undefined,
      medicalConditions: (input['medicalConditions'] as string[]) ?? [],
      allergies: (input['allergies'] as string[]) ?? [],
      notes: input['notes'] as string | undefined,
      customerType: (input['customerType'] as CustomerType) ?? 'regular',
      status: 'active',
      createdBy: userId,
      updatedBy: userId,
    },
  });
}

export async function updateCustomer(tenantId: string, id: string, input: Record<string, unknown>, userId: string) {
  await getCustomerById(tenantId, id);
  return prisma.customer.update({
    where: { id },
    data: { ...input, updatedBy: userId, updatedAt: new Date() } as Prisma.CustomerUncheckedUpdateInput,
  });
}

export async function getCustomerPurchases(tenantId: string, customerId: string) {
  const bills = await prisma.bill.findMany({
    where: { tenantId, customerId, deletedAt: null },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const purchases = bills.map(bill => ({
    id: bill.id,
    billNumber: bill.billNumber,
    billDate: bill.createdAt,
    items: bill.items.map(i => ({ medicineName: i.medicineName, quantity: i.quantity, amount: i.totalAmount })),
    totalAmount: bill.totalAmount,
    paymentMethod: bill.paymentMethod,
    status: bill.status,
  }));

  return paginate(purchases, purchases.length, 1, 50);
}

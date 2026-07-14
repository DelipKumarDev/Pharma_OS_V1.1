import { Prisma, PrescriptionStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { paginate } from '../../utils/response';

async function getNextRxNumber(tenantId: string): Promise<string> {
  const count = await prisma.prescription.count({ where: { tenantId } });
  const year = new Date().getFullYear();
  return `RX-${year}-${String(count + 1).padStart(4, '0')}`;
}

export async function getPrescriptionStats(tenantId: string) {
  const [total, pendingReview, approved, rejected, expiringSoon] = await Promise.all([
    prisma.prescription.count({ where: { tenantId, deletedAt: null } }),
    prisma.prescription.count({ where: { tenantId, status: 'pending_review', deletedAt: null } }),
    prisma.prescription.count({ where: { tenantId, status: 'approved', deletedAt: null } }),
    prisma.prescription.count({ where: { tenantId, status: 'rejected', deletedAt: null } }),
    prisma.prescription.count({
      where: { tenantId, deletedAt: null, validUntil: { gte: new Date(), lte: new Date(Date.now() + 7 * 86400000) } },
    }),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dispensedToday = await prisma.prescription.count({
    where: { tenantId, status: 'dispensed', updatedAt: { gte: today }, deletedAt: null },
  });

  return { total, pendingReview, approved, dispensedToday, rejected, expiringSoon };
}

export async function listPrescriptions(tenantId: string, query: Record<string, string | undefined>) {
  const where: Prisma.PrescriptionWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query['status'] ? { status: query['status'] as PrescriptionStatus } : {}),
    ...(query['search']
      ? {
          OR: [
            { customerName: { contains: query['search'], mode: 'insensitive' } },
            { prescriptionNumber: { contains: query['search'] } },
            { doctorName: { contains: query['search'], mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const prescriptions = await prisma.prescription.findMany({
    where,
    include: { medicines: true },
    orderBy: { createdAt: 'desc' },
  });

  return paginate(prescriptions, prescriptions.length, 1, 50);
}

export async function getPrescriptionById(tenantId: string, id: string) {
  const rx = await prisma.prescription.findFirst({ where: { id, tenantId, deletedAt: null }, include: { medicines: true } });
  if (!rx) throw new AppError('Prescription not found', 404);
  return rx;
}

export async function createPrescription(tenantId: string, input: Record<string, unknown>, userId: string) {
  if (!(input['customerName'] as string | undefined)?.trim()) throw new AppError('Customer name is required', 422);
  const medicines = (input['medicines'] as Array<Record<string, unknown>>) ?? [];
  if (medicines.length === 0) throw new AppError('At least one medicine is required', 422);

  const prescriptionNumber = await getNextRxNumber(tenantId);

  const rx = await prisma.prescription.create({
    data: {
      tenantId,
      prescriptionNumber,
      customerId: (input['customerId'] as string | undefined) || undefined,
      customerName: input['customerName'] as string,
      customerPhone: input['customerPhone'] as string | undefined,
      doctorName: input['doctorName'] as string,
      doctorRegNumber: input['doctorRegNumber'] as string | undefined,
      hospitalName: input['hospitalName'] as string | undefined,
      prescriptionDate: input['prescriptionDate'] ? new Date(input['prescriptionDate'] as string) : new Date(),
      validUntil: input['validUntil'] ? new Date(input['validUntil'] as string) : new Date(Date.now() + 30 * 86400000),
      status: 'pending_review',
      notes: input['notes'] as string | undefined,
      createdBy: userId,
      updatedBy: userId,
    },
  });

  if (medicines.length > 0) {
    await prisma.prescriptionMedicine.createMany({
      data: medicines.map(m => ({
        prescriptionId: rx.id,
        medicineName: m['medicineName'] as string,
        genericName: m['genericName'] as string | undefined,
        dosage: m['dosage'] as string,
        frequency: m['frequency'] as string,
        duration: m['duration'] as string,
        quantity: m['quantity'] as number | undefined,
        instructions: m['instructions'] as string | undefined,
        dispensed: false,
      })),
    });
  }

  return prisma.prescription.findUnique({ where: { id: rx.id }, include: { medicines: true } });
}

export async function updatePrescriptionStatus(tenantId: string, id: string, status: PrescriptionStatus, userId: string, notes?: string) {
  const rx = await getPrescriptionById(tenantId, id);
  return prisma.prescription.update({
    where: { id },
    data: {
      status,
      reviewedBy: userId,
      reviewedAt: new Date(),
      ...(status === 'rejected' ? { rejectionReason: notes } : {}),
      updatedBy: userId,
    },
    include: { medicines: true },
  });
}

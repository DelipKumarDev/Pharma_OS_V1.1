import { Prisma, MedicineCategory, MedicineStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../utils/audit';
import { paginate } from '../../utils/response';

interface ListMedicinesQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  status?: string;
  form?: string;
}

interface CreateMedicineInput {
  name: string;
  genericName?: string;
  brandName?: string;
  manufacturer?: string;
  category?: MedicineCategory;
  form?: string;
  strength?: string;
  unit?: string;
  composition?: string;
  hsn?: string;
  barcode?: string;
  schedule?: string;
  requiresPrescription?: boolean;
  gstRate?: number;
  mrp?: number;
  purchasePrice?: number;
  sellingPrice?: number;
  reorderLevel?: number;
  description?: string;
  sideEffects?: string;
  storage?: string;
}

export async function listMedicines(tenantId: string, query: ListMedicinesQuery) {
  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? 20, 100);
  const skip = (page - 1) * limit;

  const where: Prisma.MedicineWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query.status ? { status: query.status as MedicineStatus } : {}),
    ...(query.category ? { category: query.category as MedicineCategory } : {}),
    ...(query.form ? { form: query.form as Prisma.EnumMedicineFormFilter } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { genericName: { contains: query.search, mode: 'insensitive' } },
            { manufacturer: { contains: query.search, mode: 'insensitive' } },
            { barcode: { contains: query.search } },
          ],
        }
      : {}),
  };

  const [medicines, total] = await Promise.all([
    prisma.medicine.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
    prisma.medicine.count({ where }),
  ]);

  return paginate(medicines, total, page, limit);
}

export async function getMedicineById(tenantId: string, id: string) {
  const medicine = await prisma.medicine.findFirst({
    where: { id, tenantId, deletedAt: null },
  });
  if (!medicine) throw new AppError('Medicine not found', 404);
  return medicine;
}

export async function getMedicineByBarcode(tenantId: string, barcode: string) {
  const medicine = await prisma.medicine.findFirst({
    where: { barcode, tenantId, deletedAt: null },
  });
  if (!medicine) throw new AppError('Barcode not found in database', 404);
  return medicine;
}

export async function createMedicine(tenantId: string, input: CreateMedicineInput, userId: string, userName: string) {
  if (!input.name?.trim()) throw new AppError('Medicine name is required', 422);
  if (input.name.length > 150) throw new AppError('Medicine name must not exceed 150 characters', 422);
  if (input.mrp !== undefined && input.mrp < 0) throw new AppError('MRP cannot be negative', 422);
  if (input.sellingPrice !== undefined && input.sellingPrice < 0) throw new AppError('Selling price cannot be negative', 422);
  if (input.gstRate !== undefined && (input.gstRate < 0 || input.gstRate > 100)) throw new AppError('GST rate must be between 0 and 100', 422);

  const duplicate = await prisma.medicine.findFirst({
    where: { tenantId, name: { equals: input.name.trim(), mode: 'insensitive' }, deletedAt: null },
  });
  if (duplicate) throw new AppError('A medicine with this name already exists', 409);

  const medicine = await prisma.medicine.create({
    data: {
      tenantId,
      ...input,
      category: (input.category as MedicineCategory) ?? 'other',
      createdBy: userId,
      updatedBy: userId,
    } as Prisma.MedicineUncheckedCreateInput,
  });

  await createAuditLog({
    tenantId,
    userId,
    userName,
    module: 'medicine',
    action: 'create',
    entityId: medicine.id,
    entityName: medicine.name,
    description: `Added new medicine: ${medicine.name}`,
  });

  return medicine;
}

export async function updateMedicine(
  tenantId: string,
  id: string,
  input: Partial<CreateMedicineInput>,
  userId: string,
  userName: string,
) {
  const existing = await getMedicineById(tenantId, id);

  const medicine = await prisma.medicine.update({
    where: { id },
    data: { ...input, updatedBy: userId } as Prisma.MedicineUncheckedUpdateInput,
  });

  await createAuditLog({
    tenantId,
    userId,
    userName,
    module: 'medicine',
    action: 'update',
    entityId: id,
    entityName: existing.name,
    description: `Updated medicine: ${existing.name}`,
    beforeValue: existing as Record<string, unknown>,
    afterValue: medicine as Record<string, unknown>,
  });

  return medicine;
}

export async function deleteMedicine(tenantId: string, id: string, userId: string, userName: string) {
  const medicine = await getMedicineById(tenantId, id);

  await prisma.medicine.update({
    where: { id },
    data: { deletedAt: new Date(), updatedBy: userId },
  });

  await createAuditLog({
    tenantId,
    userId,
    userName,
    module: 'medicine',
    action: 'delete',
    entityId: id,
    entityName: medicine.name,
    description: `Deleted medicine: ${medicine.name}`,
    severity: 'warning',
  });
}

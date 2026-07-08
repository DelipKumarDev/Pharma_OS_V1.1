import type { ID, Timestamp, AuditFields } from './common';

export interface Medicine {
  id: ID;
  tenantId: ID;
  name: string;
  genericName: string;
  brandName?: string;
  manufacturer: string;
  category: MedicineCategory;
  form: MedicineForm;
  strength: string;
  unit: MedicineUnit;
  composition?: string;
  hsn?: string;
  barcode?: string;
  schedule?: DrugSchedule;
  requiresPrescription: boolean;
  gstRate: number;
  mrp: number;
  purchasePrice?: number;
  sellingPrice: number;
  reorderLevel: number;
  description?: string;
  sideEffects?: string;
  storage?: string;
  status: 'active' | 'discontinued' | 'banned';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type MedicineCategory =
  | 'antibiotic'
  | 'analgesic'
  | 'antacid'
  | 'antihistamine'
  | 'antifungal'
  | 'antiviral'
  | 'cardiovascular'
  | 'diabetes'
  | 'dermatology'
  | 'gastroenterology'
  | 'gynecology'
  | 'neurology'
  | 'oncology'
  | 'ophthalmology'
  | 'orthopedic'
  | 'pediatric'
  | 'psychiatry'
  | 'respiratory'
  | 'urology'
  | 'vitamins'
  | 'surgical'
  | 'other';

export type MedicineForm =
  | 'tablet'
  | 'capsule'
  | 'syrup'
  | 'injection'
  | 'cream'
  | 'ointment'
  | 'drops'
  | 'inhaler'
  | 'powder'
  | 'gel'
  | 'patch'
  | 'spray'
  | 'lotion'
  | 'suspension'
  | 'suppository';

export type MedicineUnit = 'strip' | 'bottle' | 'vial' | 'tube' | 'sachet' | 'box' | 'piece';

export type DrugSchedule = 'H' | 'H1' | 'X' | 'G' | 'C' | 'E' | null;

export interface CreateMedicineRequest {
  name: string;
  genericName: string;
  brandName?: string;
  manufacturer: string;
  category: MedicineCategory;
  form: MedicineForm;
  strength: string;
  unit: MedicineUnit;
  composition?: string;
  hsn?: string;
  barcode?: string;
  schedule?: DrugSchedule;
  requiresPrescription: boolean;
  gstRate: number;
  mrp: number;
  sellingPrice: number;
  reorderLevel: number;
}

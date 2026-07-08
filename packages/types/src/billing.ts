import type { ID, Timestamp } from './common';
import type { Medicine } from './medicine';

export interface Bill {
  id: ID;
  tenantId: ID;
  billNumber: string;
  type: BillType;
  status: BillStatus;
  customer?: BillCustomer;
  doctor?: string;
  prescription?: string;
  items: BillItem[];
  subtotal: number;
  discountAmount: number;
  discountPercent: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentMethod?: PaymentMethod;
  notes?: string;
  createdBy: ID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type BillType = 'sale' | 'return' | 'credit_note';
export type BillStatus = 'draft' | 'completed' | 'partially_paid' | 'cancelled' | 'refunded';
export type PaymentMethod = 'cash' | 'card' | 'upi' | 'netbanking' | 'credit' | 'insurance';

export interface BillItem {
  id: ID;
  medicineId: ID;
  medicineName: string;
  genericName: string;
  batchNumber: string;
  expiryDate: Timestamp;
  quantity: number;
  mrp: number;
  sellingPrice: number;
  discount: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
}

export interface BillCustomer {
  id?: ID;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  loyaltyPoints?: number;
}

export interface CreateBillRequest {
  type: BillType;
  customer?: BillCustomer;
  doctor?: string;
  prescription?: string;
  items: CreateBillItemRequest[];
  discountPercent?: number;
  paymentMethod?: PaymentMethod;
  notes?: string;
}

export interface CreateBillItemRequest {
  medicineId: ID;
  inventoryItemId: ID;
  quantity: number;
  sellingPrice: number;
  discount?: number;
}

export interface DailySalesSummary {
  date: string;
  totalBills: number;
  totalRevenue: number;
  cashRevenue: number;
  cardRevenue: number;
  upiRevenue: number;
  totalItems: number;
  returnAmount: number;
}

import type { ID, Timestamp } from './common';

export interface Vendor {
  id: ID;
  name: string;
  gstNumber?: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  pincode?: string;
  contactPerson?: string;
  paymentTerms?: string;
  creditLimit?: number;
  totalPurchases: number;
  pendingPayment: number;
  lastOrderDate?: Timestamp;
  rating?: number;
  status: 'active' | 'inactive';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PurchaseInvoice {
  id: ID;
  vendorId: ID;
  vendorName: string;
  invoiceNumber: string;
  invoiceDate: string;
  status: PurchaseStatus;
  items: PurchaseItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  paymentDueDate?: string;
  ocrStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  mismatchFlag?: boolean;
  notes?: string;
  createdBy: ID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type PurchaseStatus = 'draft' | 'pending_review' | 'confirmed' | 'partial_received' | 'completed' | 'cancelled';

export interface PurchaseItem {
  id: ID;
  medicineId?: ID;
  medicineName: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  receivedQuantity?: number;
  purchasePrice: number;
  mrp: number;
  sellingPrice: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
  mismatch?: boolean;
}

export interface VendorPayment {
  id: ID;
  vendorId: ID;
  invoiceId?: ID;
  amount: number;
  paymentDate: string;
  paymentMode: 'cash' | 'cheque' | 'neft' | 'upi' | 'rtgs';
  referenceNumber?: string;
  notes?: string;
  createdAt: Timestamp;
}

export interface VendorStats {
  totalVendors: number;
  activeVendors: number;
  totalPurchasesThisMonth: number;
  pendingPayments: number;
  overduePayments: number;
  topVendorName: string;
  invoicesPendingReview: number;
}

export interface CreateVendorRequest {
  name: string;
  gstNumber?: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  pincode?: string;
  contactPerson?: string;
  paymentTerms?: string;
  creditLimit?: number;
}

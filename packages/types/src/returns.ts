export type ReturnType = 'customer_return' | 'vendor_return';
export type ReturnStatus = 'pending' | 'approved' | 'processed' | 'rejected';
export type ReturnReason =
  | 'wrong_medicine'
  | 'damaged'
  | 'expired'
  | 'patient_condition_changed'
  | 'excess_stock'
  | 'near_expiry'
  | 'other';
export type RefundMethod = 'cash' | 'upi' | 'credit_note' | 'original_payment';
export type ItemCondition = 'resaleable' | 'damaged' | 'expired';

export interface ReturnItem {
  id: string;
  medicineId?: string;
  medicineName: string;
  batchNumber: string;
  expiryDate?: string;
  returnQty: number;
  unitPrice: number;
  totalAmount: number;
  condition: ItemCondition;
  restocked: boolean;
}

export interface ReturnRequest {
  id: string;
  returnNumber: string;
  type: ReturnType;
  status: ReturnStatus;
  billId?: string;
  billNumber?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  vendorId?: string;
  vendorName?: string;
  purchaseInvoiceId?: string;
  purchaseInvoiceNumber?: string;
  items: ReturnItem[];
  totalAmount: number;
  refundAmount: number;
  refundMethod?: RefundMethod;
  reason: ReturnReason;
  reasonNotes?: string;
  processedBy?: string;
  processedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReturnStats {
  totalReturns: number;
  pendingApproval: number;
  processedToday: number;
  totalRefundedThisMonth: number;
  customerReturns: number;
  vendorReturns: number;
}

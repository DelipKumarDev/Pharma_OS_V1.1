import type { ID, Timestamp } from './common';
import type { Medicine } from './medicine';

export interface InventoryItem {
  id: ID;
  tenantId: ID;
  medicineId: ID;
  medicine?: Medicine;
  batchNumber: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  purchasePrice: number;
  mrp: number;
  sellingPrice: number;
  manufacturingDate: Timestamp;
  expiryDate: Timestamp;
  supplierId?: ID;
  supplierName?: string;
  purchaseOrderId?: ID;
  location?: string;
  rackNumber?: string;
  rackLocation?: string;
  manufacturer?: string;
  strength?: string;
  category?: string;
  dosageForm?: string;
  reorderLevel?: number;
  status: InventoryStatus;
  expiryStatus: ExpiryStatus;
  batchStatus?: BatchStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type InventoryStatus = 'available' | 'low_stock' | 'out_of_stock' | 'expired' | 'damaged';
export type ExpiryStatus = 'good' | 'expiring_soon' | 'expired';
export type BatchStatus = 'active' | 'exhausted' | 'expired' | 'returned';

export interface MedicineBatch {
  batchId: ID;
  medicineId: ID;
  batchNumber: string;
  expiryDate: Timestamp;
  manufacturingDate?: Timestamp;
  quantityAvailable: number;
  quantityInitial: number;
  purchasePrice: number;
  sellingPrice: number;
  mrp: number;
  supplierName?: string;
  batchStatus: BatchStatus;
  createdAt: Timestamp;
}

export interface StockMovement {
  movementId: ID;
  medicineId: ID;
  batchId: ID;
  batchNumber: string;
  movementType: 'PURCHASE' | 'SALE' | 'ADJUSTMENT' | 'RETURN' | 'TRANSFER' | 'DISPOSAL';
  quantityChange: number;
  performedBy: string;
  referenceId?: string;
  notes?: string;
  createdAt: Timestamp;
}

export interface InventoryStats {
  totalMedicines: number;
  inventoryValue: number;
  lowStockCount: number;
  expiringSoonCount: number;
  outOfStockCount: number;
  /** Medicines with stock comfortably above their reorder level. */
  goodStockCount?: number;
  pendingTransfers: number;
}

export interface AIInsight {
  id: string;
  type: 'reorder' | 'transfer' | 'expiry' | 'demand' | 'dead_stock' | 'low_stock';
  title: string;
  description: string;
  actionLabel: string;
  priority: 'high' | 'medium' | 'low';
}

export interface CartItem {
  inventoryId: ID;
  medicineId: ID;
  medicineName: string;
  strength: string;
  dosageForm?: string;
  batchNumber: string;
  mrp: number;
  quantity: number;
  amount: number;
}

export interface StockAdjustment {
  id: ID;
  tenantId: ID;
  inventoryItemId: ID;
  type: AdjustmentType;
  quantity: number;
  reason: string;
  notes?: string;
  adjustedBy: ID;
  adjustedAt: Timestamp;
}

export type AdjustmentType = 'addition' | 'deduction' | 'damage' | 'return' | 'correction';

export interface PurchaseOrder {
  id: ID;
  tenantId: ID;
  supplierId: ID;
  supplierName: string;
  poNumber: string;
  status: POStatus;
  items: POItem[];
  totalAmount: number;
  expectedDelivery: Timestamp;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type POStatus = 'draft' | 'sent' | 'partial' | 'received' | 'cancelled';

export interface POItem {
  medicineId: ID;
  medicineName: string;
  quantity: number;
  purchasePrice: number;
  receivedQuantity?: number;
}

export interface Supplier {
  id: ID;
  tenantId: ID;
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  gstNumber?: string;
  drugLicense?: string;
  address?: string;
  paymentTerms?: string;
  status: 'active' | 'inactive';
  createdAt: Timestamp;
}

import type { ID, Timestamp } from './common';

export interface ReorderItem {
  id: ID;
  medicineId: ID;
  medicineName: string;
  genericName?: string;
  currentStock: number;
  reorderLevel: number;
  suggestedQty: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: ReorderStatus;
  lastSaleQty30Days: number;
  daysStockLeft?: number;
  preferredVendor?: string;
  lastPurchasePrice?: number;
  vendorSuggestions: VendorSuggestion[];
  addedAt: Timestamp;
  updatedAt: Timestamp;
  notes?: string;
}

export type ReorderStatus = 'pending' | 'ordered' | 'received' | 'cancelled';

export interface VendorSuggestion {
  vendorId: ID;
  vendorName: string;
  lastPrice: number;
  lastOrderDate: string;
  leadTimeDays: number;
  reliability: 'excellent' | 'good' | 'average' | 'poor';
}

export interface ReorderAlert {
  id: ID;
  medicineId: ID;
  medicineName: string;
  alertType: 'low_stock' | 'critical_stock' | 'out_of_stock' | 'expiry_risk';
  currentQty: number;
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
  isAcknowledged: boolean;
  createdAt: Timestamp;
}

export interface ReorderStats {
  totalPending: number;
  criticalItems: number;
  highPriorityItems: number;
  orderedToday: number;
  outOfStock: number;
  totalAlerts: number;
  avgLeadTimeDays: number;
}

export interface MedicineThreshold {
  medicineId: ID;
  medicineName: string;
  minStock: number;
  reorderQty: number;
  isCritical: boolean;
}

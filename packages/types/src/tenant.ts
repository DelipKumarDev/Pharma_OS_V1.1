import type { ID, Timestamp, Status, Address, AuditFields } from './common';

export interface Tenant {
  id: ID;
  name: string;
  slug: string;
  type: TenantType;
  status: TenantStatus;
  plan: TenantPlan;
  logo?: string;
  phone: string;
  email: string;
  address: Address;
  licenseNumber: string;
  gstNumber?: string;
  drugLicenseNumber: string;
  drugLicenseExpiry: Timestamp;
  settings: TenantSettings;
  stats?: TenantStats;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type TenantType = 'retail' | 'wholesale' | 'hospital' | 'clinic' | 'chain';
export type TenantStatus = 'active' | 'suspended' | 'pending_verification' | 'trial' | 'expired';
export type TenantPlan = 'starter' | 'professional' | 'enterprise';

export interface TenantSettings {
  currency: string;
  timezone: string;
  dateFormat: string;
  lowStockThreshold: number;
  expiryAlertDays: number;
  autoBackup: boolean;
  printBillDefault: boolean;
  requirePrescription: boolean;
  enableOfflineMode: boolean;
  gstEnabled: boolean;
}

export interface TenantStats {
  totalUsers: number;
  totalMedicines: number;
  totalInventoryItems: number;
  monthlyRevenue: number;
  storageUsedMb: number;
}

export interface CreateTenantRequest {
  name: string;
  slug: string;
  type: TenantType;
  plan: TenantPlan;
  phone: string;
  email: string;
  address: Address;
  licenseNumber: string;
  drugLicenseNumber: string;
  drugLicenseExpiry: string;
}

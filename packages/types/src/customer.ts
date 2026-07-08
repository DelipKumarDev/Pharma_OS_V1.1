import type { ID, Timestamp } from './common';

export interface Customer {
  id: ID;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  doctorName?: string;
  medicalConditions?: string[];
  allergies?: string[];
  loyaltyPoints: number;
  totalPurchases: number;
  totalSpend: number;
  creditBalance: number;
  lastVisitDate?: Timestamp;
  totalVisits: number;
  customerType: 'walk_in' | 'regular' | 'vip' | 'credit';
  status: 'active' | 'inactive';
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CustomerPurchase {
  id: ID;
  billNumber: string;
  billDate: string;
  items: CustomerPurchaseItem[];
  totalAmount: number;
  paymentMethod: string;
  status: 'completed' | 'returned' | 'partially_returned';
}

export interface CustomerPurchaseItem {
  medicineName: string;
  quantity: number;
  amount: number;
}

export interface CustomerStats {
  totalCustomers: number;
  regularCustomers: number;
  vipCustomers: number;
  walkInToday: number;
  creditCustomers: number;
  totalCreditOutstanding: number;
  newThisMonth: number;
  averageSpend: number;
}

export interface CreateCustomerRequest {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  doctorName?: string;
  customerType?: 'walk_in' | 'regular' | 'vip' | 'credit';
  notes?: string;
}

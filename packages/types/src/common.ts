export type ID = string;
export type Timestamp = string; // ISO 8601

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: Record<string, string[]>;
}

export interface ApiError {
  success: false;
  message: string;
  code: string;
  errors?: Record<string, string[]>;
}

export type SortOrder = 'asc' | 'desc';

export interface SortParams {
  sortBy: string;
  sortOrder: SortOrder;
}

export interface FilterParams {
  search?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export type Status = 'active' | 'inactive' | 'suspended' | 'pending';

export interface AuditFields {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: ID;
  updatedBy?: ID;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export type AlertSeverity = 'info' | 'warning' | 'critical';

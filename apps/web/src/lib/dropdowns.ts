'use client';

import { useAuthStore } from '@/store/auth-store';

// ─── Configurable dropdown option lists (TC_028) ─────────────────────────────
// Every configurable dropdown in the app is keyed here with a built-in default
// list. The tenant's saved overrides arrive on the auth user (dropdownOptions)
// and are merged over these defaults by useDropdown().

export interface DropdownDef {
  key: string;
  label: string;
  description: string;
  locked?: boolean;
}

export const DROPDOWN_REGISTRY: DropdownDef[] = [
  { key: 'medicineCategory', label: 'Medicine Categories', description: 'Therapeutic categories for the medicine master.' },
  { key: 'medicineForm', label: 'Medicine Forms', description: 'Dosage forms (tablet, syrup, injection…).' },
  { key: 'medicineUnit', label: 'Medicine Units', description: 'Packaging units (strip, bottle, vial…).' },
  { key: 'gstRate', label: 'GST Rates (%)', description: 'Applicable GST slabs for pricing.' },
  { key: 'customerType', label: 'Customer Types', description: 'Categories used when adding a customer.' },
  { key: 'paymentMethod', label: 'Payment Methods', description: 'Accepted payment modes at billing.' },
];

export const DEFAULT_DROPDOWNS: Record<string, string[]> = {
  medicineCategory: ['analgesic', 'antibiotic', 'antacid', 'antihistamine', 'antifungal', 'antiviral', 'cardiovascular', 'diabetes', 'dermatology', 'gastroenterology', 'gynecology', 'neurology', 'oncology', 'ophthalmology', 'orthopedic', 'pediatric', 'psychiatry', 'respiratory', 'urology', 'vitamins', 'surgical', 'other'],
  medicineForm: ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'ointment', 'drops', 'inhaler', 'powder', 'gel', 'patch', 'spray', 'lotion', 'suspension', 'suppository'],
  medicineUnit: ['strip', 'bottle', 'vial', 'tube', 'sachet', 'box', 'piece'],
  gstRate: ['0', '5', '12', '18', '28'],
  customerType: ['walk_in', 'regular', 'wholesale', 'staff'],
  paymentMethod: ['cash', 'upi', 'card', 'credit'],
};

/**
 * Returns the effective option list for a dropdown key — the tenant's saved
 * override if present, otherwise the built-in default. Reads from the auth
 * store so every screen (any role) stays in sync with Settings.
 */
export function useDropdown(key: string): string[] {
  const options = useAuthStore((s) => s.user?.dropdownOptions);
  const override = options?.[key];
  return override && override.length > 0 ? override : (DEFAULT_DROPDOWNS[key] ?? []);
}

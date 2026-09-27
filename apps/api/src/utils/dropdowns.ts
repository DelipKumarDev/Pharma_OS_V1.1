// ─── Admin-configurable dropdown option lists (TC_028) ───────────────────────
// A generic, per-tenant registry: every configurable dropdown in the app is
// keyed here with a built-in default list. Tenants may override any list from
// Settings → Dropdown Options; stored overrides are merged over these defaults.

export interface DropdownDef {
  key: string;
  label: string;
  description: string;
  /** Locked lists (e.g. statutory drug schedules) are shown read-only. */
  locked?: boolean;
}

// Registry of every configurable dropdown, with human labels for the settings UI.
export const DROPDOWN_REGISTRY: DropdownDef[] = [
  { key: 'medicineCategory', label: 'Medicine Categories', description: 'Therapeutic categories for the medicine master.' },
  { key: 'medicineForm', label: 'Medicine Forms', description: 'Dosage forms (tablet, syrup, injection…).' },
  { key: 'medicineUnit', label: 'Medicine Units', description: 'Packaging units (strip, bottle, vial…).' },
  { key: 'gstRate', label: 'GST Rates (%)', description: 'Applicable GST slabs for pricing.' },
  { key: 'customerType', label: 'Customer Types', description: 'Categories used when adding a customer.' },
  { key: 'paymentMethod', label: 'Payment Methods', description: 'Accepted payment modes at billing.' },
];

// Built-in defaults for every registry key.
export const DEFAULT_DROPDOWNS: Record<string, string[]> = {
  medicineCategory: ['analgesic', 'antibiotic', 'antacid', 'antihistamine', 'antifungal', 'antiviral', 'cardiovascular', 'diabetes', 'dermatology', 'gastroenterology', 'gynecology', 'neurology', 'oncology', 'ophthalmology', 'orthopedic', 'pediatric', 'psychiatry', 'respiratory', 'urology', 'vitamins', 'surgical', 'other'],
  medicineForm: ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'ointment', 'drops', 'inhaler', 'powder', 'gel', 'patch', 'spray', 'lotion', 'suspension', 'suppository'],
  medicineUnit: ['strip', 'bottle', 'vial', 'tube', 'sachet', 'box', 'piece'],
  gstRate: ['0', '5', '12', '18', '28'],
  customerType: ['walk_in', 'regular', 'wholesale', 'staff'],
  paymentMethod: ['cash', 'upi', 'card', 'credit'],
};

/**
 * Merge a tenant's stored overrides over the built-in defaults. Only known keys
 * with a non-empty string[] override; everything else falls back to defaults.
 */
export function resolveDropdowns(stored: unknown): Record<string, string[]> {
  const result: Record<string, string[]> = { ...DEFAULT_DROPDOWNS };
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
    for (const def of DROPDOWN_REGISTRY) {
      const v = (stored as Record<string, unknown>)[def.key];
      if (Array.isArray(v)) {
        const clean = v.map((x) => String(x).trim()).filter(Boolean);
        if (clean.length > 0) result[def.key] = Array.from(new Set(clean));
      }
    }
  }
  return result;
}

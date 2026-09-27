'use client';

import { useAuthStore } from '@/store/auth-store';

// Default used only when the tenant hasn't configured a refill template in
// Settings → Message Templates. All {{variables}} are filled at send time.
const DEFAULT_REFILL = 'Hello {{customerName}}, your medicine refill{{medicine}} is due{{overdue}}. Please visit {{pharmacyName}} to refill your prescription. Thank you!';

export interface ReminderVars {
  customerName?: string;
  medicine?: string;   // medicine name (optional)
  overdue?: string;    // e.g. " (3 days overdue)" (optional)
  [k: string]: string | undefined;
}

/**
 * Returns a renderer that fills the tenant's configured refill-reminder template
 * (frontend-configurable via Settings → Message Templates) with the given data.
 */
export function useRefillMessage() {
  const user = useAuthStore((s) => s.user);
  return (vars: ReminderVars) => {
    const tpl = user?.messageTemplates?.refillReminder?.trim() || DEFAULT_REFILL;
    const data: Record<string, string> = {
      customerName: (vars.customerName || 'Customer').split(' ')[0]!,
      medicine: vars.medicine ? ` of ${vars.medicine}` : '',
      overdue: vars.overdue ?? '',
      pharmacyName: user?.tenantName ?? 'our pharmacy',
      ...Object.fromEntries(Object.entries(vars).filter(([, v]) => v !== undefined)) as Record<string, string>,
    };
    return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => data[k] ?? '').replace(/\s{2,}/g, ' ').trim();
  };
}

export function openWhatsApp(phone: string | undefined | null, message: string): boolean {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length < 10) return false;
  const full = digits.length === 10 ? `91${digits}` : digits;
  window.open(`https://wa.me/${full}?text=${encodeURIComponent(message)}`, '_blank');
  return true;
}

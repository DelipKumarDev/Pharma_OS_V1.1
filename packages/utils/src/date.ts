import { format, parseISO, differenceInDays, isAfter, isBefore, addDays } from 'date-fns';

export function formatDate(date: string | Date, pattern = 'dd MMM yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, pattern);
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd MMM yyyy, hh:mm a');
}

// Numeric date pattern, set from the tenant's System Preferences date-format
// setting (DD/MM/YYYY | MM/DD/YYYY | YYYY-MM-DD). Readable dates (formatDate /
// formatDateTime) stay in the unambiguous "dd MMM yyyy" style.
let activeShortPattern = 'dd/MM/yyyy';
export function setActiveDateFormat(fmt?: string | null): void {
  if (!fmt) return;
  activeShortPattern = fmt === 'MM/DD/YYYY' ? 'MM/dd/yyyy' : fmt === 'YYYY-MM-DD' ? 'yyyy-MM-dd' : 'dd/MM/yyyy';
}

export function formatDateShort(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, activeShortPattern);
}

export function daysUntilExpiry(expiryDate: string): number {
  return differenceInDays(parseISO(expiryDate), new Date());
}

export function isExpired(expiryDate: string): boolean {
  return isBefore(parseISO(expiryDate), new Date());
}

export function isExpiringSoon(expiryDate: string, alertDays = 90): boolean {
  const expiry = parseISO(expiryDate);
  const alertDate = addDays(new Date(), alertDays);
  return !isExpired(expiryDate) && isBefore(expiry, alertDate);
}

export function getExpiryStatus(expiryDate: string, alertDays = 90): 'good' | 'expiring_soon' | 'expired' {
  if (isExpired(expiryDate)) return 'expired';
  if (isExpiringSoon(expiryDate, alertDays)) return 'expiring_soon';
  return 'good';
}

export function toISOString(date: Date): string {
  return date.toISOString();
}

export function today(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

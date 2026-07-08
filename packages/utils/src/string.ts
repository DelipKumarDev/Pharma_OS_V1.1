export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function titleCase(str: string): string {
  return str.replace(/\b\w/g, (l) => l.toUpperCase());
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 3)}...`;
}

export function maskPhone(phone: string): string {
  return phone.replace(/(\d{2})\d{6}(\d{2})/, '$1******$2');
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!user || !domain) return email;
  const visible = user.slice(0, 2);
  return `${visible}***@${domain}`;
}

export function generateBillNumber(prefix: string, number: number): string {
  return `${prefix}${String(number).padStart(6, '0')}`;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase();
}

export function searchMatch(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}

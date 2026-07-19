// Per-tenant configurable message templates with {{variable}} placeholders.

export interface MessageTemplates {
  refillReminder: string;
  lowStockAlert: string;
  expiryAlert: string;
  paymentDue: string;
}

// Defaults used when a tenant hasn't customised a template. Each lists the
// variables the render sites provide (see below).
export const DEFAULT_TEMPLATES: MessageTemplates = {
  refillReminder: 'Hi {{customerName}}, your {{medicine}} refill is due{{overdue}}. Visit {{pharmacyName}} to restock. Thank you!',
  lowStockAlert: '{{pharmacyName}}: {{count}} item(s) low on stock need attention. Open PharmaOS for details.',
  expiryAlert: '{{pharmacyName}}: {{count}} batch(es) expiring within {{days}} days. Open PharmaOS for details.',
  paymentDue: 'Dear {{customerName}}, a payment of ₹{{amount}} is pending at {{pharmacyName}}. Please clear it at your convenience.',
};

// Variables offered per template (for the settings UI chips + validation).
export const TEMPLATE_VARIABLES: Record<keyof MessageTemplates, string[]> = {
  refillReminder: ['customerName', 'medicine', 'overdue', 'pharmacyName'],
  lowStockAlert: ['pharmacyName', 'count'],
  expiryAlert: ['pharmacyName', 'count', 'days'],
  paymentDue: ['customerName', 'amount', 'pharmacyName'],
};

/** Replaces {{var}} tokens with provided values; unknown tokens become ''. */
export function renderTemplate(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) =>
    key in vars ? String(vars[key]) : ''
  ).replace(/\s{2,}/g, ' ').trim();
}

/** Merge a tenant's stored templates over the defaults. */
export function resolveTemplates(stored: unknown): MessageTemplates {
  const s = (stored && typeof stored === 'object') ? stored as Partial<MessageTemplates> : {};
  return {
    refillReminder: s.refillReminder?.trim() || DEFAULT_TEMPLATES.refillReminder,
    lowStockAlert: s.lowStockAlert?.trim() || DEFAULT_TEMPLATES.lowStockAlert,
    expiryAlert: s.expiryAlert?.trim() || DEFAULT_TEMPLATES.expiryAlert,
    paymentDue: s.paymentDue?.trim() || DEFAULT_TEMPLATES.paymentDue,
  };
}

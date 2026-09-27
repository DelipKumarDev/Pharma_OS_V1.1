// Searchable index of every navigable destination in Pharma Ist — top-level
// menus, sub-menus, report views, settings sections and account pages. Powers
// the "Pages" section of the global search so a user can jump anywhere by name.

export interface NavItem {
  label: string;
  href: string;
  group: string;        // shown as the result subtitle (e.g. "Sales", "Reports")
  keywords?: string;    // extra terms to match on (synonyms, abbreviations)
}

export const NAV_INDEX: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', group: 'Home', keywords: 'home overview summary kpi' },

  // Sales
  { label: 'Billing', href: '/billing', group: 'Sales', keywords: 'pos point of sale sell invoice cart checkout' },
  { label: 'Quick Bill', href: '/billing?quick=1', group: 'Sales', keywords: 'fast quick sale' },
  { label: 'Returns', href: '/returns', group: 'Sales', keywords: 'refund return customer return' },
  { label: 'Prescriptions', href: '/prescriptions', group: 'Sales', keywords: 'rx doctor prescription' },
  { label: 'Credit Sales', href: '/credit-sales', group: 'Sales', keywords: 'due udhaar outstanding credit' },
  { label: 'Delivery Orders', href: '/delivery-orders', group: 'Sales', keywords: 'delivery home dispatch' },

  // Procurement
  { label: 'Purchase Orders', href: '/purchase-orders', group: 'Procurement', keywords: 'po buy order supplier purchase' },
  { label: 'Scan Supplier Invoice', href: '/scan', group: 'Procurement', keywords: 'ocr scan bill invoice upload' },
  { label: 'Vendors', href: '/vendors', group: 'Procurement', keywords: 'supplier distributor vendor' },
  { label: 'Goods Receipt', href: '/goods-receipt', group: 'Procurement', keywords: 'grn receive stock inward' },
  { label: 'Purchase Returns', href: '/purchase-returns', group: 'Procurement', keywords: 'vendor return debit note' },

  // Inventory
  { label: 'Inventory', href: '/stock', group: 'Inventory', keywords: 'stock levels quantity on hand' },
  { label: 'Medicine Catalog', href: '/medicines', group: 'Inventory', keywords: 'medicines drugs products master catalogue' },
  { label: 'Batch Management', href: '/batch-management', group: 'Inventory', keywords: 'batch lot expiry' },
  { label: 'Stock Adjustment', href: '/stock-adjustment', group: 'Inventory', keywords: 'adjust damage correction write off' },
  { label: 'Transfers', href: '/transfers', group: 'Inventory', keywords: 'transfer relocate rack move' },
  { label: 'Reorder Queue', href: '/reorder', group: 'Inventory', keywords: 'reorder low stock replenish' },
  { label: 'Expiry Monitor', href: '/expiry', group: 'Inventory', keywords: 'near expiry expired expiring' },
  { label: 'Stock Count', href: '/stock-count', group: 'Inventory', keywords: 'physical count reconcile audit stock' },

  // Customers
  { label: 'Customers', href: '/customers', group: 'Customers', keywords: 'patients buyers customer' },
  { label: 'Contacts', href: '/contacts', group: 'Customers', keywords: 'contacts directory' },
  { label: 'Loyalty', href: '/loyalty', group: 'Customers', keywords: 'points rewards loyalty tier' },
  { label: 'Credit Accounts', href: '/credit-accounts', group: 'Customers', keywords: 'credit balance due collect payment' },
  { label: 'Patient History', href: '/patient-history', group: 'Customers', keywords: 'history purchases medication' },

  // Compliance
  { label: 'Schedule Register', href: '/schedule-register', group: 'Compliance', keywords: 'schedule h h1 x register statutory' },
  { label: 'Controlled Drugs', href: '/controlled-drugs', group: 'Compliance', keywords: 'narcotic psychotropic controlled schedule x' },
  { label: 'Audit Log', href: '/audit', group: 'Compliance', keywords: 'audit trail activity log' },

  // Reports
  { label: 'Sales Report', href: '/reports?tab=sales', group: 'Reports', keywords: 'sales revenue report analytics' },
  { label: 'Inventory Report', href: '/reports?tab=stock', group: 'Reports', keywords: 'stock intelligence dead stock report' },
  { label: 'Financial Report', href: '/reports?tab=profit', group: 'Reports', keywords: 'profit margin financial p&l report' },
  { label: 'GST Report', href: '/reports?tab=gst', group: 'Reports', keywords: 'gst gstr1 tax compliance report' },
  { label: 'Customer Insights', href: '/reports?tab=customers', group: 'Reports', keywords: 'customer insights retention report' },
  { label: 'Daily Close', href: '/reports?tab=daily-close', group: 'Reports', keywords: 'day close cash reconciliation eod' },

  // Administration
  { label: 'Users', href: '/users', group: 'Administration', keywords: 'staff user management accounts' },
  { label: 'Roles', href: '/roles', group: 'Administration', keywords: 'roles access rbac' },
  { label: 'Permissions', href: '/permissions', group: 'Administration', keywords: 'permissions matrix access rbac' },
  { label: 'Notifications', href: '/notifications', group: 'Administration', keywords: 'alerts notifications inbox' },
  { label: 'Integrations', href: '/integrations', group: 'Administration', keywords: 'whatsapp sms email upi integrations' },
  { label: 'Help', href: '/help', group: 'Administration', keywords: 'help support faq guide' },
  { label: 'Shortcuts', href: '/shortcuts', group: 'Administration', keywords: 'keyboard shortcuts hotkeys' },

  // Settings hub + sections
  { label: 'Settings', href: '/settings', group: 'Settings', keywords: 'configuration preferences settings' },
  { label: 'Pharmacy Profile', href: '/settings?tab=profile', group: 'Settings', keywords: 'pharmacy name logo license gst profile' },
  { label: 'Tax & Billing', href: '/settings?tab=tax', group: 'Settings', keywords: 'gst payment methods upi tax billing' },
  { label: 'Receipt Configuration', href: '/settings?tab=receipt', group: 'Settings', keywords: 'receipt print toggles qr cashier' },
  { label: 'Import & Export', href: '/settings?tab=import', group: 'Settings', keywords: 'import export csv backup migration' },
  { label: 'Notification Settings', href: '/settings?tab=notifications', group: 'Settings', keywords: 'alerts email sms whatsapp notifications' },
  { label: 'Message Templates', href: '/settings?tab=templates', group: 'Settings', keywords: 'templates whatsapp sms wording' },
  { label: 'Preferences', href: '/settings?tab=system', group: 'Settings', keywords: 'timezone currency thresholds preferences system' },
  { label: 'Dropdown Options', href: '/settings?tab=dropdowns', group: 'Settings', keywords: 'dropdown category form unit options' },
  { label: 'Form Fields', href: '/settings?tab=form-fields', group: 'Settings', keywords: 'form fields customize' },
  { label: 'Access Control', href: '/settings?tab=access-control', group: 'Settings', keywords: 'access control menu visibility per role' },
  { label: 'Change Password', href: '/settings?tab=security', group: 'Account', keywords: 'password security change' },
];

// Rank: label starts-with (best) > label word-boundary > label contains > keyword contains.
export function searchNav(query: string, limit = 6): NavItem[] {
  const q = query.trim().toLowerCase();
  if (q.length < 1) return [];
  const scored: Array<{ item: NavItem; score: number }> = [];
  for (const item of NAV_INDEX) {
    const label = item.label.toLowerCase();
    const kw = (item.keywords ?? '').toLowerCase();
    let score = 0;
    if (label === q) score = 100;
    else if (label.startsWith(q)) score = 80;
    else if (new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(label)) score = 60;
    else if (label.includes(q)) score = 40;
    else if (kw.includes(q)) score = 20;
    if (score > 0) scored.push({ item, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.item.label.length - b.item.label.length)
    .slice(0, limit).map((s) => s.item);
}

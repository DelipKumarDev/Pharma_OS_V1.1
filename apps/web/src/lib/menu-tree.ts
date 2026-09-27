// ─── Single source of truth for the app's navigation menu ───────────────────
// Both the sidebar (rendering + visibility filtering) and the Administration →
// Access Control section (per-role menu toggles) consume this tree, so a menu
// configured "off" for a role in Settings maps 1:1 to the leaf the sidebar hides.
//
// A leaf's `key` is its href — that same string is what we persist in
// tenant.menuAccess ({ role: { key: boolean } }) and what the backend returns in
// user.menuHidden. Keep keys stable; changing an href retires its saved config.

export interface MenuLeaf {
  label: string;
  href: string;
  /** lucide-react icon name (resolved to a component in the sidebar). */
  icon: string;
}

export interface MenuGroup {
  label: string;
  icon: string;
  items: MenuLeaf[];
}

// Standalone dashboard entry (not part of any group, never hideable).
export const MENU_DASHBOARD: MenuLeaf = { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' };

export const MENU_GROUPS: MenuGroup[] = [
  {
    label: 'Sales', icon: 'CreditCard', items: [
      { label: 'Billing', href: '/billing', icon: 'Receipt' },
      { label: 'Returns', href: '/returns', icon: 'RotateCcw' },
      { label: 'Prescriptions', href: '/prescriptions', icon: 'FileText' },
      { label: 'Credit Sales', href: '/credit-sales', icon: 'Wallet' },
      { label: 'Delivery Orders', href: '/delivery-orders', icon: 'PackageCheck' },
    ],
  },
  {
    label: 'Procurement', icon: 'Truck', items: [
      { label: 'Purchase Orders', href: '/purchase-orders', icon: 'Truck' },
      { label: 'Scan Supplier Invoice', href: '/scan', icon: 'ScanLine' },
      { label: 'Vendors', href: '/vendors', icon: 'Building2' },
      { label: 'Goods Receipt', href: '/goods-receipt', icon: 'ClipboardCheck' },
      { label: 'Purchase Returns', href: '/purchase-returns', icon: 'Undo2' },
    ],
  },
  {
    label: 'Inventory', icon: 'Package', items: [
      { label: 'Stock Management', href: '/stock', icon: 'Package' },
      { label: 'Medicine Catalog', href: '/medicines', icon: 'Pill' },
      { label: 'Batch Management', href: '/batch-management', icon: 'Boxes' },
      { label: 'Stock Adjustment', href: '/stock-adjustment', icon: 'SlidersHorizontal' },
      { label: 'Transfers', href: '/transfers', icon: 'ArrowLeftRight' },
      { label: 'Reorder Queue', href: '/reorder', icon: 'RefreshCw' },
      { label: 'Expiry Monitor', href: '/expiry', icon: 'CalendarX2' },
      { label: 'Stock Count', href: '/stock-count', icon: 'ClipboardList' },
    ],
  },
  {
    label: 'Customers', icon: 'Users', items: [
      { label: 'Customer Management', href: '/customers', icon: 'UserRound' },
      { label: 'Contacts', href: '/contacts', icon: 'Contact' },
      { label: 'Loyalty', href: '/loyalty', icon: 'Star' },
      { label: 'Credit Accounts', href: '/credit-accounts', icon: 'Wallet' },
      { label: 'Patient History', href: '/patient-history', icon: 'HeartPulse' },
    ],
  },
  {
    label: 'Compliance', icon: 'ShieldCheck', items: [
      { label: 'Schedule Register', href: '/schedule-register', icon: 'ShieldAlert' },
      { label: 'Controlled Drugs', href: '/controlled-drugs', icon: 'Lock' },
    ],
  },
  {
    label: 'Reports', icon: 'BarChart3', items: [
      { label: 'Sales', href: '/reports?tab=sales', icon: 'TrendingUp' },
      { label: 'Inventory', href: '/reports?tab=stock', icon: 'Package' },
      { label: 'Financial', href: '/reports?tab=profit', icon: 'IndianRupee' },
      { label: 'GST', href: '/reports?tab=gst', icon: 'Percent' },
      { label: 'Customer Insights', href: '/reports?tab=customers', icon: 'Users' },
      { label: 'Purchase', href: '/purchase-orders', icon: 'Truck' },
      { label: 'Expiry', href: '/expiry', icon: 'CalendarX2' },
    ],
  },
  {
    label: 'Administration', icon: 'Settings2', items: [
      { label: 'Users', href: '/users', icon: 'UserCog' },
      { label: 'Roles', href: '/roles', icon: 'Shield' },
      { label: 'Permissions', href: '/permissions', icon: 'KeyRound' },
      { label: 'Settings', href: '/settings', icon: 'Settings2' },
      { label: 'Notifications', href: '/notifications', icon: 'Bell' },
      { label: 'Help', href: '/help', icon: 'HelpCircle' },
      { label: 'Shortcuts', href: '/shortcuts', icon: 'Keyboard' },
    ],
  },
];

// Menu keys that must never be hidden (they'd lock a role out of the app / its
// own config). Access Control renders these as always-on and disabled.
export const ALWAYS_VISIBLE = new Set<string>(['/dashboard', '/settings']);

/** Flat list of every hideable leaf key, for validation/lookups. */
export function allMenuKeys(): string[] {
  return MENU_GROUPS.flatMap((g) => g.items.map((l) => l.href));
}

// Client-side mirror of the backend's computeMenuHidden (apps/api/src/utils/menu.ts),
// so the Access Control screen can patch the current user's menuHidden the moment
// a change is saved — no re-login needed. A key hides only if disabled for every
// one of the user's roles that has a configuration; ALWAYS_VISIBLE keys never hide.
export function computeMenuHidden(
  menuAccess: Record<string, Record<string, boolean>> | undefined,
  roles: string[],
): string[] {
  if (!menuAccess) return [];
  const perRole: Array<Set<string>> = [];
  for (const role of roles) {
    const map = menuAccess[role];
    if (!map || typeof map !== 'object') continue;
    perRole.push(new Set(Object.entries(map).filter(([, v]) => v === false).map(([k]) => k)));
  }
  if (perRole.length === 0) return [];
  let inter = perRole[0]!;
  for (const s of perRole.slice(1)) inter = new Set([...inter].filter((k) => s.has(k)));
  return [...inter].filter((k) => !ALWAYS_VISIBLE.has(k));
}

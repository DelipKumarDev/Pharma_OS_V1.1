// ─── Single source of truth for the app's navigation menu ───────────────────
// Both the sidebar (rendering + visibility filtering) and the Administration →
// Access Control section (per-role menu toggles) consume this tree, so a menu
// configured "off" for a role in Settings maps 1:1 to the leaf the sidebar hides.
//
// A leaf's `key` is its href — that same string is what we persist in
// tenant.menuAccess ({ role: { key: boolean } }) and what the backend returns in
// user.menuHidden. Keep keys stable; changing an href retires its saved config.
//
// `perm` is the RBAC permission (module:action) required to SEE the leaf. It must
// match the permission the API enforces on that module's list route, so the nav
// and the API agree. Leaves with no `perm` (dashboard, notifications, help,
// shortcuts) are visible to every authenticated user.

export interface MenuLeaf {
  label: string;
  href: string;
  /** lucide-react icon name (resolved to a component in the sidebar). */
  icon: string;
  /** RBAC permission required to see this leaf, e.g. "billing:view". */
  perm?: string;
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
      { label: 'Billing', href: '/billing', icon: 'Receipt', perm: 'billing:view' },
      { label: 'Returns', href: '/returns', icon: 'RotateCcw', perm: 'returns:view' },
      { label: 'Prescriptions', href: '/prescriptions', icon: 'FileText', perm: 'prescriptions:view' },
      { label: 'Credit Sales', href: '/credit-sales', icon: 'Wallet', perm: 'billing:view' },
      { label: 'Delivery Orders', href: '/delivery-orders', icon: 'PackageCheck', perm: 'billing:view' },
    ],
  },
  {
    label: 'Procurement', icon: 'Truck', items: [
      { label: 'Purchase Orders', href: '/purchase-orders', icon: 'Truck', perm: 'inventory:view' },
      { label: 'Scan Supplier Invoice', href: '/scan', icon: 'ScanLine', perm: 'inventory:view' },
      { label: 'Vendors', href: '/vendors', icon: 'Building2', perm: 'vendors:view' },
      { label: 'Goods Receipt', href: '/goods-receipt', icon: 'ClipboardCheck', perm: 'inventory:view' },
      { label: 'Purchase Returns', href: '/purchase-returns', icon: 'Undo2', perm: 'returns:view' },
    ],
  },
  {
    label: 'Inventory', icon: 'Package', items: [
      { label: 'Stock Management', href: '/stock', icon: 'Package', perm: 'inventory:view' },
      { label: 'Medicine Catalog', href: '/medicines', icon: 'Pill', perm: 'medicines:view' },
      { label: 'Batch Management', href: '/batch-management', icon: 'Boxes', perm: 'inventory:view' },
      { label: 'Stock Adjustment', href: '/stock-adjustment', icon: 'SlidersHorizontal', perm: 'inventory:view' },
      { label: 'Transfers', href: '/transfers', icon: 'ArrowLeftRight', perm: 'inventory:view' },
      { label: 'Reorder Queue', href: '/reorder', icon: 'RefreshCw', perm: 'inventory:view' },
      { label: 'Expiry Monitor', href: '/expiry', icon: 'CalendarX2', perm: 'inventory:view' },
      { label: 'Stock Count', href: '/stock-count', icon: 'ClipboardList', perm: 'inventory:view' },
    ],
  },
  {
    label: 'Customers', icon: 'Users', items: [
      { label: 'Customer Management', href: '/customers', icon: 'UserRound', perm: 'customers:view' },
      { label: 'Contacts', href: '/contacts', icon: 'Contact', perm: 'customers:view' },
      { label: 'Loyalty', href: '/loyalty', icon: 'Star', perm: 'customers:view' },
      { label: 'Credit Accounts', href: '/credit-accounts', icon: 'Wallet', perm: 'customers:view' },
      { label: 'Patient History', href: '/patient-history', icon: 'HeartPulse', perm: 'customers:view' },
    ],
  },
  {
    label: 'Compliance', icon: 'ShieldCheck', items: [
      { label: 'Schedule Register', href: '/schedule-register', icon: 'ShieldAlert', perm: 'reports:view' },
      { label: 'Controlled Drugs', href: '/controlled-drugs', icon: 'Lock', perm: 'reports:view' },
    ],
  },
  {
    label: 'Reports', icon: 'BarChart3', items: [
      { label: 'Sales', href: '/reports?tab=sales', icon: 'TrendingUp', perm: 'reports:view' },
      { label: 'Inventory', href: '/reports?tab=stock', icon: 'Package', perm: 'reports:view' },
      { label: 'Financial', href: '/reports?tab=profit', icon: 'IndianRupee', perm: 'reports:view' },
      { label: 'GST', href: '/reports?tab=gst', icon: 'Percent', perm: 'reports:view' },
      { label: 'Customer Insights', href: '/reports?tab=customers', icon: 'Users', perm: 'reports:view' },
      // These duplicate the Procurement/Inventory pages; keep the whole Reports
      // section gated on reports:view (the pages remain reachable via their own
      // groups for users with inventory:view). Route-guard perms come from the
      // canonical (first) mapping in Procurement/Inventory, not these.
      { label: 'Purchase', href: '/purchase-orders', icon: 'Truck', perm: 'reports:view' },
      { label: 'Expiry', href: '/expiry', icon: 'CalendarX2', perm: 'reports:view' },
    ],
  },
  {
    label: 'Administration', icon: 'Settings2', items: [
      { label: 'Users', href: '/users', icon: 'UserCog', perm: 'users:view' },
      { label: 'Roles', href: '/roles', icon: 'Shield', perm: 'users:view' },
      { label: 'Permissions', href: '/permissions', icon: 'KeyRound', perm: 'users:view' },
      { label: 'Settings', href: '/settings', icon: 'Settings2', perm: 'settings:view' },
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

// ─── RBAC permission helpers ─────────────────────────────────────────────────

/** True if the permission set satisfies `perm` (supports "*:*" and "module:*"). */
export function hasMenuPerm(permissions: string[] | undefined, perm: string | undefined): boolean {
  if (!perm) return true; // no requirement → always visible
  const set = permissions ?? [];
  if (set.includes('*:*') || set.includes(perm)) return true;
  const mod = perm.split(':')[0];
  return set.includes(`${mod}:*`);
}

// pathname (no query) → required permission, derived from the menu tree. Used by
// the route guard so typing a URL can't bypass the hidden nav.
const PERM_BY_PATH: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const g of MENU_GROUPS) {
    for (const l of g.items) {
      const path = l.href.split('?')[0]!;
      // First mapping wins; don't let a same-path alias (e.g. Reports→/expiry)
      // overwrite the canonical page's permission.
      if (l.perm && !(path in m)) m[path] = l.perm;
    }
  }
  return m;
})();

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

/** The permission required to view a route, or undefined if unrestricted.
 *  Falls back to the first path segment so nested pages (e.g. /billing/new)
 *  inherit their section's requirement. */
export function permForPath(pathname: string): string | undefined {
  if (PERM_BY_PATH[pathname]) return PERM_BY_PATH[pathname];
  const base = `/${pathname.split('/')[1] ?? ''}`;
  return PERM_BY_PATH[base];
}

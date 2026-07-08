'use client';

import React, { useState } from 'react';
import {
  LayoutDashboard, Receipt, FileText, Package, Users,
  BarChart3, Settings2, ChevronDown, Plus, Trash2, Check,
  Shield, ShieldCheck, Eye, Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─── Static definitions ───────────────────────────────────────────────────────

const MENU_ITEMS = [
  { id: 'dashboard',     label: 'Dashboard',      icon: LayoutDashboard, canDisable: false },
  { id: 'billing',       label: 'Billing',         icon: Receipt,         canDisable: true },
  { id: 'prescriptions', label: 'Prescriptions',   icon: FileText,        canDisable: true },
  { id: 'stock',         label: 'Stock',            icon: Package,         canDisable: true },
  { id: 'contacts',      label: 'Contacts',         icon: Users,           canDisable: true },
  { id: 'reports',       label: 'Reports',          icon: BarChart3,       canDisable: true },
  { id: 'settings',      label: 'Settings',         icon: Settings2,       canDisable: true },
] as const;

const MODULE_TABS = [
  {
    moduleId: 'reports',
    moduleName: 'Reports',
    icon: BarChart3,
    tabs: [
      { id: 'sales',       label: 'Sales Overview' },
      { id: 'gst',         label: 'GST & Compliance' },
      { id: 'stock',       label: 'Stock Intelligence' },
      { id: 'profit',      label: 'Profitability' },
      { id: 'customers',   label: 'Customers' },
      { id: 'daily-close', label: 'Daily Close' },
    ],
  },
  {
    moduleId: 'contacts',
    moduleName: 'Contacts',
    icon: Users,
    tabs: [
      { id: 'customers', label: 'Customers' },
      { id: 'vendors',   label: 'Vendors' },
      { id: 'refills',   label: 'Refill Reminders' },
    ],
  },
  {
    moduleId: 'billing',
    moduleName: 'Billing',
    icon: Receipt,
    tabs: [
      { id: 'pos',     label: 'POS / New Bill' },
      { id: 'history', label: 'Bill History' },
    ],
  },
  {
    moduleId: 'stock',
    moduleName: 'Stock',
    icon: Package,
    tabs: [
      { id: 'overview', label: 'Overview' },
      { id: 'expiry',   label: 'Expiry Tracking' },
      { id: 'reorder',  label: 'Reorder' },
    ],
  },
  {
    moduleId: 'settings',
    moduleName: 'Settings',
    icon: Settings2,
    tabs: [
      { id: 'profile',        label: 'Pharmacy Profile' },
      { id: 'tax',            label: 'Tax & Billing' },
      { id: 'import',         label: 'Import & Export' },
      { id: 'notifications',  label: 'Notifications' },
      { id: 'system',         label: 'System' },
      { id: 'form-fields',    label: 'Form Fields' },
      { id: 'access-control', label: 'Access Control' },
    ],
  },
] as const;

const DEFAULT_ROLES = ['Admin', 'Pharmacist', 'Cashier', 'Viewer'];

const ROLE_COLORS: Record<string, string> = {
  Admin:      'bg-rose-50 text-rose-700 border-rose-200',
  Pharmacist: 'bg-teal-50 text-teal-700 border-teal-200',
  Cashier:    'bg-amber-50 text-amber-700 border-amber-200',
  Viewer:     'bg-slate-50 text-slate-600 border-slate-200',
};
const CUSTOM_ROLE_COLOR = 'bg-purple-50 text-purple-700 border-purple-200';

// ─── Types ────────────────────────────────────────────────────────────────────

type AccessMap = Record<string, boolean>;   // itemId → enabled
type MenuConfig  = Record<string, AccessMap>;           // roleId → { menuItemId → bool }
type TabConfig   = Record<string, Record<string, Record<string, boolean>>>; // roleId → moduleId → tabId → bool

interface AccessConfig {
  roles: string[];
  menu: MenuConfig;
  tabs: TabConfig;
}

const STORAGE_KEY = 'pharmaos_access_config';

// ─── Persistence ──────────────────────────────────────────────────────────────

function defaultMenuFor(role: string): AccessMap {
  // Admin gets everything; Viewer can't touch Settings
  const deny = role === 'Viewer' ? ['settings'] : [];
  return Object.fromEntries(MENU_ITEMS.map((m) => [m.id, !deny.includes(m.id)]));
}

function defaultTabsFor(role: string): Record<string, Record<string, boolean>> {
  const result: Record<string, Record<string, boolean>> = {};
  MODULE_TABS.forEach((mod) => {
    result[mod.moduleId] = {};
    mod.tabs.forEach((t) => {
      // Cashier can't see reports finance tabs; Viewer can't see Daily Close
      let enabled = true;
      if (role === 'Cashier' && mod.moduleId === 'reports' && ['profit', 'daily-close'].includes(t.id)) enabled = false;
      if (role === 'Viewer' && t.id === 'daily-close') enabled = false;
      result[mod.moduleId]![t.id] = enabled;
    });
  });
  return result;
}

function buildDefault(): AccessConfig {
  const roles = [...DEFAULT_ROLES];
  const menu: MenuConfig = {};
  const tabs: TabConfig = {};
  roles.forEach((r) => { menu[r] = defaultMenuFor(r); tabs[r] = defaultTabsFor(r); });
  return { roles, menu, tabs };
}

function loadConfig(): AccessConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildDefault();
    return JSON.parse(raw) as AccessConfig;
  } catch {
    return buildDefault();
  }
}

function persistConfig(cfg: AccessConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

// ─── Compact toggle ───────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors',
        checked ? 'bg-primary' : 'bg-muted-foreground/30',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      <span className={cn(
        'pointer-events-none absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
        checked ? 'translate-x-4' : 'translate-x-0.5'
      )} />
    </button>
  );
}

// ─── Main section ─────────────────────────────────────────────────────────────

export function AccessControlSection() {
  const [config, setConfig] = useState<AccessConfig>(() => loadConfig());
  const [activeRole, setActiveRole] = useState(config.roles[0] ?? 'Admin');
  const [openModules, setOpenModules] = useState<Set<string>>(new Set(['reports']));
  const [newRole, setNewRole] = useState('');
  const [addingRole, setAddingRole] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  function patch(updater: (c: AccessConfig) => AccessConfig) {
    setConfig((prev) => { const next = updater(prev); return next; });
    setHasChanges(true);
  }

  // Menu toggles
  function toggleMenu(menuItemId: string) {
    patch((c) => ({
      ...c,
      menu: {
        ...c.menu,
        [activeRole]: {
          ...(c.menu[activeRole] ?? {}),
          [menuItemId]: !(c.menu[activeRole]?.[menuItemId] ?? true),
        },
      },
    }));
  }

  // Tab toggles
  function toggleTab(moduleId: string, tabId: string) {
    patch((c) => ({
      ...c,
      tabs: {
        ...c.tabs,
        [activeRole]: {
          ...(c.tabs[activeRole] ?? {}),
          [moduleId]: {
            ...(c.tabs[activeRole]?.[moduleId] ?? {}),
            [tabId]: !(c.tabs[activeRole]?.[moduleId]?.[tabId] ?? true),
          },
        },
      },
    }));
  }

  function menuEnabled(menuItemId: string) {
    return config.menu[activeRole]?.[menuItemId] ?? true;
  }

  function tabEnabled(moduleId: string, tabId: string) {
    return config.tabs[activeRole]?.[moduleId]?.[tabId] ?? true;
  }

  // Toggle module accordion
  function toggleModule(moduleId: string) {
    setOpenModules((prev) => {
      const next = new Set(prev);
      next.has(moduleId) ? next.delete(moduleId) : next.add(moduleId);
      return next;
    });
  }

  // Add custom role
  function addRole() {
    const name = newRole.trim();
    if (!name) { toast.error('Enter a role name'); return; }
    if (config.roles.includes(name)) { toast.error('Role already exists'); return; }
    patch((c) => ({
      ...c,
      roles: [...c.roles, name],
      menu: { ...c.menu, [name]: defaultMenuFor(name) },
      tabs: { ...c.tabs, [name]: defaultTabsFor(name) },
    }));
    setActiveRole(name);
    setNewRole('');
    setAddingRole(false);
    toast.success(`Role "${name}" created`);
  }

  // Delete custom role
  function deleteRole(role: string) {
    if (DEFAULT_ROLES.includes(role)) { toast.error('Cannot delete a system role'); return; }
    patch((c) => {
      const roles = c.roles.filter((r) => r !== role);
      const menu = { ...c.menu }; delete menu[role];
      const tabs = { ...c.tabs }; delete tabs[role];
      return { ...c, roles, menu, tabs };
    });
    if (activeRole === role) setActiveRole(config.roles.find((r) => r !== role) ?? 'Admin');
    toast.success(`Role "${role}" deleted`);
  }

  // Enable/disable all menu items
  function setAllMenu(enabled: boolean) {
    patch((c) => ({
      ...c,
      menu: {
        ...c.menu,
        [activeRole]: Object.fromEntries(MENU_ITEMS.map((m) => [m.id, m.canDisable ? enabled : true])),
      },
    }));
  }

  // Enable/disable all tabs in a module
  function setAllTabs(moduleId: string, enabled: boolean) {
    const mod = MODULE_TABS.find((m) => m.moduleId === moduleId);
    if (!mod) return;
    patch((c) => ({
      ...c,
      tabs: {
        ...c.tabs,
        [activeRole]: {
          ...(c.tabs[activeRole] ?? {}),
          [moduleId]: Object.fromEntries(mod.tabs.map((t) => [t.id, enabled])),
        },
      },
    }));
  }

  async function save() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 350));
    persistConfig(config);
    setSaving(false);
    setHasChanges(false);
    toast.success('Access control saved');
  }

  const isDefaultRole = DEFAULT_ROLES.includes(activeRole);
  const menuOnCount = MENU_ITEMS.filter((m) => menuEnabled(m.id)).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold">Access Control</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Control which menu items and tabs each role can see
          </p>
        </div>
        {hasChanges && (
          <Button onClick={save} disabled={saving} size="sm">
            {saving
              ? <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              : <Check className="h-3.5 w-3.5" />
            }
            Save Changes
          </Button>
        )}
      </div>

      {/* Role selector strip */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {config.roles.map((role) => {
          const isActive = activeRole === role;
          const isSystem = DEFAULT_ROLES.includes(role);
          const colorCls = ROLE_COLORS[role] ?? CUSTOM_ROLE_COLOR;
          return (
            <div key={role} className="relative flex items-center gap-1">
              <button
                onClick={() => setActiveRole(role)}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all',
                  isActive
                    ? cn(colorCls, 'shadow-sm ring-2 ring-offset-1', role === 'Admin' ? 'ring-rose-300' : role === 'Pharmacist' ? 'ring-teal-300' : role === 'Cashier' ? 'ring-amber-300' : role === 'Viewer' ? 'ring-slate-300' : 'ring-purple-300')
                    : 'border-border bg-background text-muted-foreground hover:bg-muted'
                )}
              >
                {isSystem ? <ShieldCheck className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                {role}
              </button>
              {!isSystem && isActive && (
                <button
                  onClick={() => deleteRole(role)}
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Delete role"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}

        {/* Add role */}
        {addingRole ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addRole(); if (e.key === 'Escape') { setAddingRole(false); setNewRole(''); } }}
              placeholder="Role name"
              className="h-8 w-32 rounded-xl border border-primary/50 bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button onClick={addRole} className="text-success p-1.5 rounded-lg hover:bg-success/10 transition-colors">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => { setAddingRole(false); setNewRole(''); }} className="text-muted-foreground p-1.5 rounded-lg hover:bg-muted transition-colors">
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAddingRole(true)}
            className="flex items-center gap-1 rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add Role
          </button>
        )}
      </div>

      {/* Role notice for system roles */}
      {isDefaultRole && activeRole !== 'Admin' && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          System role — changes apply immediately upon save. Admin always has full access and cannot be restricted.
        </div>
      )}
      {activeRole === 'Admin' && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-xs text-primary">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          Admin has unrestricted access to everything. Toggles are shown for reference only.
        </div>
      )}

      <div className="grid grid-cols-[1fr_1.2fr] gap-5 items-start">

        {/* ── Left: Sidebar menu access ───────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Sidebar Menu</p>
              <p className="text-xs text-muted-foreground">{menuOnCount} of {MENU_ITEMS.length} visible</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setAllMenu(true)}
                className="text-[11px] font-medium text-primary hover:underline underline-offset-2"
              >
                All on
              </button>
              <span className="text-muted-foreground text-xs">·</span>
              <button
                onClick={() => setAllMenu(false)}
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground hover:underline underline-offset-2"
              >
                All off
              </button>
            </div>
          </div>

          <div className="divide-y divide-border">
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              const on = menuEnabled(item.id);
              const locked = !item.canDisable || activeRole === 'Admin';
              return (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 transition-colors',
                    !on && 'bg-muted/20',
                    locked && 'opacity-60'
                  )}
                >
                  <div className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
                    on ? 'bg-primary/10 border-primary/20' : 'bg-muted border-border'
                  )}>
                    <Icon className={cn('h-4 w-4', on ? 'text-primary' : 'text-muted-foreground')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium', !on && 'text-muted-foreground line-through')}>{item.label}</p>
                    {!item.canDisable && (
                      <p className="text-[10px] text-muted-foreground">Always visible</p>
                    )}
                  </div>
                  <Toggle
                    checked={on}
                    onChange={() => !locked && toggleMenu(item.id)}
                    disabled={locked}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right: Module tab access ────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border bg-muted/30 px-4 py-3">
            <p className="text-sm font-semibold">Module Tabs</p>
            <p className="text-xs text-muted-foreground">Show or hide individual tabs within each module</p>
          </div>

          <div className="divide-y divide-border">
            {MODULE_TABS.map((mod) => {
              const ModIcon = mod.icon;
              const isOpen = openModules.has(mod.moduleId);
              const enabledTabs = mod.tabs.filter((t) => tabEnabled(mod.moduleId, t.id)).length;
              const locked = activeRole === 'Admin';

              return (
                <div key={mod.moduleId}>
                  {/* Module row — div wrapper avoids nested-button violation */}
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => toggleModule(mod.moduleId)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && toggleModule(mod.moduleId)}
                  >
                    <ModIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium flex-1">{mod.moduleName}</span>
                    <span className="text-[11px] text-muted-foreground mr-2">
                      {enabledTabs}/{mod.tabs.length} tabs
                    </span>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setAllTabs(mod.moduleId, true)}
                        className="text-[10px] text-primary hover:underline"
                        title="Enable all tabs"
                      >all</button>
                      <span className="text-muted-foreground text-[10px]">/</span>
                      <button
                        onClick={() => setAllTabs(mod.moduleId, false)}
                        className="text-[10px] text-muted-foreground hover:text-foreground hover:underline"
                        title="Disable all tabs"
                      >none</button>
                    </div>
                    <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
                  </div>

                  {/* Tab list */}
                  {isOpen && (
                    <div className="border-t border-dashed border-border bg-muted/10">
                      {mod.tabs.map((tab) => {
                        const on = tabEnabled(mod.moduleId, tab.id);
                        return (
                          <div
                            key={tab.id}
                            className={cn(
                              'flex items-center gap-3 pl-10 pr-4 py-2.5 border-b border-dashed border-border/50 last:border-0',
                              !on && 'bg-muted/20'
                            )}
                          >
                            <div className={cn(
                              'h-1.5 w-1.5 rounded-full shrink-0',
                              on ? 'bg-success' : 'bg-muted-foreground/30'
                            )} />
                            <span className={cn('text-xs font-medium flex-1', !on && 'text-muted-foreground line-through')}>
                              {tab.label}
                            </span>
                            {on ? (
                              <Eye className="h-3 w-3 text-success/60 mr-2 shrink-0" />
                            ) : (
                              <Eye className="h-3 w-3 text-muted-foreground/20 mr-2 shrink-0" />
                            )}
                            <Toggle
                              checked={on}
                              onChange={() => !locked && toggleTab(mod.moduleId, tab.id)}
                              disabled={locked}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Summary table */}
      <div className="mt-5 rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border bg-muted/30 px-4 py-2.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role Summary</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Role</th>
                {MENU_ITEMS.map((m) => (
                  <th key={m.id} className="px-2 py-2 text-center font-semibold text-muted-foreground whitespace-nowrap">
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {config.roles.map((role) => (
                <tr
                  key={role}
                  className={cn('hover:bg-muted/20 transition-colors cursor-pointer', activeRole === role && 'bg-primary/5')}
                  onClick={() => setActiveRole(role)}
                >
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-semibold',
                        ROLE_COLORS[role] ?? CUSTOM_ROLE_COLOR
                      )}>
                        {DEFAULT_ROLES.includes(role) ? <ShieldCheck className="h-2.5 w-2.5" /> : <Shield className="h-2.5 w-2.5" />}
                        {role}
                      </span>
                    </div>
                  </td>
                  {MENU_ITEMS.map((m) => {
                    const on = config.menu[role]?.[m.id] ?? true;
                    return (
                      <td key={m.id} className="px-2 py-2 text-center">
                        {on
                          ? <Check className="h-3.5 w-3.5 text-success mx-auto" />
                          : <span className="text-muted-foreground/30 text-lg leading-none">—</span>
                        }
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

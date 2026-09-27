'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown, Check, Shield, ShieldCheck, Lock, Loader2, LayoutDashboard,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import {
  MENU_GROUPS, MENU_DASHBOARD, ALWAYS_VISIBLE, computeMenuHidden,
} from '@/lib/menu-tree';

// menuAccess shape persisted on the tenant: { [roleName]: { [menuKey]: boolean } }
type MenuAccess = Record<string, Record<string, boolean>>;

interface Role { id: string; name: string; isSystem: boolean; }

async function fetchRoles(): Promise<Role[]> {
  const res = await apiFetch('/api/roles');
  const json = await res.json() as { success: boolean; data?: { data?: Role[] } };
  if (!res.ok) throw new Error('Failed to load roles');
  return json.data?.data ?? [];
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors',
        checked ? 'bg-primary' : 'bg-muted-foreground/30',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      <span className={cn(
        'pointer-events-none absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
        checked ? 'translate-x-4' : 'translate-x-0.5',
      )} />
    </button>
  );
}

// ─── Main section ─────────────────────────────────────────────────────────────

export function AccessControlSection({
  menuAccess,
  onSave,
}: {
  menuAccess?: MenuAccess;
  onSave: (section: string, payload: Record<string, unknown>) => Promise<unknown>;
}) {
  const { data: roles, isLoading } = useQuery({ queryKey: ['roles'], queryFn: fetchRoles });
  const user = useAuthStore((s) => s.user);
  const patchUser = useAuthStore((s) => s.patchUser);

  const [config, setConfig] = useState<MenuAccess>(() => structuredClone(menuAccess ?? {}));
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(MENU_GROUPS.map((g) => g.label)));
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Default the active role to the first one once roles load.
  const currentRole = activeRole ?? roles?.[0]?.name ?? null;

  function isEnabled(role: string, key: string): boolean {
    if (ALWAYS_VISIBLE.has(key)) return true;
    return config[role]?.[key] ?? true; // default visible
  }

  function toggle(role: string, key: string) {
    if (ALWAYS_VISIBLE.has(key)) return;
    setConfig((prev) => {
      const next = structuredClone(prev);
      const roleMap = next[role] ?? {};
      roleMap[key] = !(roleMap[key] ?? true);
      next[role] = roleMap;
      return next;
    });
    setHasChanges(true);
  }

  function setGroup(role: string, keys: string[], enabled: boolean) {
    setConfig((prev) => {
      const next = structuredClone(prev);
      const roleMap = next[role] ?? {};
      for (const k of keys) if (!ALWAYS_VISIBLE.has(k)) roleMap[k] = enabled;
      next[role] = roleMap;
      return next;
    });
    setHasChanges(true);
  }

  function toggleGroupOpen(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      await onSave('menu-access', { values: config });
      // Reflect immediately for the signed-in user without a re-login.
      if (user?.roles) patchUser({ menuHidden: computeMenuHidden(config, user.roles) });
      setHasChanges(false);
      toast.success('Menu access saved — the sidebar updates instantly');
    } catch {
      toast.error('Could not save menu access');
    } finally {
      setSaving(false);
    }
  }

  const hiddenCount = useMemo(() => {
    if (!currentRole) return 0;
    return MENU_GROUPS.reduce(
      (n, g) => n + g.items.filter((l) => !isEnabled(currentRole, l.href)).length,
      0,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRole, config]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading roles…
      </div>
    );
  }

  if (!roles || roles.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-muted/20 px-6 py-10 text-center">
        <Shield className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm font-medium">No roles found</p>
        <p className="text-xs text-muted-foreground mt-1">
          Create roles under Administration → Roles first, then configure their menu access here.
        </p>
      </div>
    );
  }

  const totalLeaves = MENU_GROUPS.reduce((n, g) => n + g.items.length, 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold">Menu Access</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Choose which sidebar menus each role can see. Changes save to the database and apply on next load for affected users.
          </p>
        </div>
        <Button onClick={save} disabled={!hasChanges || saving} size="sm">
          {saving
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Check className="h-3.5 w-3.5" />}
          Save Changes
        </Button>
      </div>

      {/* Role selector */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {roles.map((role) => {
          const isActive = currentRole === role.name;
          return (
            <button
              key={role.id}
              onClick={() => setActiveRole(role.name)}
              className={cn(
                'flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all',
                isActive
                  ? 'border-primary/40 bg-primary/10 text-primary shadow-sm ring-2 ring-primary/20 ring-offset-1'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted',
              )}
            >
              {role.isSystem ? <ShieldCheck className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
              {role.name}
            </button>
          );
        })}
      </div>

      {currentRole && (
        <>
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            <span>
              <b className="text-foreground">{currentRole}</b> — {totalLeaves - hiddenCount} of {totalLeaves} menus visible
              {hiddenCount > 0 && <> · {hiddenCount} hidden</>}. Dashboard and Settings are always visible.
            </span>
          </div>

          {/* Dashboard (always on) */}
          <div className="rounded-xl border border-border bg-card overflow-hidden mb-3">
            <div className="flex items-center gap-3 px-4 py-3 opacity-70">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-primary/10 border-primary/20">
                <LayoutDashboard className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{MENU_DASHBOARD.label}</p>
                <p className="text-[10px] text-muted-foreground">Always visible</p>
              </div>
              <Toggle checked disabled onChange={() => {}} />
            </div>
          </div>

          {/* Groups */}
          <div className="space-y-3">
            {MENU_GROUPS.map((group) => {
              const isOpen = openGroups.has(group.label);
              const keys = group.items.map((l) => l.href);
              const onCount = group.items.filter((l) => isEnabled(currentRole, l.href)).length;
              return (
                <div key={group.label} className="rounded-xl border border-border bg-card overflow-hidden">
                  <div
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => toggleGroupOpen(group.label)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && toggleGroupOpen(group.label)}
                  >
                    <span className="text-sm font-semibold flex-1">{group.label}</span>
                    <span className="text-[11px] text-muted-foreground mr-1">{onCount}/{group.items.length}</span>
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => setGroup(currentRole, keys, true)} className="text-[10px] text-primary hover:underline">all</button>
                      <span className="text-muted-foreground text-[10px]">/</span>
                      <button onClick={() => setGroup(currentRole, keys, false)} className="text-[10px] text-muted-foreground hover:text-foreground hover:underline">none</button>
                    </div>
                    <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
                  </div>

                  {isOpen && (
                    <div className="border-t border-dashed border-border divide-y divide-border/60">
                      {group.items.map((leaf) => {
                        const on = isEnabled(currentRole, leaf.href);
                        const locked = ALWAYS_VISIBLE.has(leaf.href);
                        return (
                          <div key={leaf.href} className={cn('flex items-center gap-3 pl-6 pr-4 py-2.5', !on && 'bg-muted/20')}>
                            <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', on ? 'bg-success' : 'bg-muted-foreground/30')} />
                            <span className={cn('text-sm font-medium flex-1', !on && 'text-muted-foreground line-through')}>
                              {leaf.label}
                            </span>
                            {locked && <span className="text-[10px] text-muted-foreground mr-1">always on</span>}
                            <Toggle checked={on} disabled={locked} onChange={() => toggle(currentRole, leaf.href)} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

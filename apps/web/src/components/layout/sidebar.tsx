'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard, CreditCard, Truck, Package, Users, ShieldCheck, BarChart3,
  Settings2, ChevronLeft, ChevronRight, ChevronDown, LogOut, HelpCircle, Pill,
  Receipt, Zap, RotateCcw, FileText, Wallet, PackageCheck, ScanLine, Building2,
  ClipboardCheck, Undo2, Boxes, SlidersHorizontal, ArrowLeftRight, RefreshCw,
  CalendarX2, ClipboardList, UserRound, Contact, Star, HeartPulse, ShieldAlert,
  Lock, TrendingUp, IndianRupee, Percent, UserCog, Shield, KeyRound,
  Bell, Keyboard, ChevronsUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSidebarStore } from '@/store/sidebar-store';
import { useAuthStore } from '@/store/auth-store';
import { getInitials } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { MENU_GROUPS, MENU_DASHBOARD, hasMenuPerm } from '@/lib/menu-tree';

/* ── Pharma Ist brand mark (swap public/logo-mark.png for the official asset) ── */
function BrandMark({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo-mark.png" alt="Pharma Ist" className={className ?? 'h-full w-full'} />;
}

interface Leaf { label: string; href: string; icon: React.ElementType; perm?: string; }
interface Group { label: string; icon: React.ElementType; items: Leaf[]; }

// Resolve the shared menu-tree's string icon names to lucide components, so the
// sidebar and Access Control (Settings) stay in lock-step off one definition.
const ICONS: Record<string, React.ElementType> = {
  LayoutDashboard, CreditCard, Truck, Package, Users, ShieldCheck, BarChart3,
  Settings2, HelpCircle, Pill, Receipt, Zap, RotateCcw, FileText, Wallet,
  PackageCheck, ScanLine, Building2, ClipboardCheck, Undo2, Boxes,
  SlidersHorizontal, ArrowLeftRight, RefreshCw, CalendarX2, ClipboardList,
  UserRound, Contact, Star, HeartPulse, ShieldAlert, Lock, TrendingUp,
  IndianRupee, Percent, UserCog, Shield, KeyRound, Bell, Keyboard,
};
const icon = (name: string): React.ElementType => ICONS[name] ?? Package;

// Standalone (no group)
const DASHBOARD: Leaf = { label: MENU_DASHBOARD.label, href: MENU_DASHBOARD.href, icon: icon(MENU_DASHBOARD.icon) };

const GROUPS: Group[] = MENU_GROUPS.map((g) => ({
  label: g.label,
  icon: icon(g.icon),
  items: g.items.map((l) => ({ label: l.label, href: l.href, icon: icon(l.icon), perm: l.perm })),
}));

// Match a leaf to the current route. For leaves that carry a ?tab= (e.g. the
// Reports submenu) the tab must also match, so only the selected one highlights.
function isLeafActive(href: string, pathname: string, currentTab: string | null): boolean {
  const [path, query] = href.split('?');
  if (pathname !== path && !pathname.startsWith(`${path}/`)) return false;
  const leafTab = query ? new URLSearchParams(query).get('tab') : null;
  if (leafTab) return currentTab === leafTab || (leafTab === 'sales' && !currentTab && pathname === '/reports');
  return true;
}
function groupHasActive(g: Group, pathname: string, currentTab: string | null): boolean {
  return g.items.some((l) => isLeafActive(l.href, pathname, currentTab));
}

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab');
  const router = useRouter();
  const { collapsed, toggle } = useSidebarStore();
  const { user, tokens, clearAuth } = useAuthStore();
  const queryClient = useQueryClient();

  // Two independent visibility filters:
  //  1. RBAC — hide any leaf whose required permission the user lacks (the user's
  //     permissions come from their roles, resolved server-side into user.permissions).
  //  2. Admin Access-Control — hide leaves an admin turned off per-role (user.menuHidden).
  // A group with no remaining leaves disappears entirely.
  const menuHidden = user?.menuHidden;
  const permissions = user?.permissions;
  const groups = React.useMemo(() => {
    const hidden = new Set(menuHidden ?? []);
    return GROUPS
      .map((g) => ({ ...g, items: g.items.filter((l) => hasMenuPerm(permissions, l.perm) && !hidden.has(l.href)) }))
      .filter((g) => g.items.length > 0);
  }, [menuHidden, permissions]);

  // Accordion: at most one group open at a time. Auto-open the group that
  // contains the active route (collapsing any other) when the route changes.
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  React.useEffect(() => {
    const active = groups.find((g) => groupHasActive(g, pathname, currentTab));
    if (active) setOpen((prev) => (prev[active.label] ? prev : { [active.label]: true }));
  }, [pathname, currentTab, groups]);

  // Opening a group collapses all others; clicking the open one closes it.
  function toggleGroup(label: string) { setOpen((p) => (p[label] ? {} : { [label]: true })); }

  async function handleSignOut() {
    try {
      if (tokens?.accessToken && tokens?.refreshToken) {
        await apiFetch('/api/auth/logout', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        });
      }
    } finally {
      clearAuth(); queryClient.clear(); router.push('/login');
    }
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'fixed left-0 top-0 z-[var(--z-sidebar)] flex h-screen flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300',
          collapsed ? 'w-[var(--sidebar-collapsed-width)]' : 'w-[var(--sidebar-width)]'
        )}
      >
        {/* ── Logo / Brand ── */}
        <div className={cn(
          'shrink-0 border-b border-sidebar-border',
          collapsed ? 'flex h-[var(--header-height)] items-center justify-center px-2' : 'flex flex-col gap-2 px-4 py-3.5'
        )}>
          {collapsed ? (
            <Link href="/dashboard" className="flex items-center justify-center">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black p-1">
                <BrandMark className="h-full w-full object-contain" />
              </span>
            </Link>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                {/* Wordmark with the mark (on its own black tile) between "Pharma" and "Ist" */}
                <Link href="/dashboard" className="flex items-center gap-1 min-w-0">
                  <span className="text-[22px] font-extrabold tracking-tight text-white leading-none">Pharma</span>
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-black p-1">
                    <BrandMark className="h-full w-full object-contain" />
                  </span>
                  <span className="text-[22px] font-extrabold tracking-tight text-white leading-none">Ist</span>
                </Link>
                <button onClick={toggle}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/35 transition-all hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  aria-label="Collapse sidebar">
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
              {/* Tagline — its own full-width row so it's never truncated */}
              <p className="whitespace-nowrap text-[11px] leading-tight text-sidebar-foreground/55">
                Smarter Pharmacy. <span className="font-semibold text-sky-400">First</span> with You.
              </p>
            </>
          )}
        </div>

        {collapsed && (
          <button onClick={toggle}
            className="absolute -right-3 top-[76px] flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground z-10"
            aria-label="Expand sidebar">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}

        {/* ── Navigation ── */}
        <ScrollArea className="flex-1">
          <nav className="space-y-0.5 px-2 py-3">
            {/* Dashboard (standalone) */}
            <LeafLink leaf={DASHBOARD} pathname={pathname} currentTab={currentTab} collapsed={collapsed} />

            {groups.map((g) => {
              const activeInGroup = groupHasActive(g, pathname, currentTab);
              const isOpen = collapsed ? false : (open[g.label] ?? false);
              const GIcon = g.icon;

              if (collapsed) {
                // Collapsed: group icon → expand sidebar + open group. Tooltip lists items.
                return (
                  <Tooltip key={g.label}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => { toggle(); setOpen((p) => ({ ...p, [g.label]: true })); }}
                        className={cn(
                          'group flex w-full items-center justify-center rounded-xl px-2 py-2 transition-all',
                          activeInGroup ? 'bg-sidebar-primary/18 text-sidebar-primary' : 'text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                        )}
                        aria-label={g.label}
                      >
                        <GIcon className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-52">
                      <p className="font-semibold mb-1">{g.label}</p>
                      <ul className="space-y-0.5 text-xs text-muted-foreground">
                        {g.items.map((l) => <li key={l.href}>{l.label}</li>)}
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return (
                <div key={g.label} className="pt-1">
                  <button
                    onClick={() => toggleGroup(g.label)}
                    className={cn(
                      'group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-all',
                      activeInGroup ? 'text-sidebar-primary' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                    )}
                    aria-expanded={isOpen}
                  >
                    <GIcon className={cn('h-4 w-4 shrink-0', activeInGroup ? 'text-sidebar-primary' : 'text-sidebar-foreground/45 group-hover:text-sidebar-foreground/75')} />
                    <span className="flex-1 text-left truncate">{g.label}</span>
                    <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-sidebar-foreground/40 transition-transform', isOpen && 'rotate-180')} />
                  </button>

                  {/* Submenu */}
                  {isOpen && (
                    <div className="mt-0.5 space-y-0.5 border-l border-sidebar-border/60 ml-4 pl-1.5">
                      {g.items.map((leaf) => <LeafLink key={leaf.href} leaf={leaf} pathname={pathname} currentTab={currentTab} collapsed={false} submenu />)}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </ScrollArea>

        {/* ── Bottom: account (profile/preferences live in the header avatar menu) ── */}
        <div className="shrink-0 border-t border-sidebar-border p-2 space-y-0.5">
          <button
            onClick={handleSignOut}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-sidebar-foreground/55 transition-all hover:bg-sidebar-accent hover:text-sidebar-foreground',
              collapsed && 'justify-center px-2'
            )}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>

          {!collapsed && user && (
            <div className="mt-1 flex items-center gap-2.5 rounded-xl bg-sidebar-accent/40 px-3 py-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-bold text-white">
                {getInitials(user.name ?? 'U')}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-sidebar-foreground truncate">{user.name ?? 'User'}</p>
                <p className="text-[10px] text-sidebar-foreground/45 truncate capitalize">{(user.roles?.[0] ?? 'Staff').replace(/_/g, ' ')}</p>
              </div>
              <ChevronsUpDown className="h-3.5 w-3.5 text-sidebar-foreground/30 shrink-0" />
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}

function LeafLink({ leaf, pathname, currentTab, collapsed, submenu }: { leaf: Leaf; pathname: string; currentTab: string | null; collapsed: boolean; submenu?: boolean }) {
  const active = isLeafActive(leaf.href, pathname, currentTab);
  const Icon = leaf.icon;

  const content = (
    <Link
      href={leaf.href}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150',
        active ? 'bg-sidebar-primary/18 text-sidebar-primary' : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground',
        collapsed && 'justify-center px-2',
        submenu && 'py-1.5'
      )}
    >
      {active && !submenu && (
        <span className="absolute left-0 top-1/2 h-[22px] w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary shadow-[0_0_8px_hsl(162_65%_52%/0.7)]" />
      )}
      <Icon className={cn('h-4 w-4 shrink-0 transition-colors', active ? 'text-sidebar-primary' : 'text-sidebar-foreground/40 group-hover:text-sidebar-foreground/75', submenu && 'h-3.5 w-3.5')} />
      {!collapsed && <span className="flex-1 truncate text-sm">{leaf.label}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right"><span className="font-medium">{leaf.label}</span></TooltipContent>
      </Tooltip>
    );
  }
  return content;
}

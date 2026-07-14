'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Package, Receipt, FileText, Users, BarChart3,
  Settings2, ChevronLeft, ChevronRight, LogOut, HelpCircle, Zap, Pill,
  RotateCcw, RefreshCw, CalendarX2, UserCog, Shield, ClipboardList, ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useSidebarStore } from '@/store/sidebar-store';
import { useAuthStore } from '@/store/auth-store';
import { getInitials } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

/* ── Pharmacy cross + leaf logo ── */
function PharmacyLogoIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      <rect x="15.5" y="5" width="9" height="30" rx="3.5" fill="white" opacity="0.95" />
      <rect x="5" y="15.5" width="30" height="9" rx="3.5" fill="white" opacity="0.95" />
      <path d="M24.5 5 C32 8 34 20 27 22 C25 16 23 9 24.5 5Z" fill="#f59e0b" opacity="0.9" />
      <path d="M30 27 C35 25 36 33 30 33 C30 30 29 27 30 27Z" fill="#f59e0b" opacity="0.6" />
      <circle cx="20" cy="20" r="3" fill="white" opacity="0.55" />
    </svg>
  );
}

/* ── Saffron gold mandala ── */
function MandalaSVG() {
  const outer = [0, 45, 90, 135, 180, 225, 270, 315];
  const inner = [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5];
  const mid   = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  return (
    <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"
      className="h-36 w-36" style={{ color: '#f59e0b' }}>
      <g transform="translate(60,60)">
        {outer.map(a => (
          <ellipse key={`o${a}`} transform={`rotate(${a})`} cx="0" cy="-38"
            rx="6.5" ry="17" fill="currentColor" opacity="0.25" />
        ))}
        {inner.map(a => (
          <ellipse key={`i${a}`} transform={`rotate(${a})`} cx="0" cy="-24"
            rx="4" ry="11" fill="currentColor" opacity="0.18" />
        ))}
        {mid.map(a => (
          <ellipse key={`m${a}`} transform={`rotate(${a})`} cx="0" cy="-14"
            rx="2.5" ry="7" fill="currentColor" opacity="0.14" />
        ))}
        <circle cx="0" cy="0" r="8" fill="currentColor" opacity="0.28" />
        <circle cx="0" cy="0" r="4" fill="currentColor" opacity="0.35" />
        <circle cx="0" cy="0" r="16" fill="none" stroke="currentColor" strokeWidth="0.7"
          strokeDasharray="3 3" opacity="0.22" />
        <circle cx="0" cy="0" r="28" fill="none" stroke="currentColor" strokeWidth="0.5"
          opacity="0.14" />
        <circle cx="0" cy="0" r="48" fill="none" stroke="currentColor" strokeWidth="0.4"
          opacity="0.1" />
        {outer.map(a => {
          const r = (a * Math.PI) / 180;
          return (
            <circle key={`d${a}`} cx={48 * Math.sin(r)} cy={-48 * Math.cos(r)}
              r="2" fill="currentColor" opacity="0.3" />
          );
        })}
        <circle cx="0" cy="0" r="56" fill="none" stroke="currentColor" strokeWidth="0.25"
          opacity="0.07" />
      </g>
    </svg>
  );
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string | number;
  badgeVariant?: 'default' | 'destructive' | 'warning' | 'success' | 'muted';
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',         href: '/dashboard',    icon: LayoutDashboard },
  { label: 'Billing',           href: '/billing',      icon: Receipt },
  { label: 'Returns',           href: '/returns',      icon: RotateCcw },
  { label: 'Prescriptions',     href: '/prescriptions', icon: FileText },
  { label: 'Stock & Inventory', href: '/stock',        icon: Package },
  { label: 'Medicine Master',   href: '/medicines',    icon: Pill },
  { label: 'Reorder Queue',     href: '/reorder',      icon: RefreshCw },
  { label: 'Expiry Monitor',    href: '/expiry',       icon: CalendarX2 },
  { label: 'Schedule Register', href: '/schedule-register', icon: ShieldAlert },
  { label: 'Contacts',          href: '/contacts',     icon: Users },
  { label: 'Reports',           href: '/reports',      icon: BarChart3 },
  { label: 'Settings',          href: '/settings',     icon: Settings2 },
];

const ADMIN_ITEMS: NavItem[] = [
  { label: 'Users',     href: '/users',  icon: UserCog },
  { label: 'Roles',     href: '/roles',  icon: Shield },
  { label: 'Audit Log', href: '/audit',  icon: ClipboardList },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed, toggle } = useSidebarStore();
  const { user, tokens, clearAuth } = useAuthStore();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    try {
      if (tokens?.accessToken && tokens?.refreshToken) {
        await apiFetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        });
      }
    } finally {
      clearAuth();
      queryClient.clear();
      router.push('/login');
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
          'flex h-[var(--header-height)] shrink-0 items-center border-b border-sidebar-border',
          collapsed ? 'justify-center px-3' : 'justify-between px-4'
        )}>
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary shadow-[0_2px_16px_hsl(162_65%_52%/0.4)]">
                <PharmacyLogoIcon />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold tracking-tight text-white truncate">PharmaOS</p>
                <p className="text-[10px] text-sidebar-foreground/40 truncate leading-tight">Smart Pharmacy, Better Care</p>
              </div>
            </Link>
          )}
          {collapsed && (
            <Link href="/dashboard">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary shadow-[0_2px_16px_hsl(162_65%_52%/0.4)]">
                <PharmacyLogoIcon />
              </div>
            </Link>
          )}
          {!collapsed && (
            <button onClick={toggle}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-sidebar-foreground/35 transition-all hover:bg-sidebar-accent hover:text-sidebar-foreground"
              aria-label="Collapse sidebar">
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Expand button (collapsed) */}
        {collapsed && (
          <button onClick={toggle}
            className="absolute -right-3 top-[76px] flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground"
            aria-label="Expand sidebar">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}

        {/* ── Navigation ── */}
        <ScrollArea className="flex-1">
          <div className="py-3">
            <nav className="space-y-0.5 px-2">
              {NAV_ITEMS.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
              ))}

              {/* Administration section */}
              {!collapsed ? (
                <p className="mt-4 mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/35">
                  Administration
                </p>
              ) : (
                <div className="my-2 mx-1 border-t border-sidebar-border/50" />
              )}
              {ADMIN_ITEMS.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
              ))}
            </nav>

            {/* Quick Bill tip */}
            {!collapsed && (
              <div className="mx-2 mt-4 rounded-xl border border-sidebar-primary/25 bg-sidebar-primary/12 p-3">
                <div className="flex items-start gap-2">
                  <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sidebar-primary" />
                  <div>
                    <p className="text-xs font-semibold text-sidebar-foreground">Quick Bill</p>
                    <p className="mt-0.5 text-[10px] text-sidebar-foreground/45">
                      Press <kbd className="rounded bg-sidebar-border/80 px-1 font-mono text-[10px]">F2</kbd> from anywhere
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Mandala art */}
            {!collapsed && (
              <div className="mt-4 flex justify-center py-2 opacity-80">
                <MandalaSVG />
              </div>
            )}
          </div>
        </ScrollArea>

        {/* ── Bottom section ── */}
        <div className="shrink-0 border-t border-sidebar-border">
          <div className="space-y-0.5 p-2">
            <NavLink
              item={{ label: 'Help & Shortcuts', href: '/help', icon: HelpCircle }}
              pathname={pathname}
              collapsed={collapsed}
            />
            <button
              onClick={handleSignOut}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-sidebar-foreground/55 transition-all hover:bg-sidebar-accent hover:text-sidebar-foreground',
                collapsed && 'justify-center px-2'
              )}
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Sign out</span>}
            </button>
          </div>

          {/* User profile */}
          {!collapsed && (
            <div className="border-t border-sidebar-border/60 px-3 pb-3 pt-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-bold text-white">
                  {getInitials(user?.name ?? 'U')}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-sidebar-foreground truncate">{user?.name ?? 'User'}</p>
                  <p className="text-[10px] text-sidebar-foreground/45 truncate capitalize">{(user?.roles?.[0] ?? 'Staff').replace(/_/g, ' ')}</p>
                </div>
                <span className="h-2 w-2 rounded-full bg-success shadow-[0_0_5px_#22c55e] shrink-0" />
              </div>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}

function NavLink({ item, pathname, collapsed }: { item: NavItem; pathname: string; collapsed: boolean }) {
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;

  const content = (
    <Link
      href={item.href}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150',
        isActive
          ? 'bg-sidebar-primary/18 text-sidebar-primary'
          : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground',
        collapsed && 'justify-center px-2'
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 h-[22px] w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary shadow-[0_0_8px_hsl(162_65%_52%/0.7)]" />
      )}
      <Icon className={cn(
        'h-4 w-4 shrink-0 transition-colors',
        isActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/40 group-hover:text-sidebar-foreground/75'
      )} />
      {!collapsed && (
        <>
          <span className="flex-1 truncate text-sm">{item.label}</span>
          {item.badge !== undefined && (
            <Badge variant={item.badgeVariant ?? 'default'} className="h-4 min-w-5 px-1.5 text-[10px] tabular-nums">
              {item.badge}
            </Badge>
          )}
        </>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2">
          <span className="font-medium">{item.label}</span>
          {item.badge !== undefined && (
            <Badge variant={item.badgeVariant ?? 'default'} className="h-4 min-w-4 px-1 text-2xs">{item.badge}</Badge>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

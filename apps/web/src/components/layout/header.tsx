'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Bell, Search, Moon, Sun, ChevronDown, User, Lock, LogOut, Settings, Pill, Receipt, Users, X, WifiOff, RefreshCw, CloudOff, Compass, FileText, Truck, Building2 } from 'lucide-react';
import { searchNav } from '@/lib/nav-index';
import { useOffline } from '@/hooks/use-offline';
import { syncQueue } from '@/lib/offline-sync';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { useSidebarStore } from '@/store/sidebar-store';
import { useAuthStore } from '@/store/auth-store';
import { getInitials } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  category: string;
  priority: string;
  isRead: boolean;
  createdAt: string;
}

async function fetchNotifications(): Promise<{ data: Notification[]; total: number }> {
  const res = await apiFetch('/api/notifications?unread=true&limit=5');
  if (!res.ok) return { data: [], total: 0 };
  const json = await res.json();
  return json.data ?? { data: [], total: 0 };
}

async function markAllRead() {
  await apiFetch('/api/notifications/mark-all-read', { method: 'PATCH' });
}

async function logoutApi(refreshToken: string) {
  await apiFetch('/api/auth/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
}

// ─── Global Search ────────────────────────────────────────────────────────────

interface SearchResult {
  id: string;
  type: 'page' | 'medicine' | 'customer' | 'bill' | 'vendor' | 'prescription' | 'purchaseOrder';
  title: string;
  subtitle: string;
  href: string;
}

const TYPE_ICON: Record<string, React.ElementType> = {
  page: Compass,
  medicine: Pill,
  customer: Users,
  bill: Receipt,
  vendor: Building2,
  prescription: FileText,
  purchaseOrder: Truck,
};

const TYPE_LABEL: Record<string, string> = {
  page: 'Page',
  medicine: 'Medicine',
  customer: 'Customer',
  bill: 'Bill',
  vendor: 'Vendor',
  prescription: 'Rx',
  purchaseOrder: 'PO',
};

function GlobalSearch() {
  const router = useRouter();
  const { tokens } = useAuthStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const { data: results = [], isFetching } = useQuery<SearchResult[]>({
    queryKey: ['global-search', query],
    queryFn: async () => {
      if (query.length < 2) return [];
      const r = await apiFetch(`/api/search?q=${encodeURIComponent(query)}&limit=8`);
      if (!r.ok) return [];
      const j = await r.json() as { data: SearchResult[] };
      return j.data ?? [];
    },
    enabled: query.length >= 2 && !!tokens?.accessToken,
    staleTime: 10_000,
  });

  // Menus / sub-menus / pages — matched instantly on the client from the nav index.
  const pageResults = useMemo<SearchResult[]>(
    () => searchNav(query, 6).map((n) => ({ id: `nav:${n.href}`, type: 'page', title: n.label, subtitle: n.group, href: n.href })),
    [query],
  );

  const focus = useCallback(() => {
    inputRef.current?.focus();
    setOpen(true);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        focus();
      }
      if (e.key === 'Escape') { setOpen(false); setQuery(''); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focus]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function navigate(href: string) {
    router.push(href);
    setOpen(false);
    setQuery('');
  }

  const ResultRow = ({ r }: { r: SearchResult }) => {
    const Icon = TYPE_ICON[r.type] ?? Search;
    return (
      <li>
        <button
          className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/60 transition-colors"
          onMouseDown={(e) => { e.preventDefault(); navigate(r.href); }}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">{r.title}</p>
            <p className="truncate text-2xs text-muted-foreground">{r.subtitle}</p>
          </div>
          <Badge variant="muted" className="text-2xs shrink-0">{TYPE_LABEL[r.type]}</Badge>
        </button>
      </li>
    );
  };

  const SectionHeader = ({ children }: { children: React.ReactNode }) => (
    <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{children}</p>
  );

  const showDropdown = open && query.trim().length >= 1;
  const noResults = query.trim().length >= 2 && !isFetching && pageResults.length === 0 && results.length === 0;

  return (
    <div ref={containerRef} className="relative hidden max-w-md flex-1 md:flex">
      <div className="relative w-full">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const first = pageResults[0] ?? results[0];
              if (first) navigate(first.href);
            }
          }}
          placeholder="Search anything — pages, medicines, bills, customers…"
          className="h-8 w-full rounded-lg border border-input bg-muted/50 pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); inputRef.current?.focus(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-10 z-50 rounded-xl border border-border bg-card shadow-xl">
          {noResults ? (
            <div className="px-4 py-3 text-xs text-muted-foreground">No results for &ldquo;{query}&rdquo;</div>
          ) : (
            <ul className="max-h-[26rem] overflow-y-auto py-1">
              {pageResults.length > 0 && <SectionHeader>Menus &amp; Pages</SectionHeader>}
              {pageResults.map((r) => <ResultRow key={r.id} r={r} />)}

              {query.trim().length >= 2 && (
                isFetching ? (
                  <div className="px-3 py-2.5 text-xs text-muted-foreground">Searching records…</div>
                ) : results.length > 0 ? (
                  <>
                    <SectionHeader>Records</SectionHeader>
                    {results.map((r) => <ResultRow key={r.id} r={r} />)}
                  </>
                ) : null
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// Connectivity + offline sync-queue indicator. Hidden entirely when online with
// nothing pending; otherwise shows an offline badge and/or a pending-sync pill
// that syncs on click.
function OfflineIndicator() {
  const { online, pending } = useOffline();
  const [syncing, setSyncing] = React.useState(false);
  if (online && pending === 0) return null;

  async function handleSync() {
    setSyncing(true);
    const r = await syncQueue();
    setSyncing(false);
    if (r.synced > 0) toast.success(`Synced ${r.synced} offline bill${r.synced === 1 ? '' : 's'}`);
    else if (r.failed > 0) toast.error(`${r.failed} offline bill(s) need attention`);
  }

  return (
    <div className="flex items-center gap-1.5">
      {!online && (
        <span className="hidden items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive sm:flex" title="No internet — sales are being saved locally">
          <WifiOff className="h-3.5 w-3.5" /> Offline
        </span>
      )}
      {pending > 0 && (
        <button
          onClick={handleSync}
          disabled={syncing || !online}
          title={online ? 'Click to sync pending offline records' : 'Will sync when back online'}
          className="flex items-center gap-1 rounded-md border border-warning/40 bg-warning/10 px-2 py-1 text-xs font-semibold text-warning-700 transition-colors hover:bg-warning/20 disabled:opacity-70"
        >
          {syncing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CloudOff className="h-3.5 w-3.5" />}
          {pending} pending
        </button>
      )}
    </div>
  );
}

interface HeaderProps {
  breadcrumb?: React.ReactNode;
}

export function Header({ breadcrumb }: HeaderProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { collapsed } = useSidebarStore();
  const { user, tokens, clearAuth } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: notifData } = useQuery({
    queryKey: ['notifications', 'header'],
    queryFn: () => fetchNotifications(),
    enabled: !!tokens?.accessToken,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const markReadMutation = useMutation({
    mutationFn: () => markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('All notifications marked as read');
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => logoutApi(tokens?.refreshToken ?? ''),
    onSettled: () => {
      clearAuth();
      queryClient.clear();
      router.push('/login');
    },
  });

  const notifications = notifData?.data ?? [];
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const displayName = user?.name ?? 'User';
  const displayEmail = user?.email ?? '';
  const displayRole = user?.roles?.[0] ?? 'Staff';
  const tenantName = user?.tenantName ?? 'Pharma Ist';

  return (
    <header
      className={cn(
        'fixed right-0 top-0 z-[var(--z-header)] flex h-[var(--header-height)] items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-300',
        collapsed
          ? 'left-[var(--sidebar-collapsed-width)]'
          : 'left-[var(--sidebar-width)]'
      )}
    >
      <div className="flex flex-1 items-center gap-4 px-4 md:px-6">
        {/* Breadcrumb */}
        {breadcrumb && <div className="hidden md:flex">{breadcrumb}</div>}

        {/* Global Search */}
        <GlobalSearch />

        <div className="ml-auto flex items-center gap-1.5">
          <OfflineIndicator />
          {/* Tenant chip — shows the pharmacy's own logo when configured */}
          <div className="hidden items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 md:flex">
            {user?.logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={user.logoUrl} alt={tenantName} className="h-4 w-4 rounded object-contain" />
              : <div className="h-2 w-2 rounded-full bg-success" />}
            <span className="text-xs font-medium text-foreground">{tenantName}</span>
          </div>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="relative" aria-label="Notifications">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <Badge className="absolute -right-0.5 -top-0.5 h-4 min-w-4 px-1 text-2xs">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-xs text-primary"
                    onClick={() => markReadMutation.mutate()}
                    disabled={markReadMutation.isPending}
                  >
                    Mark all read
                  </Button>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No unread notifications
                </div>
              ) : (
                notifications.map((n) => (
                  <DropdownMenuItem
                    key={n.id}
                    className="flex-col items-start gap-0.5 py-3"
                    onClick={() => router.push(`/notifications?id=${n.id}`)}
                  >
                    <div className="flex w-full items-start gap-2">
                      <div
                        className={cn(
                          'mt-1 h-2 w-2 shrink-0 rounded-full',
                          n.priority === 'warning' && 'bg-warning',
                          n.priority === 'critical' && 'bg-destructive',
                          n.priority === 'info' && 'bg-success'
                        )}
                      />
                      <p className="flex-1 text-sm leading-snug">{n.title}</p>
                    </div>
                    <span className="pl-4 text-xs text-muted-foreground">{n.message}</span>
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="justify-center text-sm text-primary"
                onClick={() => router.push('/notifications')}
              >
                View all notifications
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 px-2">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={user?.avatar} alt={displayName} />
                  <AvatarFallback className="text-xs">{getInitials(displayName)}</AvatarFallback>
                </Avatar>
                <div className="hidden text-left md:block">
                  <p className="text-xs font-medium leading-none">{displayName}</p>
                  <p className="text-2xs text-muted-foreground capitalize">{displayRole.replace(/_/g, ' ')}</p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p className="font-medium">{displayName}</p>
                <p className="text-xs font-normal text-muted-foreground">{displayEmail}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/users')}>
                <User className="mr-2 h-4 w-4" />
                Profile settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/settings?tab=security')}>
                <Lock className="mr-2 h-4 w-4" />
                Change password
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/settings?tab=preferences')}>
                <Settings className="mr-2 h-4 w-4" />
                Preferences
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                destructive
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
              >
                <LogOut className="mr-2 h-4 w-4" />
                {logoutMutation.isPending ? 'Signing out…' : 'Sign out'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

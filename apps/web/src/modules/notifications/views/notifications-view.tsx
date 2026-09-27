'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell, BellOff, Package, CreditCard, Building2, Shield, Users,
  Zap, AlertTriangle, Info, CheckCircle2, ChevronRight, Clock, X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Notification, NotificationStats } from '@pharmaos/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

async function fetchNotificationStats(): Promise<NotificationStats> {
  const res = await apiFetch('/api/notifications/stats');
  const json = await res.json() as { success: boolean; data: NotificationStats };
  if (!res.ok) throw new Error('Request failed');
  return json.data ?? ({} as NotificationStats);
}

async function fetchNotifications(category?: string, unreadOnly?: boolean): Promise<Notification[]> {
  const params = new URLSearchParams();
  if (category && category !== 'all') params.set('category', category);
  if (unreadOnly) params.set('unread', 'true');
  const res = await apiFetch(`/api/notifications?${params}`);
  const json = await res.json() as { success: boolean; data: { data: Notification[] } };
  if (!res.ok) throw new Error('Request failed');
  return json.data?.data ?? ([] as Notification[]);
}

async function markRead(id: string): Promise<void> {
  await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
}

async function markAllRead(): Promise<void> {
  await apiFetch('/api/notifications/mark-all-read', { method: 'PATCH' });
}

const CATEGORY_CONFIG = {
  inventory: { label: 'Inventory', icon: Package, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950' },
  billing: { label: 'Billing', icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950' },
  vendor: { label: 'Vendor', icon: Building2, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950' },
  system: { label: 'System', icon: Bell, color: 'text-gray-600', bg: 'bg-gray-50 dark:bg-gray-900' },
  customer: { label: 'Customer', icon: Users, color: 'text-pink-600', bg: 'bg-pink-50 dark:bg-pink-950' },
  security: { label: 'Security', icon: Shield, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-950' },
};

const PRIORITY_CONFIG = {
  critical: { icon: Zap, badge: 'destructive' as const, dot: 'bg-destructive' },
  warning: { icon: AlertTriangle, badge: 'warning' as const, dot: 'bg-warning-500' },
  info: { icon: Info, badge: 'secondary' as const, dot: 'bg-muted-foreground' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function NotificationCard({ notif, onRead, highlight }: { notif: Notification; onRead: (id: string) => void; highlight?: boolean }) {
  const cat = CATEGORY_CONFIG[notif.category] ?? CATEGORY_CONFIG.system;
  const pri = PRIORITY_CONFIG[notif.priority] ?? PRIORITY_CONFIG.info;
  const CatIcon = cat.icon;
  const PriIcon = pri.icon;

  return (
    <div data-notif-id={notif.id} className={cn('group relative rounded-xl border bg-card p-4 transition-all hover:shadow-sm', !notif.isRead && 'border-l-2 border-l-primary bg-primary/5', highlight && 'ring-2 ring-primary ring-offset-2')}>
      {!notif.isRead && (
        <div className={cn('absolute right-4 top-4 h-2 w-2 rounded-full', pri.dot)} />
      )}
      <div className="flex items-start gap-3">
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', cat.bg)}>
          <CatIcon className={cn('h-4 w-4', cat.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className={cn('text-sm font-semibold', !notif.isRead && 'text-foreground', notif.isRead && 'text-muted-foreground')}>{notif.title}</p>
            <Badge variant={pri.badge} className="text-[10px] px-1.5 py-0 flex items-center gap-0.5">
              <PriIcon className="h-2.5 w-2.5" />
              {notif.priority.toUpperCase()}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{notif.message}</p>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />{timeAgo(notif.createdAt)}
            </span>
            <Badge variant="secondary" className="text-[10px]">{cat.label}</Badge>
            {notif.entityName && <span className="text-xs text-muted-foreground">{notif.entityName}</span>}
          </div>
          <div className="flex items-center gap-2 mt-3">
            {notif.actionUrl && notif.actionLabel && (
              <Button size="sm" variant="outline" asChild className="h-7 text-xs">
                <Link href={notif.actionUrl}>
                  {notif.actionLabel} <ChevronRight className="h-3 w-3 ml-0.5" />
                </Link>
              </Button>
            )}
            {!notif.isRead && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onRead(notif.id)}>
                <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Read
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function NotificationsView() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const openedRef = React.useRef(false);
  const qc = useQueryClient();

  const { data: stats } = useQuery({ queryKey: ['notification-stats'], queryFn: fetchNotificationStats });
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', activeCategory, unreadOnly],
    queryFn: () => fetchNotifications(activeCategory, unreadOnly),
  });

  // Summary counts are derived from the loaded list so the header always
  // matches the notifications shown below (TC_034).
  const summary = {
    total: notifications.length,
    unread: notifications.filter(n => !n.isRead).length,
    critical: notifications.filter(n => n.priority === 'critical').length,
    warning: notifications.filter(n => n.priority === 'warning').length,
    today: notifications.filter(n => new Date(n.createdAt).toDateString() === new Date().toDateString()).length,
  };

  const markReadMutation = useMutation({
    mutationFn: markRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notification-stats'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notification-stats'] });
      toast.success('All notifications marked as read');
    },
  });

  // TC_021 — when arriving via /notifications?id=<id> (e.g. clicking a single
  // notification in the header), scroll to it, highlight it, and mark it read.
  React.useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (id) setHighlightId(id);
  }, []);

  React.useEffect(() => {
    if (!highlightId || openedRef.current || notifications.length === 0) return;
    const target = notifications.find(n => n.id === highlightId);
    if (!target) return;
    openedRef.current = true;
    const el = document.querySelector(`[data-notif-id="${highlightId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (!target.isRead) markReadMutation.mutate(highlightId);
    const t = setTimeout(() => setHighlightId(null), 3000);
    return () => clearTimeout(t);
  }, [highlightId, notifications, markReadMutation]);

  const categories = [
    { key: 'all', label: 'All' },
    { key: 'inventory', label: 'Inventory' },
    { key: 'vendor', label: 'Vendor' },
    { key: 'billing', label: 'Billing' },
    { key: 'customer', label: 'Customer' },
    { key: 'security', label: 'Security' },
    { key: 'system', label: 'System' },
  ];

  const unread = notifications.filter(n => !n.isRead).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
            {(stats?.totalUnread ?? 0) > 0 && (
              <Badge variant="destructive" className="text-sm h-6 min-w-6 justify-center">
                {stats?.totalUnread}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Operational alerts, stock warnings, and system events</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setUnreadOnly(!unreadOnly)}
            className={cn(unreadOnly && 'bg-primary/10 text-primary border-primary/30')}
          >
            <Bell className="h-4 w-4" /> {unreadOnly ? 'Show All' : 'Unread Only'}
          </Button>
          {(stats?.totalUnread ?? 0) > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAllMutation.mutate()} disabled={markAllMutation.isPending}>
              <CheckCircle2 className="h-4 w-4" /> Mark All Read
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      {notifications.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total Unread', value: summary.unread, icon: Bell, color: 'text-primary', bg: 'bg-primary/10' },
            { label: 'Critical', value: summary.critical, icon: Zap, color: 'text-destructive', bg: 'bg-destructive/10' },
            { label: 'Warnings', value: summary.warning, icon: AlertTriangle, color: 'text-warning-700', bg: 'bg-warning/10' },
            { label: "Today's Total", value: summary.today, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', bg)}>
                <Icon className={cn('h-4 w-4', color)} />
              </div>
              <div>
                <p className="text-xl font-bold leading-tight">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {categories.map(cat => {
          const count = cat.key === 'all' ? notifications.filter(n => !n.isRead).length : notifications.filter(n => n.category === cat.key && !n.isRead).length;
          return (
            <Button
              key={cat.key}
              variant={activeCategory === cat.key ? 'default' : 'outline'}
              size="sm"
              className="gap-1.5"
              onClick={() => setActiveCategory(cat.key)}
            >
              {cat.label}
              {count > 0 && (
                <Badge variant={activeCategory === cat.key ? 'secondary' : 'default'} className="h-4 min-w-4 p-0 justify-center text-[10px]">{count}</Badge>
              )}
            </Button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Loading notifications…</div>
      ) : notifications.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-20 text-center">
          <BellOff className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="font-semibold">
            {unreadOnly ? 'No unread notifications' : 'No notifications'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadOnly ? 'All caught up! Click "Show All" to see history.' : 'Operational alerts will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {unread > 0 && (
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{unread} unread</p>
          )}
          {notifications.map(notif => (
            <NotificationCard key={notif.id} notif={notif} onRead={id => markReadMutation.mutate(id)} highlight={highlightId === notif.id} />
          ))}
        </div>
      )}
    </div>
  );
}

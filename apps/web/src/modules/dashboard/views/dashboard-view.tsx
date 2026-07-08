'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, Receipt, Package, CalendarX2,
  Pill, AlertTriangle, ArrowRight, RefreshCw, FileText,
  RotateCcw, Zap, Users, BarChart3,
} from 'lucide-react';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatCurrency, formatNumber } from '@pharmaos/utils';
import { formatDate } from '@pharmaos/utils';

type AlertSeverity = 'warning' | 'error' | 'critical';

interface DashboardData {
  kpis: {
    todayRevenue: number;
    todayBills: number;
    lowStockItems: number;
    expiringItems: number;
    totalMedicines: number;
    activeCustomers: number;
    todayRevenueChange: number;
    todayBillsChange: number;
    pendingPrescriptions?: number;
    pendingReturns?: number;
  };
  revenueChart: Array<{ date: string; revenue: number; bills: number }>;
  topMedicines: Array<{ name: string; qty: number; revenue: number }>;
  salesByCategory: Array<{ category: string; value: number }>;
  alerts: Array<{ id: string; type: string; message: string; severity: AlertSeverity }>;
}

const PIE_COLORS = ['#0F766E', '#D97706', '#4338CA', '#059669', '#dc2626', '#7c3aed'];

async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch('/api/dashboard');
  const json = await res.json() as { success: boolean; data: DashboardData };
  if (!json.success) throw new Error('Failed to load dashboard');
  return json.data;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardView() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    refetchInterval: 5 * 60 * 1000,
  });

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <AlertTriangle className="h-10 w-10 text-warning" />
        <p className="font-medium">Failed to load dashboard</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Hero ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting()}, Rahul 👋
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {formatDate(new Date())} · Divya Pharmacy is open
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}
          className="shrink-0">
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* ── Quick actions ── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          {
            label: 'New Bill', icon: Receipt, href: '/billing', shortcut: 'F2',
            cls: 'bg-primary text-white hover:bg-primary/90 shadow-[0_4px_14px_hsl(175_77%_26%/0.30)]',
            kbdCls: 'bg-white/20 text-white',
          },
          {
            label: 'Register Rx', icon: FileText, href: '/prescriptions', shortcut: 'F3',
            cls: 'bg-card border border-amber-300/70 text-amber-700 hover:bg-amber-50 dark:border-amber-700/40 dark:text-amber-400 dark:hover:bg-amber-900/20',
            kbdCls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30',
          },
          {
            label: 'Add Stock', icon: Package, href: '/stock', shortcut: 'F5',
            cls: 'bg-card border border-primary/30 text-primary hover:bg-primary/5',
            kbdCls: 'bg-primary/10 text-primary',
          },
          {
            label: 'Process Return', icon: RotateCcw, href: '/returns', shortcut: 'F6',
            cls: 'bg-card border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/50',
            kbdCls: 'bg-slate-100 text-slate-600 dark:bg-slate-800',
          },
        ].map(({ label, icon: Icon, href, shortcut, cls, kbdCls }) => (
          <Link key={label} href={href}>
            <div className={cn(
              'flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium cursor-pointer transition-all duration-200 hover:-translate-y-0.5',
              cls
            )}>
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              <kbd className={cn('hidden sm:inline-block rounded px-1.5 py-0.5 text-[10px] font-mono', kbdCls)}>{shortcut}</kbd>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Pending action banners ── */}
      {data && (data.kpis.pendingPrescriptions ?? 0) + (data.kpis.pendingReturns ?? 0) > 0 && (
        <div className="flex flex-wrap gap-2">
          {(data.kpis.pendingPrescriptions ?? 0) > 0 && (
            <Link href="/prescriptions">
              <div className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/8 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-warning/15 transition-colors cursor-pointer dark:text-amber-400">
                <FileText className="h-4 w-4" />
                {data.kpis.pendingPrescriptions} prescription{data.kpis.pendingPrescriptions !== 1 ? 's' : ''} awaiting review
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          )}
          {(data.kpis.pendingReturns ?? 0) > 0 && (
            <Link href="/returns">
              <div className="flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50/70 px-3 py-2 text-sm font-medium text-orange-700 hover:bg-orange-100 transition-colors cursor-pointer dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
                <RotateCcw className="h-4 w-4" />
                {data.kpis.pendingReturns} return{data.kpis.pendingReturns !== 1 ? 's' : ''} pending approval
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          )}
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Today's Revenue"
          value={data ? formatCurrency(data.kpis.todayRevenue) : undefined}
          change={data?.kpis.todayRevenueChange}
          icon={Receipt}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50 dark:bg-emerald-900/25"
          loading={isLoading}
        />
        <KpiCard
          title="Bills Issued Today"
          value={data ? String(data.kpis.todayBills) : undefined}
          change={data?.kpis.todayBillsChange}
          icon={BarChart3}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-50 dark:bg-indigo-900/25"
          loading={isLoading}
        />
        <KpiCard
          title="Low Stock Items"
          value={data ? String(data.kpis.lowStockItems) : undefined}
          icon={Package}
          iconColor="text-amber-600"
          iconBg="bg-amber-50 dark:bg-amber-900/25"
          alert={data?.kpis.lowStockItems ? 'Need reorder' : undefined}
          alertHref="/stock?tab=reorder"
          loading={isLoading}
        />
        <KpiCard
          title="Expiring Within 90d"
          value={data ? String(data.kpis.expiringItems) : undefined}
          icon={CalendarX2}
          iconColor="text-red-600"
          iconBg="bg-red-50 dark:bg-red-900/25"
          alert={data?.kpis.expiringItems ? 'Take action' : undefined}
          alertHref="/stock?tab=expiry"
          loading={isLoading}
        />
      </div>

      {/* ── Charts row ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Revenue area chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Revenue Trend</CardTitle>
                <CardDescription>Last 30 days · daily revenue</CardDescription>
              </div>
              {data && (
                <div className="text-right">
                  <p className="text-lg font-bold text-primary font-mono">{formatCurrency(data.kpis.todayRevenue)}</p>
                  <div className="flex items-center gap-1 justify-end text-xs text-success">
                    <TrendingUp className="h-3 w-3" />
                    +{data.kpis.todayRevenueChange}% vs yesterday
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={224}>
                <AreaChart data={data?.revenueChart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0F766E" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#0F766E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(v: string) => { const d = new Date(v); return `${d.getDate()}/${d.getMonth() + 1}`; }}
                    interval={4}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
                    width={44}
                  />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px' }}
                    formatter={(v: number) => [formatCurrency(v), 'Revenue']}
                    labelFormatter={(l: string) => formatDate(l)}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#0F766E" strokeWidth={2.5} fill="url(#revenueGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Sales by category pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sales by Category</CardTitle>
            <CardDescription>Revenue distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-56 w-full rounded-full" />
            ) : (
              <div className="space-y-3">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={data?.salesByCategory} cx="50%" cy="50%" innerRadius={44} outerRadius={72}
                      dataKey="value" paddingAngle={3}>
                      {data?.salesByCategory.map((entry, i) => (
                        <Cell key={entry.category} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '10px', fontSize: '11px' }}
                      formatter={(v: number) => [`${v}%`, '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5">
                  {data?.salesByCategory.slice(0, 5).map((item, i) => (
                    <div key={item.category} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-muted-foreground">{item.category}</span>
                      </div>
                      <span className="font-semibold tabular-nums">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Bottom row ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top medicines */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">Top Medicines</CardTitle>
              <CardDescription>By quantity sold this month</CardDescription>
            </div>
            <Link href="/stock?tab=catalog">
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-primary h-7">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
            ) : (
              <div className="space-y-0.5">
                {data?.topMedicines.map((med, i) => (
                  <div key={med.name} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/50">
                    <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      i === 0 ? 'bg-primary text-white' :
                      i === 1 ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                      i === 2 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                      'bg-muted text-muted-foreground'
                    )}>{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{med.name}</p>
                      <p className="text-xs text-muted-foreground">{formatNumber(med.qty)} units</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-primary tabular-nums font-mono">{formatCurrency(med.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active alerts */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">Active Alerts</CardTitle>
              <CardDescription>Items requiring your attention</CardDescription>
            </div>
            {data && <Badge variant="warning" dot className="text-xs">{data.alerts.length} active</Badge>}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
            ) : (
              <div className="space-y-2">
                {data?.alerts.map((alert) => <AlertCard key={alert.id} alert={alert} />)}
                {data?.alerts.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                      <Zap className="h-5 w-5 text-success" />
                    </div>
                    <p className="text-sm font-medium text-success">All clear!</p>
                    <p className="text-xs text-muted-foreground">No active alerts right now.</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-center gap-3 py-1">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
        <p className="text-xs text-muted-foreground/60 tracking-wide" style={{ fontFamily: 'serif' }}>
          ❁ सर्वे भवन्तु सुखिनः · सर्वे सन्तु निरामयाः ❁
        </p>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>
    </div>
  );
}

/* ── KPI Card ── */
interface KpiCardProps {
  title: string;
  value?: string;
  change?: number;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  alert?: string;
  alertHref?: string;
  loading?: boolean;
}

function KpiCard({ title, value, change, icon: Icon, iconColor, iconBg, alert, alertHref, loading }: KpiCardProps) {
  return (
    <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="mt-2 h-8 w-24" />
            ) : (
              <p className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums font-mono">{value}</p>
            )}
            {!loading && (change !== undefined ? (
              <div className="mt-1.5 flex items-center gap-1">
                {change >= 0
                  ? <TrendingUp className="h-3.5 w-3.5 text-success" />
                  : <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
                <span className={cn('text-xs font-medium', change >= 0 ? 'text-success' : 'text-destructive')}>
                  {Math.abs(change)}% vs yesterday
                </span>
              </div>
            ) : alert ? (
              alertHref ? (
                <Link href={alertHref}>
                  <p className="mt-1 text-xs text-primary hover:underline cursor-pointer font-medium">{alert} →</p>
                </Link>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">{alert}</p>
              )
            ) : null)}
          </div>
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', iconBg)}>
            <Icon className={cn('h-5 w-5', iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AlertCard({ alert }: { alert: { id: string; type: string; message: string; severity: AlertSeverity } }) {
  const cfgMap = {
    warning: { color: 'border-warning/30 bg-warning/6', dot: 'bg-warning', badge: 'warning' as const },
    error: { color: 'border-destructive/20 bg-destructive/5', dot: 'bg-destructive', badge: 'destructive' as const },
    critical: { color: 'border-destructive/40 bg-destructive/8', dot: 'bg-destructive animate-pulse', badge: 'destructive' as const },
  };
  const config = cfgMap[alert.severity] ?? cfgMap.warning;
  const href = alert.type === 'expiry' ? '/stock?tab=expiry' : alert.type === 'stock' ? '/stock?tab=reorder' : '/settings';
  return (
    <Link href={href}>
      <div className={cn('flex items-start gap-3 rounded-xl border p-3 transition-all hover:opacity-80 cursor-pointer', config.color)}>
        <div className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', config.dot)} />
        <p className="flex-1 text-xs leading-relaxed">{alert.message}</p>
        <Badge variant={config.badge} className="shrink-0 text-2xs capitalize">{alert.severity}</Badge>
      </div>
    </Link>
  );
}

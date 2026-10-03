'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Line,
} from 'recharts';
import {
  TrendingUp, Receipt, Package, Users, Download, FileSpreadsheet,
  FileText, AlertTriangle, ShieldCheck, Activity, Percent,
  ArrowUpRight, ArrowDownRight, Clock, Star, Printer, Calculator,
  Banknote, CheckCircle, ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate, formatNumber } from '@pharmaos/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { useCan } from '@/lib/permissions';
import { markDayClosed, postDayClose, fetchDayCloseHistory } from '@/lib/day-close';
import { useAuthStore } from '@/store/auth-store';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DailySale {
  date: string; revenue: number; bills: number; gst: number;
  avgBillValue: number; cash: number; upi: number; card: number; credit: number;
}
interface Medicine {
  name: string; generic: string; category: string; qtySold: number;
  revenue: number; margin: number; scheduleH: boolean;
}
interface Category {
  category: string; revenue: number; bills: number; margin: number; gst: number; pct: number;
}
interface GSTSlab {
  rate: number; description: string; taxable: number;
  gst: number; cgst: number; sgst: number; igst: number; pct: number;
}
interface DeadStock { name: string; category: string; qty: number; value: number; lastSoldDays: number; batchExpiry: string; }
interface Customer { name: string; phone: string; visits: number; totalSpend: number; loyaltyPts: number; lastVisit: string; }
interface Summary {
  totalRevenue: number; totalBills: number; avgBillValue: number; totalGST: number;
  grossProfit: number; grossMarginPct: number; bestDay: { date: string; revenue: number };
  paymentMethods: { cash: number; upi: number; card: number; credit: number };
  newCustomers: number; returningCustomers: number; deadStockValue: number; totalStockValue: number;
  topCategory?: string;
  deltas?: { revenue: number; bills: number; grossProfit: number; newCustomers: number };
}
interface Purchases {
  totalPurchase: number; purchaseGST: number; purchaseSubtotal: number;
  poCount: number; receivedCount: number; pendingCount: number;
  byVendor: Array<{ vendor: string; value: number; orders: number }>;
  recent: Array<{ poNumber: string; vendor: string; status: string; date: string; items: number; qty: number; total: number }>;
}
interface Reconciliation {
  opening: number; purchases: number; customerReturns: number; sales: number;
  disposals: number; adjustments: number; closing: number; balanced: boolean;
}
interface ReturnsReport {
  customer: { count: number; totalValue: number; refundValue: number; byReason: Array<{ reason: string; count: number; value: number }> };
  vendor: { count: number; totalValue: number };
  recent: Array<{ returnNumber: string; type: string; status: string; party: string; reason: string; qty: number; value: number; date: string }>;
}
interface ReportsData {
  summary: Summary;
  purchases?: Purchases;
  reconciliation?: Reconciliation;
  returns?: ReturnsReport;
  dailySales: DailySale[];
  topMedicines: Medicine[];
  categories: Category[];
  gstSlabs: GSTSlab[];
  gstTotals: { totalTaxable: number; totalGST: number; cgst: number; sgst: number; igst: number; effectiveRate: number };
  scheduleHLog: Array<{ date: string; medicine: string; qty: number; prescriptionNo: string; doctorName: string; doctorReg: string; patientName: string; address: string }>;
  deadStock: DeadStock[];
  topCustomers: Customer[];
  hourlyPattern: Array<{ hour: string; bills: number }>;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CHART_TEAL = '#0d9488';
const CHART_BLUE = '#3b82f6';
const CHART_AMBER = '#f59e0b';
const CHART_ROSE = '#f43f5e';
const CHART_PURPLE = '#8b5cf6';
const CAT_COLORS = [CHART_TEAL, CHART_BLUE, CHART_AMBER, CHART_ROSE, CHART_PURPLE, '#10b981', '#64748b'];

const PERIODS = [
  { label: 'Today', days: 1 },
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 },
];

// Each report is selected from the Reports sidebar submenu (?tab=). Only the
// chosen report renders — no in-page tab bar duplicating that navigation.
const REPORT_META: Record<string, { label: string; desc: string }> = {
  sales: { label: 'Sales Overview', desc: 'Revenue trend, payment mix and peak hours' },
  purchase: { label: 'Purchase Report', desc: 'Vendor purchases, orders received and purchase value' },
  gst: { label: 'GST & Compliance', desc: 'GST slabs, GSTR-1 export and Schedule-H register' },
  stock: { label: 'Stock Intelligence', desc: 'Category revenue, margins and dead-stock alerts' },
  reconciliation: { label: 'Stock Reconciliation', desc: 'Opening + Purchases + Returns − Sales ± Adjustments = Closing' },
  returns: { label: 'Returns Report', desc: 'Customer & vendor returns, refunds and reasons' },
  profit: { label: 'Profitability', desc: 'Gross profit, margins and top medicines' },
  customers: { label: 'Customer Insights', desc: 'Acquisition, retention and top customers' },
  'daily-close': { label: 'Daily Close', desc: 'End-of-day cash reconciliation' },
};
const REPORT_TABS = Object.keys(REPORT_META);

/** Turn a signed growth % (from the API) into the KpiCard trend badge, or hide it. */
const toTrend = (d?: number) => (d === undefined || d === null ? undefined : { value: Math.abs(Number(d)), positive: Number(d) >= 0 });

const tooltipStyle = {
  contentStyle: {
    background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))',
    borderRadius: '10px', fontSize: '12px', boxShadow: '0 4px 12px rgb(0 0 0/0.1)',
  },
};

// ─── API ────────────────────────────────────────────────────────────────────

async function fetchReports(days: number): Promise<ReportsData> {
  const res = await apiFetch(`/api/reports?days=${days}`);
  const json = await res.json() as { success: boolean; data: ReportsData };
  if (!res.ok || !json.data) throw new Error('Failed to load reports');
  return json.data;
}

// ─── Subcomponents ──────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, gradient, loading, trend,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  gradient: string; loading?: boolean; trend?: { value: number; positive: boolean };
}) {
  return (
    <div className={cn('rounded-2xl p-4 text-white', gradient)} style={{ boxShadow: '0 4px 14px rgb(0 0 0/0.18)' }}>
      <div className="flex items-start justify-between mb-3">
        <div className="rounded-xl bg-white/20 p-2">
          <Icon className="h-4 w-4 text-white" />
        </div>
        {trend && (
          <div className={cn('flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold', trend.positive ? 'bg-white/20' : 'bg-white/20')}>
            {trend.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {trend.value}%
          </div>
        )}
      </div>
      {loading ? (
        <div className="space-y-1.5">
          <div className="h-7 w-28 rounded-lg bg-white/20 animate-pulse" />
          <div className="h-3 w-20 rounded bg-white/15 animate-pulse" />
        </div>
      ) : (
        <>
          <p className="text-2xl font-bold leading-none mb-1">{value}</p>
          <p className="text-xs text-white/75">{sub ?? label}</p>
        </>
      )}
    </div>
  );
}

function SectionTitle({ children, description }: { children: React.ReactNode; description?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-foreground">{children}</h3>
      {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
    </div>
  );
}

// ─── Tab: Purchase Report ────────────────────────────────────────────────────

const PO_STATUS: Record<string, 'warning' | 'secondary' | 'success' | 'muted'> = {
  ordered: 'warning', partially_received: 'secondary', received: 'success', cancelled: 'muted',
};

function PurchaseTab({ data, loading }: { data?: ReportsData; loading: boolean }) {
  const p = data?.purchases;
  const hasData = !!p && p.poCount > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Total Purchases" value={p ? formatCurrency(p.totalPurchase) : '—'} sub="Order value (incl. GST)" icon={Package} gradient="kpi-teal" loading={loading} />
        <KpiCard label="Purchase GST" value={p ? formatCurrency(p.purchaseGST) : '—'} sub="Input tax credit" icon={Percent} gradient="kpi-purple" loading={loading} />
        <KpiCard label="Purchase Orders" value={p ? formatNumber(p.poCount) : '—'} sub={p ? `${p.receivedCount} received · ${p.pendingCount} pending` : ''} icon={Receipt} gradient="kpi-blue" loading={loading} />
        <KpiCard label="Taxable Value" value={p ? formatCurrency(p.purchaseSubtotal) : '—'} sub="Before GST" icon={TrendingUp} gradient="kpi-amber" loading={loading} />
      </div>

      {!hasData ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <Package className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium">No purchases in this period</p>
          <p className="text-xs text-muted-foreground mt-1">Raise a purchase order under Procurement → Purchase Orders, then receive goods to see purchase value here.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* By vendor */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-3"><h3 className="text-sm font-semibold">Purchases by Vendor</h3></div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border/60 text-xs text-muted-foreground"><th className="px-5 py-2 text-left font-medium">Vendor</th><th className="px-3 py-2 text-center font-medium">Orders</th><th className="px-5 py-2 text-right font-medium">Value</th></tr></thead>
              <tbody>
                {p!.byVendor.map((v) => (
                  <tr key={v.vendor} className="border-b border-border/40 last:border-0">
                    <td className="px-5 py-2.5 font-medium">{v.vendor}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">{v.orders}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums font-semibold">{formatCurrency(v.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Recent purchase orders */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-3"><h3 className="text-sm font-semibold">Recent Purchase Orders</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border/60 text-xs text-muted-foreground"><th className="px-5 py-2 text-left font-medium">PO No.</th><th className="px-3 py-2 text-left font-medium">Vendor</th><th className="px-3 py-2 text-center font-medium">Items</th><th className="px-3 py-2 text-center font-medium">Status</th><th className="px-5 py-2 text-right font-medium">Total</th></tr></thead>
                <tbody>
                  {p!.recent.map((r) => (
                    <tr key={r.poNumber} className="border-b border-border/40 last:border-0">
                      <td className="px-5 py-2.5 font-mono text-xs font-semibold text-primary">{r.poNumber}</td>
                      <td className="px-3 py-2.5">{r.vendor}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">{r.items} · {r.qty}u</td>
                      <td className="px-3 py-2.5 text-center"><Badge variant={PO_STATUS[r.status] ?? 'muted'} dot className="text-xs capitalize">{r.status.replace('_', ' ')}</Badge></td>
                      <td className="px-5 py-2.5 text-right tabular-nums font-semibold">{formatCurrency(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Stock Reconciliation ───────────────────────────────────────────────

function ReconciliationTab({ data, loading }: { data?: ReportsData; loading: boolean }) {
  const r = data?.reconciliation;
  const u = (n: number) => `${n >= 0 ? '' : '−'}${formatNumber(Math.abs(n))} u`;
  const rows: Array<{ label: string; value: number; kind: 'base' | 'in' | 'out' | 'adj' | 'total' }> = r ? [
    { label: 'Opening Stock (start of period)', value: r.opening, kind: 'base' },
    { label: 'Purchases / Goods Received', value: r.purchases, kind: 'in' },
    { label: 'Customer Returns (restocked)', value: r.customerReturns, kind: 'in' },
    { label: 'Sales', value: -r.sales, kind: 'out' },
    { label: 'Disposals / Write-offs', value: -r.disposals, kind: 'out' },
    { label: 'Adjustments (net)', value: r.adjustments, kind: 'adj' },
    { label: 'Closing Stock (current)', value: r.closing, kind: 'total' },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Opening Stock" value={r ? `${formatNumber(r.opening)} u` : '—'} sub="Start of period" icon={Package} gradient="kpi-blue" loading={loading} />
        <KpiCard label="Purchases In" value={r ? `${formatNumber(r.purchases + r.customerReturns)} u` : '—'} sub="Received + returns" icon={TrendingUp} gradient="kpi-teal" loading={loading} />
        <KpiCard label="Sold / Out" value={r ? `${formatNumber(r.sales + r.disposals)} u` : '—'} sub="Sales + disposals" icon={Receipt} gradient="kpi-amber" loading={loading} />
        <KpiCard label="Closing Stock" value={r ? `${formatNumber(r.closing)} u` : '—'} sub="Current on hand" icon={Package} gradient="kpi-emerald" loading={loading} />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold">Stock Movement Reconciliation (units)</h3>
          {r && (
            <Badge variant={r.balanced ? 'success' : 'destructive'} dot className="text-xs">
              {r.balanced ? 'Balanced ✓' : 'Discrepancy'}
            </Badge>
          )}
        </div>
        <table className="w-full text-sm">
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className={cn('border-b border-border/40 last:border-0', row.kind === 'total' && 'bg-muted/40 font-bold')}>
                <td className="px-5 py-3">
                  <span className={cn(row.kind === 'in' && 'text-success', row.kind === 'out' && 'text-destructive', row.kind === 'total' && 'text-base')}>{row.label}</span>
                </td>
                <td className={cn('px-5 py-3 text-right tabular-nums font-semibold',
                  row.kind === 'in' && 'text-success', row.kind === 'out' && 'text-destructive')}>
                  {row.kind === 'in' ? '+ ' : row.kind === 'out' ? '' : ''}{u(row.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-5 py-3 text-xs text-muted-foreground">
          Opening + Purchases + Customer Returns − Sales − Disposals ± Adjustments = Closing. Opening is derived from the current closing balance and the period&apos;s movement ledger.
        </p>
      </div>
    </div>
  );
}

// ─── Tab: Returns Report ─────────────────────────────────────────────────────

const RET_STATUS: Record<string, 'warning' | 'success' | 'muted' | 'destructive'> = {
  pending: 'warning', approved: 'success', processed: 'muted', rejected: 'destructive',
};

function ReturnsTab({ data, loading }: { data?: ReportsData; loading: boolean }) {
  const ret = data?.returns;
  const hasData = !!ret && (ret.customer.count > 0 || ret.vendor.count > 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Customer Returns" value={ret ? formatNumber(ret.customer.count) : '—'} sub="In period" icon={Receipt} gradient="kpi-teal" loading={loading} />
        <KpiCard label="Refund Value" value={ret ? formatCurrency(ret.customer.refundValue) : '—'} sub="Paid back to customers" icon={TrendingUp} gradient="kpi-amber" loading={loading} />
        <KpiCard label="Return Value" value={ret ? formatCurrency(ret.customer.totalValue) : '—'} sub="Goods returned" icon={Package} gradient="kpi-purple" loading={loading} />
        <KpiCard label="Vendor Returns" value={ret ? formatNumber(ret.vendor.count) : '—'} sub={ret ? formatCurrency(ret.vendor.totalValue) : ''} icon={Package} gradient="kpi-blue" loading={loading} />
      </div>

      {!hasData ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <Receipt className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium">No returns in this period</p>
          <p className="text-xs text-muted-foreground mt-1">Customer and vendor returns logged under Sales → Returns appear here.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-3"><h3 className="text-sm font-semibold">Returns by Reason (customer)</h3></div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border/60 text-xs text-muted-foreground"><th className="px-5 py-2 text-left font-medium">Reason</th><th className="px-3 py-2 text-center font-medium">Count</th><th className="px-5 py-2 text-right font-medium">Value</th></tr></thead>
              <tbody>
                {ret!.customer.byReason.map((b) => (
                  <tr key={b.reason} className="border-b border-border/40 last:border-0">
                    <td className="px-5 py-2.5 capitalize">{b.reason.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">{b.count}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums font-semibold">{formatCurrency(b.value)}</td>
                  </tr>
                ))}
                {ret!.customer.byReason.length === 0 && <tr><td colSpan={3} className="px-5 py-6 text-center text-xs text-muted-foreground">No customer returns</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-3"><h3 className="text-sm font-semibold">Recent Returns</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border/60 text-xs text-muted-foreground"><th className="px-5 py-2 text-left font-medium">Return No.</th><th className="px-3 py-2 text-left font-medium">Party</th><th className="px-3 py-2 text-center font-medium">Qty</th><th className="px-3 py-2 text-center font-medium">Status</th><th className="px-5 py-2 text-right font-medium">Value</th></tr></thead>
                <tbody>
                  {ret!.recent.map((r) => (
                    <tr key={r.returnNumber} className="border-b border-border/40 last:border-0">
                      <td className="px-5 py-2.5 font-mono text-xs font-semibold text-primary">{r.returnNumber}</td>
                      <td className="px-3 py-2.5">{r.party}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">{r.qty}</td>
                      <td className="px-3 py-2.5 text-center"><Badge variant={RET_STATUS[r.status] ?? 'muted'} dot className="text-xs capitalize">{r.status}</Badge></td>
                      <td className="px-5 py-2.5 text-right tabular-nums font-semibold">{formatCurrency(r.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Sales Overview ─────────────────────────────────────────────────────

function SalesTab({ data, loading }: { data?: ReportsData; loading: boolean }) {
  const daily = data?.dailySales ?? [];
  const summary = data?.summary;

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Total Revenue" value={summary ? formatCurrency(summary.totalRevenue) : '—'} sub="vs previous period" icon={TrendingUp} gradient="kpi-teal" loading={loading} trend={toTrend(summary?.deltas?.revenue)} />
        <KpiCard label="Bills Issued" value={summary ? formatNumber(summary.totalBills) : '—'} sub="vs previous period" icon={Receipt} gradient="kpi-blue" loading={loading} trend={toTrend(summary?.deltas?.bills)} />
        <KpiCard label="Avg Bill Value" value={summary ? formatCurrency(summary.avgBillValue) : '—'} sub="Per transaction" icon={Activity} gradient="kpi-emerald" loading={loading} />
        <KpiCard label="Best Day" value={summary ? formatCurrency(summary.bestDay.revenue) : '—'} sub={summary ? formatDate(summary.bestDay.date) : '—'} icon={Star} gradient="kpi-amber" loading={loading} />
      </div>

      {/* Revenue + bills chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Daily Revenue & Bills</CardTitle>
          <CardDescription>Revenue trend with bill count overlay</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-72 w-full" /> : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={daily} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_TEAL} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={CHART_TEAL} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(v: string) => { const d = new Date(v); return `${d.getDate()}/${d.getMonth() + 1}`; }} />
                <YAxis yAxisId="rev" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} width={48} />
                <YAxis yAxisId="bills" orientation="right" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={36} />
                <Tooltip {...tooltipStyle}
                  formatter={(v: number, name: string) => [
                    name === 'revenue' ? formatCurrency(v) : v,
                    name === 'revenue' ? 'Revenue' : 'Bills',
                  ]}
                  labelFormatter={(l: string) => formatDate(l)} />
                <Area yAxisId="rev" type="monotone" dataKey="revenue" stroke={CHART_TEAL} strokeWidth={2} fill="url(#revGrad)" name="revenue" />
                <Bar yAxisId="bills" dataKey="bills" fill={CHART_BLUE} fillOpacity={0.3} name="bills" radius={[2, 2, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Payment methods + hourly pattern */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Payment Mix</CardTitle>
            <CardDescription>Revenue by payment method</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-48 w-full" /> : (
              <div className="space-y-3">
                {summary && Object.entries(summary.paymentMethods).map(([method, amount]) => {
                  const total = Object.values(summary.paymentMethods).reduce((s, v) => s + v, 0);
                  const pct = Math.round((amount / total) * 100);
                  const colors: Record<string, string> = { cash: CHART_TEAL, upi: CHART_BLUE, card: CHART_PURPLE, credit: CHART_AMBER };
                  const labels: Record<string, string> = { cash: 'Cash', upi: 'UPI / QR', card: 'Card', credit: 'Store Credit' };
                  return (
                    <div key={method}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium">{labels[method]}</span>
                        <span className="text-muted-foreground">{formatCurrency(amount)} <span className="text-foreground font-semibold">({pct}%)</span></span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: colors[method] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Peak Hours</CardTitle>
            <CardDescription>Average bills by hour of day</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-48 w-full" /> : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data?.hourlyPattern} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => [v, 'Bills']} />
                  <Bar dataKey="bills" fill={CHART_TEAL} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Tab: GST & Compliance ───────────────────────────────────────────────────

function GSTTab({ data, loading }: { data?: ReportsData; loading: boolean }) {
  const totals = data?.gstTotals;
  const slabs = data?.gstSlabs ?? [];

  async function exportGSTR1() {
    const now = new Date();
    const r = await apiFetch(`/api/reports/gstr1?month=${now.getMonth() + 1}&year=${now.getFullYear()}&format=csv`);
    if (!r.ok) { toast.error('GSTR-1 export failed'); return; }
    const blob = await r.blob();
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `gstr1-${String(now.getMonth() + 1).padStart(2, '0')}${now.getFullYear()}.csv`,
    });
    a.click();
    toast.success('GSTR-1 exported — B2CS + HSN summary ready for GST portal upload');
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Taxable Turnover" value={totals ? formatCurrency(totals.totalTaxable) : '—'} sub="Excl. exempt items" icon={Percent} gradient="kpi-blue" loading={loading} />
        <KpiCard label="Total GST" value={totals ? formatCurrency(totals.totalGST) : '—'} sub="CGST + SGST" icon={ShieldCheck} gradient="kpi-teal" loading={loading} />
        <KpiCard label="CGST Collected" value={totals ? formatCurrency(totals.cgst) : '—'} sub="Central GST" icon={TrendingUp} gradient="kpi-purple" loading={loading} />
        <KpiCard label="SGST Collected" value={totals ? formatCurrency(totals.sgst) : '—'} sub="State GST" icon={TrendingUp} gradient="kpi-rose" loading={loading} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* GST slab breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">GST Slab Breakdown</CardTitle>
                <CardDescription>Sales classified by applicable GST rate</CardDescription>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={exportGSTR1}>
                <Download className="h-3 w-3" /> GSTR-1
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-64 w-full" /> : (
              <div className="space-y-3">
                {slabs.map((slab) => (
                  <div key={slab.rate} className="rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Badge variant={slab.rate === 0 ? 'success' : 'muted'} className="font-mono text-xs w-10 justify-center">{slab.rate}%</Badge>
                        <span className="text-xs font-medium">{slab.description}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{slab.pct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-2">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${slab.pct}%` }} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div>
                        <p className="font-semibold">{formatCurrency(slab.taxable)}</p>
                        <p className="text-muted-foreground">Taxable</p>
                      </div>
                      <div>
                        <p className="font-semibold text-primary">{formatCurrency(slab.gst)}</p>
                        <p className="text-muted-foreground">GST</p>
                      </div>
                      <div>
                        <p className="font-semibold">{formatCurrency(slab.cgst)}</p>
                        <p className="text-muted-foreground">CGST</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* GST pie + effective rate */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Sales by Tax Category</CardTitle>
              <CardDescription>Proportion of exempt vs taxable sales</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              {loading ? <Skeleton className="h-40 w-40 rounded-full mx-auto" /> : (
                <>
                  <PieChart width={160} height={160}>
                    <Pie data={slabs} cx="50%" cy="50%" outerRadius={70} innerRadius={40} dataKey="pct" paddingAngle={2}>
                      {slabs.map((s, i) => <Cell key={s.rate} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                    </Pie>
                    <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v}%`, 'Share']} />
                  </PieChart>
                  <div className="space-y-2">
                    {slabs.map((s, i) => (
                      <div key={s.rate} className="flex items-center gap-2 text-xs">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }} />
                        <span className="text-muted-foreground">{s.rate}% GST</span>
                        <span className="ml-auto font-semibold">{s.pct}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50/40">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-800">Effective GST Rate: {totals?.effectiveRate ?? 0}%</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Due to exempt life-saving drugs, your blended rate is well below the statutory rates. Ensure GSTR-1 is filed by the 11th of next month.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Schedule-H register */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Schedule H Drug Register</CardTitle>
              <CardDescription>Legally mandated prescription drug dispensing log (Drugs & Cosmetics Act)</CardDescription>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={async () => {
              const r = await apiFetch('/api/schedule-register/export');
              if (!r.ok) { toast.error('Export failed'); return; }
              const blob = await r.blob();
              const a = Object.assign(document.createElement('a'), {
                href: URL.createObjectURL(blob),
                download: `schedule-register-${new Date().toISOString().slice(0, 10)}.csv`,
              });
              a.click();
              toast.success('Schedule register exported');
            }}>
              <Printer className="h-3 w-3" /> Export Register
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-40 w-full" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    {['Date', 'Medicine', 'Qty', 'Rx No.', 'Doctor', 'Reg. No.', 'Patient', 'Address'].map((h) => (
                      <th key={h} className="pb-2 pr-3 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data?.scheduleHLog.map((row, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="py-2 pr-3 whitespace-nowrap">{formatDate(row.date)}</td>
                      <td className="py-2 pr-3 font-medium whitespace-nowrap">{row.medicine}</td>
                      <td className="py-2 pr-3">{row.qty}</td>
                      <td className="py-2 pr-3 font-mono text-primary">{row.prescriptionNo}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{row.doctorName}</td>
                      <td className="py-2 pr-3 font-mono text-muted-foreground">{row.doctorReg}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{row.patientName}</td>
                      <td className="py-2 text-muted-foreground">{row.address}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab: Inventory Intelligence ─────────────────────────────────────────────

function StockTab({ data, loading }: { data?: ReportsData; loading: boolean }) {
  const router = useRouter();
  const summary = data?.summary;
  const deadStockPct = summary ? Math.round((summary.deadStockValue / summary.totalStockValue) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Stock Value" value={summary ? formatCurrency(summary.totalStockValue) : '—'} sub="Total inventory" icon={Package} gradient="kpi-blue" loading={loading} />
        <KpiCard label="Dead Stock" value={summary ? formatCurrency(summary.deadStockValue) : '—'} sub={`${deadStockPct}% of inventory`} icon={AlertTriangle} gradient="kpi-amber" loading={loading} />
        <KpiCard label="Top Category" value={summary?.topCategory ? summary.topCategory.replace(/\b\w/g, (c) => c.toUpperCase()) : '—'} sub="By revenue" icon={TrendingUp} gradient="kpi-teal" loading={loading} />
        <KpiCard label="Avg Margin" value={summary ? `${summary.grossMarginPct}%` : '—'} sub="Gross margin" icon={Percent} gradient="kpi-purple" loading={loading} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Category revenue */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Revenue by Category</CardTitle>
            <CardDescription>Which categories drive the most revenue</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-64 w-full" /> : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data?.categories} layout="vertical" margin={{ left: 80, right: 20, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="category" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={80} />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => [formatCurrency(v), 'Revenue']} />
                  <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                    {data?.categories.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Category margin table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Margin by Category</CardTitle>
            <CardDescription>Profitability health per category</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-64 w-full" /> : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    {['Category', 'Revenue', 'GST', 'Margin %'].map((h) => (
                      <th key={h} className="pb-2 pr-3 text-left font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data?.categories.map((c) => (
                    <tr key={c.category} className="hover:bg-muted/30">
                      <td className="py-2 pr-3 font-medium">{c.category}</td>
                      <td className="py-2 pr-3">{formatCurrency(c.revenue)}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{formatCurrency(c.gst)}</td>
                      <td className="py-2">
                        <span className={cn('font-semibold', c.margin >= 22 ? 'text-success' : c.margin >= 18 ? 'text-warning' : 'text-destructive')}>
                          {c.margin}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dead stock */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Dead Stock Alert</CardTitle>
              <CardDescription>Items with no sales in 90+ days — capital locked up</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="warning">{formatCurrency(data?.summary.deadStockValue ?? 0)} at risk</Badge>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => router.push('/stock?tab=inventory')}>
                View Stock <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-40 w-full" /> : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  {['Medicine', 'Category', 'Qty', 'Value', 'Last Sold', 'Expiry'].map((h) => (
                    <th key={h} className="pb-2 pr-3 text-left font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.deadStock.map((item, i) => (
                  <tr key={`${item.name}-${i}`} className="hover:bg-muted/30">
                    <td className="py-2 pr-3 font-medium">{item.name}</td>
                    <td className="py-2 pr-3"><Badge variant="muted" className="text-2xs">{item.category}</Badge></td>
                    <td className="py-2 pr-3">{item.qty}</td>
                    <td className="py-2 pr-3 font-semibold">{formatCurrency(item.value)}</td>
                    <td className="py-2 pr-3">
                      <span className="text-destructive font-medium">{item.lastSoldDays}d ago</span>
                    </td>
                    <td className="py-2 text-muted-foreground">{formatDate(item.batchExpiry)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab: Profitability ──────────────────────────────────────────────────────

function ProfitTab({ data, loading }: { data?: ReportsData; loading: boolean }) {
  const summary = data?.summary;
  const medicines = data?.topMedicines ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Gross Profit" value={summary ? formatCurrency(summary.grossProfit) : '—'} sub="After purchase cost" icon={TrendingUp} gradient="kpi-emerald" loading={loading} trend={toTrend(summary?.deltas?.grossProfit)} />
        <KpiCard label="Gross Margin" value={summary ? `${summary.grossMarginPct}%` : '—'} sub="Of total revenue" icon={Percent} gradient="kpi-teal" loading={loading} />
        <KpiCard label="GST Liability" value={data ? formatCurrency(data.gstTotals.totalGST) : '—'} sub="Payable this period" icon={ShieldCheck} gradient="kpi-rose" loading={loading} />
        <KpiCard label="Net Revenue" value={summary ? formatCurrency(summary.totalRevenue - (data?.gstTotals.totalGST ?? 0)) : '—'} sub="After GST" icon={Receipt} gradient="kpi-blue" loading={loading} />
      </div>

      {/* Top medicines by revenue with margin */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Top Medicines — Revenue & Margin</CardTitle>
          <CardDescription>Best performing medicines by revenue contribution</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-80 w-full" /> : (
            <div className="space-y-3">
              {medicines.slice(0, 8).map((m, i) => (
                <div key={`${m.name}-${i}`} className="flex items-center gap-3">
                  <span className="w-5 text-xs text-muted-foreground font-mono text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-xs font-medium truncate">{m.name}</p>
                        {m.scheduleH && <Badge variant="warning" className="text-2xs shrink-0">Sch-H</Badge>}
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-2">
                        <span className="text-xs text-muted-foreground">{formatCurrency(m.revenue)}</span>
                        <span className={cn('text-xs font-semibold w-10 text-right', m.margin >= 24 ? 'text-success' : m.margin >= 18 ? 'text-warning' : 'text-destructive')}>
                          {m.margin}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${medicines[0] ? (m.revenue / medicines[0].revenue) * 100 : 0}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category margin chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Margin by Category</CardTitle>
          <CardDescription>Which categories give the best profit</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-56 w-full" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data?.categories} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v}%`, 'Gross Margin']} />
                <Bar dataKey="margin" radius={[4, 4, 0, 0]}>
                  {data?.categories.map((c, i) => (
                    <Cell key={i} fill={c.margin >= 24 ? CHART_TEAL : c.margin >= 19 ? CHART_BLUE : CHART_AMBER} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab: Customer Insights ──────────────────────────────────────────────────

function CustomersTab({ data, loading }: { data?: ReportsData; loading: boolean }) {
  const router = useRouter();
  const summary = data?.summary;
  const total = (summary?.newCustomers ?? 0) + (summary?.returningCustomers ?? 0);
  const retentionPct = total > 0 ? Math.round(((summary?.returningCustomers ?? 0) / total) * 100) : 0;

  const retentionData = [
    { name: 'Returning', value: summary?.returningCustomers ?? 0, fill: CHART_TEAL },
    { name: 'New', value: summary?.newCustomers ?? 0, fill: CHART_BLUE },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Total Customers" value={summary ? formatNumber(total) : '—'} sub="This period" icon={Users} gradient="kpi-blue" loading={loading} />
        <KpiCard label="New Customers" value={summary ? formatNumber(summary.newCustomers) : '—'} sub="vs previous period" icon={ArrowUpRight} gradient="kpi-teal" loading={loading} trend={toTrend(summary?.deltas?.newCustomers)} />
        <KpiCard label="Retention Rate" value={`${retentionPct}%`} sub="Returning customers" icon={Activity} gradient="kpi-purple" loading={loading} />
        <KpiCard label="Avg Spend" value={summary ? formatCurrency(Math.round(summary.totalRevenue / total)) : '—'} sub="Per customer" icon={TrendingUp} gradient="kpi-emerald" loading={loading} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* New vs returning pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">New vs Returning</CardTitle>
            <CardDescription>Customer acquisition vs retention this period</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            {loading ? <Skeleton className="h-40 w-40 rounded-full mx-auto" /> : (
              <>
                <div className="relative">
                  <PieChart width={160} height={160}>
                    <Pie data={retentionData} cx="50%" cy="50%" outerRadius={70} innerRadius={45} dataKey="value" paddingAngle={3}>
                      {retentionData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                  </PieChart>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-lg font-bold">{retentionPct}%</p>
                      <p className="text-2xs text-muted-foreground">Retention</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3 flex-1">
                  {retentionData.map((d) => (
                    <div key={d.name}>
                      <div className="flex justify-between text-xs mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: d.fill }} />
                          <span className="font-medium">{d.name}</span>
                        </div>
                        <span className="font-semibold">{d.value}</span>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                    A retention rate above 60% indicates strong customer loyalty.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Top customers */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Top Customers by Spend</CardTitle>
                <CardDescription>Highest value customers this period</CardDescription>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => router.push('/customers')}>
                All Customers <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-48 w-full" /> : (
              <div className="space-y-2">
                {data?.topCustomers.map((c, i) => (
                  <div key={`${c.name}-${i}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/40 transition-colors">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{c.name}</p>
                      <p className="text-2xs text-muted-foreground">{c.visits} visits · Last: {formatDate(c.lastVisit)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold">{formatCurrency(c.totalSpend)}</p>
                      <p className="text-2xs text-muted-foreground">{c.loyaltyPts} pts</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Visit frequency chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Daily Footfall</CardTitle>
          <CardDescription>Number of bills per day — proxy for customer visits</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-48 w-full" /> : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={data?.dailySales} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="billGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_PURPLE} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={CHART_PURPLE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(v: string) => { const d = new Date(v); return `${d.getDate()}/${d.getMonth() + 1}`; }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={30} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [v, 'Bills']} labelFormatter={(l: string) => formatDate(l)} />
                <Area type="monotone" dataKey="bills" stroke={CHART_PURPLE} strokeWidth={2} fill="url(#billGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab: Cash Reconciliation ────────────────────────────────────────────────

const DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1];

function CashReconciliationTab({ data, loading }: { data?: ReportsData; loading: boolean }) {
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [closed, setClosed] = useState(false);
  const [saving, setSaving] = useState(false);
  const tenant = useAuthStore((s) => s.user?.tenantName ?? 'default');
  const { data: history = [], refetch: refetchHistory } = useQuery({ queryKey: ['day-close-history'], queryFn: fetchDayCloseHistory });

  const today = data?.dailySales[data.dailySales.length - 1];
  const systemCash = today?.cash ?? 0;
  const systemUPI = today?.upi ?? 0;
  const systemCard = today?.card ?? 0;
  const systemCredit = today?.credit ?? 0;
  const systemTotal = systemCash + systemUPI + systemCard + systemCredit;

  const physicalCash = DENOMINATIONS.reduce((sum, d) => sum + d * (Number(counts[d]) || 0), 0);
  const variance = physicalCash - systemCash;

  async function handleClose() {
    if (physicalCash === 0) { toast.warning('Enter physical cash count before closing'); return; }
    setSaving(true);
    try {
      const denominations = Object.fromEntries(DENOMINATIONS.map((d) => [d, Number(counts[d]) || 0]));
      await postDayClose({ physicalCash, denominations });
      setClosed(true);
      markDayClosed(tenant); // mirror for the synchronous browser-close guard
      refetchHistory();
      toast.success('Day closed successfully', {
        description: `Cash variance: ${variance >= 0 ? '+' : ''}₹${variance.toFixed(2)}. Recorded to the server.`,
        duration: 8000,
      });
    } catch (e) {
      const msg = (e as Error).message;
      if (/already been closed/i.test(msg)) {
        setClosed(true); markDayClosed(tenant); refetchHistory();
        toast.info('This day has already been closed');
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
      {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40" />)}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle description="Totals recorded in the system for today">Today's System Totals</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Cash Sales', value: systemCash, color: 'text-success border-success/20 bg-success/5' },
            { label: 'UPI Sales', value: systemUPI, color: 'text-blue-600 border-blue-200 bg-blue-50/50' },
            { label: 'Card Sales', value: systemCard, color: 'text-purple-600 border-purple-200 bg-purple-50/50' },
            { label: 'Credit/Due', value: systemCredit, color: 'text-warning-600 border-warning/20 bg-warning/5' },
          ].map(({ label, value, color }) => (
            <div key={label} className={cn('rounded-xl border p-4', color)}>
              <p className="text-xs font-medium mb-1">{label}</p>
              <p className="text-xl font-bold tabular-nums">{formatCurrency(value)}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-end">
          <span className="text-sm font-semibold text-foreground">
            System Total: <span className="text-primary">{formatCurrency(systemTotal)}</span>
          </span>
        </div>
      </div>

      <div>
        <SectionTitle description="Count the physical notes and coins in the till">Physical Cash Count</SectionTitle>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-3 border-b border-border bg-muted/30 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <span>Denomination</span>
            <span className="text-center">Count</span>
            <span className="text-right">Amount</span>
          </div>
          <div className="divide-y divide-border">
            {DENOMINATIONS.map((d) => {
              const count = Number(counts[d]) || 0;
              const amt = d * count;
              return (
                <div key={d} className="grid grid-cols-3 items-center px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Banknote className={cn('h-4 w-4', d >= 100 ? 'text-success' : 'text-muted-foreground')} />
                    <span className="text-sm font-semibold">₹{d}</span>
                  </div>
                  <div className="flex justify-center">
                    <input
                      type="number"
                      min={0}
                      value={counts[d] ?? ''}
                      onChange={(e) => setCounts((prev) => ({ ...prev, [d]: e.target.value }))}
                      placeholder="0"
                      disabled={closed}
                      className="w-20 h-8 text-center text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                    />
                  </div>
                  <div className="text-right text-sm tabular-nums font-medium">
                    {amt > 0 ? formatCurrency(amt) : <span className="text-muted-foreground">—</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground mb-1">System Cash</p>
              <p className="text-lg font-bold tabular-nums">{formatCurrency(systemCash)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Physical Cash</p>
              <p className={cn('text-lg font-bold tabular-nums', physicalCash > 0 ? 'text-foreground' : 'text-muted-foreground')}>
                {formatCurrency(physicalCash)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Variance</p>
              <p className={cn('text-xl font-bold tabular-nums', variance > 0 ? 'text-success' : variance < 0 ? 'text-destructive' : 'text-foreground')}>
                {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
              </p>
              <p className="text-xs mt-0.5 text-muted-foreground">
                {variance === 0 ? 'Balanced ✓' : variance > 0 ? 'Overage' : 'Shortage'}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={handleClose}
            disabled={closed || saving}
            variant={closed ? 'outline' : 'default'}
          >
            {closed
              ? <><CheckCircle className="h-4 w-4 text-success" /> Day Closed</>
              : saving
                ? <><Skeleton className="h-4 w-4 rounded-full" /> Closing…</>
                : <><Calculator className="h-4 w-4" /> Close Day</>
            }
          </Button>
        </div>
      </div>

      {closed && (
        <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/5 px-4 py-3">
          <CheckCircle className="h-5 w-5 text-success shrink-0" />
          <div>
            <p className="text-sm font-semibold text-success">End-of-day reconciliation complete</p>
            <p className="text-xs text-muted-foreground">
              Cash: {formatCurrency(physicalCash)} · UPI: {formatCurrency(systemUPI)} · Card: {formatCurrency(systemCard)} · Total: {formatCurrency(physicalCash + systemUPI + systemCard)}
            </p>
          </div>
        </div>
      )}

      {/* Audit trail — server-recorded day closes */}
      {history.length > 0 && (
        <div>
          <SectionTitle description="Every closed day is recorded on the server and auditable across devices">Day Close History</SectionTitle>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                  {['Date', 'Bills', 'System Cash', 'Physical', 'Variance', 'Total', 'Closed By'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map((h) => (
                  <tr key={h.id} className="hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{formatDate(h.closeDate)}</td>
                    <td className="px-3 py-2 tabular-nums">{h.billCount}</td>
                    <td className="px-3 py-2 tabular-nums">{formatCurrency(h.systemCash)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatCurrency(h.physicalCash)}</td>
                    <td className={cn('px-3 py-2 tabular-nums font-semibold', h.variance > 0 ? 'text-success' : h.variance < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                      {h.variance >= 0 ? '+' : ''}{formatCurrency(h.variance)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{formatCurrency(h.systemTotal)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{h.closedByName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main View ───────────────────────────────────────────────────────────────

export function ReportsView() {
  const router = useRouter();
  const can = useCan();
  const searchParams = useSearchParams();
  // Default the analytics window to Today (Divya R187) — the owner can widen it.
  const [days, setDays] = useState(1);

  // The report to show is chosen from the Reports sidebar submenu (?tab=).
  // Derived from the URL so client-side submenu clicks switch it reactively.
  const tabParam = searchParams.get('tab');
  const activeTab = tabParam && REPORT_TABS.includes(tabParam) ? tabParam : 'sales';

  // "Live" mode auto-refreshes the analytics every 30s (J5 — it was a dead label).
  const [live, setLive] = useState(false);
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['reports', days],
    queryFn: () => fetchReports(days),
    refetchInterval: live ? 30000 : false,
    refetchOnWindowFocus: live,
  });

  async function exportCSV() {
    const r = await apiFetch(`/api/reports/export?days=${days}`);
    if (!r.ok) { toast.error('Export failed'); return; }
    const blob = await r.blob();
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `pharmaos-report-${days}d-${new Date().toISOString().substring(0, 10)}.csv`,
    });
    a.click();
    toast.success('Bill-level report exported as CSV');
  }

  function printReport() {
    const win = window.open('', '_blank');
    if (!win || !data) return;
    const s = data.summary;
    win.document.write(`
      <html><head><title>Pharma Ist Report</title>
      <style>body{font-family:sans-serif;padding:24px;color:#1e293b;}h1{color:#0d9488;}
      table{width:100%;border-collapse:collapse;margin-top:16px;}
      th,td{border:1px solid #e2e8f0;padding:8px;text-align:left;font-size:12px;}
      th{background:#f8fafc;font-weight:600;}</style></head><body>
      <h1>Pharma Ist Analytics Report</h1>
      <p>Period: Last ${days} days &nbsp;|&nbsp; Generated: ${new Date().toLocaleString()}</p>
      <h2>Summary</h2>
      <table><tr><th>Metric</th><th>Value</th></tr>
      <tr><td>Total Revenue</td><td>₹${s.totalRevenue.toLocaleString()}</td></tr>
      <tr><td>Total Bills</td><td>${s.totalBills}</td></tr>
      <tr><td>Avg Bill Value</td><td>₹${s.avgBillValue}</td></tr>
      <tr><td>Gross Profit</td><td>₹${s.grossProfit.toLocaleString()}</td></tr>
      <tr><td>Gross Margin</td><td>${s.grossMarginPct}%</td></tr>
      <tr><td>GST Collected</td><td>₹${s.totalGST.toLocaleString()}</td></tr>
      </table>
      <h2>Daily Sales</h2>
      <table><tr><th>Date</th><th>Revenue</th><th>Bills</th><th>GST</th></tr>
      ${data.dailySales.map((d) => `<tr><td>${d.date}</td><td>₹${d.revenue.toLocaleString()}</td><td>${d.bills}</td><td>₹${d.gst.toLocaleString()}</td></tr>`).join('')}
      </table></body></html>
    `);
    win.document.close(); win.print();
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground">Sales intelligence, GST compliance, stock health and customer insights</p>
        </div>
        <div className="flex gap-2">
          {can('reports:export') && (
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={!data}>
              <FileSpreadsheet className="h-4 w-4" /> Export CSV
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={printReport} disabled={!data}>
            <FileText className="h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      {/* Current report (chosen from the Reports sidebar submenu) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            {activeTab === 'daily-close' ? <Calculator className="h-4 w-4 text-primary" /> : <TrendingUp className="h-4 w-4 text-primary" />}
          </span>
          <div>
            <p className="text-sm font-bold leading-tight">{REPORT_META[activeTab]?.label}</p>
            <p className="text-xs text-muted-foreground">{REPORT_META[activeTab]?.desc}</p>
          </div>
        </div>

        {/* Period selector — not applicable to the Daily Close reconciliation */}
        {activeTab !== 'daily-close' && (
          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-muted/30 p-1 w-fit">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                onClick={() => setDays(p.days)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                  days === p.days ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setLive((v) => !v)}
              title={live ? 'Live auto-refresh on (every 30s)' : 'Turn on live auto-refresh'}
              className={cn(
                'ml-1 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
                live ? 'bg-success/15 text-success' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span className={cn('h-2 w-2 rounded-full', live ? 'bg-success animate-pulse' : 'bg-muted-foreground/40')} />
              {live ? (isFetching ? 'Refreshing…' : 'Live') : 'Live'}
            </button>
          </div>
        )}
      </div>

      {/* Only the selected report renders */}
      <div className="mt-1">
        {activeTab === 'sales' && <SalesTab data={data} loading={isLoading} />}
        {activeTab === 'purchase' && <PurchaseTab data={data} loading={isLoading} />}
        {activeTab === 'gst' && <GSTTab data={data} loading={isLoading} />}
        {activeTab === 'stock' && <StockTab data={data} loading={isLoading} />}
        {activeTab === 'reconciliation' && <ReconciliationTab data={data} loading={isLoading} />}
        {activeTab === 'returns' && <ReturnsTab data={data} loading={isLoading} />}
        {activeTab === 'profit' && <ProfitTab data={data} loading={isLoading} />}
        {activeTab === 'customers' && <CustomersTab data={data} loading={isLoading} />}
        {activeTab === 'daily-close' && <CashReconciliationTab data={data} loading={isLoading} />}
      </div>
    </div>
  );
}

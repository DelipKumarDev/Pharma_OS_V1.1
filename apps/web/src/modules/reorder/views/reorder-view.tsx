'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, ShoppingCart, TrendingDown, CheckCircle2, Bell,
  Package, ChevronDown, ChevronRight, Star, Clock, Zap,
  RotateCcw, MessageSquare, Download,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ReorderItem, ReorderAlert, ReorderStats } from '@pharmaos/types';
import { formatCurrency } from '@pharmaos/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

async function fetchReorderStats(): Promise<ReorderStats> {
  const res = await apiFetch('/api/reorder/stats');
  const json = await res.json() as { success: boolean; data: ReorderStats };
  if (!res.ok) throw new Error('Request failed');
  return json.data ?? ({} as ReorderStats);
}

async function fetchReorderItems(priority?: string, status?: string): Promise<ReorderItem[]> {
  const params = new URLSearchParams();
  if (priority && priority !== 'all') params.set('priority', priority);
  if (status && status !== 'all') params.set('status', status);
  const res = await apiFetch(`/api/reorder?${params}`);
  const json = await res.json() as { success: boolean; data: { data: ReorderItem[] } };
  if (!res.ok) throw new Error('Request failed');
  return json.data?.data ?? ([] as ReorderItem[]);
}

async function fetchAlerts(): Promise<ReorderAlert[]> {
  const res = await apiFetch('/api/reorder/alerts?acknowledged=false');
  const json = await res.json() as { success: boolean; data: { data: ReorderAlert[] } };
  if (!res.ok) throw new Error('Request failed');
  return json.data?.data ?? ([] as ReorderAlert[]);
}

async function updateReorderItem(id: string, data: Partial<ReorderItem>): Promise<void> {
  await apiFetch(`/api/reorder/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
}

async function acknowledgeAlert(id: string): Promise<void> {
  await apiFetch(`/api/reorder/alerts/${id}/acknowledge`, { method: 'PATCH' });
}

const PRIORITY_CONFIG = {
  critical: { label: 'Critical', color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/30', badge: 'destructive' as const, icon: Zap },
  high: { label: 'High Priority', color: 'text-warning-700', bg: 'bg-warning/10 border-warning-300', badge: 'warning' as const, icon: AlertTriangle },
  medium: { label: 'Medium', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800', badge: 'default' as const, icon: Clock },
  low: { label: 'Low', color: 'text-muted-foreground', bg: 'bg-muted/30 border-border', badge: 'secondary' as const, icon: Package },
};

const RELIABILITY_ICON = { excellent: '★★★★★', good: '★★★★☆', average: '★★★☆☆', poor: '★★☆☆☆' };

function ReorderCard({ item, onOrder, onDismiss }: { item: ReorderItem; onOrder: (id: string) => void; onDismiss: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const config = PRIORITY_CONFIG[item.priority];
  const PriorityIcon = config.icon;

  const stockPercent = Math.round((item.currentStock / item.reorderLevel) * 100);

  return (
    <div className={cn('rounded-xl border p-4 transition-all', config.bg)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', item.priority === 'critical' ? 'bg-destructive/20' : item.priority === 'high' ? 'bg-warning/20' : 'bg-muted')}>
            <PriorityIcon className={cn('h-4 w-4', config.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{item.medicineName}</p>
              <Badge variant={config.badge} className="text-xs">{config.label}</Badge>
              {item.status === 'ordered' && <Badge variant="success" className="text-xs">Ordered</Badge>}
            </div>
            {item.genericName && <p className="text-xs text-muted-foreground">{item.genericName}</p>}

            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Current Stock</span>
                <p className={cn('font-bold', item.currentStock === 0 ? 'text-destructive' : item.currentStock < item.reorderLevel * 0.3 ? 'text-warning-700' : 'text-foreground')}>
                  {item.currentStock} units
                </p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Reorder Level</span>
                <p className="font-medium">{item.reorderLevel} units</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Suggested Order</span>
                <p className="font-medium text-primary">{item.suggestedQty} units</p>
              </div>
              {item.daysStockLeft !== undefined && (
                <div>
                  <span className="text-muted-foreground text-xs">Stock Left</span>
                  <p className={cn('font-bold', item.daysStockLeft === 0 ? 'text-destructive' : item.daysStockLeft <= 3 ? 'text-warning-700' : 'text-foreground')}>
                    {item.daysStockLeft === 0 ? 'Out of Stock' : `~${item.daysStockLeft} day${item.daysStockLeft !== 1 ? 's' : ''}`}
                  </p>
                </div>
              )}
              <div>
                <span className="text-muted-foreground text-xs">Sold (30 days)</span>
                <p className="font-medium">{item.lastSaleQty30Days} units</p>
              </div>
            </div>

            {/* Stock progress bar */}
            <div className="mt-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Stock vs Reorder Level</span>
                <span>{stockPercent}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', item.currentStock === 0 ? 'bg-destructive' : stockPercent < 30 ? 'bg-warning-500' : 'bg-primary')}
                  style={{ width: `${Math.min(100, stockPercent)}%` }}
                />
              </div>
            </div>

            {item.preferredVendor && (
              <p className="mt-2 text-xs text-muted-foreground">
                <Star className="inline h-3 w-3 text-amber-400 fill-amber-400 mr-0.5" />
                Preferred: {item.preferredVendor}
                {item.lastPurchasePrice && ` · Last price: ${formatCurrency(item.lastPurchasePrice)}/unit`}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          {item.status !== 'ordered' && (
            <Button size="sm" onClick={() => onOrder(item.id)} className="whitespace-nowrap">
              <ShoppingCart className="h-3.5 w-3.5" /> Order Now
            </Button>
          )}
          {item.status === 'ordered' && (
            <Button size="sm" variant="outline" onClick={() => onDismiss(item.id)}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Mark Received
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)} className="text-xs">
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Vendors ({item.vendorSuggestions.length})
          </Button>
        </div>
      </div>

      {expanded && item.vendorSuggestions.length > 0 && (
        <div className="mt-4 rounded-lg border bg-card p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vendor Suggestions</p>
          <div className="space-y-2">
            {item.vendorSuggestions.map((vs, idx) => (
              <div key={vs.vendorId} className={cn('flex items-center justify-between rounded-md p-2.5', idx === 0 ? 'bg-primary/5 border border-primary/20' : 'bg-muted/30')}>
                <div>
                  <div className="flex items-center gap-1.5">
                    {idx === 0 && <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />}
                    <p className="text-sm font-medium">{vs.vendorName}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Lead time: {vs.leadTimeDays} day{vs.leadTimeDays !== 1 ? 's' : ''} · {RELIABILITY_ICON[vs.reliability]}</p>
                  <p className="text-xs text-muted-foreground">Last order: {vs.lastOrderDate}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{formatCurrency(vs.lastPrice)}<span className="text-xs font-normal text-muted-foreground">/unit</span></p>
                  <p className="text-xs text-muted-foreground">Est. total: {formatCurrency(vs.lastPrice * item.suggestedQty)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {item.notes && (
        <div className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          {item.notes}
        </div>
      )}
    </div>
  );
}

function AlertCard({ alert, onAcknowledge }: { alert: ReorderAlert; onAcknowledge: (id: string) => void }) {
  const alertColors = { critical: 'border-destructive/40 bg-destructive/5', warning: 'border-warning-300 bg-warning/5', info: 'border-border bg-muted/30' };
  const alertIcons = { critical: <Zap className="h-4 w-4 text-destructive" />, warning: <AlertTriangle className="h-4 w-4 text-warning-600" />, info: <Bell className="h-4 w-4 text-muted-foreground" /> };
  const typeLabels: Record<string, string> = { out_of_stock: 'Out of Stock', critical_stock: 'Critical Stock', low_stock: 'Low Stock', expiry_risk: 'Expiry Risk' };

  return (
    <div className={cn('flex items-center justify-between rounded-lg border p-3', alertColors[alert.severity])}>
      <div className="flex items-center gap-3">
        {alertIcons[alert.severity]}
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{alert.medicineName}</p>
            <Badge variant={alert.severity === 'critical' ? 'destructive' : alert.severity === 'warning' ? 'warning' : 'secondary'} className="text-xs">
              {typeLabels[alert.alertType] ?? alert.alertType}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">Current: {alert.currentQty} units · Threshold: {alert.threshold} units</p>
        </div>
      </div>
      <Button size="sm" variant="ghost" onClick={() => onAcknowledge(alert.id)} className="text-xs shrink-0">
        <CheckCircle2 className="h-3.5 w-3.5" /> Acknowledge
      </Button>
    </div>
  );
}

export function ReorderView() {
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('pending');
  const qc = useQueryClient();

  const { data: stats } = useQuery({ queryKey: ['reorder-stats'], queryFn: fetchReorderStats });
  const { data: items = [], isLoading } = useQuery({ queryKey: ['reorder', priorityFilter, statusFilter], queryFn: () => fetchReorderItems(priorityFilter, statusFilter) });
  const { data: alerts = [] } = useQuery({ queryKey: ['reorder-alerts'], queryFn: fetchAlerts });

  const orderMutation = useMutation({
    mutationFn: (id: string) => updateReorderItem(id, { status: 'ordered' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reorder'] }); qc.invalidateQueries({ queryKey: ['reorder-stats'] }); toast.success('Item marked as ordered'); },
  });

  const receiveMutation = useMutation({
    mutationFn: (id: string) => updateReorderItem(id, { status: 'received' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reorder'] }); toast.success('Stock marked as received'); },
  });

  const ackMutation = useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reorder-alerts'] }); toast.success('Alert acknowledged'); },
  });

  function exportReorderList() {
    const headers = ['Medicine', 'Generic', 'Current Stock', 'Reorder Level', 'Suggested Qty', 'Priority', 'Status', 'Days Left', 'Preferred Vendor', 'Last Price'];
    const rows = items.map(i => [i.medicineName, i.genericName ?? '', i.currentStock, i.reorderLevel, i.suggestedQty, i.priority, i.status, i.daysStockLeft ?? '', i.preferredVendor ?? '', i.lastPurchasePrice ?? ''].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `reorder-queue-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Reorder list exported');
  }

  const statCards = [
    { label: 'Pending Reorders', value: stats?.totalPending ?? 0, icon: RotateCcw, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Critical Items', value: stats?.criticalItems ?? 0, icon: Zap, color: 'text-destructive', bg: 'bg-destructive/10' },
    { label: 'High Priority', value: stats?.highPriorityItems ?? 0, icon: AlertTriangle, color: 'text-warning-700', bg: 'bg-warning/10' },
    { label: 'Out of Stock', value: stats?.outOfStock ?? 0, icon: TrendingDown, color: 'text-destructive', bg: 'bg-destructive/10' },
    { label: 'Ordered Today', value: stats?.orderedToday ?? 0, icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
    { label: 'Active Alerts', value: stats?.totalAlerts ?? 0, icon: Bell, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reorder Intelligence</h1>
          <p className="text-sm text-muted-foreground">Smart procurement queue — never run out of critical medicines</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportReorderList}>
            <Download className="h-4 w-4" /> Export Queue
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', bg)}>
              <Icon className={cn('h-4 w-4', color)} />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold leading-tight">{value}</p>
              <p className="text-xs text-muted-foreground leading-tight">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {alerts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-warning-600" />
            <h2 className="font-semibold">Active Alerts</h2>
            <Badge variant="warning" className="text-xs">{alerts.length}</Badge>
          </div>
          <div className="space-y-2">
            {alerts.map(alert => (
              <AlertCard key={alert.id} alert={alert} onAcknowledge={id => ackMutation.mutate(id)} />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Reorder Queue</h2>
          <div className="flex gap-2">
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="ordered">Ordered</SelectItem>
                <SelectItem value="received">Received</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading reorder queue…</div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-border bg-card py-16 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-success" />
            <p className="font-semibold text-success">All Stocked Up!</p>
            <p className="text-sm text-muted-foreground mt-1">No medicines need reordering right now</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <ReorderCard
                key={item.id}
                item={item}
                onOrder={id => orderMutation.mutate(id)}
                onDismiss={id => receiveMutation.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { CalendarX2, AlertTriangle, CheckCircle, XCircle, Download, RotateCcw, Trash2, Tag, Package } from 'lucide-react';
import { toast } from 'sonner';
import type { InventoryItem } from '@pharmaos/types';
import { formatCurrency, formatDate, daysUntilExpiry } from '@pharmaos/utils';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { exportToExcel } from '@/lib/export';

// The inventory API returns medicine fields flat (medicineName / dosageForm),
// not a nested `medicine` object.
type InvRow = InventoryItem & { medicineName?: string; supplierName?: string };
const medName = (i: InventoryItem) => (i as InvRow).medicineName ?? '—';

async function fetchInventory(): Promise<InventoryItem[]> {
  const res = await apiFetch('/api/inventory?limit=1000');
  const json = await res.json() as { success: boolean; data: { data: InventoryItem[] } };
  if (!res.ok) throw new Error('Request failed');
  return json.data?.data ?? ([] as InventoryItem[]);
}

// Human-readable time-to-expiry with an explicit unit (TC_010).
function expiryLabel(dateStr: string): string {
  const d = daysUntilExpiry(dateStr);
  if (d < 0) { const n = Math.abs(d); return `${n} day${n !== 1 ? 's' : ''} over`; }
  if (d < 60) return `${d} day${d !== 1 ? 's' : ''}`;
  const m = Math.round(d / 30);
  return `${m} month${m !== 1 ? 's' : ''}`;
}

function exportExpiryExcel(data: InventoryItem[], label: string) {
  const headers = ['Medicine', 'Batch', 'Qty', 'MRP', 'Value at Risk', 'Expiry Date', 'Time Left', 'Rack', 'Supplier'];
  const rows = data.map((i) => [
    medName(i), i.batchNumber, i.availableQuantity, i.mrp,
    (i.availableQuantity * i.mrp).toFixed(2), formatDate(i.expiryDate),
    expiryLabel(i.expiryDate), i.rackLocation ?? '', (i as InvRow).supplierName ?? '',
  ]);
  exportToExcel(`expiry-${label}-${new Date().toISOString().split('T')[0]}`, headers, rows);
  toast.success(`Exported ${data.length} items`);
}

export function ExpiryView() {
  const qc = useQueryClient();
  const router = useRouter();
  const [disposeTarget, setDisposeTarget] = useState<InventoryItem | null>(null);
  const [returnTarget, setReturnTarget] = useState<InventoryItem | null>(null);
  const [discountTarget, setDiscountTarget] = useState<InventoryItem | null>(null);
  const [discountPct, setDiscountPct] = useState('25');
  const [bulkDispose, setBulkDispose] = useState(false);

  const { data: rawData = [], isLoading } = useQuery({ queryKey: ['inventory', 'all'], queryFn: fetchInventory });
  // Once a batch is fully disposed / exhausted (0 available), there is nothing
  // left to return or dispose — drop it so "Mark Disposed" visibly clears it.
  const data = rawData.filter((i) => (i.availableQuantity ?? 0) > 0);

  const now = Date.now();
  const expired = data.filter((i) => new Date(i.expiryDate).getTime() < now);
  const expiring30 = data.filter((i) => { const t = new Date(i.expiryDate).getTime() - now; return t >= 0 && t <= 30 * 86400000; });
  const expiring60 = data.filter((i) => { const t = new Date(i.expiryDate).getTime() - now; return t > 30 * 86400000 && t <= 60 * 86400000; });
  const expiring90 = data.filter((i) => { const t = new Date(i.expiryDate).getTime() - now; return t > 60 * 86400000 && t <= 90 * 86400000; });
  const goodStock = data.filter((i) => new Date(i.expiryDate).getTime() - now > 90 * 86400000);

  const valueAtRisk30 = expiring30.reduce((s, i) => s + i.availableQuantity * i.mrp, 0);
  const valueAtRisk60 = expiring60.reduce((s, i) => s + i.availableQuantity * i.mrp, 0);
  const valueAtRisk90 = expiring90.reduce((s, i) => s + i.availableQuantity * i.mrp, 0);
  const expiredValue = expired.reduce((s, i) => s + i.availableQuantity * i.mrp, 0);

  // Dispose = deduct the full remaining quantity of a batch (correct backend
  // payload: adjustmentType + quantity + notes) — TC_018.
  async function disposeBatch(item: InventoryItem) {
    const r = await apiFetch(`/api/inventory/${item.id}/adjust`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adjustmentType: 'damage', quantity: item.availableQuantity, notes: 'Expired units disposed' }),
    });
    const j = await r.json() as { success: boolean; message?: string };
    if (!r.ok || !j.success) throw new Error(j.message ?? 'Dispose failed');
  }

  const disposeMutation = useMutation({
    mutationFn: (item: InventoryItem) => disposeBatch(item),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Batch marked as disposed', { description: 'Stock deducted and audit log updated.' });
      setDisposeTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Bulk dispose every expired batch (TC_011).
  const bulkDisposeMutation = useMutation({
    mutationFn: async () => {
      let ok = 0;
      for (const item of expired) { try { await disposeBatch(item); ok++; } catch { /* continue */ } }
      return ok;
    },
    onSuccess: (ok) => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      toast.success(`Disposed ${ok} expired batch${ok !== 1 ? 'es' : ''}`, { description: 'Stock deducted; audit log updated.' });
      setBulkDispose(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Initiate a supplier return for a near/expired batch — creates a real vendor
  // return so the count/stock updates (TC_015).
  const returnMutation = useMutation({
    mutationFn: async (item: InventoryItem) => {
      const r = await apiFetch('/api/returns', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'vendor_return', reason: 'near_expiry', refundMethod: 'credit_note',
          vendorName: (item as InvRow).supplierName ?? undefined,
          items: [{ medicineId: item.medicineId, medicineName: medName(item), batchNumber: item.batchNumber, expiryDate: item.expiryDate, returnQty: item.availableQuantity, unitPrice: item.mrp, totalAmount: item.availableQuantity * item.mrp, condition: 'expired' }],
        }),
      });
      const j = await r.json() as { success: boolean; message?: string; data?: { returnNumber?: string } };
      if (!r.ok || !j.success) throw new Error(j.message ?? 'Return failed');
      return j.data?.returnNumber;
    },
    onSuccess: (num) => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['returns'] });
      toast.success(`Return ${num ?? ''} initiated`, {
        description: 'Track it under Procurement → Purchase Returns.',
        action: { label: 'View in Returns', onClick: () => router.push('/purchase-returns') },
      });
      setReturnTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Apply a clearance discount to a near-expiry batch's selling price (TC_017).
  const discountMutation = useMutation({
    mutationFn: async ({ item, pct }: { item: InventoryItem; pct: number }) => {
      const newPrice = Number((item.mrp * (1 - pct / 100)).toFixed(2));
      const r = await apiFetch(`/api/inventory/${item.id}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'available', sellingPrice: newPrice }),
      });
      const j = await r.json() as { success: boolean; message?: string };
      if (!r.ok || !j.success) throw new Error(j.message ?? 'Discount failed');
      return newPrice;
    },
    onSuccess: (newPrice, { item }) => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      toast.success(`Discount applied to ${medName(item)}`, { description: `Clearance price set to ${formatCurrency(newPrice)}` });
      setDiscountTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function buildColumns(showDaysLeft = true): ColumnDef<InventoryItem>[] {
    return [
      {
        id: 'medicine',
        accessorFn: (row) => medName(row),
        header: 'Medicine',
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-sm">{medName(row.original)}</p>
            <p className="text-xs text-muted-foreground">{row.original.manufacturer ?? ''}</p>
          </div>
        ),
      },
      {
        accessorKey: 'batchNumber',
        header: 'Batch',
        cell: ({ row }) => <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{row.original.batchNumber}</code>,
      },
      {
        accessorKey: 'availableQuantity',
        header: ({ column }) => <SortableHeader column={column}>Qty</SortableHeader>,
        cell: ({ row }) => <span className="font-semibold tabular-nums">{row.original.availableQuantity}</span>,
      },
      {
        id: 'valueAtRisk',
        header: 'Value at Risk',
        cell: ({ row }) => (
          <span className="text-sm font-medium text-warning-600 tabular-nums">
            {formatCurrency(row.original.availableQuantity * row.original.mrp)}
          </span>
        ),
      },
      {
        accessorKey: 'expiryDate',
        header: ({ column }) => <SortableHeader column={column}>Expiry Date</SortableHeader>,
        cell: ({ row }) => <span className="text-sm">{formatDate(row.original.expiryDate)}</span>,
      },
      ...(showDaysLeft ? [{
        id: 'daysLeft',
        header: ({ column }: { column: Parameters<typeof SortableHeader>[0]['column'] }) => <SortableHeader column={column}>Time Left</SortableHeader>,
        cell: ({ row }: { row: { original: InventoryItem } }) => {
          const days = daysUntilExpiry(row.original.expiryDate);
          return (
            <Badge variant={days < 0 ? 'error' : days <= 30 ? 'error' : days <= 60 ? 'warning' : 'muted'} className="text-xs tabular-nums">
              {expiryLabel(row.original.expiryDate)}
            </Badge>
          );
        },
      }] : []),
      {
        accessorKey: 'rackLocation',
        header: 'Rack',
        cell: ({ row }) => <code className="text-xs font-mono text-muted-foreground">{row.original.rackLocation ?? '—'}</code>,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          // Already-expired stock cannot be sold, so a clearance Discount makes no
          // sense — only Return / Dispose apply. Discount is for near-expiry only.
          const isExpired = daysUntilExpiry(row.original.expiryDate) < 0;
          return (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setReturnTarget(row.original)}>
                <RotateCcw className="h-3 w-3" /> Return
              </Button>
              {!isExpired && (
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => { setDiscountPct('25'); setDiscountTarget(row.original); }}>
                  <Tag className="h-3 w-3" /> Discount
                </Button>
              )}
              <Button variant="destructive" size="sm" className="h-7 text-xs gap-1" onClick={() => setDisposeTarget(row.original)}>
                <Trash2 className="h-3 w-3" /> Dispose
              </Button>
            </div>
          );
        },
      },
    ] as ColumnDef<InventoryItem>[];
  }

  const SUMMARY_CARDS = [
    { label: 'Expired Batches', value: expired.length, valueAt: expiredValue, icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', tab: 'expired' },
    { label: 'Expiring in 30 Days', value: expiring30.length, valueAt: valueAtRisk30, icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10', tab: 'expiring30' },
    { label: 'Expiring in 60 Days', value: expiring60.length, valueAt: valueAtRisk60, icon: CalendarX2, color: 'text-orange-500', bg: 'bg-orange-50', tab: 'expiring60' },
    { label: 'Expiring in 90 Days', value: expiring90.length, valueAt: valueAtRisk90, icon: AlertTriangle, color: 'text-warning-600', bg: 'bg-warning/10', tab: 'expiring90' },
    { label: 'Good Stock', value: goodStock.length, valueAt: null, icon: CheckCircle, color: 'text-success', bg: 'bg-success/10', tab: 'good' },
  ];

  const [activeTab, setActiveTab] = useState('expiring30');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expiry Monitor</h1>
          <p className="text-sm text-muted-foreground">Monitor, act on, and prevent expiry losses — Return · Discount · Dispose</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportExpiryExcel([...expired, ...expiring30, ...expiring60, ...expiring90], 'full-report')}>
            <Download className="h-4 w-4" /> Export Report
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {SUMMARY_CARDS.map(({ label, value, valueAt, icon: Icon, color, bg, tab }) => (
          <div
            key={label}
            className={cn(
              'flex flex-col gap-1.5 rounded-xl border border-border bg-card p-4 cursor-pointer transition-colors',
              activeTab === tab ? 'border-primary/40 bg-primary/5' : 'hover:bg-muted/30'
            )}
            onClick={() => setActiveTab(tab)}
          >
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', bg)}>
              <Icon className={cn('h-4 w-4', color)} />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
              {valueAt !== null && (
                <p className={cn('text-xs font-medium mt-0.5', value > 0 ? 'text-warning-600' : 'text-muted-foreground')}>
                  {value > 0 ? `₹${(valueAt / 1000).toFixed(1)}K at risk` : 'No risk'}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="expired" className="gap-1.5 text-xs">
            <XCircle className="h-3.5 w-3.5" /> Expired
            {expired.length > 0 && <Badge variant="error" className="h-4 min-w-4 px-1 text-2xs">{expired.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="expiring30" className="gap-1.5 text-xs">
            Within 30 Days
            {expiring30.length > 0 && <Badge variant="error" className="h-4 min-w-4 px-1 text-2xs">{expiring30.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="expiring60" className="gap-1.5 text-xs">
            31–60 Days
            {expiring60.length > 0 && <Badge variant="warning" className="h-4 min-w-4 px-1 text-2xs">{expiring60.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="expiring90" className="gap-1.5 text-xs">
            61–90 Days
            {expiring90.length > 0 && <Badge variant="muted" className="h-4 min-w-4 px-1 text-2xs">{expiring90.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="good" className="gap-1.5 text-xs">
            <CheckCircle className="h-3.5 w-3.5" /> Good Stock
          </TabsTrigger>
        </TabsList>

        <TabsContent value="expired">
          {expired.length > 0 && (
            <div className="mb-3 flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" />
                <p className="text-sm font-medium text-destructive">{expired.length} batches expired — Value at risk: {formatCurrency(expiredValue)}</p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setBulkDispose(true)}>Bulk Dispose</Button>
            </div>
          )}
          <DataTable columns={buildColumns(false)} data={expired} loading={isLoading} globalSearch searchPlaceholder="Search expired items…" emptyMessage="No expired items" emptyDescription="Great! No batches have expired." />
        </TabsContent>

        <TabsContent value="expiring30">
          {expiring30.length > 0 && (
            <div className="mb-3 flex items-center justify-between rounded-lg border border-warning/20 bg-warning/5 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning-600" />
                <p className="text-sm font-medium text-warning-600">{expiring30.length} batches expire in 30 days — Value at risk: {formatCurrency(valueAtRisk30)}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => exportExpiryExcel(expiring30, '30d')}>
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
            </div>
          )}
          <DataTable columns={buildColumns()} data={expiring30} loading={isLoading} globalSearch searchPlaceholder="Search near-expiry items…" emptyMessage="No items expiring in 30 days" emptyDescription="No urgent expiry alerts." />
        </TabsContent>

        <TabsContent value="expiring60">
          {expiring60.length > 0 && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5">
              <CalendarX2 className="h-4 w-4 text-orange-500" />
              <p className="text-sm font-medium text-orange-700">{expiring60.length} batches expire in 31–60 days — Value: {formatCurrency(valueAtRisk60)}</p>
            </div>
          )}
          <DataTable columns={buildColumns()} data={expiring60} loading={isLoading} globalSearch searchPlaceholder="Search 31–60 day expiry…" emptyMessage="No items expiring in 31–60 days" emptyDescription="No alerts for this window." />
        </TabsContent>

        <TabsContent value="expiring90">
          <DataTable columns={buildColumns()} data={expiring90} loading={isLoading} globalSearch searchPlaceholder="Search 61–90 day expiry…" emptyMessage="No items expiring in 61–90 days" emptyDescription="No alerts for this window." />
        </TabsContent>

        <TabsContent value="good">
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-4 py-2.5">
            <CheckCircle className="h-4 w-4 text-success" />
            <p className="text-sm text-success-700 font-medium">{goodStock.length} batches have good stock with 90+ days to expiry</p>
          </div>
          <DataTable
            columns={[
              { accessorKey: 'medicine', header: 'Medicine', cell: ({ row }) => { const med = row.original.medicine as { name: string } | undefined; return <p className="font-medium text-sm">{med?.name ?? '—'}</p>; } },
              { accessorKey: 'batchNumber', header: 'Batch', cell: ({ row }) => <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{row.original.batchNumber}</code> },
              { accessorKey: 'availableQuantity', header: 'Qty', cell: ({ row }) => <span className="font-semibold tabular-nums text-success">{row.original.availableQuantity}</span> },
              { accessorKey: 'mrp', header: 'MRP', cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.mrp)}</span> },
              { accessorKey: 'expiryDate', header: 'Expiry Date', cell: ({ row }) => <span className="text-sm">{formatDate(row.original.expiryDate)}</span> },
              { id: 'daysLeft', header: 'Days Left', cell: ({ row }) => { const d = daysUntilExpiry(row.original.expiryDate); return <Badge variant="success" className="text-xs tabular-nums">{d}d</Badge>; } },
            ] as ColumnDef<InventoryItem>[]}
            data={goodStock}
            loading={isLoading}
            globalSearch
            searchPlaceholder="Search good stock…"
            emptyMessage="No good-stock items"
            emptyDescription="All items have expiry concerns."
          />
        </TabsContent>
      </Tabs>

      {/* Dispose confirmation */}
      <AlertDialog open={!!disposeTarget} onOpenChange={(o) => !o && setDisposeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Dispose Expired Batch
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will mark <strong>{disposeTarget ? medName(disposeTarget) : ''}</strong> batch <strong>{disposeTarget?.batchNumber}</strong> ({disposeTarget?.availableQuantity} units, value {formatCurrency((disposeTarget?.availableQuantity ?? 0) * (disposeTarget?.mrp ?? 0))}) as disposed.
              A disposal record and audit log entry will be created. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => disposeTarget && disposeMutation.mutate(disposeTarget)}>
              Confirm Disposal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Return to supplier confirmation */}
      <AlertDialog open={!!returnTarget} onOpenChange={(o) => !o && setReturnTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-primary" />
              Return to Supplier
            </AlertDialogTitle>
            <AlertDialogDescription>
              Initiate a supplier return for <strong>{returnTarget ? medName(returnTarget) : ''}</strong> batch <strong>{returnTarget?.batchNumber}</strong> ({returnTarget?.availableQuantity} units).
              A return request will be created and sent to <strong>{returnTarget?.supplierName ?? 'the supplier'}</strong>. Stock will be updated once confirmed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => returnTarget && returnMutation.mutate(returnTarget)} disabled={returnMutation.isPending}>
              Initiate Return
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk dispose confirmation (TC_011) */}
      <AlertDialog open={bulkDispose} onOpenChange={setBulkDispose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Trash2 className="h-5 w-5 text-destructive" /> Dispose All Expired Batches</AlertDialogTitle>
            <AlertDialogDescription>
              This will dispose <strong>{expired.length}</strong> expired batch{expired.length !== 1 ? 'es' : ''} (value {formatCurrency(expiredValue)}). Stock will be deducted and an audit record created for each. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => bulkDisposeMutation.mutate()} disabled={bulkDisposeMutation.isPending}>
              {bulkDisposeMutation.isPending ? 'Disposing…' : `Dispose ${expired.length} batches`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clearance discount (TC_017) */}
      <AlertDialog open={!!discountTarget} onOpenChange={(o) => !o && setDiscountTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Tag className="h-5 w-5 text-primary" /> Apply Clearance Discount</AlertDialogTitle>
            <AlertDialogDescription>
              Set a near-expiry clearance discount for <strong>{discountTarget ? medName(discountTarget) : ''}</strong> (batch {discountTarget?.batchNumber}). Current MRP {formatCurrency(discountTarget?.mrp ?? 0)}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-3 py-1">
            <label className="text-sm">Discount %</label>
            <input type="number" min={0} max={90} value={discountPct} onChange={(e) => setDiscountPct(e.target.value)}
              className="h-9 w-24 rounded-md border border-input bg-background px-3 text-sm" />
            <span className="text-sm text-muted-foreground">→ New price{' '}
              <strong className="text-foreground">{formatCurrency((discountTarget?.mrp ?? 0) * (1 - (Number(discountPct) || 0) / 100))}</strong>
            </span>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => discountTarget && discountMutation.mutate({ item: discountTarget, pct: Number(discountPct) || 0 })} disabled={discountMutation.isPending}>
              Apply Discount
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

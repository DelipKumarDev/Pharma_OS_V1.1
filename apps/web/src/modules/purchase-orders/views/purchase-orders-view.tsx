'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Plus, Truck, PackageCheck, Wallet, MoreHorizontal, Eye, Trash2, Search, X, Loader2, PackagePlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@pharmaos/utils';
import type { Medicine } from '@pharmaos/types';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { useCan } from '@/lib/permissions';
import { useFormFieldConfig } from '@/lib/form-fields';

// ─── Types ────────────────────────────────────────────────────────────────────

interface POItem {
  id: string;
  medicineId: string;
  medicineName: string;
  quantity: number;
  receivedQuantity: number;
  unitCost: number;
  gstRate: number;
  totalAmount: number;
}
interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  status: 'ordered' | 'partially_received' | 'received' | 'cancelled';
  orderDate: string;
  expectedDate?: string;
  receivedDate?: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string;
  items: POItem[];
}
interface Vendor { id: string; name: string; }

const STATUS_CFG: Record<PurchaseOrder['status'], { label: string; variant: 'warning' | 'secondary' | 'success' | 'muted' }> = {
  ordered: { label: 'Ordered', variant: 'warning' },
  partially_received: { label: 'Partial', variant: 'secondary' },
  received: { label: 'Received', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'muted' },
};

// ─── API ──────────────────────────────────────────────────────────────────────

async function fetchPOs(): Promise<PurchaseOrder[]> {
  const r = await apiFetch('/api/purchase-orders');
  const j = await r.json() as { data: { data: PurchaseOrder[] } };
  return j.data?.data ?? [];
}
async function fetchStats(): Promise<{ open: number; received: number; openValue: number }> {
  const r = await apiFetch('/api/purchase-orders/stats');
  const j = await r.json() as { data: { open: number; received: number; openValue: number } };
  return j.data ?? { open: 0, received: 0, openValue: 0 };
}
async function fetchVendors(): Promise<Vendor[]> {
  const r = await apiFetch('/api/vendors?limit=200');
  const j = await r.json() as { data: { data: Vendor[] } };
  return j.data?.data ?? [];
}
async function searchMeds(q: string): Promise<Medicine[]> {
  const r = await apiFetch(`/api/medicines?search=${encodeURIComponent(q)}&limit=8`);
  const j = await r.json() as { data: { data: Medicine[] } };
  return j.data?.data ?? [];
}

// ─── Create PO dialog ───────────────────────────────────────────────────────

interface DraftLine { medicineId: string; medicineName: string; quantity: number; unitCost: number; }

function CreatePODialog({ open, onOpenChange, prefill }: { open: boolean; onOpenChange: (o: boolean) => void; prefill?: DraftLine | null }) {
  const qc = useQueryClient();
  const ff = useFormFieldConfig('purchaseOrder');
  const [vendorId, setVendorId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [search, setSearch] = useState('');
  const [showSugg, setShowSugg] = useState(false);

  const { data: vendors = [] } = useQuery({ queryKey: ['po-vendors'], queryFn: fetchVendors, enabled: open });
  const { data: suggestions = [] } = useQuery({ queryKey: ['po-med-search', search], queryFn: () => searchMeds(search), enabled: open && search.length >= 2 });

  useEffect(() => {
    if (open) {
      setVendorId(''); setExpectedDate(''); setNotes(''); setSearch(''); setShowSugg(false);
      setLines(prefill ? [prefill] : []);
    }
  }, [open, prefill]);

  function addLine(med: Medicine) {
    setSearch(''); setShowSugg(false);
    setLines((prev) => prev.some((l) => l.medicineId === med.id)
      ? prev
      : [...prev, { medicineId: med.id, medicineName: med.name, quantity: 1, unitCost: med.purchasePrice ?? med.sellingPrice ?? 0 }]);
  }
  function updateLine(i: number, patch: Partial<DraftLine>) { setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l)); }
  function removeLine(i: number) { setLines((prev) => prev.filter((_, idx) => idx !== i)); }

  const total = useMemo(() => lines.reduce((s, l) => s + l.quantity * l.unitCost, 0), [lines]);

  const mutation = useMutation({
    mutationFn: async () => {
      const r = await apiFetch('/api/purchase-orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorId, expectedDate: expectedDate || undefined, notes: notes || undefined, items: lines }),
      });
      const j = await r.json() as { success: boolean; message?: string; data: PurchaseOrder };
      if (!r.ok || !j.success) throw new Error(j.message ?? 'Failed to create PO');
      return j.data;
    },
    onSuccess: (po) => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      qc.invalidateQueries({ queryKey: ['po-stats'] });
      qc.invalidateQueries({ queryKey: ['reorder'] });
      toast.success(`${po.poNumber} created`, { description: `${formatCurrency(po.totalAmount)} · ${po.vendorName}` });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit() {
    if (!vendorId) { toast.error('Select a vendor'); return; }
    if (lines.length === 0) { toast.error('Add at least one medicine'); return; }
    if (lines.some((l) => l.quantity < 1)) { toast.error('Every line needs a quantity of at least 1'); return; }
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Purchase Order</DialogTitle>
          <DialogDescription>Order stock from a vendor. Receive it later to add batches to inventory.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Vendor <span className="text-destructive">*</span></Label>
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {ff.isEnabled('expectedDate') && (
              <div className="space-y-1">
                <Label>{ff.label('expectedDate', 'Expected Delivery')}</Label>
                <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
              </div>
            )}
          </div>

          {/* Add medicine */}
          <div className="space-y-1">
            <Label>Add Medicines</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search medicine to add…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setShowSugg(true); }}
                onFocus={() => search.length >= 2 && setShowSugg(true)}
                onBlur={() => setTimeout(() => setShowSugg(false), 150)}
              />
              {showSugg && suggestions.length > 0 && (
                <div className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                  {suggestions.map((m) => (
                    <button key={m.id} type="button" onMouseDown={(e) => { e.preventDefault(); addLine(m); }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent">
                      <span>{m.name} <span className="text-xs text-muted-foreground">· {m.manufacturer}</span></span>
                      <span className="text-xs text-muted-foreground">₹{m.purchasePrice ?? m.sellingPrice}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Lines */}
          <div className="rounded-lg border border-border">
            <div className="grid grid-cols-[1fr_80px_110px_100px_32px] gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Medicine</span><span className="text-right">Qty</span><span className="text-right">Unit ₹</span><span className="text-right">Line ₹</span><span />
            </div>
            {lines.length === 0 ? (
              <div className="flex flex-col items-center gap-1 py-8 text-center text-muted-foreground">
                <PackagePlus className="h-6 w-6 opacity-40" />
                <p className="text-xs">Search above to add medicines to this order</p>
              </div>
            ) : lines.map((l, i) => (
              <div key={l.medicineId} className="grid grid-cols-[1fr_80px_110px_100px_32px] items-center gap-2 border-b border-border/60 px-3 py-2 last:border-0">
                <span className="truncate text-sm font-medium">{l.medicineName}</span>
                <Input type="number" min={1} value={l.quantity} onChange={(e) => updateLine(i, { quantity: Math.max(1, Number(e.target.value)) })} className="h-8 text-right text-xs" />
                <Input type="number" min={0} step="0.01" value={l.unitCost} onChange={(e) => updateLine(i, { unitCost: Math.max(0, Number(e.target.value)) })} className="h-8 text-right text-xs" />
                <span className="text-right text-sm tabular-nums">{formatCurrency(l.quantity * l.unitCost)}</span>
                <button onClick={() => removeLine(i)} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
              </div>
            ))}
          </div>

          {ff.isEnabled('notes') && (
            <div className="space-y-1">
              <Label>{ff.label('notes', 'Notes')}</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
            <span className="text-sm text-muted-foreground">Subtotal (excl. GST)</span>
            <span className="text-lg font-bold text-primary tabular-nums">{formatCurrency(total)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create PO
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Receive dialog ─────────────────────────────────────────────────────────

interface ReceiveRow { poItemId: string; medicineName: string; remaining: number; batchNumber: string; expiryDate: string; quantity: number; }

function ReceivePODialog({ po, onClose }: { po: PurchaseOrder | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<ReceiveRow[]>([]);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (po) {
      setRows(po.items
        .filter((i) => i.receivedQuantity < i.quantity)
        .map((i) => ({ poItemId: i.id, medicineName: i.medicineName, remaining: i.quantity - i.receivedQuantity, batchNumber: '', expiryDate: '', quantity: i.quantity - i.receivedQuantity })));
    }
  }, [po]);

  function update(i: number, patch: Partial<ReceiveRow>) { setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r)); }

  const mutation = useMutation({
    mutationFn: async () => {
      const items = rows.filter((r) => r.quantity > 0 && r.batchNumber && r.expiryDate);
      if (items.length === 0) throw new Error('Enter batch number and expiry for at least one item');
      const r = await apiFetch(`/api/purchase-orders/${po!.id}/receive`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items.map((x) => ({ poItemId: x.poItemId, batchNumber: x.batchNumber, expiryDate: x.expiryDate, quantity: x.quantity })) }),
      });
      const j = await r.json() as { success: boolean; message?: string };
      if (!r.ok || !j.success) throw new Error(j.message ?? 'Failed to receive');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      qc.invalidateQueries({ queryKey: ['po-stats'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['inventory-stats'] });
      toast.success('Stock received', { description: 'Batches added to Stock & Inventory' });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!po} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receive Stock — {po?.poNumber}</DialogTitle>
          <DialogDescription>Enter the batch and expiry for each item. Received quantities are added to inventory.</DialogDescription>
        </DialogHeader>

        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">All items on this PO have already been received.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((r, i) => (
              <div key={r.poItemId} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{r.medicineName}</p>
                  <span className="text-xs text-muted-foreground">{r.remaining} remaining</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Batch No. <span className="text-destructive">*</span></Label>
                    <Input value={r.batchNumber} onChange={(e) => update(i, { batchNumber: e.target.value })} className="h-8 text-xs" placeholder="e.g. B2024X" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Expiry <span className="text-destructive">*</span></Label>
                    <Input type="date" min={today} value={r.expiryDate} onChange={(e) => update(i, { expiryDate: e.target.value })} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Qty</Label>
                    <Input type="number" min={0} max={r.remaining} value={r.quantity} onChange={(e) => update(i, { quantity: Math.min(r.remaining, Math.max(0, Number(e.target.value))) })} className="h-8 text-xs" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || rows.length === 0}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Receive Stock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function PurchaseOrdersView() {
  const qc = useQueryClient();
  const can = useCan();
  const [createOpen, setCreateOpen] = useState(false);
  const [prefill, setPrefill] = useState<DraftLine | null>(null);
  const [receivePO, setReceivePO] = useState<PurchaseOrder | null>(null);
  const [viewPO, setViewPO] = useState<PurchaseOrder | null>(null);
  const [pendingReceiveId, setPendingReceiveId] = useState<string | null>(null);

  const { data: orders = [], isLoading } = useQuery({ queryKey: ['purchase-orders'], queryFn: fetchPOs });
  const { data: stats } = useQuery({ queryKey: ['po-stats'], queryFn: fetchStats });

  // Deep-link from Reorder Queue: /purchase-orders?new=1&medicineId=&name=&qty=
  // Deep-link from Goods Receipt: /purchase-orders?receive=<poId>
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('new') === '1') {
      const medicineId = p.get('medicineId');
      const name = p.get('name');
      const qty = Number(p.get('qty') ?? '1');
      if (medicineId && name) setPrefill({ medicineId, medicineName: name, quantity: qty > 0 ? qty : 1, unitCost: Number(p.get('cost') ?? '0') });
      setCreateOpen(true);
      window.history.replaceState({}, '', '/purchase-orders');
    }
    const receiveId = p.get('receive');
    if (receiveId) {
      setPendingReceiveId(receiveId);
      window.history.replaceState({}, '', '/purchase-orders');
    }
  }, []);

  // Once orders load, open the Receive dialog for a deep-linked PO.
  useEffect(() => {
    if (!pendingReceiveId || orders.length === 0) return;
    const po = orders.find((o) => o.id === pendingReceiveId);
    if (po) {
      if (po.status === 'ordered' || po.status === 'partially_received') setReceivePO(po);
      else toast.info(`${po.poNumber} has no pending items to receive`);
    } else {
      toast.error('Purchase order not found');
    }
    setPendingReceiveId(null);
  }, [pendingReceiveId, orders]);

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiFetch(`/api/purchase-orders/${id}/cancel`, { method: 'PATCH' });
      const j = await r.json() as { success: boolean; message?: string };
      if (!r.ok || !j.success) throw new Error(j.message ?? 'Failed to cancel');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-orders'] }); qc.invalidateQueries({ queryKey: ['po-stats'] }); toast.success('Purchase order cancelled'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: ColumnDef<PurchaseOrder>[] = [
    { accessorKey: 'poNumber', header: 'PO No.', cell: ({ row }) => <span className="font-mono font-semibold text-primary text-sm">{row.original.poNumber}</span> },
    { accessorKey: 'vendorName', header: 'Vendor', cell: ({ row }) => <span className="text-sm font-medium">{row.original.vendorName}</span> },
    { id: 'items', header: 'Items', cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.items.length}</span> },
    { accessorKey: 'totalAmount', header: ({ column }) => <SortableHeader column={column}>Total</SortableHeader>, cell: ({ row }) => <span className="font-semibold tabular-nums">{formatCurrency(row.original.totalAmount)}</span> },
    {
      accessorKey: 'status', header: 'Status',
      cell: ({ row }) => { const c = STATUS_CFG[row.original.status]; return <Badge variant={c.variant} dot className="text-xs">{c.label}</Badge>; },
    },
    { accessorKey: 'orderDate', header: ({ column }) => <SortableHeader column={column}>Ordered</SortableHeader>, cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDate(row.original.orderDate)}</span> },
    { id: 'expected', header: 'Expected', cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.expectedDate ? formatDate(row.original.expectedDate) : '—'}</span> },
    {
      id: 'actions', header: '',
      cell: ({ row }) => {
        const po = row.original;
        const canReceive = po.status === 'ordered' || po.status === 'partially_received';
        return (
          <div className="flex items-center gap-1.5">
            {canReceive && (
              <Button size="sm" className="h-7 text-xs" onClick={() => setReceivePO(po)}>
                <PackageCheck className="h-3.5 w-3.5" /> Receive
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setViewPO(po)}><Eye className="h-4 w-4" /> View Details</DropdownMenuItem>
                {canReceive && (
                  <DropdownMenuItem destructive onClick={() => { if (confirm(`Cancel ${po.poNumber}?`)) cancelMutation.mutate(po.id); }}>
                    <Trash2 className="h-4 w-4" /> Cancel PO
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Purchase Orders</h1>
          <p className="text-sm text-muted-foreground">Order stock from vendors and receive it into inventory</p>
        </div>
        {can('inventory:create') && (
          <Button size="sm" onClick={() => { setPrefill(null); setCreateOpen(true); }}>
            <Plus className="h-4 w-4" /> New Purchase Order
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Open Orders', value: String(stats?.open ?? 0), icon: Truck, color: 'text-warning-600', bg: 'bg-warning/10' },
          { label: 'Received', value: String(stats?.received ?? 0), icon: PackageCheck, color: 'text-success', bg: 'bg-success/10' },
          { label: 'Open Order Value', value: formatCurrency(stats?.openValue ?? 0), icon: Wallet, color: 'text-primary', bg: 'bg-primary/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', bg)}><Icon className={cn('h-5 w-5', color)} /></div>
            <div><p className="text-xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>
          </div>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={orders}
        loading={isLoading}
        searchColumn="poNumber"
        searchPlaceholder="Search by PO number…"
        emptyMessage="No purchase orders yet"
        emptyDescription="Create a PO to order stock from a vendor, then receive it into inventory."
      />

      <CreatePODialog open={createOpen} onOpenChange={setCreateOpen} prefill={prefill} />
      <ReceivePODialog po={receivePO} onClose={() => setReceivePO(null)} />

      {/* View details */}
      <Dialog open={!!viewPO} onOpenChange={(o) => !o && setViewPO(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono text-primary">{viewPO?.poNumber}</DialogTitle>
            <DialogDescription>{viewPO?.vendorName}</DialogDescription>
          </DialogHeader>
          {viewPO && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 rounded-lg bg-muted/40 p-3">
                <div><span className="text-muted-foreground">Status: </span><Badge variant={STATUS_CFG[viewPO.status].variant} dot className="text-xs">{STATUS_CFG[viewPO.status].label}</Badge></div>
                <div><span className="text-muted-foreground">Ordered: </span>{formatDate(viewPO.orderDate)}</div>
                <div><span className="text-muted-foreground">Expected: </span>{viewPO.expectedDate ? formatDate(viewPO.expectedDate) : '—'}</div>
                <div><span className="text-muted-foreground">Received: </span>{viewPO.receivedDate ? formatDate(viewPO.receivedDate) : '—'}</div>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-xs text-muted-foreground">
                  <th className="py-1.5 text-left font-medium">Medicine</th>
                  <th className="py-1.5 text-right font-medium">Recv/Ord</th>
                  <th className="py-1.5 text-right font-medium">Unit</th>
                  <th className="py-1.5 text-right font-medium">Total</th>
                </tr></thead>
                <tbody>
                  {viewPO.items.map((it) => (
                    <tr key={it.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{it.medicineName}</td>
                      <td className="py-2 text-right tabular-nums">{it.receivedQuantity}/{it.quantity}</td>
                      <td className="py-2 text-right tabular-nums">{formatCurrency(it.unitCost)}</td>
                      <td className="py-2 text-right tabular-nums font-semibold">{formatCurrency(it.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-between rounded-lg bg-muted/40 px-3 py-2 font-bold">
                <span>Total (incl. GST)</span><span className="text-primary tabular-nums">{formatCurrency(viewPO.totalAmount)}</span>
              </div>
              {(viewPO.status === 'ordered' || viewPO.status === 'partially_received') && (
                <Button className="w-full" onClick={() => { const p = viewPO; setViewPO(null); setReceivePO(p); }}>
                  <PackageCheck className="h-4 w-4" /> Receive Stock
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

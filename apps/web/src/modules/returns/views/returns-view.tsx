'use client';

import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import {
  RotateCcw, Clock, CheckCircle, XCircle, AlertTriangle, Plus,
  MoreHorizontal, Eye, Check, X, User, Building2, Receipt,
  ArrowLeftRight, Package, Loader2, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ReturnRequest, ReturnStats, ReturnType, ReturnStatus } from '@pharmaos/types';
import { formatCurrency, formatDate, formatDateTime } from '@pharmaos/utils';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// ─── API ─────────────────────────────────────────────────────────────────────

async function fetchStats(): Promise<ReturnStats> {
  const r = await fetch('/api/returns/stats');
  return ((await r.json()) as { data: ReturnStats }).data;
}

async function fetchReturns(type?: string, status?: string): Promise<ReturnRequest[]> {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (status) params.set('status', status);
  const r = await fetch(`/api/returns${params.size ? '?' + params.toString() : ''}`);
  return ((await r.json()) as { data: { data: ReturnRequest[] } }).data.data;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ReturnStatus, { label: string; variant: 'warning' | 'success' | 'muted' | 'destructive' | 'secondary' }> = {
  pending: { label: 'Pending', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  processed: { label: 'Processed', variant: 'muted' },
  rejected: { label: 'Rejected', variant: 'destructive' },
};

const REASON_LABELS: Record<string, string> = {
  wrong_medicine: 'Wrong Medicine',
  damaged: 'Damaged',
  expired: 'Expired',
  patient_condition_changed: 'Condition Changed',
  excess_stock: 'Excess Stock',
  near_expiry: 'Near Expiry',
  other: 'Other',
};

const CONDITION_CONFIG = {
  resaleable: { label: 'Resaleable', cls: 'text-success bg-success/10' },
  damaged: { label: 'Damaged', cls: 'text-destructive bg-destructive/10' },
  expired: { label: 'Expired', cls: 'text-warning-600 bg-warning/10' },
};

// ─── Return detail sheet ──────────────────────────────────────────────────────

function ReturnDetailSheet({ ret, onClose }: { ret: ReturnRequest; onClose: () => void }) {
  const qc = useQueryClient();

  const approveMut = useMutation({
    mutationFn: async () => {
      await fetch(`/api/returns/${ret.id}/approve`, { method: 'PATCH' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['returns'] });
      qc.invalidateQueries({ queryKey: ['return-stats'] });
      toast.success(`Return ${ret.returnNumber} approved`);
      onClose();
    },
  });

  const processMut = useMutation({
    mutationFn: async () => {
      await fetch(`/api/returns/${ret.id}/process`, { method: 'PATCH' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['returns'] });
      qc.invalidateQueries({ queryKey: ['return-stats'] });
      toast.success(`Return ${ret.returnNumber} processed — stock updated`);
      onClose();
    },
  });

  const rejectMut = useMutation({
    mutationFn: async () => {
      await fetch(`/api/returns/${ret.id}/reject`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Rejected by pharmacist' }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['returns'] });
      qc.invalidateQueries({ queryKey: ['return-stats'] });
      toast.success(`Return ${ret.returnNumber} rejected`);
      onClose();
    },
  });

  const isCustomer = ret.type === 'customer_return';
  const cfg = STATUS_CONFIG[ret.status];

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent className="flex flex-col w-full sm:max-w-lg" side="right">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-primary" />
            {ret.returnNumber}
          </SheetTitle>
          <SheetDescription>
            <div className="flex items-center gap-2">
              <Badge variant={cfg.variant} dot className="text-xs">{cfg.label}</Badge>
              <Badge variant={isCustomer ? 'secondary' : 'muted'} className="text-xs">
                {isCustomer ? 'Customer Return' : 'Vendor Return'}
              </Badge>
            </div>
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-2">
          {/* Party info */}
          <div className="rounded-lg bg-muted/40 p-3">
            <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {isCustomer ? <><User className="h-3 w-3" /> Customer</> : <><Building2 className="h-3 w-3" /> Vendor</>}
            </div>
            <p className="font-semibold text-sm">{isCustomer ? ret.customerName : ret.vendorName}</p>
            {ret.customerPhone && <p className="text-xs text-muted-foreground">{ret.customerPhone}</p>}
            {ret.billNumber && (
              <p className="text-xs text-muted-foreground mt-1">
                Original Bill: <span className="font-mono text-primary">{ret.billNumber}</span>
              </p>
            )}
            {ret.purchaseInvoiceNumber && (
              <p className="text-xs text-muted-foreground mt-1">
                Purchase Invoice: <span className="font-mono text-primary">{ret.purchaseInvoiceNumber}</span>
              </p>
            )}
          </div>

          {/* Reason */}
          <div className="flex gap-4 text-sm">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Return Reason</p>
              <p className="font-medium">{REASON_LABELS[ret.reason] ?? ret.reason}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="font-medium">{formatDate(ret.createdAt)}</p>
            </div>
          </div>
          {ret.reasonNotes && (
            <div className="rounded-lg bg-muted/30 p-3 text-sm">
              <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
              <p>{ret.reasonNotes}</p>
            </div>
          )}

          {/* Items */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Return Items</p>
            <div className="space-y-2">
              {ret.items.map((item) => {
                const condCfg = CONDITION_CONFIG[item.condition];
                return (
                  <div key={item.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="font-semibold text-sm">{item.medicineName}</p>
                        <p className="text-xs text-muted-foreground">Batch: {item.batchNumber}</p>
                      </div>
                      <span className={cn('text-[10px] rounded-full px-2 py-0.5 font-semibold', condCfg.cls)}>
                        {condCfg.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div><p className="text-muted-foreground">Qty</p><p className="font-semibold">{item.returnQty}</p></div>
                      <div><p className="text-muted-foreground">Unit Price</p><p className="font-semibold">₹{item.unitPrice}</p></div>
                      <div><p className="text-muted-foreground">Total</p><p className="font-semibold text-primary">₹{item.totalAmount}</p></div>
                      <div><p className="text-muted-foreground">Restocked</p>
                        <p className={cn('font-semibold', item.restocked ? 'text-success' : 'text-muted-foreground')}>
                          {item.restocked ? 'Yes' : 'No'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals */}
          <div className="rounded-lg bg-muted/30 p-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Total Return Value</span>
              <span className="tabular-nums">{formatCurrency(ret.totalAmount)}</span>
            </div>
            <div className="flex justify-between font-bold text-base border-t border-border pt-1.5">
              <span>Refund Amount</span>
              <span className={cn('tabular-nums', ret.refundAmount > 0 ? 'text-primary' : 'text-muted-foreground')}>
                {ret.refundAmount > 0 ? formatCurrency(ret.refundAmount) : 'No refund'}
              </span>
            </div>
            {ret.refundMethod && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Refund Method</span>
                <span className="capitalize font-medium">{ret.refundMethod.replace('_', ' ')}</span>
              </div>
            )}
          </div>

          {/* Processed info */}
          {ret.processedAt && ret.processedBy && (
            <p className="text-xs text-muted-foreground">
              Processed by {ret.processedBy} on {formatDateTime(ret.processedAt)}
            </p>
          )}
        </div>

        <SheetFooter className="gap-2 px-6 pb-6 pt-2">
          {ret.status === 'pending' && (
            <>
              <Button variant="destructive" size="sm" className="flex-1" onClick={() => rejectMut.mutate()} disabled={rejectMut.isPending}>
                <XCircle className="h-4 w-4" /> Reject
              </Button>
              <Button className="flex-1" onClick={() => approveMut.mutate()} disabled={approveMut.isPending}>
                {approveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle className="h-4 w-4" /> Approve</>}
              </Button>
            </>
          )}
          {ret.status === 'approved' && (
            <Button className="flex-[2]" onClick={() => processMut.mutate()} disabled={processMut.isPending}>
              {processMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Process Return & Update Stock</>}
            </Button>
          )}
          {(ret.status === 'processed' || ret.status === 'rejected') && (
            <Button variant="outline" className="flex-1" onClick={onClose}>Close</Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── New return sheet ─────────────────────────────────────────────────────────

function NewReturnSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [type, setType] = useState<ReturnType>('customer_return');
  const [billNumber, setBillNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [refundMethod, setRefundMethod] = useState('cash');
  const [items, setItems] = useState([{ medicineName: '', batchNumber: '', qty: '', unitPrice: '', condition: 'resaleable' }]);

  function addItem() { setItems((p) => [...p, { medicineName: '', batchNumber: '', qty: '', unitPrice: '', condition: 'resaleable' }]); }
  function removeItem(i: number) { setItems((p) => p.filter((_, idx) => idx !== i)); }
  function updateItem(i: number, field: string, val: string) {
    setItems((p) => p.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const returnItems = items.filter((i) => i.medicineName.trim()).map((i, idx) => ({
        id: `ri_${Date.now()}_${idx}`,
        medicineName: i.medicineName, batchNumber: i.batchNumber,
        returnQty: Number(i.qty) || 1,
        unitPrice: Number(i.unitPrice) || 0,
        totalAmount: (Number(i.qty) || 1) * (Number(i.unitPrice) || 0),
        condition: i.condition, restocked: false,
      }));
      const totalAmount = returnItems.reduce((s, i) => s + i.totalAmount, 0);
      const payload = {
        type, reason,
        reasonNotes: notes || undefined,
        items: returnItems,
        totalAmount, refundAmount: totalAmount,
        ...(type === 'customer_return'
          ? { billNumber: billNumber || undefined, customerName, customerPhone: customerPhone || undefined, refundMethod }
          : { vendorName, purchaseInvoiceNumber: invoiceNumber || undefined }),
      };
      const r = await fetch('/api/returns', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['returns'] });
      qc.invalidateQueries({ queryKey: ['return-stats'] });
      toast.success('Return request submitted for approval');
      onClose();
    },
    onError: () => toast.error('Failed to submit return'),
  });

  const canSubmit = reason && items.some((i) => i.medicineName.trim()) &&
    (type === 'customer_return' ? customerName : vendorName);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="flex flex-col w-full sm:max-w-lg" side="right">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-primary" /> New Return Request
          </SheetTitle>
          <SheetDescription>Process customer or vendor return with stock reconciliation</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-2">
          {/* Type toggle */}
          <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-muted p-1">
            {(['customer_return', 'vendor_return'] as const).map((t) => (
              <button key={t} onClick={() => setType(t)} className={cn(
                'rounded-md py-2 text-sm font-medium transition-all',
                type === t ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}>
                {t === 'customer_return' ? '👤 Customer Return' : '🏢 Vendor Return'}
              </button>
            ))}
          </div>

          {/* Party details */}
          {type === 'customer_return' ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer Details</p>
              <Input placeholder="Original bill number (e.g. INV000003)" value={billNumber} onChange={(e) => setBillNumber(e.target.value)} className="h-8 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Customer name *" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="h-8 text-sm" />
                <Input placeholder="Phone number" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="h-8 text-sm" maxLength={10} />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vendor Details</p>
              <Input placeholder="Vendor / distributor name *" value={vendorName} onChange={(e) => setVendorName(e.target.value)} className="h-8 text-sm" />
              <Input placeholder="Purchase invoice number" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="h-8 text-sm" />
            </div>
          )}

          <Separator />

          {/* Return items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Return Items</p>
              <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={addItem}>
                <Plus className="h-3 w-3" /> Add Item
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="rounded-lg border border-border p-2.5 space-y-1.5">
                  <div className="flex gap-1.5">
                    <Input value={item.medicineName} onChange={(e) => updateItem(i, 'medicineName', e.target.value)}
                      className="h-7 text-xs flex-1" placeholder="Medicine name *" />
                    {items.length > 1 && (
                      <button onClick={() => removeItem(i)} className="text-muted-foreground hover:text-destructive">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <Input value={item.batchNumber} onChange={(e) => updateItem(i, 'batchNumber', e.target.value)} className="h-7 text-xs" placeholder="Batch" />
                    <Input type="number" value={item.qty} onChange={(e) => updateItem(i, 'qty', e.target.value)} className="h-7 text-xs" placeholder="Qty" />
                    <Input type="number" value={item.unitPrice} onChange={(e) => updateItem(i, 'unitPrice', e.target.value)} className="h-7 text-xs" placeholder="₹ Price" />
                    <select value={item.condition} onChange={(e) => updateItem(i, 'condition', e.target.value)}
                      className="h-7 text-xs rounded-md border border-border bg-background px-1.5 focus:outline-none focus:ring-1 focus:ring-primary">
                      <option value="resaleable">Resaleable</option>
                      <option value="damaged">Damaged</option>
                      <option value="expired">Expired</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Reason */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Return Reason</p>
            <select value={reason} onChange={(e) => setReason(e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">Select reason *</option>
              <option value="wrong_medicine">Wrong Medicine Dispensed</option>
              <option value="damaged">Damaged / Defective</option>
              <option value="expired">Expired</option>
              <option value="patient_condition_changed">Patient Condition Changed</option>
              <option value="excess_stock">Excess / Surplus Stock</option>
              <option value="near_expiry">Near Expiry</option>
              <option value="other">Other</option>
            </select>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Additional notes (optional)…" />
          </div>

          {/* Refund method (customer only) */}
          {type === 'customer_return' && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Refund Method</p>
              <div className="grid grid-cols-4 gap-1.5">
                {[['cash', 'Cash'], ['upi', 'UPI'], ['credit_note', 'Credit'], ['original_payment', 'Original']].map(([val, label]) => (
                  <button key={val} onClick={() => setRefundMethod(val)}
                    className={cn(
                      'rounded-lg py-2 text-xs font-semibold border transition-all',
                      refundMethod === val ? 'bg-primary text-white border-primary' : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    )}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="px-6 pb-6 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !canSubmit}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RotateCcw className="h-4 w-4" /> Submit Return</>}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function ReturnsView() {
  const [typeFilter, setTypeFilter] = useState<ReturnType | 'all'>('all');
  const [selectedReturn, setSelectedReturn] = useState<ReturnRequest | null>(null);
  const [newReturnOpen, setNewReturnOpen] = useState(false);

  const { data: stats } = useQuery({ queryKey: ['return-stats'], queryFn: fetchStats });
  const { data: returns = [], isLoading } = useQuery({
    queryKey: ['returns', typeFilter],
    queryFn: () => fetchReturns(typeFilter === 'all' ? undefined : typeFilter),
  });

  const columns: ColumnDef<ReturnRequest>[] = [
    {
      accessorKey: 'returnNumber',
      header: 'Return No.',
      cell: ({ row }) => <span className="font-mono font-semibold text-primary text-sm">{row.original.returnNumber}</span>,
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => (
        <Badge variant={row.original.type === 'customer_return' ? 'secondary' : 'muted'} className="text-xs">
          {row.original.type === 'customer_return' ? '👤 Customer' : '🏢 Vendor'}
        </Badge>
      ),
    },
    {
      id: 'party',
      header: 'From',
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div>
            <p className="font-medium text-sm">{r.type === 'customer_return' ? r.customerName : r.vendorName}</p>
            {r.billNumber && <p className="text-xs text-muted-foreground font-mono">{r.billNumber}</p>}
            {r.purchaseInvoiceNumber && <p className="text-xs text-muted-foreground font-mono">{r.purchaseInvoiceNumber}</p>}
          </div>
        );
      },
    },
    {
      id: 'items',
      header: 'Items',
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.items.length}</span>,
    },
    {
      accessorKey: 'reason',
      header: 'Reason',
      cell: ({ row }) => <span className="text-xs">{REASON_LABELS[row.original.reason] ?? row.original.reason}</span>,
    },
    {
      accessorKey: 'refundAmount',
      header: ({ column }) => <SortableHeader column={column}>Refund</SortableHeader>,
      cell: ({ row }) => (
        <span className={cn('font-semibold tabular-nums text-sm', row.original.refundAmount > 0 ? 'text-primary' : 'text-muted-foreground')}>
          {row.original.refundAmount > 0 ? formatCurrency(row.original.refundAmount) : 'No refund'}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const cfg = STATUS_CONFIG[row.original.status];
        return <Badge variant={cfg.variant} dot className="text-xs">{cfg.label}</Badge>;
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <SortableHeader column={column}>Date</SortableHeader>,
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setSelectedReturn(row.original)}>
              <Eye className="h-4 w-4" /> View Details
            </DropdownMenuItem>
            {row.original.status === 'pending' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSelectedReturn(row.original)}>
                  <Check className="h-4 w-4" /> Approve / Reject
                </DropdownMenuItem>
              </>
            )}
            {row.original.status === 'approved' && (
              <DropdownMenuItem onClick={() => setSelectedReturn(row.original)}>
                <Package className="h-4 w-4" /> Process Return
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Returns</h1>
          <p className="text-sm text-muted-foreground">Manage customer returns, vendor returns and stock reconciliation</p>
        </div>
        <Button size="sm" onClick={() => setNewReturnOpen(true)}>
          <Plus className="h-4 w-4" /> New Return
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: 'Total Returns', value: stats.totalReturns, icon: RotateCcw, color: 'text-primary', bg: 'bg-primary/10' },
            { label: 'Pending Approval', value: stats.pendingApproval, icon: Clock, color: 'text-warning-600', bg: 'bg-warning/10', urgent: stats.pendingApproval > 0 },
            { label: 'Processed Today', value: stats.processedToday, icon: CheckCircle, color: 'text-success', bg: 'bg-success/10' },
            { label: 'Refunded (Month)', value: formatCurrency(stats.totalRefundedThisMonth), icon: ArrowLeftRight, color: 'text-blue-600', bg: 'bg-blue-500/10' },
            { label: 'Customer Returns', value: stats.customerReturns, icon: User, color: 'text-purple-600', bg: 'bg-purple-500/10' },
            { label: 'Vendor Returns', value: stats.vendorReturns, icon: Building2, color: 'text-muted-foreground', bg: 'bg-muted' },
          ].map(({ label, value, icon: Icon, color, bg, urgent }) => (
            <div key={label} className={cn(
              'flex items-center gap-3 rounded-xl border border-border bg-card p-4',
              urgent && 'border-warning/50 bg-warning/5'
            )}>
              <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', bg)}>
                <Icon className={cn('h-4 w-4', color)} />
              </div>
              <div>
                <p className="text-lg font-bold leading-tight">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pending alert */}
      {stats && stats.pendingApproval > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-warning/40 bg-warning/8 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-warning-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-warning-600">{stats.pendingApproval} return{stats.pendingApproval !== 1 ? 's' : ''} pending approval</p>
            <p className="text-xs text-muted-foreground">Review and approve to update inventory and process refunds</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setTypeFilter('all')}>
            Review Now
          </Button>
        </div>
      )}

      {/* Type filter */}
      <div className="flex gap-1 border-b border-border">
        {([
          { key: 'all', label: 'All Returns', count: stats?.totalReturns },
          { key: 'customer_return', label: 'Customer Returns', count: stats?.customerReturns },
          { key: 'vendor_return', label: 'Vendor Returns', count: stats?.vendorReturns },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTypeFilter(tab.key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors',
              typeFilter === tab.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="text-[10px] rounded-full px-1.5 py-0.5 font-semibold bg-muted text-muted-foreground">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={returns}
        loading={isLoading}
        searchColumn="returnNumber"
        searchPlaceholder="Search by return number, customer, or vendor…"
        emptyMessage="No returns found"
        emptyDescription="Create a new return request to get started."
      />

      {/* Sheets */}
      {selectedReturn && <ReturnDetailSheet ret={selectedReturn} onClose={() => setSelectedReturn(null)} />}
      <NewReturnSheet open={newReturnOpen} onClose={() => setNewReturnOpen(false)} />
    </div>
  );
}

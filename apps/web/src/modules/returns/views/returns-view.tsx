'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
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
import { apiFetch } from '@/lib/api';
import { useCan } from '@/lib/permissions';
import { useFormFieldConfig } from '@/lib/form-fields';

// ─── API ─────────────────────────────────────────────────────────────────────

async function fetchStats(): Promise<ReturnStats> {
  const r = await apiFetch('/api/returns/stats');
  const json = await r.json() as { success: boolean; data: ReturnStats };
  if (!r.ok) throw new Error('Request failed');
  return json.data ?? ({} as ReturnStats);
}

async function fetchReturns(type?: string, status?: string): Promise<ReturnRequest[]> {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (status) params.set('status', status);
  const r = await apiFetch(`/api/returns${params.size ? '?' + params.toString() : ''}`);
  const json = await r.json() as { success: boolean; data: { data: ReturnRequest[] } };
  if (!r.ok) throw new Error('Request failed');
  return json.data?.data ?? ([] as ReturnRequest[]);
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
  resaleable: { label: 'Resalable', cls: 'text-success bg-success/10' },
  damaged: { label: 'Damaged', cls: 'text-destructive bg-destructive/10' },
  expired: { label: 'Expired', cls: 'text-warning-600 bg-warning/10' },
};

// ─── Return detail sheet ──────────────────────────────────────────────────────

function ReturnDetailSheet({ ret, onClose }: { ret: ReturnRequest; onClose: () => void }) {
  const qc = useQueryClient();
  const can = useCan();

  const approveMut = useMutation({
    mutationFn: async () => {
      await apiFetch(`/api/returns/${ret.id}/approve`, { method: 'PATCH' });
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
      await apiFetch(`/api/returns/${ret.id}/process`, { method: 'PATCH' });
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
      await apiFetch(`/api/returns/${ret.id}/reject`, {
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
          <SheetDescription className="sr-only">
            {isCustomer ? 'Customer' : 'Vendor'} return {ret.returnNumber} — status {cfg.label}
          </SheetDescription>
          <div className="flex items-center gap-2">
            <Badge variant={cfg.variant} dot className="text-xs">{cfg.label}</Badge>
            <Badge variant={isCustomer ? 'secondary' : 'muted'} className="text-xs">
              {isCustomer ? 'Customer Return' : 'Vendor Return'}
            </Badge>
          </div>
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
          {ret.status === 'pending' && can('returns:approve') && (
            <>
              <Button variant="destructive" size="sm" className="flex-1" onClick={() => rejectMut.mutate()} disabled={rejectMut.isPending}>
                <XCircle className="h-4 w-4" /> Reject
              </Button>
              <Button className="flex-1" onClick={() => approveMut.mutate()} disabled={approveMut.isPending}>
                {approveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle className="h-4 w-4" /> Approve</>}
              </Button>
            </>
          )}
          {ret.status === 'approved' && can('returns:approve') && (
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

interface ReturnLine {
  medicineName: string; batchNumber: string; qty: string; unitPrice: string; condition: string;
  medicineId?: string; maxQty?: number; expiryDate?: string;
}

function NewReturnSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const ff = useFormFieldConfig('returns');
  const [type, setType] = useState<ReturnType>('customer_return');
  const [billNumber, setBillNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [refundMethod, setRefundMethod] = useState('cash');
  const emptyLine = (): ReturnLine => ({ medicineName: '', batchNumber: '', qty: '', unitPrice: '', condition: 'resaleable' });
  const [items, setItems] = useState<ReturnLine[]>([emptyLine()]);
  const [billId, setBillId] = useState<string | null>(null);
  const [billLookup, setBillLookup] = useState<'idle' | 'loading' | 'found' | 'notfound'>('idle');
  const lastFetched = useRef('');

  function addItem() { setItems((p) => [...p, emptyLine()]); }
  function removeItem(i: number) { setItems((p) => p.filter((_, idx) => idx !== i)); }
  function updateItem(i: number, field: keyof ReturnLine, val: string) {
    setItems((p) => p.map((item, idx) => {
      if (idx !== i) return item;
      // Can't return more than what was billed for a fetched line.
      if (field === 'qty' && item.maxQty != null) {
        const n = Math.min(Math.max(0, Number(val) || 0), item.maxQty);
        return { ...item, qty: val === '' ? '' : String(n) };
      }
      return { ...item, [field]: val };
    }));
  }

  // ── Intelligence: type a bill number → auto-fetch the customer + sold items so
  // the shopkeeper only edits what's actually being returned. ──────────────────
  const fetchBill = useCallback(async (raw: string) => {
    const q = raw.trim();
    lastFetched.current = q;
    if (q.length < 3) { setBillLookup('idle'); return; }
    setBillLookup('loading');
    try {
      const r = await apiFetch(`/api/billing?search=${encodeURIComponent(q)}&limit=10`);
      const j = await r.json() as { data?: { data?: Array<{ id: string; billNumber: string; customerName?: string; customerPhone?: string; items: Array<{ medicineId: string; medicineName: string; batchNumber: string; quantity: number; sellingPrice: number; expiryDate?: string }> }> } };
      const bills = j.data?.data ?? [];
      const bill = bills.find((b) => b.billNumber?.toLowerCase() === q.toLowerCase()) ?? (bills.length === 1 ? bills[0] : null);
      if (!bill || !bill.items?.length) { setBillId(null); setBillLookup('notfound'); return; }
      setBillId(bill.id);
      if (bill.customerName) setCustomerName(bill.customerName);
      if (bill.customerPhone) setCustomerPhone(bill.customerPhone);
      setItems(bill.items.map((it) => ({
        medicineName: it.medicineName ?? '',
        batchNumber: it.batchNumber ?? '',
        qty: String(it.quantity ?? ''),
        unitPrice: String(it.sellingPrice ?? ''),
        condition: 'resaleable',
        medicineId: it.medicineId,
        maxQty: it.quantity,
        expiryDate: it.expiryDate,
      })));
      setBillLookup('found');
    } catch { setBillLookup('notfound'); }
  }, []);

  // Debounced auto-fetch as the bill number is typed (customer returns only).
  useEffect(() => {
    if (type !== 'customer_return') return;
    const q = billNumber.trim();
    if (q === lastFetched.current) return;
    if (q.length < 3) { setBillLookup('idle'); setBillId(null); return; }
    const h = setTimeout(() => fetchBill(q), 450);
    return () => clearTimeout(h);
  }, [billNumber, type, fetchBill]);

  const mutation = useMutation({
    mutationFn: async () => {
      const returnItems = items.filter((i) => i.medicineName.trim()).map((i, idx) => ({
        id: `ri_${Date.now()}_${idx}`,
        medicineId: i.medicineId,
        medicineName: i.medicineName, batchNumber: i.batchNumber,
        expiryDate: i.expiryDate,
        returnQty: Number(i.qty) || 1,
        unitPrice: Number(i.unitPrice) || 0,
        totalAmount: (Number(i.qty) || 1) * (Number(i.unitPrice) || 0),
        condition: i.condition, restocked: false,
      }));
      const totalAmount = returnItems.reduce((s, i) => s + i.totalAmount, 0);
      const payload = {
        type, reason, refundMethod,
        reasonNotes: notes || undefined,
        items: returnItems,
        totalAmount, refundAmount: totalAmount,
        ...(type === 'customer_return'
          ? { billId: billId || undefined, billNumber: billNumber || undefined, customerName, customerPhone: customerPhone || undefined }
          : { vendorName, purchaseInvoiceNumber: invoiceNumber || undefined }),
      };
      const r = await apiFetch('/api/returns', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json() as { success: boolean; message?: string };
      if (!r.ok || !j.success) throw new Error(j.message ?? 'Failed to submit return');
      return j;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['returns'] });
      qc.invalidateQueries({ queryKey: ['return-stats'] });
      toast.success('Return request submitted for approval');
      // Reset the form so the next "New Return" starts clean.
      setBillNumber(''); setCustomerName(''); setCustomerPhone(''); setVendorName('');
      setInvoiceNumber(''); setReason(''); setNotes(''); setRefundMethod('cash');
      setItems([emptyLine()]); setBillId(null); setBillLookup('idle'); lastFetched.current = '';
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Every named line must have a positive quantity, and a customer return can't
  // exceed the quantity actually billed (I2 — vendor returns were accepting any
  // random/oversized data). Vendor returns still require a vendor + reason.
  const namedItems = items.filter((i) => i.medicineName.trim());
  const itemsValid = namedItems.length > 0 && namedItems.every((i) => {
    const q = Number(i.qty) || 0;
    return q > 0 && (i.maxQty === undefined || q <= i.maxQty);
  });
  // Customer name is optional on a customer return (walk-in returns are valid, and
  // the bill number links the sale) — consistent with walk-in billing (I5). Vendor
  // returns still require a vendor.
  const canSubmit = !!reason && itemsValid &&
    (type === 'customer_return' ? true : !!vendorName);

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
              <div className="space-y-1">
                <div className="relative">
                  <Input placeholder="Original bill number (e.g. INV000003) — auto-fills the rest" value={billNumber}
                    onChange={(e) => setBillNumber(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); fetchBill(billNumber); } }}
                    className="h-8 text-sm pr-8" />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2">
                    {billLookup === 'loading' && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                    {billLookup === 'found' && <CheckCircle className="h-3.5 w-3.5 text-success" />}
                  </span>
                </div>
                {billLookup === 'found' && <p className="text-2xs text-success">✓ Bill loaded — {items.length} item{items.length !== 1 ? 's' : ''} filled in. Adjust quantity/condition for what&apos;s being returned.</p>}
                {billLookup === 'notfound' && billNumber.trim().length >= 3 && <p className="text-2xs text-muted-foreground">No matching bill found — you can still enter the details manually.</p>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder={`${ff.label('customerName', 'Customer name')} *`} value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="h-8 text-sm" />
                {ff.isEnabled('customerPhone') && (
                  <Input placeholder={ff.label('customerPhone', 'Phone number')} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="h-8 text-sm" maxLength={10} />
                )}
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
                    <div className="relative">
                      <Input type="number" min={0} max={item.maxQty} value={item.qty} onChange={(e) => updateItem(i, 'qty', e.target.value)} className="h-7 text-xs pr-6" placeholder="Qty" />
                      {item.maxQty != null && <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">/{item.maxQty}</span>}
                    </div>
                    <Input type="number" value={item.unitPrice} onChange={(e) => updateItem(i, 'unitPrice', e.target.value)} className="h-7 text-xs" placeholder="₹ Price" />
                    <select value={item.condition} onChange={(e) => updateItem(i, 'condition', e.target.value)}
                      className="h-7 text-xs rounded-md border border-border bg-background px-1.5 focus:outline-none focus:ring-1 focus:ring-primary">
                      <option value="resaleable">Resalable</option>
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
            {ff.isEnabled('notes') && (
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={`${ff.label('notes', 'Additional notes')} (optional)…`} />
            )}
          </div>

          {/* Refund / settlement method — for both customer and vendor returns (TC_003) */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {type === 'customer_return' ? 'Refund Method' : 'Settlement Method'}
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {(type === 'customer_return'
                ? [['cash', 'Cash'], ['upi', 'UPI'], ['credit_note', 'Credit'], ['original_payment', 'Original']]
                : [['credit_note', 'Vendor Credit'], ['cash', 'Cash'], ['upi', 'Bank/UPI'], ['original_payment', 'Replacement']]
              ).map(([val, label]) => (
                <button key={val} type="button" onClick={() => setRefundMethod(val ?? '')}
                  className={cn(
                    'rounded-lg py-2 text-xs font-semibold border transition-all',
                    refundMethod === val ? 'bg-primary text-white border-primary' : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  )}>
                  {label}
                </button>
              ))}
            </div>
          </div>
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
  const can = useCan();
  // Allow deep-linking to a pre-filtered view, e.g. Procurement → Purchase
  // Returns opens /returns?type=vendor_return.
  const initialType = useSearchParams().get('type');
  const [typeFilter, setTypeFilter] = useState<ReturnType | 'all'>(
    initialType === 'vendor_return' || initialType === 'customer_return' ? (initialType as ReturnType) : 'all',
  );
  const [pendingOnly, setPendingOnly] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<ReturnRequest | null>(null);
  const [newReturnOpen, setNewReturnOpen] = useState(false);

  const { data: stats } = useQuery({ queryKey: ['return-stats'], queryFn: fetchStats });
  const { data: returns = [], isLoading } = useQuery({
    queryKey: ['returns', typeFilter, pendingOnly],
    queryFn: () => fetchReturns(typeFilter === 'all' ? undefined : typeFilter, pendingOnly ? 'pending' : undefined),
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
      cell: ({ row }) => {
        const n = row.original.items.length;
        const qty = row.original.items.reduce((s, it) => s + (it.returnQty ?? 0), 0);
        return <span className="text-sm text-muted-foreground">{n} item{n !== 1 ? 's' : ''} · {qty} qty</span>;
      },
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
            {row.original.status === 'pending' && can('returns:approve') && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSelectedReturn(row.original)}>
                  <Check className="h-4 w-4" /> Approve / Reject
                </DropdownMenuItem>
              </>
            )}
            {row.original.status === 'approved' && can('returns:approve') && (
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
        {can('returns:create') && (
          <Button size="sm" onClick={() => setNewReturnOpen(true)}>
            <Plus className="h-4 w-4" /> New Return
          </Button>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: 'Total Returns', value: stats.totalReturns, icon: RotateCcw, color: 'text-primary', bg: 'bg-primary/10', filter: 'all' as const },
            { label: 'Pending Approval', value: stats.pendingApproval, icon: Clock, color: 'text-warning-600', bg: 'bg-warning/10', urgent: stats.pendingApproval > 0, filter: 'pending' as const },
            { label: 'Processed Today', value: stats.processedToday, icon: CheckCircle, color: 'text-success', bg: 'bg-success/10', filter: null },
            { label: 'Refunded (Month)', value: formatCurrency(stats.totalRefundedThisMonth), icon: ArrowLeftRight, color: 'text-blue-600', bg: 'bg-blue-500/10', filter: null },
            { label: 'Customer Returns', value: stats.customerReturns, icon: User, color: 'text-purple-600', bg: 'bg-purple-500/10', filter: null },
            { label: 'Vendor Returns', value: stats.vendorReturns, icon: Building2, color: 'text-muted-foreground', bg: 'bg-muted', filter: null },
          ].map(({ label, value, icon: Icon, color, bg, urgent, filter }) => {
            // A card is "selected" only when it matches the live view state, so the
            // header highlight always agrees with the table below (not a stuck tint).
            const selected = filter === 'pending' ? pendingOnly : filter === 'all' ? !pendingOnly : false;
            return (
              <button
                key={label}
                type="button"
                onClick={() => { if (filter === 'pending') { setPendingOnly(true); setTypeFilter('all'); } else if (filter === 'all') setPendingOnly(false); }}
                disabled={filter === null}
                className={cn(
                  'flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition-all',
                  selected ? 'border-primary ring-2 ring-primary/25' : 'border-border',
                  !selected && urgent && 'border-warning/40',
                  filter && !selected && 'hover:bg-muted/50 cursor-pointer',
                )}
              >
                <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', bg)}>
                  <Icon className={cn('h-4 w-4', color)} />
                </div>
                <div>
                  <p className="text-lg font-bold leading-tight">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </button>
            );
          })}
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
          <Button size="sm" variant="outline" onClick={() => { setPendingOnly(true); setTypeFilter('all'); }}>
            Review Now
          </Button>
        </div>
      )}

      {pendingOnly && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Showing <strong className="text-foreground">pending returns</strong> only</span>
          <button onClick={() => setPendingOnly(false)} className="text-primary hover:underline">Show all statuses</button>
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
        globalSearch
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

'use client';

import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Search, Loader2, User, Receipt } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Medicine, Bill } from '@pharmaos/types';

interface LineItem {
  medicineId: string;
  medicineName: string;
  genericName: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  mrp: number;
  sellingPrice: number;
  discount: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

async function searchMedicines(q: string): Promise<Medicine[]> {
  const res = await fetch(`/api/medicines?search=${encodeURIComponent(q)}&limit=10`);
  const json = await res.json() as { success: boolean; data: { data: Medicine[] } };
  return json.data.data;
}

async function createBill(payload: object): Promise<Bill> {
  const res = await fetch('/api/billing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json() as { success: boolean; data: Bill; message?: string };
  if (!json.success) throw new Error(json.message ?? 'Failed to create bill');
  return json.data;
}

function calcLine(item: LineItem): LineItem {
  const base = item.sellingPrice * item.quantity;
  const discAmt = base * (item.discount / 100);
  const taxable = base - discAmt;
  const gstAmount = taxable * (item.gstRate / 100);
  return { ...item, gstAmount: Number(gstAmount.toFixed(2)), totalAmount: Number((taxable + gstAmount).toFixed(2)) };
}

export function NewBillSheet({ open, onOpenChange }: Props) {
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [showSugg, setShowSugg] = useState(false);
  const [items, setItems] = useState<LineItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [doctor, setDoctor] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card' | 'credit'>('cash');
  const [globalDiscount, setGlobalDiscount] = useState(0);

  const { data: suggestions = [] } = useQuery({
    queryKey: ['med-search', search],
    queryFn: () => searchMedicines(search),
    enabled: search.length >= 2,
  });

  React.useEffect(() => {
    if (open) {
      setItems([]);
      setSearch('');
      setCustomerName('');
      setCustomerPhone('');
      setDoctor('');
      setPaymentMethod('cash');
      setGlobalDiscount(0);
      setShowSugg(false);
    }
  }, [open]);

  const addItem = useCallback((med: Medicine) => {
    setSearch('');
    setShowSugg(false);
    const existing = items.findIndex((i) => i.medicineId === med.id);
    if (existing >= 0) {
      setItems((prev) => prev.map((item, idx) => idx === existing ? calcLine({ ...item, quantity: item.quantity + 1 }) : item));
      return;
    }
    const newLine: LineItem = {
      medicineId: med.id,
      medicineName: med.name,
      genericName: med.genericName,
      batchNumber: 'AUTO',
      expiryDate: '2026-12-31T00:00:00Z',
      quantity: 1,
      mrp: med.mrp,
      sellingPrice: med.sellingPrice,
      discount: 0,
      gstRate: med.gstRate,
      gstAmount: 0,
      totalAmount: 0,
    };
    setItems((prev) => [...prev, calcLine(newLine)]);
  }, [items]);

  const updateItem = useCallback((idx: number, field: keyof LineItem, value: number | string) => {
    setItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      return calcLine({ ...item, [field]: value });
    }));
  }, []);

  const removeItem = useCallback((idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const subtotal = items.reduce((s, i) => s + i.sellingPrice * i.quantity * (1 - i.discount / 100), 0);
  const taxTotal = items.reduce((s, i) => s + i.gstAmount, 0);
  const discountAmt = subtotal * (globalDiscount / 100);
  const total = subtotal + taxTotal - discountAmt;

  const mutation = useMutation({
    mutationFn: createBill,
    onSuccess: (bill) => {
      qc.invalidateQueries({ queryKey: ['billing'] });
      toast.success(`Bill ${bill.billNumber} created`, { description: `₹${total.toFixed(2)} · ${paymentMethod.toUpperCase()}` });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleSubmit() {
    if (items.length === 0) { toast.error('Add at least one item to the bill'); return; }
    const billItems = items.map((item, i) => ({ id: `bi_${Date.now()}_${i}`, ...item }));
    mutation.mutate({
      type: 'sale',
      customer: customerName ? { name: customerName, phone: customerPhone || undefined } : undefined,
      doctor: doctor || undefined,
      items: billItems,
      subtotal: Number(subtotal.toFixed(2)),
      discountAmount: Number(discountAmt.toFixed(2)),
      discountPercent: globalDiscount,
      taxAmount: Number(taxTotal.toFixed(2)),
      totalAmount: Number(total.toFixed(2)),
      paidAmount: Number(total.toFixed(2)),
      balanceAmount: 0,
      paymentMethod,
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col w-full sm:max-w-xl" side="right">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" /> New Bill
          </SheetTitle>
          <SheetDescription>Search medicines, set quantities, and process payment</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
          {/* Medicine search */}
          <div>
            <Label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add Medicine</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search by name or generic…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setShowSugg(true); }}
                onFocus={() => search.length >= 2 && setShowSugg(true)}
                onBlur={() => setTimeout(() => setShowSugg(false), 150)}
              />
              {showSugg && suggestions.length > 0 && (
                <div className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
                  {suggestions.map((med) => (
                    <button key={med.id} type="button" onMouseDown={(e) => { e.preventDefault(); addItem(med); }}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{med.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{med.manufacturer} · ₹{med.mrp}</p>
                      </div>
                      <Badge variant={med.requiresPrescription ? 'warning' : 'muted'} className="shrink-0 text-[10px]">
                        {med.requiresPrescription ? 'Rx' : 'OTC'}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Line items */}
          {items.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Items ({items.length})</Label>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="rounded-lg border border-border bg-card p-3">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.medicineName}</p>
                        <p className="text-xs text-muted-foreground">{item.genericName} · GST {item.gstRate}%</p>
                      </div>
                      <button type="button" onClick={() => removeItem(idx)} className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <p className="mb-0.5 text-[10px] text-muted-foreground">Qty</p>
                        <Input type="number" min={1} value={item.quantity}
                          onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))}
                          className="h-7 text-xs" />
                      </div>
                      <div>
                        <p className="mb-0.5 text-[10px] text-muted-foreground">Rate (₹)</p>
                        <Input type="number" step="0.01" value={item.sellingPrice}
                          onChange={(e) => updateItem(idx, 'sellingPrice', Number(e.target.value))}
                          className="h-7 text-xs" />
                      </div>
                      <div>
                        <p className="mb-0.5 text-[10px] text-muted-foreground">Disc %</p>
                        <Input type="number" min={0} max={100} value={item.discount}
                          onChange={(e) => updateItem(idx, 'discount', Number(e.target.value))}
                          className="h-7 text-xs" />
                      </div>
                      <div>
                        <p className="mb-0.5 text-[10px] text-muted-foreground">Total</p>
                        <div className="flex h-7 items-center rounded-md bg-muted px-2 text-xs font-semibold">
                          ₹{item.totalAmount.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10 text-center">
              <Plus className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Search above to add medicines</p>
            </div>
          )}

          <Separator />

          {/* Customer info */}
          <div>
            <Label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <User className="h-3 w-3" /> Customer (optional)
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="text-sm" />
              <Input placeholder="Phone number" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} maxLength={10} className="text-sm" />
            </div>
            <Input placeholder="Doctor name (if prescription)" value={doctor} onChange={(e) => setDoctor(e.target.value)} className="mt-2 text-sm" />
          </div>

          {/* Payment and summary */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Label className="text-xs">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}>
                  <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="text-xs">Bill Discount (%)</Label>
                <Input type="number" min={0} max={100} value={globalDiscount} onChange={(e) => setGlobalDiscount(Number(e.target.value))} className="mt-1 h-8 text-xs" />
              </div>
            </div>

            <Separator />

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>GST</span>
                <span>₹{taxTotal.toFixed(2)}</span>
              </div>
              {discountAmt > 0 && (
                <div className="flex justify-between text-success">
                  <span>Discount ({globalDiscount}%)</span>
                  <span>-₹{discountAmt.toFixed(2)}</span>
                </div>
              )}
              <div className={cn('flex justify-between border-t border-border pt-1.5 text-base font-bold')}>
                <span>Total</span>
                <span className="text-primary">₹{total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending || items.length === 0}>
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Receipt className="mr-2 h-4 w-4" />}
            Create Bill {items.length > 0 && `· ₹${total.toFixed(2)}`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

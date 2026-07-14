'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Search } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Medicine, InventoryItem } from '@pharmaos/types';
import { apiFetch } from '@/lib/api';

const schema = z.object({
  medicineId: z.string().min(1, 'Select a medicine'),
  batchNumber: z.string().min(1, 'Batch number is required'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  purchasePrice: z.coerce.number().min(0, 'Purchase price is required'),
  mrp: z.coerce.number().min(0.01, 'MRP is required'),
  sellingPrice: z.coerce.number().min(0.01, 'Selling price is required'),
  manufacturingDate: z.string().min(1, 'Manufacturing date is required'),
  expiryDate: z.string().min(1, 'Expiry date is required'),
  supplierName: z.string().min(1, 'Supplier name is required'),
  rackLocation: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

async function fetchMedicinesSearch(q: string): Promise<Medicine[]> {
  const res = await apiFetch(`/api/medicines?search=${encodeURIComponent(q)}&limit=20`);
  const json = await res.json() as { success: boolean; data: { data: Medicine[] } };
  if (!res.ok) throw new Error('Request failed');
  return json.data?.data ?? ([] as Medicine[]);
}

async function addStock(data: FormValues): Promise<InventoryItem> {
  const res = await apiFetch('/api/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json() as { success: boolean; data: InventoryItem; message?: string };
  if (!json.success) throw new Error(json.message ?? 'Failed to add stock');
  return json.data;
}

export function AddStockSheet({ open, onOpenChange }: Props) {
  const [search, setSearch] = useState('');
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const qc = useQueryClient();

  const { data: suggestions = [] } = useQuery({
    queryKey: ['medicine-search', search],
    queryFn: () => fetchMedicinesSearch(search),
    enabled: search.length >= 2,
  });

  const { register, handleSubmit, setValue, reset, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  React.useEffect(() => {
    if (open) {
      reset();
      setSelectedMedicine(null);
      setSearch('');
    }
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: addStock,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Stock added successfully');
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function selectMedicine(med: Medicine) {
    setSelectedMedicine(med);
    setSearch(med.name);
    setShowDropdown(false);
    setValue('medicineId', med.id);
    setValue('mrp', med.mrp);
    setValue('sellingPrice', med.sellingPrice);
    setValue('purchasePrice', med.purchasePrice ?? 0);
  }

  const qty = watch('quantity') ?? 0;
  const purchasePrice = watch('purchasePrice') ?? 0;
  const totalCost = qty * purchasePrice;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Add Stock</SheetTitle>
          <SheetDescription>Record a new stock batch for a medicine</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
          {/* Medicine search */}
          <div className="space-y-1">
            <Label>Medicine <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search medicine by name…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); setSelectedMedicine(null); setValue('medicineId', ''); }}
                onFocus={() => search.length >= 2 && setShowDropdown(true)}
              />
              {showDropdown && suggestions.length > 0 && (
                <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                  {suggestions.map((med) => (
                    <button key={med.id} type="button" className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-accent" onClick={() => selectMedicine(med)}>
                      <span className="text-sm font-medium">{med.name}</span>
                      <span className="text-xs text-muted-foreground">{med.manufacturer} · MRP ₹{med.mrp}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedMedicine && (
              <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-sm">
                <span className="font-medium text-primary">{selectedMedicine.name}</span>
                <span className="text-muted-foreground"> — {selectedMedicine.manufacturer} · {selectedMedicine.form}</span>
              </div>
            )}
            {errors.medicineId && <p className="text-xs text-destructive">{errors.medicineId.message}</p>}
          </div>

          {/* Batch and qty */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Batch Number <span className="text-destructive">*</span></Label>
              <Input {...register('batchNumber')} placeholder="e.g. PCM2024A" />
              {errors.batchNumber && <p className="text-xs text-destructive">{errors.batchNumber.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Quantity <span className="text-destructive">*</span></Label>
              <Input type="number" {...register('quantity')} placeholder="Units received" />
              {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Manufacturing Date <span className="text-destructive">*</span></Label>
              <Input type="date" {...register('manufacturingDate')} />
              {errors.manufacturingDate && <p className="text-xs text-destructive">{errors.manufacturingDate.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Expiry Date <span className="text-destructive">*</span></Label>
              <Input type="date" {...register('expiryDate')} />
              {errors.expiryDate && <p className="text-xs text-destructive">{errors.expiryDate.message}</p>}
            </div>
          </div>

          {/* Pricing */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pricing</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Purchase Price (₹)</Label>
                <Input type="number" step="0.01" {...register('purchasePrice')} placeholder="0.00" />
                {errors.purchasePrice && <p className="text-xs text-destructive">{errors.purchasePrice.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>MRP (₹) <span className="text-destructive">*</span></Label>
                <Input type="number" step="0.01" {...register('mrp')} placeholder="0.00" />
                {errors.mrp && <p className="text-xs text-destructive">{errors.mrp.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Selling Price (₹) <span className="text-destructive">*</span></Label>
                <Input type="number" step="0.01" {...register('sellingPrice')} placeholder="0.00" />
                {errors.sellingPrice && <p className="text-xs text-destructive">{errors.sellingPrice.message}</p>}
              </div>
            </div>
            {qty > 0 && purchasePrice > 0 && (
              <div className="flex items-center justify-between rounded bg-muted px-3 py-2 text-sm">
                <span className="text-muted-foreground">Total purchase cost</span>
                <span className="font-semibold">₹{totalCost.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Supplier + Rack Location */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Supplier Name <span className="text-destructive">*</span></Label>
              <Input {...register('supplierName')} placeholder="e.g. MedLine Distributors" />
              {errors.supplierName && <p className="text-xs text-destructive">{errors.supplierName.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Rack Location</Label>
              <Input {...register('rackLocation')} placeholder="e.g. A-01-02" />
              <p className="text-2xs text-muted-foreground">Format: [A-Z]-[00-99]-[00-99]</p>
            </div>
          </div>
        </form>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit((d) => mutation.mutate(d))} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Stock
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

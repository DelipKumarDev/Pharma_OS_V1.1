'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { InventoryItem } from '@pharmaos/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';

interface Props {
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EditValues {
  batchNumber: string;
  expiryDate: string;
  mrp: string;
  sellingPrice: string;
  purchasePrice: string;
  rackLocation: string;
}

// Edit a stock entry's correctable details (batch, expiry, prices, rack). Quantity
// is intentionally handled by Adjust Stock so every quantity change is audited.
export function EditStockDialog({ item, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm<EditValues>();

  useEffect(() => {
    if (item) {
      reset({
        batchNumber: item.batchNumber ?? '',
        expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().slice(0, 10) : '',
        mrp: String(item.mrp ?? ''),
        sellingPrice: String(item.sellingPrice ?? ''),
        purchasePrice: String(item.purchasePrice ?? ''),
        rackLocation: item.rackLocation ?? '',
      });
    }
  }, [item, reset]);

  const mutation = useMutation({
    mutationFn: async (v: EditValues) => {
      const r = await apiFetch(`/api/inventory/${item!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchNumber: v.batchNumber,
          expiryDate: v.expiryDate || undefined,
          mrp: v.mrp, sellingPrice: v.sellingPrice, purchasePrice: v.purchasePrice,
          rackLocation: v.rackLocation,
        }),
      });
      const j = await r.json() as { success: boolean; message?: string };
      if (!r.ok || !j.success) throw new Error(j.message ?? 'Update failed');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['inventory-stats'] });
      toast.success('Stock entry updated');
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Stock Entry</DialogTitle>
          <DialogDescription>{(item as (typeof item) & { medicineName?: string })?.medicineName ?? item?.medicine?.name} — batch {item?.batchNumber}. To change quantity, use Adjust Stock.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Batch Number</Label>
              <Input {...register('batchNumber')} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Expiry Date</Label>
              <Input type="date" {...register('expiryDate')} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">MRP (₹)</Label>
              <Input type="number" step="0.01" {...register('mrp')} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Selling Price (₹)</Label>
              <Input type="number" step="0.01" {...register('sellingPrice')} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Purchase Price (₹)</Label>
              <Input type="number" step="0.01" {...register('purchasePrice')} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Rack / Shelf</Label>
              <Input {...register('rackLocation')} className="h-8 text-sm" placeholder="e.g. A-01" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

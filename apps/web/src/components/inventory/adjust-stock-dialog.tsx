'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react';
import type { InventoryItem } from '@pharmaos/types';
import { formatCurrency } from '@pharmaos/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

const REASONS = [
  'Physical stock count correction',
  'Damaged / broken units',
  'Theft / missing stock',
  'Supplier return',
  'Expired units removed',
  'Stock received without invoice',
  'Billing error correction',
  'Inter-branch transfer',
  'Other',
];

const schema = z.object({
  physicalCount: z.coerce.number().min(0, 'Physical count cannot be negative'),
  reason: z.string().min(1, 'Select a reason'),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdjustStockDialog({ item, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const systemQty = item?.availableQuantity ?? 0;
  const medicineName = (item?.medicine as { name: string } | undefined)?.name ?? '';

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormValues>({
    mode: 'onTouched',
    resolver: zodResolver(schema),
    defaultValues: { physicalCount: systemQty, reason: '', notes: '' },
  });

  useEffect(() => {
    if (open && item) {
      reset({ physicalCount: item.availableQuantity, reason: '', notes: '' });
    }
  }, [open, item, reset]);

  const physicalCount = Number(watch('physicalCount') ?? systemQty);
  const variance = physicalCount - systemQty;
  const isDecrease = variance < 0;
  const largeVariance = systemQty > 0 && Math.abs(variance) / systemQty > 0.2;

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await apiFetch(`/api/inventory/${item!.id}/adjust`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustment: variance, physicalCount: data.physicalCount, reason: data.reason, notes: data.notes }),
      });
      const json = await res.json() as { success: boolean; message?: string };
      if (!json.success) throw new Error(json.message ?? 'Adjustment failed');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Stock adjustment submitted', {
        description: largeVariance ? 'Pending approval — manager has been notified.' : 'Applied immediately.',
      });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Stock Adjustment</DialogTitle>
          <DialogDescription>Enter physical count to auto-calculate variance.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
          {/* Medicine info strip */}
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
            <p className="text-sm font-semibold">{medicineName}</p>
            <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
              <span>Batch: <code className="font-mono">{item?.batchNumber}</code></span>
              <span>Rack: {item?.rackLocation ?? '—'}</span>
              <span>MRP: {formatCurrency(item?.mrp ?? 0)}</span>
            </div>
          </div>

          {/* System qty vs physical count */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground mb-1">System Quantity</p>
              <p className="text-3xl font-bold text-primary tabular-nums">{systemQty}</p>
              <p className="text-xs text-muted-foreground mt-1">Current record</p>
            </div>
            <div className={cn('rounded-lg border p-3', variance !== 0 ? 'border-warning/30 bg-warning/5' : 'border-border bg-card')}>
              <p className="text-xs text-muted-foreground mb-1">Physical Count <span className="text-destructive">*</span></p>
              <Input
                type="number"
                min={0}
                className="h-9 text-2xl font-bold border-0 p-0 focus-visible:ring-0 bg-transparent tabular-nums"
                {...register('physicalCount')}
              />
              <p className="text-xs text-muted-foreground mt-1">Actual count today</p>
            </div>
          </div>

          {/* Variance display */}
          <div className={cn(
            'flex items-center justify-between rounded-lg px-4 py-3 border',
            variance === 0 ? 'border-success/20 bg-success/5' :
            isDecrease ? 'border-destructive/20 bg-destructive/5' : 'border-primary/20 bg-primary/5'
          )}>
            <div className="flex items-center gap-2">
              {variance === 0
                ? <CheckCircle2 className="h-5 w-5 text-success" />
                : isDecrease
                ? <TrendingDown className="h-5 w-5 text-destructive" />
                : <TrendingUp className="h-5 w-5 text-primary" />}
              <div>
                <p className="text-sm font-semibold">
                  {variance === 0 ? 'No variance' : `Variance: ${variance > 0 ? '+' : ''}${variance} units`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {variance === 0 ? 'System and physical counts match'
                    : isDecrease ? `Stock will decrease by ${Math.abs(variance)} units`
                    : `Stock will increase by ${variance} units`}
                </p>
              </div>
            </div>
            {variance !== 0 && (
              <span className={cn('text-lg font-bold tabular-nums', isDecrease ? 'text-destructive' : 'text-primary')}>
                {variance > 0 ? '+' : ''}{variance}
              </span>
            )}
          </div>

          {/* Large variance warning */}
          {largeVariance && variance !== 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 text-warning-600 mt-0.5 shrink-0" />
              <div className="text-xs">
                <p className="font-semibold text-warning-600">Approval Required</p>
                <p className="text-muted-foreground">Variance exceeds 20% — this adjustment needs manager approval before taking effect.</p>
              </div>
            </div>
          )}

          {errors.physicalCount && <p className="text-xs text-destructive">{errors.physicalCount.message}</p>}

          {/* Reason */}
          <div className="space-y-1.5">
            <Label>Reason <span className="text-destructive">*</span></Label>
            <Select onValueChange={(v) => setValue('reason', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason for adjustment…" />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.reason && <p className="text-xs text-destructive">{errors.reason.message}</p>}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Additional Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea
              {...register('notes')}
              placeholder="Add context about the discrepancy…"
              className="resize-none h-20 text-sm"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending || variance === 0}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {largeVariance && variance !== 0
                ? <><AlertTriangle className="mr-1.5 h-4 w-4" />Submit for Approval</>
                : 'Apply Adjustment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

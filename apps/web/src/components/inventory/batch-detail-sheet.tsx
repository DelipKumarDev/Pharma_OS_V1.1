'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package2, TrendingDown, TrendingUp, ArrowLeftRight, Trash2, RotateCcw, ShoppingCart } from 'lucide-react';
import type { InventoryItem, MedicineBatch, StockMovement } from '@pharmaos/types';
import { formatCurrency, formatDate } from '@pharmaos/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Props {
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

async function fetchBatches(medicineId: string): Promise<MedicineBatch[]> {
  const res = await apiFetch(`/api/inventory/batches/${medicineId}`);
  const json = await res.json() as { success: boolean; data: MedicineBatch[] };
  return json.data;
}

async function fetchMovements(medicineId: string): Promise<StockMovement[]> {
  const res = await apiFetch(`/api/inventory/movements/${medicineId}`);
  const json = await res.json() as { success: boolean; data: StockMovement[] };
  return json.data;
}

const MOVEMENT_META: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  PURCHASE: { icon: TrendingUp, color: 'text-success', label: 'Purchase' },
  SALE: { icon: ShoppingCart, color: 'text-primary', label: 'Sale' },
  ADJUSTMENT: { icon: ArrowLeftRight, color: 'text-warning-600', label: 'Adjustment' },
  RETURN: { icon: RotateCcw, color: 'text-blue-500', label: 'Return' },
  TRANSFER: { icon: ArrowLeftRight, color: 'text-purple-500', label: 'Transfer' },
  DISPOSAL: { icon: Trash2, color: 'text-destructive', label: 'Disposal' },
};

const BATCH_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'muted'> = {
  active: 'success',
  exhausted: 'muted',
  expired: 'error',
  returned: 'warning',
};

export function BatchDetailSheet({ item, open, onOpenChange }: Props) {
  const medicineId = item?.medicineId ?? '';
  const medicineName = (item?.medicine as { name: string } | undefined)?.name ?? '';

  const { data: batches = [], isLoading: bLoading } = useQuery({
    queryKey: ['batches', medicineId],
    queryFn: () => fetchBatches(medicineId),
    enabled: !!medicineId && open,
  });

  const { data: movements = [], isLoading: mLoading } = useQuery({
    queryKey: ['movements', medicineId],
    queryFn: () => fetchMovements(medicineId),
    enabled: !!medicineId && open,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-xl overflow-hidden">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Package2 className="h-5 w-5 text-primary" />
            {medicineName}
          </SheetTitle>
          <SheetDescription>
            All batches in FEFO order · Rack {item?.rackLocation ?? '—'} · {item?.manufacturer ?? '—'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-6 px-6 pb-6">
          {/* Medicine summary strip */}
          <div className="grid grid-cols-3 gap-3 rounded-xl bg-muted/40 border border-border p-4">
            <div>
              <p className="text-xs text-muted-foreground">Total Stock</p>
              <p className="text-lg font-bold text-primary">{item?.availableQuantity ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">MRP</p>
              <p className="text-lg font-bold">{formatCurrency(item?.mrp ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reorder At</p>
              <p className="text-lg font-bold">{item?.reorderLevel ?? 10}</p>
            </div>
          </div>

          {/* FEFO Batches */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Batches — FEFO Order</h3>
              <Badge variant="muted" className="text-xs">First Expiry First Out</Badge>
            </div>
            {bLoading ? (
              <div className="space-y-2">
                {[1, 2].map((n) => <Skeleton key={n} className="h-20 w-full rounded-lg" />)}
              </div>
            ) : batches.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted-foreground">No batches found — add stock to get started.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {[...batches].sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())
                  .map((batch, idx) => {
                    const daysLeft = Math.round((new Date(batch.expiryDate).getTime() - Date.now()) / 86400000);
                    const isFefo = idx === 0 && batch.batchStatus === 'active';
                    return (
                      <div key={batch.batchId} className={cn(
                        'rounded-lg border p-3 space-y-2',
                        isFefo ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{batch.batchNumber}</code>
                            {isFefo && <Badge variant="success" className="text-2xs px-1.5">FEFO Active</Badge>}
                          </div>
                          <Badge variant={BATCH_STATUS_VARIANT[batch.batchStatus] ?? 'muted'} className="text-xs capitalize">
                            {batch.batchStatus}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">Available</p>
                            <p className="font-semibold tabular-nums">{batch.quantityAvailable}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Expiry</p>
                            <p className={cn('font-medium', daysLeft < 0 ? 'text-destructive' : daysLeft <= 30 ? 'text-warning-600' : '')}>
                              {formatDate(batch.expiryDate)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Days Left</p>
                            <p className={cn('font-semibold', daysLeft < 0 ? 'text-destructive' : daysLeft <= 30 ? 'text-warning-600' : 'text-success')}>
                              {daysLeft < 0 ? `${Math.abs(daysLeft)}d over` : `${daysLeft}d`}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">MRP</p>
                            <p className="font-medium">{formatCurrency(batch.mrp)}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Purchase: {formatCurrency(batch.purchasePrice)}</span>
                          <span>Supplier: {batch.supplierName ?? '—'}</span>
                          <span>{batch.quantityInitial} received</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          <Separator />

          {/* Stock Movement History */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Stock Movement History</h3>
            {mLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((n) => <Skeleton key={n} className="h-14 w-full rounded-lg" />)}
              </div>
            ) : movements.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No movements recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {movements.slice().reverse().map((mv) => {
                  const meta = MOVEMENT_META[mv.movementType] ?? MOVEMENT_META['ADJUSTMENT']!;
                  const Icon = meta.icon;
                  return (
                    <div key={mv.movementId} className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                        <Icon className={cn('h-4 w-4', meta.color)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{meta.label}</span>
                          <span className={cn('text-sm font-semibold tabular-nums', mv.quantityChange > 0 ? 'text-success' : 'text-destructive')}>
                            {mv.quantityChange > 0 ? '+' : ''}{mv.quantityChange}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {mv.performedBy} · {formatDate(mv.createdAt)}
                          {mv.referenceId && ` · ${mv.referenceId}`}
                        </p>
                        {mv.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{mv.notes}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

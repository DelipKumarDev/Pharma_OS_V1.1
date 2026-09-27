'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { Boxes } from 'lucide-react';
import type { InventoryItem } from '@pharmaos/types';
import { formatCurrency, formatDate, daysUntilExpiry } from '@pharmaos/utils';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BatchDetailSheet } from '@/components/inventory/batch-detail-sheet';
import { apiFetch } from '@/lib/api';

type Row = InventoryItem & { medicineName?: string; dosageForm?: string };

async function fetchBatches(): Promise<Row[]> {
  const r = await apiFetch('/api/inventory?limit=1000');
  const j = await r.json() as { data: { data: Row[] } };
  return j.data?.data ?? [];
}

export default function BatchManagementPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ['batches'], queryFn: fetchBatches });
  const [detail, setDetail] = useState<InventoryItem | null>(null);
  const value = data.reduce((s, i) => s + i.availableQuantity * i.purchasePrice, 0);

  const columns: ColumnDef<Row>[] = [
    { id: 'medicine', accessorFn: (r) => r.medicineName ?? '', header: 'Medicine', cell: ({ row }) => <div><p className="font-medium text-sm">{row.original.medicineName ?? 'Unknown'}</p><p className="text-xs text-muted-foreground capitalize">{row.original.dosageForm ?? ''}</p></div> },
    { accessorKey: 'batchNumber', header: 'Batch', cell: ({ row }) => <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{row.original.batchNumber}</code> },
    { accessorKey: 'availableQuantity', header: ({ column }) => <SortableHeader column={column}>Qty</SortableHeader>, cell: ({ row }) => <span className="font-semibold tabular-nums">{row.original.availableQuantity}</span> },
    { accessorKey: 'mrp', header: 'MRP', cell: ({ row }) => <span className="tabular-nums text-sm">{formatCurrency(row.original.mrp)}</span> },
    { accessorKey: 'expiryDate', header: ({ column }) => <SortableHeader column={column}>Expiry</SortableHeader>, cell: ({ row }) => { const d = daysUntilExpiry(row.original.expiryDate); return <div className="text-sm">{formatDate(row.original.expiryDate)} <span className={d < 0 ? 'text-destructive text-xs' : d <= 90 ? 'text-warning-600 text-xs' : 'text-muted-foreground text-xs'}>({d < 0 ? `${Math.abs(d)}d over` : `${d}d`})</span></div>; } },
    { id: 'rack', header: 'Rack', cell: ({ row }) => <code className="text-xs font-mono text-muted-foreground">{row.original.rackLocation ?? '—'}</code> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => { const s = row.original.status; const m: Record<string, 'success' | 'warning' | 'destructive' | 'muted'> = { available: 'success', low_stock: 'warning', out_of_stock: 'destructive', expired: 'muted', damaged: 'muted' }; return <Badge variant={m[s] ?? 'muted'} dot className="text-xs capitalize">{s.replace('_', ' ')}</Badge>; } },
    { id: 'actions', header: '', cell: ({ row }) => <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setDetail(row.original)}>View Batch</Button> },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Batch Management</h1><p className="text-sm text-muted-foreground">Every stock batch with quantity, expiry, rack location and status</p></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 max-w-2xl">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><Boxes className="h-5 w-5 text-primary" /></div><div><p className="text-xl font-bold">{data.length}</p><p className="text-xs text-muted-foreground">Active Batches</p></div></div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10"><Boxes className="h-5 w-5 text-success" /></div><div><p className="text-xl font-bold">{formatCurrency(value)}</p><p className="text-xs text-muted-foreground">Stock Value (cost)</p></div></div>
      </div>
      <DataTable columns={columns} data={data} loading={isLoading} globalSearch searchPlaceholder="Search by medicine, batch, rack…"
        emptyMessage="No batches" emptyDescription="Add stock to create batches." />
      {detail && <BatchDetailSheet item={detail} open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }} />}
    </div>
  );
}

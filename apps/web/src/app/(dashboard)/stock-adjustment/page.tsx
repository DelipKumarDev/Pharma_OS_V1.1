'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { SlidersHorizontal, Edit2 } from 'lucide-react';
import type { InventoryItem } from '@pharmaos/types';
import { formatCurrency, formatDate } from '@pharmaos/utils';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AdjustStockDialog } from '@/components/inventory/adjust-stock-dialog';
import { apiFetch } from '@/lib/api';

type Row = InventoryItem & { medicineName?: string };

async function fetchBatches(): Promise<Row[]> {
  const r = await apiFetch('/api/inventory?limit=1000');
  const j = await r.json() as { data: { data: Row[] } };
  return j.data?.data ?? [];
}

export default function StockAdjustmentPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ['inventory', 'adjust'], queryFn: fetchBatches });
  const [adjust, setAdjust] = useState<InventoryItem | null>(null);

  const columns: ColumnDef<Row>[] = [
    { id: 'medicine', accessorFn: (r) => r.medicineName ?? '', header: 'Medicine', cell: ({ row }) => <div><p className="font-medium text-sm">{row.original.medicineName ?? 'Unknown'}</p><p className="text-xs text-muted-foreground font-mono">{row.original.batchNumber}</p></div> },
    { accessorKey: 'availableQuantity', header: ({ column }) => <SortableHeader column={column}>System Qty</SortableHeader>, cell: ({ row }) => <span className="font-semibold tabular-nums">{row.original.availableQuantity}</span> },
    { accessorKey: 'mrp', header: 'MRP', cell: ({ row }) => <span className="tabular-nums text-sm">{formatCurrency(row.original.mrp)}</span> },
    { accessorKey: 'expiryDate', header: 'Expiry', cell: ({ row }) => <span className="text-sm">{formatDate(row.original.expiryDate)}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant={row.original.status === 'available' ? 'success' : row.original.status === 'low_stock' ? 'warning' : 'destructive'} dot className="text-xs capitalize">{row.original.status.replace('_', ' ')}</Badge> },
    { id: 'actions', header: '', cell: ({ row }) => <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAdjust(row.original)}><Edit2 className="h-3.5 w-3.5" /> Adjust</Button> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10"><SlidersHorizontal className="h-4 w-4 text-primary" /></div>
        <div><h1 className="text-2xl font-bold tracking-tight">Stock Adjustment</h1><p className="text-sm text-muted-foreground">Correct system quantities against physical count — additions, deductions, damage & write-offs</p></div>
      </div>
      <DataTable columns={columns} data={data} loading={isLoading} globalSearch searchPlaceholder="Search by medicine or batch…"
        emptyMessage="No stock to adjust" emptyDescription="Add stock first." />
      {adjust && <AdjustStockDialog item={adjust} open={!!adjust} onOpenChange={(o) => { if (!o) setAdjust(null); }} />}
    </div>
  );
}

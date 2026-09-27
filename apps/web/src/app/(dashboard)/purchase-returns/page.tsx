'use client';

import { useQuery } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { Undo2, Plus } from 'lucide-react';
import Link from 'next/link';
import type { ReturnRequest } from '@pharmaos/types';
import { formatCurrency, formatDate } from '@pharmaos/utils';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';

const STATUS = { pending: 'warning', approved: 'success', processed: 'muted', rejected: 'destructive' } as const;

async function fetchVendorReturns(): Promise<ReturnRequest[]> {
  const r = await apiFetch('/api/returns?type=vendor_return&limit=200');
  const j = await r.json() as { data: { data: ReturnRequest[] } };
  return j.data?.data ?? [];
}

export default function PurchaseReturnsPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ['purchase-returns'], queryFn: fetchVendorReturns });
  const value = data.reduce((s, r) => s + (r.totalAmount ?? 0), 0);

  const columns: ColumnDef<ReturnRequest>[] = [
    { accessorKey: 'returnNumber', header: 'Return No.', cell: ({ row }) => <span className="font-mono font-semibold text-primary text-sm">{row.original.returnNumber}</span> },
    { accessorKey: 'vendorName', header: 'Vendor', cell: ({ row }) => <div><p className="font-medium text-sm">{row.original.vendorName ?? '—'}</p>{row.original.purchaseInvoiceNumber && <p className="text-xs text-muted-foreground font-mono">{row.original.purchaseInvoiceNumber}</p>}</div> },
    { id: 'items', header: 'Items', cell: ({ row }) => { const n = row.original.items.length; const q = row.original.items.reduce((s, it) => s + (it.returnQty ?? 0), 0); return <span className="text-sm text-muted-foreground">{n} item{n !== 1 ? 's' : ''} · {q} qty</span>; } },
    { accessorKey: 'reason', header: 'Reason', cell: ({ row }) => <span className="text-xs capitalize">{row.original.reason.replace(/_/g, ' ')}</span> },
    { accessorKey: 'totalAmount', header: ({ column }) => <SortableHeader column={column}>Value</SortableHeader>, cell: ({ row }) => <span className="font-semibold tabular-nums text-sm">{formatCurrency(row.original.totalAmount ?? 0)}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant={STATUS[row.original.status] ?? 'muted'} dot className="text-xs capitalize">{row.original.status}</Badge> },
    { accessorKey: 'createdAt', header: ({ column }) => <SortableHeader column={column}>Date</SortableHeader>, cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDate(row.original.createdAt)}</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-2xl font-bold tracking-tight">Purchase Returns</h1><p className="text-sm text-muted-foreground">Return expired, damaged or excess stock to vendors</p></div>
        <Button size="sm" asChild><Link href="/returns"><Plus className="h-4 w-4" /> New Return</Link></Button>
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><Undo2 className="h-5 w-5 text-primary" /></div><div><p className="text-xl font-bold">{data.length}</p><p className="text-xs text-muted-foreground">Vendor Returns</p></div></div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10"><Undo2 className="h-5 w-5 text-warning-700" /></div><div><p className="text-xl font-bold">{formatCurrency(value)}</p><p className="text-xs text-muted-foreground">Return Value</p></div></div>
      </div>
      <DataTable columns={columns} data={data} loading={isLoading} globalSearch searchPlaceholder="Search by return no. or vendor…"
        emptyMessage="No vendor returns" emptyDescription="Create a vendor return from the Returns module." />
    </div>
  );
}

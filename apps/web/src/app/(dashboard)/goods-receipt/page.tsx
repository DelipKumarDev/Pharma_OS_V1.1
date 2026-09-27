'use client';

import { useQuery } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { ClipboardCheck, PackageCheck, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency, formatDate } from '@pharmaos/utils';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';

interface POItem { quantity: number; receivedQuantity: number; }
interface PO { id: string; poNumber: string; vendorName: string; status: string; orderDate: string; expectedDate?: string; totalAmount: number; items: POItem[]; }

async function fetchOpenPOs(): Promise<PO[]> {
  const r = await apiFetch('/api/purchase-orders');
  const j = await r.json() as { data: { data: PO[] } };
  return (j.data?.data ?? []).filter((p) => p.status === 'ordered' || p.status === 'partially_received');
}

export default function GoodsReceiptPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ['goods-receipt'], queryFn: fetchOpenPOs });
  const pendingValue = data.reduce((s, p) => s + p.totalAmount, 0);

  const columns: ColumnDef<PO>[] = [
    { accessorKey: 'poNumber', header: 'PO No.', cell: ({ row }) => <span className="font-mono font-semibold text-primary text-sm">{row.original.poNumber}</span> },
    { accessorKey: 'vendorName', header: 'Vendor', cell: ({ row }) => <span className="text-sm font-medium">{row.original.vendorName}</span> },
    { id: 'progress', header: 'Received', cell: ({ row }) => { const tot = row.original.items.reduce((s, i) => s + i.quantity, 0); const rec = row.original.items.reduce((s, i) => s + i.receivedQuantity, 0); return <span className="text-sm tabular-nums">{rec} / {tot} units</span>; } },
    { accessorKey: 'totalAmount', header: ({ column }) => <SortableHeader column={column}>Value</SortableHeader>, cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.totalAmount)}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant={row.original.status === 'partially_received' ? 'secondary' : 'warning'} dot className="text-xs">{row.original.status === 'partially_received' ? 'Partial' : 'Awaiting'}</Badge> },
    { id: 'expected', header: 'Expected', cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.expectedDate ? formatDate(row.original.expectedDate) : '—'}</span> },
    { id: 'actions', header: '', cell: ({ row }) => <Button size="sm" className="h-7 text-xs" asChild><Link href={`/purchase-orders?receive=${row.original.id}`}><PackageCheck className="h-3.5 w-3.5" /> Receive</Link></Button> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-2xl font-bold tracking-tight">Goods Receipt</h1><p className="text-sm text-muted-foreground">Receive stock against open purchase orders into inventory</p></div>
        <Link href="/purchase-orders" className="text-sm text-primary hover:underline flex items-center gap-1">All purchase orders <ArrowRight className="h-3.5 w-3.5" /></Link>
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10"><ClipboardCheck className="h-5 w-5 text-warning-700" /></div><div><p className="text-xl font-bold">{data.length}</p><p className="text-xs text-muted-foreground">Awaiting Receipt</p></div></div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><ClipboardCheck className="h-5 w-5 text-primary" /></div><div><p className="text-xl font-bold">{formatCurrency(pendingValue)}</p><p className="text-xs text-muted-foreground">Pending Value</p></div></div>
      </div>
      <DataTable columns={columns} data={data} loading={isLoading} globalSearch searchPlaceholder="Search by PO no. or vendor…"
        emptyMessage="Nothing to receive" emptyDescription="All purchase orders have been fully received." />
    </div>
  );
}

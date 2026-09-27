'use client';

import { useQuery } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { Wallet, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { Bill } from '@pharmaos/types';
import { formatCurrency, formatDateTime } from '@pharmaos/utils';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';

async function fetchCreditBills(): Promise<Bill[]> {
  const r = await apiFetch('/api/billing?limit=500');
  const j = await r.json() as { data: { data: Bill[] } };
  return (j.data?.data ?? []).filter((b) => (b.balanceAmount ?? 0) > 0 || b.paymentMethod === 'credit');
}

export default function CreditSalesPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ['credit-sales'], queryFn: fetchCreditBills });
  const outstanding = data.reduce((s, b) => s + (b.balanceAmount ?? 0), 0);

  const columns: ColumnDef<Bill>[] = [
    { accessorKey: 'billNumber', header: 'Bill No.', cell: ({ row }) => <span className="font-mono font-semibold text-primary text-sm">{row.original.billNumber}</span> },
    { id: 'customer', header: 'Customer', cell: ({ row }) => <span className="text-sm">{row.original.customer?.name ?? 'Walk-in'}</span> },
    { accessorKey: 'totalAmount', header: ({ column }) => <SortableHeader column={column}>Total</SortableHeader>, cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.totalAmount)}</span> },
    { accessorKey: 'paidAmount', header: 'Paid', cell: ({ row }) => <span className="tabular-nums text-success">{formatCurrency(row.original.paidAmount ?? 0)}</span> },
    { accessorKey: 'balanceAmount', header: ({ column }) => <SortableHeader column={column}>Balance Due</SortableHeader>, cell: ({ row }) => <span className="tabular-nums font-semibold text-warning-700">{formatCurrency(row.original.balanceAmount ?? 0)}</span> },
    { accessorKey: 'createdAt', header: ({ column }) => <SortableHeader column={column}>Date</SortableHeader>, cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDateTime(row.original.createdAt)}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant={row.original.status === 'completed' ? 'success' : 'warning'} dot className="text-xs capitalize">{row.original.status.replace('_', ' ')}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Credit Sales</h1>
          <p className="text-sm text-muted-foreground">Bills sold on credit with an outstanding balance</p>
        </div>
        <Link href="/credit-accounts" className="text-sm text-primary hover:underline flex items-center gap-1">
          Collect payments <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: 'Credit Bills', value: String(data.length), tone: 'text-primary bg-primary/10' },
          { label: 'Total Outstanding', value: formatCurrency(outstanding), tone: 'text-warning-700 bg-warning/10' },
          { label: 'Fully Paid Credit', value: String(data.filter((b) => (b.balanceAmount ?? 0) === 0).length), tone: 'text-success bg-success/10' },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.tone}`}><Wallet className="h-5 w-5" /></div>
            <div><p className="text-xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
          </div>
        ))}
      </div>

      <DataTable columns={columns} data={data} loading={isLoading} globalSearch searchPlaceholder="Search credit bills…"
        emptyMessage="No credit sales" emptyDescription="Bills sold on credit will appear here." />
    </div>
  );
}

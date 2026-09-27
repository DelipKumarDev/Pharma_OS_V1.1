'use client';

import { useQuery } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { Star, Crown } from 'lucide-react';
import type { Customer } from '@pharmaos/types';
import { formatCurrency } from '@pharmaos/utils';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';

async function fetchCustomers(): Promise<Customer[]> {
  const r = await apiFetch('/api/customers?limit=500');
  const j = await r.json() as { data: { data: Customer[] } };
  return (j.data?.data ?? []).slice().sort((a, b) => (b.loyaltyPoints ?? 0) - (a.loyaltyPoints ?? 0));
}

export default function LoyaltyPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ['loyalty'], queryFn: fetchCustomers });
  const totalPoints = data.reduce((s, c) => s + (c.loyaltyPoints ?? 0), 0);
  const members = data.filter((c) => (c.loyaltyPoints ?? 0) > 0).length;

  const columns: ColumnDef<Customer>[] = [
    {
      id: 'rank', header: '#', cell: ({ row }) => {
        const i = row.index;
        return <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-100 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-muted text-muted-foreground'}`}>{i + 1}</span>;
      },
    },
    { accessorKey: 'name', header: 'Customer', cell: ({ row }) => <div className="flex items-center gap-1.5"><p className="font-medium text-sm">{row.original.name}</p>{row.original.customerType === 'vip' && <Crown className="h-3.5 w-3.5 text-amber-500" />}</div> },
    { accessorKey: 'phone', header: 'Phone', cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.phone}</span> },
    { accessorKey: 'loyaltyPoints', header: ({ column }) => <SortableHeader column={column}>Points</SortableHeader>, cell: ({ row }) => <div className="flex items-center gap-1 font-semibold text-amber-600"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{(row.original.loyaltyPoints ?? 0).toLocaleString()}</div> },
    { accessorKey: 'totalSpend', header: ({ column }) => <SortableHeader column={column}>Total Spend</SortableHeader>, cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.totalSpend ?? 0)}</span> },
    { id: 'tier', header: 'Tier', cell: ({ row }) => { const p = row.original.loyaltyPoints ?? 0; const t = p >= 1000 ? { l: 'Gold', v: 'warning' as const } : p >= 300 ? { l: 'Silver', v: 'secondary' as const } : { l: 'Bronze', v: 'muted' as const }; return <Badge variant={t.v} className="text-xs">{t.l}</Badge>; } },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Loyalty Program</h1><p className="text-sm text-muted-foreground">Reward points earned by your customers</p></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 max-w-2xl">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50"><Star className="h-5 w-5 text-amber-500" /></div><div><p className="text-xl font-bold">{members}</p><p className="text-xs text-muted-foreground">Loyalty Members</p></div></div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><Star className="h-5 w-5 text-primary" /></div><div><p className="text-xl font-bold">{totalPoints.toLocaleString()}</p><p className="text-xs text-muted-foreground">Points Issued</p></div></div>
      </div>
      <DataTable columns={columns} data={data} loading={isLoading} globalSearch searchPlaceholder="Search by name or phone…" emptyMessage="No loyalty members yet" emptyDescription="Points accrue automatically as customers make purchases." />
    </div>
  );
}

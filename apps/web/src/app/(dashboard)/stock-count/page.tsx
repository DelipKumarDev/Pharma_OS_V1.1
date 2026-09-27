'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import type { InventoryItem } from '@pharmaos/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

type Row = InventoryItem & { medicineName?: string };

async function fetchBatches(): Promise<Row[]> {
  const r = await apiFetch('/api/inventory?limit=1000');
  const j = await r.json() as { data: { data: Row[] } };
  return j.data?.data ?? [];
}

export default function StockCountPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['inventory', 'count'], queryFn: fetchBatches });
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => data.filter((i) => {
    const q = search.toLowerCase();
    return !q || (i.medicineName ?? '').toLowerCase().includes(q) || i.batchNumber.toLowerCase().includes(q);
  }), [data, search]);

  const variances = data
    .map((i) => ({ item: i, counted: counts[i.id] === undefined || counts[i.id] === '' ? null : Number(counts[i.id]) }))
    .filter((x) => x.counted !== null && x.counted !== x.item.availableQuantity);

  const submit = useMutation({
    mutationFn: async () => {
      let applied = 0;
      for (const { item, counted } of variances) {
        const diff = (counted as number) - item.availableQuantity;
        const adjustmentType = diff >= 0 ? 'addition' : 'deduction';
        const r = await apiFetch(`/api/inventory/${item.id}/adjust`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adjustmentType, quantity: Math.abs(diff), notes: 'Physical stock count reconciliation' }),
        });
        if (r.ok) applied++;
      }
      return applied;
    },
    onSuccess: (n) => { qc.invalidateQueries({ queryKey: ['inventory'] }); toast.success(`Reconciled ${n} batch${n !== 1 ? 'es' : ''}`, { description: 'System quantities updated to physical count.' }); setCounts({}); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10"><ClipboardList className="h-4 w-4 text-primary" /></div>
          <div><h1 className="text-2xl font-bold tracking-tight">Stock Count</h1><p className="text-sm text-muted-foreground">Enter the physically counted quantity for each batch and reconcile variances</p></div>
        </div>
        <Button size="sm" onClick={() => submit.mutate()} disabled={submit.isPending || variances.length === 0}>
          {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Reconcile {variances.length > 0 && `(${variances.length})`}
        </Button>
      </div>

      <Input placeholder="Search by medicine or batch…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm h-8 text-sm" />

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[1fr_100px_120px_120px] gap-2 border-b border-border bg-muted/40 px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <span>Medicine / Batch</span><span className="text-right">System</span><span className="text-right">Counted</span><span className="text-right">Variance</span>
        </div>
        {isLoading ? <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div> : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No batches</div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-border">
            {filtered.map((i) => {
              const c = counts[i.id];
              const counted = c === undefined || c === '' ? null : Number(c);
              const variance = counted === null ? null : counted - i.availableQuantity;
              return (
                <div key={i.id} className="grid grid-cols-[1fr_100px_120px_120px] items-center gap-2 px-4 py-2">
                  <div><p className="text-sm font-medium">{i.medicineName ?? 'Unknown'}</p><p className="text-xs text-muted-foreground font-mono">{i.batchNumber}</p></div>
                  <span className="text-right text-sm font-semibold tabular-nums">{i.availableQuantity}</span>
                  <div className="flex justify-end">
                    <Input type="number" value={c ?? ''} onChange={(e) => setCounts((p) => ({ ...p, [i.id]: e.target.value }))} className="h-8 w-24 text-right text-sm" placeholder="—" />
                  </div>
                  <span className={cn('text-right text-sm font-semibold tabular-nums', variance === null ? 'text-muted-foreground' : variance === 0 ? 'text-success' : variance > 0 ? 'text-primary' : 'text-destructive')}>
                    {variance === null ? '—' : variance > 0 ? `+${variance}` : variance}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

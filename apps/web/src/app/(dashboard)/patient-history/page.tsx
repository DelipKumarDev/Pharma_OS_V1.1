'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, HeartPulse, Receipt, User } from 'lucide-react';
import type { Customer, CustomerPurchase } from '@pharmaos/types';
import { formatCurrency, formatDate } from '@pharmaos/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';

async function searchCustomers(q: string): Promise<Customer[]> {
  const r = await apiFetch(`/api/customers?search=${encodeURIComponent(q)}&limit=10`);
  const j = await r.json() as { data: { data: Customer[] } };
  return j.data?.data ?? [];
}
async function fetchPurchases(id: string): Promise<CustomerPurchase[]> {
  const r = await apiFetch(`/api/customers/${id}/purchases`);
  const j = await r.json() as { data: { data: CustomerPurchase[] } };
  return j.data?.data ?? [];
}

export default function PatientHistoryPage() {
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);
  const { data: results = [] } = useQuery({ queryKey: ['ph-search', q], queryFn: () => searchCustomers(q), enabled: q.length >= 2 });
  const { data: purchases = [], isLoading } = useQuery({ queryKey: ['ph-purchases', selected?.id], queryFn: () => fetchPurchases(selected!.id), enabled: !!selected });

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Patient History</h1><p className="text-sm text-muted-foreground">Look up a patient's complete purchase and medication history</p></div>

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Search patient by name or phone…" value={q} onChange={(e) => { setQ(e.target.value); setSelected(null); }} />
        {q.length >= 2 && !selected && results.length > 0 && (
          <div className="absolute z-40 mt-1 w-full rounded-lg border border-border bg-popover shadow-md max-h-64 overflow-y-auto">
            {results.map((c) => (
              <button key={c.id} onClick={() => { setSelected(c); setQ(c.name); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent">
                <User className="h-3.5 w-3.5 text-muted-foreground" /><span className="font-medium">{c.name}</span><span className="text-xs text-muted-foreground">{c.phone}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {!selected ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-20 text-center">
          <HeartPulse className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Search and select a patient to view their history</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">{selected.name.charAt(0).toUpperCase()}</div>
            <div className="flex-1"><p className="font-semibold">{selected.name}</p><p className="text-xs text-muted-foreground">{selected.phone}{selected.doctorName ? ` · Dr. ${selected.doctorName}` : ''}</p></div>
            <div className="text-right"><p className="text-xs text-muted-foreground">Total Spend</p><p className="font-bold text-primary">{formatCurrency(selected.totalSpend ?? 0)}</p></div>
            <div className="text-right"><p className="text-xs text-muted-foreground">Visits</p><p className="font-bold">{selected.totalVisits ?? 0}</p></div>
          </div>

          {selected.medicalConditions && selected.medicalConditions.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Medical Conditions & Allergies</p><div className="flex flex-wrap gap-1.5">{selected.medicalConditions.map((c) => <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>)}{(selected.allergies ?? []).map((a) => <Badge key={a} variant="destructive" className="text-xs">⚠ {a}</Badge>)}</div></div>
          )}

          <div>
            <p className="text-sm font-semibold mb-2">Purchase History ({purchases.length})</p>
            {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : purchases.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-border py-8 text-center">No purchases on record.</p>
            ) : (
              <div className="space-y-2">
                {purchases.map((p) => (
                  <div key={p.id} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2"><Receipt className="h-3.5 w-3.5 text-primary" /><span className="font-mono text-sm font-medium">{p.billNumber}</span><span className="text-xs text-muted-foreground">{formatDate(p.billDate)} · {p.paymentMethod?.toUpperCase()}</span></div>
                      <span className="font-semibold text-primary">{formatCurrency(p.totalAmount)}</span>
                    </div>
                    <div className="space-y-0.5">{p.items.map((it, i) => <div key={i} className="flex justify-between text-xs text-muted-foreground"><span>{it.medicineName} × {it.quantity}</span><span>{formatCurrency(it.amount)}</span></div>)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

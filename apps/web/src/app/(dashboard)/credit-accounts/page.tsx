'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { Wallet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Customer } from '@pharmaos/types';
import { formatCurrency } from '@pharmaos/utils';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api';

async function fetchCreditCustomers(): Promise<Customer[]> {
  const r = await apiFetch('/api/customers?limit=500');
  const j = await r.json() as { data: { data: Customer[] } };
  return (j.data?.data ?? []).filter((c) => (c.creditBalance ?? 0) > 0);
}

function PaymentDialog({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('cash');
  const mutation = useMutation({
    mutationFn: async () => {
      const r = await apiFetch(`/api/customers/${customer!.id}/payments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount), paymentMode: mode }),
      });
      const j = await r.json() as { success: boolean; message?: string };
      if (!r.ok || !j.success) throw new Error(j.message ?? 'Failed');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['credit-customers'] }); toast.success('Payment recorded'); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={!!customer} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Collect Credit — {customer?.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning-700">Outstanding: {formatCurrency(customer?.creditBalance ?? 0)}</div>
          <div className="space-y-1"><Label>Amount (₹)</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></div>
          <div className="space-y-1"><Label>Mode</Label>
            <Select value={mode} onValueChange={setMode}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="upi">UPI</SelectItem><SelectItem value="neft">NEFT</SelectItem><SelectItem value="cheque">Cheque</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!amount || Number(amount) <= 0 || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Record Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CreditAccountsPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ['credit-customers'], queryFn: fetchCreditCustomers });
  const [payCustomer, setPayCustomer] = useState<Customer | null>(null);
  const totalDue = data.reduce((s, c) => s + (c.creditBalance ?? 0), 0);

  const columns: ColumnDef<Customer>[] = [
    { accessorKey: 'name', header: 'Customer', cell: ({ row }) => <div><p className="font-medium text-sm">{row.original.name}</p><p className="text-xs text-muted-foreground">{row.original.phone}</p></div> },
    { accessorKey: 'customerType', header: 'Type', cell: ({ row }) => <span className="text-xs capitalize">{row.original.customerType?.replace('_', ' ')}</span> },
    { accessorKey: 'creditBalance', header: ({ column }) => <SortableHeader column={column}>Balance Due</SortableHeader>, cell: ({ row }) => <span className="font-semibold text-warning-700 tabular-nums">{formatCurrency(row.original.creditBalance ?? 0)}</span> },
    { id: 'actions', header: '', cell: ({ row }) => <Button size="sm" className="h-7 text-xs" onClick={() => setPayCustomer(row.original)}><Wallet className="h-3.5 w-3.5" /> Record Payment</Button> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Credit Accounts</h1>
        <p className="text-sm text-muted-foreground">Customers with outstanding credit balances — collect and record payments</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 max-w-md">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><Wallet className="h-5 w-5 text-primary" /></div><div><p className="text-xl font-bold">{data.length}</p><p className="text-xs text-muted-foreground">Credit Customers</p></div></div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10"><Wallet className="h-5 w-5 text-warning-700" /></div><div><p className="text-xl font-bold">{formatCurrency(totalDue)}</p><p className="text-xs text-muted-foreground">Total Outstanding</p></div></div>
      </div>
      <DataTable columns={columns} data={data} loading={isLoading} globalSearch searchPlaceholder="Search by name or phone…"
        emptyMessage="No outstanding credit" emptyDescription="Customers with a credit balance appear here." />
      <PaymentDialog customer={payCustomer} onClose={() => setPayCustomer(null)} />
    </div>
  );
}

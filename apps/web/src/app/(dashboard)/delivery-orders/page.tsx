'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { Truck, Loader2, Plus, MapPin, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api';
import { useCan } from '@/lib/permissions';

interface DeliveryOrder {
  id: string;
  orderNumber: string;
  billNumber?: string | null;
  customerName: string;
  customerPhone?: string | null;
  address: string;
  status: 'pending' | 'out_for_delivery' | 'delivered' | 'cancelled';
  assignedTo?: string | null;
  notes?: string | null;
  createdAt: string;
  deliveredAt?: string | null;
}

const STATUS_META: Record<DeliveryOrder['status'], { label: string; variant: 'secondary' | 'default' | 'success' | 'destructive' }> = {
  pending: { label: 'Pending', variant: 'secondary' },
  out_for_delivery: { label: 'Out for Delivery', variant: 'default' },
  delivered: { label: 'Delivered', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
};

async function fetchOrders(): Promise<DeliveryOrder[]> {
  const r = await apiFetch('/api/delivery-orders');
  const j = await r.json() as { data: { data: DeliveryOrder[] } };
  return j.data?.data ?? [];
}

function CreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ customerName: '', customerPhone: '', address: '', billNumber: '', assignedTo: '', notes: '' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const mutation = useMutation({
    mutationFn: async () => {
      const r = await apiFetch('/api/delivery-orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await r.json() as { success: boolean; message?: string };
      if (!r.ok || !j.success) throw new Error(j.message ?? 'Failed to create');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['delivery-orders'] });
      toast.success('Delivery order created');
      setForm({ customerName: '', customerPhone: '', address: '', billNumber: '', assignedTo: '', notes: '' });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const valid = form.customerName.trim() && form.address.trim();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New Delivery Order</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Customer Name *</Label><Input value={form.customerName} onChange={set('customerName')} placeholder="Ramesh Kumar" /></div>
            <div className="space-y-1"><Label>Phone</Label><Input value={form.customerPhone} onChange={set('customerPhone')} placeholder="9876543210" /></div>
          </div>
          <div className="space-y-1"><Label>Delivery Address *</Label><Textarea value={form.address} onChange={set('address')} placeholder="Door no, street, area, city, PIN" rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Bill No. (optional)</Label><Input value={form.billNumber} onChange={set('billNumber')} placeholder="INV00042" /></div>
            <div className="space-y-1"><Label>Assigned To</Label><Input value={form.assignedTo} onChange={set('assignedTo')} placeholder="Delivery boy" /></div>
          </div>
          <div className="space-y-1"><Label>Notes</Label><Input value={form.notes} onChange={set('notes')} placeholder="Landmark, timing, etc." /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DeliveryOrdersPage() {
  const qc = useQueryClient();
  const can = useCan();
  const { data = [], isLoading } = useQuery({ queryKey: ['delivery-orders'], queryFn: fetchOrders });
  const [createOpen, setCreateOpen] = useState(false);

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: DeliveryOrder['status'] }) => {
      const r = await apiFetch(`/api/delivery-orders/${id}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const j = await r.json() as { success: boolean; message?: string };
      if (!r.ok || !j.success) throw new Error(j.message ?? 'Failed');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['delivery-orders'] }); toast.success('Status updated'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const counts = {
    pending: data.filter((d) => d.status === 'pending').length,
    out: data.filter((d) => d.status === 'out_for_delivery').length,
    delivered: data.filter((d) => d.status === 'delivered').length,
  };

  const columns: ColumnDef<DeliveryOrder>[] = [
    { accessorKey: 'orderNumber', header: ({ column }) => <SortableHeader column={column}>Order #</SortableHeader>, cell: ({ row }) => <span className="font-mono text-xs font-semibold">{row.original.orderNumber}</span> },
    { accessorKey: 'customerName', header: 'Customer', cell: ({ row }) => <div><p className="font-medium text-sm">{row.original.customerName}</p><p className="text-xs text-muted-foreground">{row.original.customerPhone || '—'}</p></div> },
    { accessorKey: 'address', header: 'Address', cell: ({ row }) => <div className="flex items-start gap-1 max-w-[240px]"><MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" /><span className="text-xs text-muted-foreground line-clamp-2">{row.original.address}</span></div> },
    { accessorKey: 'billNumber', header: 'Bill', cell: ({ row }) => <span className="text-xs">{row.original.billNumber || '—'}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => { const m = STATUS_META[row.original.status]; return <Badge variant={m.variant}>{m.label}</Badge>; } },
    { id: 'actions', header: '', cell: ({ row }) => {
      const o = row.original;
      if (o.status === 'delivered' || o.status === 'cancelled') return <span className="text-xs text-muted-foreground">{o.deliveredAt ? new Date(o.deliveredAt).toLocaleDateString() : ''}</span>;
      if (!can('billing:edit')) return <span className="text-xs text-muted-foreground">—</span>;
      return (
        <div className="flex gap-1.5 justify-end">
          {o.status === 'pending' && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => statusMutation.mutate({ id: o.id, status: 'out_for_delivery' })}><Truck className="h-3.5 w-3.5" /> Dispatch</Button>}
          {o.status === 'out_for_delivery' && <Button size="sm" className="h-7 text-xs" onClick={() => statusMutation.mutate({ id: o.id, status: 'delivered' })}><Check className="h-3.5 w-3.5" /> Delivered</Button>}
          <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => statusMutation.mutate({ id: o.id, status: 'cancelled' })}><X className="h-3.5 w-3.5" /></Button>
        </div>
      );
    } },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Delivery Orders</h1>
          <p className="text-sm text-muted-foreground">Track home deliveries from dispatch to doorstep</p>
        </div>
        {can('billing:create') && <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New Delivery</Button>}
      </div>
      <div className="grid grid-cols-3 gap-3 max-w-xl">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary"><Truck className="h-5 w-5 text-muted-foreground" /></div><div><p className="text-xl font-bold">{counts.pending}</p><p className="text-xs text-muted-foreground">Pending</p></div></div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><Truck className="h-5 w-5 text-primary" /></div><div><p className="text-xl font-bold">{counts.out}</p><p className="text-xs text-muted-foreground">Out for Delivery</p></div></div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10"><Check className="h-5 w-5 text-success-700" /></div><div><p className="text-xl font-bold">{counts.delivered}</p><p className="text-xs text-muted-foreground">Delivered</p></div></div>
      </div>
      <DataTable columns={columns} data={data} loading={isLoading} globalSearch searchPlaceholder="Search by order, customer, address…"
        emptyMessage="No delivery orders yet" emptyDescription="Create a delivery order to start tracking home deliveries." />
      <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

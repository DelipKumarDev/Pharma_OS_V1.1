'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { ArrowLeftRight, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { InventoryItem } from '@pharmaos/types';
import { formatDate } from '@pharmaos/utils';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api';

interface StockTransfer {
  id: string;
  transferNumber: string;
  medicineName: string;
  batchNumber: string;
  quantity: number;
  fromLocation?: string | null;
  toLocation: string;
  status: string;
  notes?: string | null;
  createdAt: string;
}

type InvRow = InventoryItem & { medicineName?: string };

async function fetchTransfers(): Promise<StockTransfer[]> {
  const r = await apiFetch('/api/transfers');
  const j = await r.json() as { data: { data: StockTransfer[] } };
  return j.data?.data ?? [];
}

async function fetchBatches(): Promise<InvRow[]> {
  const r = await apiFetch('/api/inventory?limit=1000');
  const j = await r.json() as { data: { data: InvRow[] } };
  return (j.data?.data ?? []).filter((b) => (b.availableQuantity ?? 0) > 0);
}

function CreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: batches = [] } = useQuery({ queryKey: ['inventory', 'transfer-picker'], queryFn: fetchBatches, enabled: open });
  const [inventoryItemId, setInventoryItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [notes, setNotes] = useState('');
  const selected = batches.find((b) => b.id === inventoryItemId);

  const reset = () => { setInventoryItemId(''); setQuantity(''); setToLocation(''); setNotes(''); };
  const mutation = useMutation({
    mutationFn: async () => {
      const r = await apiFetch('/api/transfers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventoryItemId, quantity: Number(quantity), toLocation, notes }),
      });
      const j = await r.json() as { success: boolean; message?: string };
      if (!r.ok || !j.success) throw new Error(j.message ?? 'Failed to transfer');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfers'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Stock transferred');
      reset(); onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const max = selected?.availableQuantity ?? 0;
  const qtyNum = Number(quantity);
  const valid = inventoryItemId && toLocation.trim() && qtyNum > 0 && qtyNum <= max;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Transfer Stock</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Batch *</Label>
            <Select value={inventoryItemId} onValueChange={(v) => { setInventoryItemId(v); setQuantity(''); }}>
              <SelectTrigger><SelectValue placeholder="Select medicine batch…" /></SelectTrigger>
              <SelectContent>
                {batches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.medicineName ?? 'Unknown'} · {b.batchNumber} · {b.availableQuantity} left{b.rackLocation ? ` · ${b.rackLocation}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selected && (
            <div className="rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground">
              Current location: <span className="font-medium text-foreground">{selected.rackLocation || 'Unassigned'}</span> · Available: <span className="font-medium text-foreground">{selected.availableQuantity}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Quantity *</Label><Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" max={max} /></div>
            <div className="space-y-1"><Label>To Location *</Label><Input value={toLocation} onChange={(e) => setToLocation(e.target.value)} placeholder="Rack B-12 / Counter" /></div>
          </div>
          {qtyNum > max && max > 0 && <p className="text-xs text-destructive">Max transferable is {max}.</p>}
          <div className="space-y-1"><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for transfer" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TransfersPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ['transfers'], queryFn: fetchTransfers });
  const [createOpen, setCreateOpen] = useState(false);

  const columns: ColumnDef<StockTransfer>[] = [
    { accessorKey: 'transferNumber', header: ({ column }) => <SortableHeader column={column}>Transfer #</SortableHeader>, cell: ({ row }) => <span className="font-mono text-xs font-semibold">{row.original.transferNumber}</span> },
    { accessorKey: 'medicineName', header: 'Medicine', cell: ({ row }) => <div><p className="font-medium text-sm">{row.original.medicineName}</p><p className="text-xs text-muted-foreground font-mono">{row.original.batchNumber}</p></div> },
    { accessorKey: 'quantity', header: ({ column }) => <SortableHeader column={column}>Qty</SortableHeader>, cell: ({ row }) => <span className="font-semibold tabular-nums">{row.original.quantity}</span> },
    { id: 'route', header: 'From → To', cell: ({ row }) => <span className="text-xs"><span className="text-muted-foreground">{row.original.fromLocation || 'Unassigned'}</span> → <span className="font-medium">{row.original.toLocation}</span></span> },
    { accessorKey: 'createdAt', header: 'Date', cell: ({ row }) => <span className="text-sm">{formatDate(row.original.createdAt)}</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10"><ArrowLeftRight className="h-4 w-4 text-primary" /></div>
          <div><h1 className="text-2xl font-bold tracking-tight">Stock Transfers</h1><p className="text-sm text-muted-foreground">Move batches between racks, counters, or storage locations</p></div>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New Transfer</Button>
      </div>
      <DataTable columns={columns} data={data} loading={isLoading} globalSearch searchPlaceholder="Search by transfer, medicine, location…"
        emptyMessage="No transfers yet" emptyDescription="Record a stock transfer to relocate a batch." />
      <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

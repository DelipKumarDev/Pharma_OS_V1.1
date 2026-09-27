'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Download, Pill, AlertCircle, CheckCircle, XCircle, MoreHorizontal, Edit, Eye, Trash2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import type { Medicine } from '@pharmaos/types';
import { formatCurrency } from '@pharmaos/utils';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AddMedicineDialog } from '@/components/medicines/add-medicine-dialog';
import { apiFetch } from '@/lib/api';
import { useDropdown } from '@/lib/dropdowns';
import { cn } from '@/lib/utils';

async function fetchMedicines(search: string, category: string): Promise<Medicine[]> {
  const params = new URLSearchParams({ limit: '1000' });
  if (search) params.set('search', search);
  if (category && category !== 'all') params.set('category', category);
  const res = await apiFetch(`/api/medicines?${params}`);
  const json = await res.json() as { success: boolean; data: { data: Medicine[] } };
  return json.data.data;
}

// Export as an Excel-openable .xls (HTML table) so headers can be BOLD + CAPS,
// matching the on-screen table. Columns mirror the UI 1:1.
function exportExcel(data: Medicine[], rxOf: (m: Medicine) => boolean) {
  const headers = ['NAME', 'GENERIC NAME', 'BRAND', 'MANUFACTURER', 'CATEGORY', 'FORM', 'STRENGTH', 'MRP', 'SELLING PRICE', 'GST%', 'RX', 'STATUS'];
  const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const thead = `<tr>${headers.map((h) => `<th style="font-weight:bold;text-transform:uppercase;background:#f1f5f9;border:1px solid #cbd5e1;padding:4px 8px;text-align:left">${h}</th>`).join('')}</tr>`;
  const tbody = data.map((m) => {
    const cells = [m.name, m.genericName, m.brandName ?? '', m.manufacturer, m.category, m.form, m.strength, m.mrp, m.sellingPrice, m.gstRate, rxOf(m) ? 'Rx' : 'OTC', m.status];
    return `<tr>${cells.map((c) => `<td style="border:1px solid #e2e8f0;padding:4px 8px">${esc(c)}</td>`).join('')}</tr>`;
  }).join('');
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table>${thead}${tbody}</table></body></html>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `medicines-${new Date().toISOString().split('T')[0]}.xls`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${data.length} medicines`);
}

export function MedicinesView() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [form, setForm] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [editMedicine, setEditMedicine] = useState<Medicine | null>(null);
  const [viewMedicine, setViewMedicine] = useState<Medicine | null>(null);
  const [discontinueTarget, setDiscontinueTarget] = useState<Medicine | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Medicine | null>(null);
  // Status quick-filter driven by the stat cards (all | active | discontinued | rx).
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'discontinued' | 'rx'>('all');
  const qc = useQueryClient();

  // TC_028: filter option lists come from tenant config (Settings → Dropdown Options).
  const CATEGORY_OPTIONS = ['all', ...useDropdown('medicineCategory')];
  const FORM_OPTIONS = ['all', ...useDropdown('medicineForm')];

  // Universal search deep-link (/medicines?q=…) pre-filters to the picked item.
  React.useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setSearch(q);
  }, []);

  // A medicine is prescription-only if flagged OR under a prescription schedule.
  const isRx = (m: Medicine) => m.requiresPrescription || ['H', 'H1', 'X'].includes((m.schedule as string) ?? '');

  const { data = [], isLoading } = useQuery({
    queryKey: ['medicines', search, category],
    queryFn: () => fetchMedicines(search, category),
  });

  const filtered = data.filter((m) => {
    if (form !== 'all' && m.form !== form) return false;
    if (statusFilter === 'active') return m.status === 'active';
    if (statusFilter === 'discontinued') return m.status === 'discontinued';
    if (statusFilter === 'rx') return isRx(m);
    return true;
  });

  const stats = {
    total: data.length,
    prescription: data.filter((m) => isRx(m)).length,
    active: data.filter((m) => m.status === 'active').length,
    discontinued: data.filter((m) => m.status === 'discontinued').length,
  };

  // Discontinuing only changes STATUS — the record stays visible under the
  // Discontinued count and is not removed until explicitly deleted.
  const discontinueMutation = useMutation({
    mutationFn: async (m: Medicine) => {
      await apiFetch(`/api/medicines/${m.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'discontinued' }) });
      return m;
    },
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ['medicines'] });
      toast.success(`${m.name} marked as discontinued`);
      setDiscontinueTarget(null);
    },
  });

  // Reactivate a discontinued medicine
  const reactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/api/medicines/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'active' }) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['medicines'] }); toast.success('Medicine reactivated'); },
  });

  // Permanent delete (manual, explicit) — actually removes the record
  const deleteMutation = useMutation({
    mutationFn: async (m: Medicine) => {
      await apiFetch(`/api/medicines/${m.id}`, { method: 'DELETE' });
      return m;
    },
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ['medicines'] });
      toast.success(`${m.name} deleted`);
      setDeleteTarget(null);
    },
  });

  const columns: ColumnDef<Medicine>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => <SortableHeader column={column}>MEDICINE</SortableHeader>,
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-foreground">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.genericName}</p>
        </div>
      ),
    },
    {
      accessorKey: 'brandName',
      header: 'BRAND',
      cell: ({ row }) => <span className="text-sm">{row.original.brandName || '—'}</span>,
    },
    {
      accessorKey: 'manufacturer',
      header: 'MANUFACTURER',
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.manufacturer}</span>,
    },
    {
      accessorKey: 'category',
      header: 'CATEGORY',
      cell: ({ row }) => (
        <Badge variant="secondary" className="capitalize text-xs">{row.original.category}</Badge>
      ),
    },
    {
      accessorKey: 'form',
      header: 'FORM',
      cell: ({ row }) => <span className="capitalize text-sm">{row.original.form}</span>,
    },
    {
      accessorKey: 'strength',
      header: 'STRENGTH',
      cell: ({ row }) => <span className="text-sm">{row.original.strength || '—'}</span>,
    },
    {
      accessorKey: 'mrp',
      header: ({ column }) => <SortableHeader column={column}>MRP</SortableHeader>,
      cell: ({ row }) => <span className="font-medium tabular-nums">{formatCurrency(row.original.mrp)}</span>,
    },
    {
      accessorKey: 'sellingPrice',
      header: ({ column }) => <SortableHeader column={column}>SELLING PRICE</SortableHeader>,
      cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.sellingPrice)}</span>,
    },
    {
      accessorKey: 'gstRate',
      header: 'GST%',
      cell: ({ row }) => <span className="tabular-nums text-sm">{row.original.gstRate}%</span>,
    },
    {
      accessorKey: 'schedule',
      header: 'SCHEDULE',
      cell: ({ row }) => {
        const s = (row.original.schedule as string) ?? '';
        if (!s || s === 'none') return <Badge variant="muted" className="text-xs">OTC</Badge>;
        const rx = ['H', 'H1', 'X'].includes(s);
        return <Badge variant={rx ? 'warning' : 'secondary'} className="text-xs">Schedule {s}</Badge>;
      },
    },
    {
      accessorKey: 'status',
      header: 'STATUS',
      cell: ({ row }) => {
        const s = row.original.status;
        return (
          <Badge variant={s === 'active' ? 'success' : s === 'discontinued' ? 'muted' : 'error'} dot className="capitalize text-xs">
            {s}
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setViewMedicine(row.original)}>
              <Eye className="h-4 w-4" /> View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setEditMedicine(row.original)}>
              <Edit className="h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {row.original.status === 'discontinued' ? (
              <DropdownMenuItem onClick={() => reactivateMutation.mutate(row.original.id)}>
                <RotateCcw className="h-4 w-4" /> Reactivate
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => setDiscontinueTarget(row.original)}>
                <XCircle className="h-4 w-4" /> Discontinue
              </DropdownMenuItem>
            )}
            <DropdownMenuItem destructive onClick={() => setDeleteTarget(row.original)}>
              <Trash2 className="h-4 w-4" /> Delete permanently
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Medicine Catalog</h1>
          <p className="text-sm text-muted-foreground">Manage all medicines, generics, and formulations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportExcel(filtered, isRx)}>
            <Download className="h-4 w-4" /> Export Excel
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Medicine
          </Button>
        </div>
      </div>

      {/* Stat cards double as quick filters (click to filter the list). */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { key: 'all' as const, label: 'Total Medicines', value: stats.total, icon: Pill, color: 'text-primary', bg: 'bg-primary/10' },
          { key: 'active' as const, label: 'Active', value: stats.active, icon: CheckCircle, color: 'text-success', bg: 'bg-success/10' },
          { key: 'rx' as const, label: 'Prescription (Rx)', value: stats.prescription, icon: AlertCircle, color: 'text-warning-600', bg: 'bg-warning/10' },
          { key: 'discontinued' as const, label: 'Discontinued', value: stats.discontinued, icon: XCircle, color: 'text-muted-foreground', bg: 'bg-muted' },
        ].map(({ key, label, value, icon: Icon, color, bg }) => (
          <button
            key={label}
            type="button"
            onClick={() => setStatusFilter((cur) => (cur === key ? 'all' : key))}
            aria-pressed={statusFilter === key}
            className={cn(
              'flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition-all hover:border-primary/50',
              statusFilter === key ? 'border-primary ring-1 ring-primary/40' : 'border-border',
            )}
          >
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', bg)}>
              <Icon className={cn('h-4 w-4', color)} />
            </div>
            <div>
              <p className="text-xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </button>
        ))}
      </div>

      {statusFilter !== 'all' && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Filtered by <strong className="capitalize text-foreground">{statusFilter === 'rx' ? 'Prescription (Rx)' : statusFilter}</strong></span>
          <button onClick={() => setStatusFilter('all')} className="text-primary hover:underline">Clear filter</button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={filtered}
        loading={isLoading}
        globalSearch
        searchPlaceholder="Search any column…"
        emptyMessage="No medicines found"
        emptyDescription="Add your first medicine or adjust the search."
        toolbar={
          <>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c} className="capitalize text-xs">{c === 'all' ? 'All Categories' : c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={form} onValueChange={setForm}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Form" /></SelectTrigger>
              <SelectContent>
                {FORM_OPTIONS.map((f) => (
                  <SelectItem key={f} value={f} className="capitalize text-xs">{f === 'all' ? 'All Forms' : f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      <AddMedicineDialog open={addOpen || !!editMedicine} onOpenChange={(o) => { if (!o) { setAddOpen(false); setEditMedicine(null); } }} medicine={editMedicine ?? undefined} />

      {/* Read-only details (View Details) — distinct from Edit (M3/3rd scenario). */}
      <Dialog open={!!viewMedicine} onOpenChange={(o) => !o && setViewMedicine(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewMedicine?.name}</DialogTitle>
            <DialogDescription>{viewMedicine?.genericName}{viewMedicine?.brandName ? ` · ${viewMedicine.brandName}` : ''}</DialogDescription>
          </DialogHeader>
          {viewMedicine && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {[
                ['Manufacturer', viewMedicine.manufacturer],
                ['Category', viewMedicine.category],
                ['Form', viewMedicine.form],
                ['Strength', viewMedicine.strength],
                ['Unit', (viewMedicine as { unit?: string }).unit],
                ['Drug Schedule', viewMedicine.schedule ? `Schedule ${viewMedicine.schedule}` : 'OTC (none)'],
                ['Requires Prescription', isRx(viewMedicine) ? 'Yes (Rx)' : 'No (OTC)'],
                ['HSN Code', (viewMedicine as { hsn?: string }).hsn],
                ['GST Rate', `${viewMedicine.gstRate}%`],
                ['MRP', formatCurrency(viewMedicine.mrp)],
                ['Selling Price', formatCurrency(viewMedicine.sellingPrice)],
                ['Purchase Price', viewMedicine.purchasePrice != null ? formatCurrency(viewMedicine.purchasePrice) : '—'],
                ['Reorder Level', String((viewMedicine as { reorderLevel?: number }).reorderLevel ?? '—')],
                ['Status', viewMedicine.status],
              ].map(([label, val]) => (
                <div key={label as string}>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-medium capitalize">{val || '—'}</p>
                </div>
              ))}
              {(viewMedicine as { composition?: string }).composition && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Composition</p>
                  <p className="font-medium">{(viewMedicine as { composition?: string }).composition}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { const m = viewMedicine; setViewMedicine(null); setEditMedicine(m); }}>
              <Edit className="h-4 w-4" /> Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!discontinueTarget} onOpenChange={(o) => !o && setDiscontinueTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discontinue Medicine?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{discontinueTarget?.name}</strong> will be marked as <strong>Discontinued</strong> — the record is <strong>not deleted</strong>. It stays visible (and can be reactivated) until you choose to delete it permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => discontinueTarget && discontinueMutation.mutate(discontinueTarget)}>
              Discontinue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Medicine Permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> will be permanently removed. This cannot be undone. If you only want to stop selling it, use <strong>Discontinue</strong> instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}>
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

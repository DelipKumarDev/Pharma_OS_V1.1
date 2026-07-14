'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { Plus, Download, Pill, AlertCircle, CheckCircle, XCircle, MoreHorizontal, Edit, Eye } from 'lucide-react';
import { toast } from 'sonner';
import type { Medicine } from '@pharmaos/types';
import { formatCurrency } from '@pharmaos/utils';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AddMedicineDialog } from '@/components/medicines/add-medicine-dialog';
import { cn } from '@/lib/utils';

const CATEGORY_OPTIONS = ['all', 'antibiotic', 'analgesic', 'antacid', 'antihistamine', 'antifungal', 'antiviral', 'cardiovascular', 'diabetes', 'dermatology', 'gastroenterology', 'vitamins', 'respiratory', 'psychiatry', 'other'];
const FORM_OPTIONS = ['all', 'tablet', 'capsule', 'syrup', 'injection', 'cream', 'ointment', 'drops', 'inhaler', 'powder', 'gel', 'lotion'];

async function fetchMedicines(search: string, category: string): Promise<Medicine[]> {
  const params = new URLSearchParams({ limit: '100' });
  if (search) params.set('search', search);
  if (category && category !== 'all') params.set('category', category);
  const res = await fetch(`/api/medicines?${params}`);
  const json = await res.json() as { success: boolean; data: { data: Medicine[] } };
  return json.data.data;
}

function exportCSV(data: Medicine[]) {
  const headers = ['Name', 'Generic Name', 'Brand', 'Manufacturer', 'Category', 'Form', 'Strength', 'MRP', 'Selling Price', 'GST%', 'Rx', 'Status'];
  const rows = data.map((m) => [m.name, m.genericName, m.brandName ?? '', m.manufacturer, m.category, m.form, m.strength, m.mrp, m.sellingPrice, m.gstRate, m.requiresPrescription ? 'Yes' : 'No', m.status].join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `medicines-${new Date().toISOString().split('T')[0]}.csv`;
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
  const [discontinueTarget, setDiscontinueTarget] = useState<Medicine | null>(null);
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ['medicines', search, category],
    queryFn: () => fetchMedicines(search, category),
  });

  const filtered = form === 'all' ? data : data.filter((m) => m.form === form);

  const stats = {
    total: data.length,
    prescription: data.filter((m) => m.requiresPrescription).length,
    active: data.filter((m) => m.status === 'active').length,
    discontinued: data.filter((m) => m.status === 'discontinued').length,
  };

  const discontinueMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/medicines/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medicines'] });
      toast.success(`${discontinueTarget?.name} discontinued`);
      setDiscontinueTarget(null);
    },
  });

  const columns: ColumnDef<Medicine>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => <SortableHeader column={column}>Medicine</SortableHeader>,
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-foreground">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.genericName}</p>
        </div>
      ),
    },
    {
      accessorKey: 'manufacturer',
      header: 'Manufacturer',
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.manufacturer}</span>,
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => (
        <Badge variant="secondary" className="capitalize text-xs">{row.original.category}</Badge>
      ),
    },
    {
      accessorKey: 'form',
      header: 'Form',
      cell: ({ row }) => <span className="capitalize text-sm">{row.original.form}</span>,
    },
    {
      accessorKey: 'mrp',
      header: ({ column }) => <SortableHeader column={column}>MRP</SortableHeader>,
      cell: ({ row }) => <span className="font-medium tabular-nums">{formatCurrency(row.original.mrp)}</span>,
    },
    {
      accessorKey: 'requiresPrescription',
      header: 'Rx',
      cell: ({ row }) => row.original.requiresPrescription
        ? <Badge variant="warning" className="text-xs">Rx</Badge>
        : <Badge variant="muted" className="text-xs">OTC</Badge>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
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
            <DropdownMenuItem onClick={() => setEditMedicine(row.original)}>
              <Eye className="h-4 w-4" /> View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setEditMedicine(row.original)}>
              <Edit className="h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive disabled={row.original.status === 'discontinued'} onClick={() => setDiscontinueTarget(row.original)}>
              <XCircle className="h-4 w-4" /> Discontinue
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
          <h1 className="text-2xl font-bold tracking-tight">Medicine Master</h1>
          <p className="text-sm text-muted-foreground">Manage all medicines, generics, and formulations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCSV(filtered)}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Medicine
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Medicines', value: stats.total, icon: Pill, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Active', value: stats.active, icon: CheckCircle, color: 'text-success', bg: 'bg-success/10' },
          { label: 'Prescription (Rx)', value: stats.prescription, icon: AlertCircle, color: 'text-warning-600', bg: 'bg-warning/10' },
          { label: 'Discontinued', value: stats.discontinued, icon: XCircle, color: 'text-muted-foreground', bg: 'bg-muted' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', bg)}>
              <Icon className={cn('h-4 w-4', color)} />
            </div>
            <div>
              <p className="text-xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={isLoading}
        searchColumn="name"
        searchPlaceholder="Search by name, generic, manufacturer…"
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

      <AlertDialog open={!!discontinueTarget} onOpenChange={(o) => !o && setDiscontinueTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discontinue Medicine?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{discontinueTarget?.name}</strong> will be marked as discontinued. Existing stock will still show in inventory but the medicine cannot be added to new bills.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => discontinueTarget && discontinueMutation.mutate(discontinueTarget.id)}>
              Discontinue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

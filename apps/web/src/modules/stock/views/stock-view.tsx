'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Package, AlertTriangle, CalendarX2, RotateCcw, Plus, Upload, Download,
  MoreHorizontal, Eye, Edit2, Trash2, TrendingDown, CheckCircle,
  Loader2, FileSpreadsheet, Archive, X, Pill, ShieldCheck,
  ArrowUpDown, RefreshCw, Zap, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import type { InventoryItem, InventoryStats } from '@pharmaos/types';
import { formatCurrency, formatDate, daysUntilExpiry } from '@pharmaos/utils';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AddStockSheet } from '@/components/inventory/add-stock-sheet';
import { AdjustStockDialog } from '@/components/inventory/adjust-stock-dialog';
import { EditStockDialog } from '@/components/inventory/edit-stock-dialog';
import { exportToExcel } from '@/lib/export';
import { BatchDetailSheet } from '@/components/inventory/batch-detail-sheet';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { useDropdown } from '@/lib/dropdowns';

// ─── API ─────────────────────────────────────────────────────────────────────

async function fetchStats(): Promise<InventoryStats> {
  const r = await apiFetch('/api/inventory/stats');
  const j = await r.json() as { success: boolean; data: InventoryStats };
  if (!j.success || !j.data) throw new Error('Failed to load inventory stats');
  return j.data;
}

async function fetchInventory(search = '', status = 'all', form = 'all'): Promise<InventoryItem[]> {
  const p = new URLSearchParams({ limit: '1000' });
  if (search) p.set('search', search);
  if (status !== 'all') p.set('status', status);
  if (form !== 'all') p.set('dosageForm', form);
  const r = await apiFetch(`/api/inventory?${p}`);
  const json = await r.json() as { success: boolean; data: { data: InventoryItem[] } };
  if (!r.ok) throw new Error('Request failed');
  return json.data?.data ?? ([] as InventoryItem[]);
}

async function fetchMedicines(search = '', category = 'all'): Promise<Record<string, unknown>[]> {
  const p = new URLSearchParams({ limit: '200' });
  if (search) p.set('search', search);
  if (category !== 'all') p.set('category', category);
  const r = await apiFetch(`/api/medicines?${p}`);
  const json = await r.json() as { success: boolean; data: { data: Record<string, unknown>[] } };
  if (!r.ok) throw new Error('Request failed');
  return json.data?.data ?? ([] as Record<string, unknown>[]);
}

async function fetchReorder(): Promise<Record<string, unknown>[]> {
  const r = await apiFetch('/api/reorder?limit=100');
  const json = await r.json() as { success: boolean; data: { data: Record<string, unknown>[] } };
  if (!r.ok) throw new Error('Request failed');
  return json.data?.data ?? ([] as Record<string, unknown>[]);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function expiryBadge(dateStr: string | undefined) {
  if (!dateStr) return null;
  const days = daysUntilExpiry(dateStr);
  if (days <= 0) return <Badge variant="destructive" dot className="text-xs">Expired</Badge>;
  if (days <= 30) return <Badge variant="destructive" dot className="text-xs">{days}d left</Badge>;
  if (days <= 90) return <Badge variant="warning" dot className="text-xs">{days}d left</Badge>;
  return <span className="text-xs text-muted-foreground">{formatDate(dateStr)}</span>;
}

function StockBar({ current, max }: { current: number; max: number }) {
  const pct = Math.min(100, Math.round((current / Math.max(max, 1)) * 100));
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', pct > 50 ? 'bg-success' : pct > 20 ? 'bg-warning' : 'bg-destructive')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums font-medium w-8 text-right">{current}</span>
    </div>
  );
}

// ─── Import sheet ─────────────────────────────────────────────────────────────

function ImportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [type, setType] = useState('medicines');
  const [phase, setPhase] = useState<'upload' | 'importing' | 'done'>('upload');
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: number; errorDetails?: Array<{ row: number; message: string }> } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFile(f: File) {
    setFile(f);
    setPhase('upload');
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  // Minimal RFC-4180 CSV parser — handles quoted fields, escaped quotes, CRLF.
  function parseCsv(text: string): Array<Record<string, string>> {
    const rows: string[][] = [];
    let cell = '', row: string[] = [], inQuotes = false;
    const src = text.replace(/^﻿/, '');
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (inQuotes) {
        if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false; }
        else cell += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && src[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.some((c) => c.trim() !== '')) rows.push(row);
        row = [];
      } else cell += ch;
    }
    row.push(cell);
    if (row.some((c) => c.trim() !== '')) rows.push(row);
    if (rows.length < 2) return [];
    const headers = rows[0]!.map((h) => h.trim());
    return rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()])));
  }

  async function startImport() {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      toast.error('Please upload a .csv file', { description: 'Open your Excel file and use "Save As → CSV" first.' });
      return;
    }
    if (type === 'backup') { toast.error('Restore from backup is done via Settings → Backup & Restore'); return; }
    setPhase('importing');
    setProgress(0);
    const interval = setInterval(() => setProgress((p) => Math.min(p + 4 + Math.random() * 6, 90)), 150);
    try {
      const rows = parseCsv(await file.text());
      if (rows.length === 0) throw new Error('File has no data rows (header + at least one row required)');
      const res = await apiFetch(`/api/settings/import/${type}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }),
      });
      const data = await res.json() as { success: boolean; message?: string; data: { imported: number; skipped: number; errors: number; errorDetails?: Array<{ row: number; message: string }> } };
      clearInterval(interval);
      if (!res.ok || !data.success) throw new Error(data.message ?? 'Import failed');
      setProgress(100);
      setResult(data.data);
      setPhase('done');
    } catch (err) {
      clearInterval(interval);
      setPhase('upload');
      toast.error('Import failed', { description: (err as Error).message });
    }
  }

  function reset() { setFile(null); setPhase('upload'); setProgress(0); setResult(null); }

  const TYPES = [
    { value: 'medicines', label: 'Medicine Catalog', icon: Pill, ext: '.xlsx, .csv', desc: 'Import drug master list' },
    { value: 'inventory', label: 'Stock / Inventory', icon: Package, ext: '.xlsx, .csv', desc: 'Import current stock levels with batches' },
    { value: 'customers', label: 'Customer List', icon: CheckCircle, ext: '.xlsx, .csv', desc: 'Import existing customer database' },
    { value: 'backup', label: 'Full Backup', icon: Archive, ext: '.zip', desc: 'Restore from a Pharma Ist backup file' },
  ];

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="flex flex-col w-full sm:max-w-lg" side="right">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" /> Bulk Import / Migration
          </SheetTitle>
          <SheetDescription>Import your existing data to get started quickly</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-2">
          {/* Type selector */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">What are you importing?</p>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => { setType(t.value); reset(); }}
                  className={cn(
                    'rounded-xl border p-3 text-left transition-all',
                    type === t.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-muted-foreground/40'
                  )}
                >
                  <t.icon className={cn('h-5 w-5 mb-1.5', type === t.value ? 'text-primary' : 'text-muted-foreground')} />
                  <p className="text-xs font-semibold leading-tight">{t.label}</p>
                  <p className="text-2xs text-muted-foreground mt-0.5">{t.ext}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Download template */}
          <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-success" />
              <div>
                <p className="text-xs font-semibold">Download Excel Template</p>
                <p className="text-2xs text-muted-foreground">Use our template for the correct format</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-xs"
              onClick={() => {
                const cols: Record<string, string> = {
                  medicines: 'Medicine Name,Generic Name,Manufacturer,Category,Dosage Form,Strength,Schedule,MRP,Selling Price,HSN Code,GST %',
                  inventory: 'Medicine Name,Batch Number,Qty,Purchase Price,MRP,Expiry Date (MM/YYYY),Rack Location',
                  customers: 'Name,Phone,Email,Address,City,Date of Birth,Notes',
                };
                const header = cols[type];
                if (!header) { toast.error('No template for this type'); return; }
                const a = Object.assign(document.createElement('a'), {
                  href: URL.createObjectURL(new Blob([header], { type: 'text/csv' })),
                  download: `pharmaos-${type}-template.csv`,
                });
                a.click();
                toast.success('Template downloaded — fill it in Excel, Save As CSV, then upload');
              }}>
              <Download className="h-3 w-3" /> Template
            </Button>
          </div>

          {/* Supported formats guidance */}
          <p className="text-2xs text-muted-foreground">
            Supported format: <strong>.csv</strong> only. Export your Excel sheet as CSV (File → Save As → CSV) before uploading.
          </p>

          {/* Upload zone */}
          {phase === 'upload' && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Upload File</p>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-all',
                  dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50 hover:bg-muted/30',
                  file && 'border-success bg-success/5'
                )}
              >
                {file ? (
                  <>
                    <CheckCircle className="h-8 w-8 text-success" />
                    <div>
                      <p className="text-sm font-semibold text-success">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB — ready to import</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); reset(); }} className="text-xs text-muted-foreground hover:text-foreground">
                      Remove file
                    </button>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground/50" />
                    <div>
                      <p className="text-sm font-medium">Drop your file here</p>
                      <p className="text-xs text-muted-foreground">or click to browse (.csv only)</p>
                    </div>
                  </>
                )}
                <input ref={inputRef} type="file" className="hidden" accept=".csv"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </div>
            </div>
          )}

          {/* Progress */}
          {phase === 'importing' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <p className="text-sm font-medium">Importing {TYPES.find((t) => t.value === type)?.label}…</p>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${Math.min(progress, 100)}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{Math.round(Math.min(progress, 100))}% — Validating rows and checking duplicates…</p>
            </div>
          )}

          {/* Done */}
          {phase === 'done' && result && (
            <div className="rounded-xl border border-success/30 bg-success/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle className="h-5 w-5" />
                <p className="font-semibold">Import Complete</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-background p-2">
                  <p className="text-lg font-bold text-success">{result.imported.toLocaleString()}</p>
                  <p className="text-2xs text-muted-foreground">Imported</p>
                </div>
                <div className="rounded-lg bg-background p-2">
                  <p className="text-lg font-bold text-warning-600">{result.skipped}</p>
                  <p className="text-2xs text-muted-foreground">Skipped</p>
                </div>
                <div className="rounded-lg bg-background p-2">
                  <p className="text-lg font-bold text-destructive">{result.errors}</p>
                  <p className="text-2xs text-muted-foreground">Errors</p>
                </div>
              </div>
              {result.skipped > 0 && (
                <p className="text-2xs text-muted-foreground">Skipped rows already exist (duplicate name/phone) and were not re-imported.</p>
              )}
              {result.errorDetails && result.errorDetails.length > 0 && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-2 max-h-32 overflow-y-auto">
                  <p className="text-2xs font-semibold text-destructive mb-1">Rows with errors:</p>
                  <ul className="space-y-0.5">
                    {result.errorDetails.slice(0, 20).map((e, i) => (
                      <li key={i} className="text-2xs text-muted-foreground">Row {e.row}: {e.message}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Button variant="outline" size="sm" className="w-full" onClick={reset}>
                Import Another File
              </Button>
            </div>
          )}
        </div>

        <SheetFooter className="px-6 pb-6 pt-2 gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {phase === 'upload' && file && (
            <Button onClick={startImport}>
              <Upload className="h-4 w-4" /> Start Import
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function StockView() {
  const router = useRouter();
  const [tab, setTab] = useState('overview');

  // Open the tab named by ?tab= and pre-apply a ?status= filter (e.g. dashboard
  // "Low Stock Items" → Stock Levels tab filtered to low_stock).
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab');
    if (t && ['overview', 'catalog', 'inventory', 'expiry', 'reorder'].includes(t)) setTab(t);
    const s = params.get('status');
    if (s && ['available', 'low_stock', 'out_of_stock'].includes(s)) { setStatusFilter(s); setTab('inventory'); }
  }, []);

  const [showImport, setShowImport] = useState(false);
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [batchItem, setBatchItem] = useState<InventoryItem | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formFilter, setFormFilter] = useState('all');
  const [medSearch, setMedSearch] = useState('');
  const qc = useQueryClient();

  // Configurable medicine forms (Settings → Dropdown Options) for the Form filter.
  const FORM_FILTER_OPTIONS = useDropdown('medicineForm');

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const r = await apiFetch(`/api/inventory/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const j = await r.json() as { success: boolean; message?: string };
      if (!r.ok || !j.success) throw new Error(j.message ?? 'Update failed');
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['inventory-stats'] });
      const label = variables.status === 'damaged' ? 'marked as disposed' : 'marked as expired';
      toast.success(`Batch ${label} successfully`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: stats } = useQuery({ queryKey: ['inventory-stats'], queryFn: fetchStats });

  const { data: inventory = [], isLoading: invLoading } = useQuery({
    queryKey: ['inventory', search, statusFilter, formFilter],
    queryFn: () => fetchInventory(search, statusFilter, formFilter),
    enabled: tab === 'inventory' || tab === 'expiry' || tab === 'overview',
  });

  const { data: medicines = [], isLoading: medLoading } = useQuery({
    queryKey: ['medicines-stock', medSearch],
    queryFn: () => fetchMedicines(medSearch),
    enabled: tab === 'catalog',
  });

  const { data: reorderItems = [], isLoading: reorderLoading } = useQuery({
    queryKey: ['reorder'],
    queryFn: fetchReorder,
    enabled: tab === 'reorder',
  });

  // Expiry-filtered from inventory
  const expiringItems = inventory.filter((item) => {
    const days = daysUntilExpiry(item.expiryDate);
    return days <= 90;
  }).sort((a, b) => daysUntilExpiry(a.expiryDate) - daysUntilExpiry(b.expiryDate));

  // Overview stock-health counts come straight from the backend stats so they
  // match the header strip and the dashboard exactly (all per-medicine, measured
  // against each medicine's reorder level). Falls back to a per-item tally only
  // if stats haven't loaded yet.
  const goodStock = stats?.goodStockCount ?? inventory.filter((i) => i.status === 'available').length;
  const lowStock = stats?.lowStockCount ?? inventory.filter((i) => i.status === 'low_stock').length;
  const criticalStock = stats?.outOfStockCount ?? inventory.filter((i) => i.status === 'out_of_stock').length;

  // ── Inventory columns ────────────────────────────────────────────────────────
  const inventoryColumns: ColumnDef<InventoryItem>[] = [
    {
      id: 'medicine',
      accessorFn: (row) => (row as { medicineName?: string }).medicineName ?? '',
      header: 'Medicine',
      cell: ({ row }) => {
        const item = row.original as InventoryItem & { medicineName?: string };
        return (
          <div>
            <p className="font-semibold text-sm">{item.medicineName ?? 'Unknown'}</p>
            <p className="text-xs text-muted-foreground font-mono">{item.batchNumber}</p>
          </div>
        );
      },
    },
    {
      id: 'form',
      accessorFn: (row) => (row as { dosageForm?: string }).dosageForm ?? '',
      header: 'Form',
      cell: ({ row }) => <span className="text-xs capitalize text-muted-foreground">{(row.original as { dosageForm?: string }).dosageForm ?? '—'}</span>,
    },
    {
      accessorKey: 'availableQuantity',
      header: ({ column }) => <SortableHeader column={column}>Stock</SortableHeader>,
      cell: ({ row }) => (
        <StockBar
          current={row.original.availableQuantity}
          max={row.original.reorderLevel ? row.original.reorderLevel * 4 : row.original.availableQuantity * 2 + 1}
        />
      ),
    },
    {
      accessorKey: 'expiryDate',
      header: ({ column }) => <SortableHeader column={column}>Expiry</SortableHeader>,
      cell: ({ row }) => expiryBadge(row.original.expiryDate),
    },
    {
      accessorKey: 'mrp',
      header: ({ column }) => <SortableHeader column={column}>MRP</SortableHeader>,
      cell: ({ row }) => <span className="text-sm tabular-nums">₹{row.original.mrp}</span>,
    },
    {
      id: 'location',
      header: 'Location',
      cell: ({ row }) => <span className="text-xs text-muted-foreground font-mono">{row.original.rackLocation ?? '—'}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const s = row.original.status;
        const map: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'muted' }> = {
          available: { label: 'In Stock', variant: 'success' },
          in_stock: { label: 'In Stock', variant: 'success' },
          low_stock: { label: 'Low', variant: 'warning' },
          out_of_stock: { label: 'Out of Stock', variant: 'destructive' },
          expired: { label: 'Expired', variant: 'muted' },
          damaged: { label: 'Disposed', variant: 'muted' },
        };
        const cfg = map[s] ?? { label: s, variant: 'muted' as const };
        return <Badge variant={cfg.variant} dot className="text-xs">{cfg.label}</Badge>;
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
            <DropdownMenuItem onClick={() => setBatchItem(row.original)}><Eye className="h-4 w-4" /> View Batch</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setEditItem(row.original)}><Edit2 className="h-4 w-4" /> Edit Details</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAdjustItem(row.original)}><TrendingDown className="h-4 w-4" /> Adjust Stock</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAddStockOpen(true)}><Plus className="h-4 w-4" /> Add Stock</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // ── Medicine catalog columns ──────────────────────────────────────────────────
  const medicineColumns: ColumnDef<Record<string, unknown>>[] = [
    {
      accessorKey: 'name',
      header: 'Medicine',
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-sm">{String(row.original.name ?? '')}</p>
          <p className="text-xs text-muted-foreground">{String(row.original.genericName ?? '')}</p>
        </div>
      ),
    },
    {
      accessorKey: 'manufacturer',
      header: 'Manufacturer',
      cell: ({ row }) => <span className="text-xs">{String(row.original.manufacturer ?? '—')}</span>,
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => <Badge variant="secondary" className="text-xs">{String(row.original.category ?? '')}</Badge>,
    },
    {
      accessorKey: 'form',
      header: 'Form',
      cell: ({ row }) => <span className="text-xs capitalize text-muted-foreground">{String(row.original.form ?? row.original.dosageForm ?? '—')}</span>,
    },
    {
      accessorKey: 'mrp',
      header: ({ column }) => <SortableHeader column={column}>MRP</SortableHeader>,
      cell: ({ row }) => <span className="text-sm tabular-nums">₹{Number(row.original.mrp ?? 0)}</span>,
    },
    {
      accessorKey: 'schedule',
      header: 'Schedule',
      cell: ({ row }) => {
        const s = String(row.original.schedule ?? '');
        return s ? <Badge variant={s.includes('H') ? 'warning' : s === 'X' ? 'destructive' : 'muted'} className="text-xs">{s}</Badge> : <span className="text-xs text-muted-foreground">OTC</span>;
      },
    },
    {
      id: 'actions',
      header: '',
      cell: () => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => router.push('/medicines')}><Eye className="h-4 w-4" /> View in Medicine Master</DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/medicines')}><Edit2 className="h-4 w-4" /> Edit in Medicine Master</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // ── Expiry columns ────────────────────────────────────────────────────────────
  const expiryColumns: ColumnDef<InventoryItem>[] = [
    {
      id: 'medicine',
      accessorFn: (row) => (row as { medicineName?: string }).medicineName ?? '',
      header: 'Medicine / Batch',
      cell: ({ row }) => {
        const item = row.original as InventoryItem & { medicineName?: string };
        return (
          <div>
            <p className="font-semibold text-sm">{item.medicineName ?? 'Unknown'}</p>
            <p className="text-xs text-muted-foreground font-mono">{item.batchNumber}</p>
          </div>
        );
      },
    },
    {
      accessorKey: 'availableQuantity',
      header: 'Qty',
      cell: ({ row }) => <span className="font-semibold text-sm">{row.original.availableQuantity}</span>,
    },
    {
      accessorKey: 'expiryDate',
      header: ({ column }) => <SortableHeader column={column}>Expires</SortableHeader>,
      cell: ({ row }) => {
        const days = daysUntilExpiry(row.original.expiryDate);
        return (
          <div>
            <div>{expiryBadge(row.original.expiryDate)}</div>
            <p className="text-2xs text-muted-foreground mt-0.5">{formatDate(row.original.expiryDate)}</p>
          </div>
        );
      },
    },
    {
      id: 'urgency',
      header: 'Action Needed',
      cell: ({ row }) => {
        const days = daysUntilExpiry(row.original.expiryDate);
        if (days <= 0) return <span className="text-xs text-destructive font-semibold">Mark Expired / Dispose</span>;
        if (days <= 30) return <span className="text-xs text-destructive font-semibold">Return to vendor or dispose</span>;
        if (days <= 60) return <span className="text-xs text-warning-600 font-semibold">Promote / discount stock</span>;
        return <span className="text-xs text-muted-foreground">Monitor closely</span>;
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
            <DropdownMenuItem onClick={() => { if (confirm(`Mark batch ${row.original.batchNumber} as disposed?`)) updateStatusMutation.mutate({ id: row.original.id, status: 'damaged' }); }}><Trash2 className="h-4 w-4" /> Mark Disposed</DropdownMenuItem>
            <DropdownMenuItem onClick={() => { if (confirm(`Mark batch ${row.original.batchNumber} as expired?`)) updateStatusMutation.mutate({ id: row.original.id, status: 'expired' }); }}><X className="h-4 w-4" /> Mark Expired</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // ── Reorder columns ───────────────────────────────────────────────────────────
  const reorderColumns: ColumnDef<Record<string, unknown>>[] = [
    {
      id: 'medicine',
      accessorFn: (row) => String(row.medicineName ?? row.name ?? ''),
      header: 'Medicine',
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-sm">{String(row.original.medicineName ?? row.original.name ?? '')}</p>
          <p className="text-xs text-muted-foreground">{String(row.original.manufacturer ?? '')}</p>
        </div>
      ),
    },
    {
      id: 'currentStock',
      header: ({ column }) => <SortableHeader column={column}>Current / Reorder</SortableHeader>,
      cell: ({ row }) => {
        const cur = Number(row.original.currentStock ?? row.original.availableQuantity ?? 0);
        const lvl = Number(row.original.reorderLevel ?? 50);
        return (
          <div>
            <span className={cn('text-sm font-bold', cur < lvl ? 'text-destructive' : 'text-muted-foreground')}>{cur}</span>
            <span className="text-xs text-muted-foreground"> / {lvl}</span>
          </div>
        );
      },
    },
    {
      id: 'suggestedQty',
      header: 'Suggested Order',
      cell: ({ row }) => {
        const qty = Number(row.original.suggestedOrderQty ?? row.original.suggestedQty ?? 100);
        return <span className="text-sm font-semibold text-primary">{qty} units</span>;
      },
    },
    {
      id: 'priority',
      header: 'Priority',
      cell: ({ row }) => {
        const p = String(row.original.priority ?? 'medium');
        const map: Record<string, { label: string; variant: 'destructive' | 'warning' | 'muted' }> = {
          critical: { label: 'Critical', variant: 'destructive' },
          high: { label: 'High', variant: 'warning' },
          medium: { label: 'Medium', variant: 'muted' },
        };
        const cfg = map[p] ?? map.medium;
        return <Badge variant={cfg!.variant} dot className="text-xs">{cfg!.label}</Badge>;
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const medicineId = String(row.original.medicineId ?? row.original.id ?? '');
        const name = String(row.original.medicineName ?? row.original.name ?? '');
        const qty = Number(row.original.suggestedOrderQty ?? row.original.suggestedQty ?? 100);
        const cost = Number(row.original.lastPurchasePrice ?? 0);
        return (
          <div className="flex gap-1.5">
            <Button size="sm" className="h-7 text-xs" onClick={() => router.push(
              `/purchase-orders?new=1&medicineId=${encodeURIComponent(medicineId)}&name=${encodeURIComponent(name)}&qty=${qty}&cost=${cost}`,
            )}>
              <Plus className="h-3 w-3" /> Create PO
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stock Management</h1>
          <p className="text-sm text-muted-foreground">Medicine catalog, stock levels, expiry tracking and reorder — all in one place</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4" /> Import
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            if (inventory.length === 0) { toast.warning('No data to export'); return; }
            const headers = ['Medicine', 'Form', 'Batch No.', 'Qty', 'Expiry', 'Status', 'MRP', 'Selling', 'Rack'];
            const rows = inventory.map((i) => {
              const r = i as InventoryItem & { medicineName?: string; dosageForm?: string };
              return [r.medicineName ?? '', r.dosageForm ?? '', i.batchNumber, i.availableQuantity, formatDate(i.expiryDate), i.status, i.mrp, i.sellingPrice, i.rackLocation ?? ''];
            });
            exportToExcel(`stock-${new Date().toISOString().split('T')[0]}`, headers, rows);
            toast.success(`Exported ${inventory.length} items`);
          }}>
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button size="sm" onClick={() => setAddStockOpen(true)}>
            <Plus className="h-4 w-4" /> Add Stock
          </Button>
        </div>
      </div>

      {/* Stats strip */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: Package, label: 'Total Items', value: stats.totalMedicines, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
            { icon: AlertTriangle, label: 'Low Stock', value: stats.lowStockCount, color: 'text-warning-600', bg: 'bg-warning/10', border: 'border-warning/30', urgent: true },
            { icon: CalendarX2, label: 'Expiring (90d)', value: stats.expiringSoonCount, color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/20', urgent: true },
            { icon: RotateCcw, label: 'Need Reorder', value: stats.outOfStockCount ?? reorderItems.length, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800' },
          ].map(({ icon: Icon, label, value, color, bg, border, urgent }) => (
            <div key={label} className={cn('flex items-center gap-3 rounded-xl border p-4', border, urgent && Number(value) > 0 && 'shadow-sm')}>
              <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', bg)}>
                <Icon className={cn('h-5 w-5', color)} />
              </div>
              <div>
                <p className="text-2xl font-bold leading-none">{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between border-b border-border">
          <TabsList className="bg-transparent p-0 h-auto rounded-none gap-0">
            {[
              { value: 'overview', label: 'Overview', icon: Zap },
              { value: 'catalog', label: 'Medicine Catalog', icon: Pill },
              { value: 'inventory', label: 'Stock Levels', icon: Package },
              { value: 'expiry', label: 'Expiry Monitor', icon: CalendarX2, badge: stats?.expiringSoonCount },
              { value: 'reorder', label: 'Reorder Queue', icon: RotateCcw, badge: stats?.lowStockCount },
            ].map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="flex items-center gap-1.5 rounded-none border-b-2 border-transparent px-3 pb-3 pt-0 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary"
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
                {t.badge !== undefined && t.badge > 0 && (
                  <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                    {t.badge}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Overview tab */}
        <TabsContent value="overview" className="pt-4 space-y-4">
          {/* Stock health — click a card to view those items in Stock Levels */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Good Stock', value: goodStock, color: 'text-success', desc: 'Items well-stocked', status: 'available' as const },
              { label: 'Low Stock', value: lowStock, color: 'text-warning-600', desc: 'Need attention soon', status: 'low_stock' as const },
              { label: 'Critical / OOS', value: criticalStock, color: 'text-destructive', desc: 'Immediate action needed', status: 'out_of_stock' as const },
            ].map(({ label, value, color, desc, status }) => (
              <button
                key={label}
                type="button"
                onClick={() => { setStatusFilter(status); setTab('inventory'); }}
                className="rounded-xl border border-border bg-card p-4 space-y-1 text-left transition-all hover:border-primary/50"
              >
                <div className={cn('text-3xl font-bold', color)}>{value}</div>
                <div className="font-medium text-sm">{label}</div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </button>
            ))}
          </div>

          {/* Quick alerts */}
          {expiringItems.length > 0 && (
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CalendarX2 className="h-4 w-4 text-warning-600" />
                  <span className="font-semibold text-sm text-warning-600">{expiringItems.length} items expiring within 90 days</span>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setTab('expiry')}>
                  View All
                </Button>
              </div>
              <div className="space-y-2">
                {expiringItems.slice(0, 3).map((item) => {
                  const med = item as InventoryItem & { medicineName?: string };
                  const days = daysUntilExpiry(item.expiryDate);
                  return (
                    <div key={item.id} className="flex items-center justify-between text-xs">
                      <span className="font-medium">{med.medicineName ?? 'Unknown'} — Batch {item.batchNumber}</span>
                      <span className={cn('font-semibold', days <= 30 ? 'text-destructive' : 'text-warning-600')}>
                        {days <= 0 ? 'EXPIRED' : `${days}d`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Value summary */}
          {stats && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: 'Total Stock Value', value: formatCurrency(stats.inventoryValue), icon: Package },
                { label: 'Total Medicines', value: String(stats.totalMedicines), icon: Pill },
                { label: 'Out of Stock', value: String(stats.outOfStockCount), icon: AlertTriangle },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="font-bold text-sm">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Catalog tab */}
        <TabsContent value="catalog" className="pt-4">
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Input
                placeholder="Search medicines…"
                value={medSearch}
                onChange={(e) => setMedSearch(e.target.value)}
                className="pl-3 h-8 text-sm"
              />
            </div>
          </div>
          <DataTable
            columns={medicineColumns}
            data={medicines}
            loading={medLoading}
            emptyMessage="No medicines in catalog"
            emptyDescription="Add medicines manually or use the Import button to bulk upload from Excel."
          />
        </TabsContent>

        {/* Inventory / Stock Levels tab */}
        <TabsContent value="inventory" className="pt-4">
          <div className="flex flex-wrap gap-2 mb-4">
            <Input
              placeholder="Search medicine or batch…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm max-w-xs"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-sm w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="available">In Stock</SelectItem>
                <SelectItem value="low_stock">Low Stock</SelectItem>
                <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            <Select value={formFilter} onValueChange={setFormFilter}>
              <SelectTrigger className="h-8 text-sm w-36">
                <SelectValue placeholder="Form" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Forms</SelectItem>
                {FORM_FILTER_OPTIONS.map((f) => (
                  <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DataTable
            columns={inventoryColumns}
            data={inventory}
            loading={invLoading}
            emptyMessage="No stock entries found"
            emptyDescription="Add stock via purchase entries or import from Excel."
          />
        </TabsContent>

        {/* Expiry tab */}
        <TabsContent value="expiry" className="pt-4">
          {expiringItems.length === 0 && !invLoading ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
              <ShieldCheck className="h-12 w-12 text-success/50" />
              <p className="font-semibold text-success">All stock is well within expiry dates</p>
              <p className="text-sm">No items expire within the next 90 days.</p>
            </div>
          ) : (
            <DataTable
              columns={expiryColumns}
              data={expiringItems}
              loading={invLoading}
              emptyMessage="No expiring items"
            />
          )}
        </TabsContent>

        {/* Reorder tab */}
        <TabsContent value="reorder" className="pt-4">
          <DataTable
            columns={reorderColumns}
            data={reorderItems}
            loading={reorderLoading}
            emptyMessage="No items need reordering"
            emptyDescription="When items fall below their reorder threshold, they'll appear here."
          />
        </TabsContent>
      </Tabs>

      {/* Sheets & dialogs */}
      <ImportSheet open={showImport} onClose={() => setShowImport(false)} />
      {addStockOpen && (
        <AddStockSheet
          open={addStockOpen}
          onOpenChange={(o) => { if (!o) { setAddStockOpen(false); void qc.invalidateQueries({ queryKey: ['inventory'] }); } }}
        />
      )}
      {adjustItem && (
        <AdjustStockDialog
          item={adjustItem}
          open={!!adjustItem}
          onOpenChange={(o) => { if (!o) setAdjustItem(null); }}
        />
      )}
      {editItem && (
        <EditStockDialog
          item={editItem}
          open={!!editItem}
          onOpenChange={(o) => { if (!o) setEditItem(null); }}
        />
      )}
      {batchItem && (
        <BatchDetailSheet
          item={batchItem}
          open={!!batchItem}
          onOpenChange={(o) => { if (!o) setBatchItem(null); }}
        />
      )}
    </div>
  );
}

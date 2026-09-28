'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Plus, Download, Package, AlertTriangle, XCircle, CheckCircle, MoreHorizontal,
  ShoppingCart, Scan, Mic, SlidersHorizontal, Star, Eye, Edit2, Trash2,
  RefreshCw, TrendingUp, Layers, MapPin, PackageSearch, Zap, RotateCcw,
  Printer, ChevronDown, X, Minus,
} from 'lucide-react';
import { toast } from 'sonner';
import type { InventoryItem, InventoryStats, AIInsight, CartItem } from '@pharmaos/types';
import { formatCurrency, formatDate, daysUntilExpiry } from '@pharmaos/utils';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { AddStockSheet } from '@/components/inventory/add-stock-sheet';
import { AdjustStockDialog } from '@/components/inventory/adjust-stock-dialog';
import { BatchDetailSheet } from '@/components/inventory/batch-detail-sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { useCan } from '@/lib/permissions';

const CATEGORY_TABS = [
  { label: 'All', value: 'all' },
  { label: 'Tablets', value: 'Tablet' },
  { label: 'Capsules', value: 'Capsule' },
  { label: 'Syrups', value: 'Syrup' },
  { label: 'Injections', value: 'Injection' },
  { label: 'OTC', value: 'OTC', isCategory: true },
  { label: 'Prescription', value: 'Prescription', isCategory: true },
  { label: 'Controlled', value: 'Controlled', isCategory: true },
];

const RECENT_SEARCHES = ['Paracetamol 650', 'Crocin 650', 'Augmentin 625'];

async function fetchStats(): Promise<InventoryStats> {
  const res = await apiFetch('/api/inventory/stats');
  const json = await res.json() as { success: boolean; data: InventoryStats };
  if (!res.ok) throw new Error('Request failed');
  return json.data ?? ({} as InventoryStats);
}

async function fetchInventory(params: { search: string; status: string; category: string }): Promise<InventoryItem[]> {
  const p = new URLSearchParams({ limit: '100' });
  if (params.search) p.set('search', params.search);
  if (params.status && params.status !== 'all') p.set('status', params.status);
  // Category tabs map to either dosageForm or category field
  const tab = CATEGORY_TABS.find((t) => t.value === params.category);
  if (params.category && params.category !== 'all') {
    if (tab?.isCategory) p.set('category', params.category);
    else p.set('dosageForm', params.category);
  }
  const res = await apiFetch(`/api/inventory?${p}`);
  const json = await res.json() as { success: boolean; data: { data: InventoryItem[] } };
  if (!res.ok) throw new Error('Request failed');
  return json.data?.data ?? ([] as InventoryItem[]);
}

async function fetchAIInsights(): Promise<AIInsight[]> {
  const res = await apiFetch('/api/inventory/ai-insights');
  const json = await res.json() as { success: boolean; data: AIInsight[] };
  if (!res.ok) throw new Error('Request failed');
  return json.data ?? ([] as AIInsight[]);
}

function exportCSV(data: InventoryItem[]) {
  const headers = ['Medicine', 'Strength', 'Manufacturer', 'Batch No.', 'Qty Available', 'MRP', 'Selling Price', 'Purchase Price', 'Expiry Date', 'Rack Location', 'Category', 'Status'];
  const rows = data.map((i) => {
    const med = i.medicine as { name: string } | undefined;
    return [med?.name ?? '', i.strength ?? '', i.manufacturer ?? '', i.batchNumber, i.availableQuantity, i.mrp, i.sellingPrice, i.purchasePrice, formatDate(i.expiryDate), i.rackLocation ?? '', i.category ?? '', i.status].join(',');
  });
  const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `inventory-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${data.length} items`);
}

const AI_INSIGHT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  reorder: RefreshCw,
  transfer: Layers,
  expiry: AlertTriangle,
  demand: TrendingUp,
  dead_stock: PackageSearch,
  low_stock: AlertTriangle,
};

const AI_INSIGHT_COLORS: Record<string, string> = {
  high: 'text-destructive bg-destructive/10',
  medium: 'text-warning-600 bg-warning/10',
  low: 'text-primary bg-primary/10',
};

export function InventoryView() {
  const router = useRouter();
  const can = useCan();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('all');
  const [activeCategory, setActiveCategory] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [batchItem, setBatchItem] = useState<InventoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [cartOpen, setCartOpen] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);

  const { data: stats, isLoading: statsLoading } = useQuery({ queryKey: ['inventory-stats'], queryFn: fetchStats });
  const { data = [], isLoading } = useQuery({
    queryKey: ['inventory', search, status, activeCategory],
    queryFn: () => fetchInventory({ search, status, category: activeCategory }),
  });
  const { data: insights = [] } = useQuery({ queryKey: ['ai-insights'], queryFn: fetchAIInsights });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/inventory/${id}`, { method: 'DELETE' });
      const json = await res.json() as { success: boolean };
      if (!json.success) throw new Error('Delete failed');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); toast.success('Item removed from inventory'); setDeleteTarget(null); },
    onError: () => toast.error('Failed to remove item'),
  });

  const handleSearch = useCallback((value: string) => {
    setSearchInput(value);
    const t = setTimeout(() => setSearch(value), 300);
    return () => clearTimeout(t);
  }, []);

  function addToCart(item: InventoryItem) {
    const med = item.medicine as { name: string } | undefined;
    setCart((prev) => {
      const existing = prev.findIndex((c) => c.inventoryId === item.id);
      if (existing !== -1) {
        return prev.map((c, i) => i === existing ? { ...c, quantity: c.quantity + 1, amount: (c.quantity + 1) * c.mrp } : c);
      }
      return [...prev, { inventoryId: item.id, medicineId: item.medicineId, medicineName: med?.name ?? '', strength: item.strength ?? '', dosageForm: item.dosageForm, batchNumber: item.batchNumber, mrp: item.mrp, quantity: 1, amount: item.mrp }];
    });
    setCartOpen(true);
    toast.success(`Added ${med?.name ?? 'item'} to cart`);
  }

  function updateCartQty(inventoryId: string, delta: number) {
    setCart((prev) => prev.map((c) => c.inventoryId === inventoryId
      ? { ...c, quantity: Math.max(0, c.quantity + delta), amount: Math.max(0, c.quantity + delta) * c.mrp }
      : c
    ).filter((c) => c.quantity > 0));
  }

  function removeFromCart(inventoryId: string) {
    setCart((prev) => prev.filter((c) => c.inventoryId !== inventoryId));
  }

  const cartSubtotal = cart.reduce((s, c) => s + c.amount, 0);
  const cartDiscount = cartSubtotal * 0.025;
  const cartGst = (cartSubtotal - cartDiscount) * 0.12;
  const cartTotal = cartSubtotal - cartDiscount + cartGst;

  const columns: ColumnDef<InventoryItem>[] = [
    {
      id: 'favorite',
      header: '',
      cell: ({ row }) => (
        <button
          onClick={() => setFavorites((prev) => { const s = new Set(prev); if (s.has(row.original.id)) s.delete(row.original.id); else s.add(row.original.id); return s; })}
          className="p-1 rounded hover:bg-accent"
        >
          <Star className={cn('h-3.5 w-3.5', favorites.has(row.original.id) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40')} />
        </button>
      ),
      size: 32,
    },
    {
      accessorKey: 'medicine',
      header: 'Medicine Name',
      cell: ({ row }) => {
        const med = row.original.medicine as { name: string } | undefined;
        return (
          <div className="min-w-0">
            <p className="font-medium text-sm leading-tight">{med?.name ?? '—'}</p>
            <p className="text-xs text-muted-foreground">{row.original.dosageForm ?? 'Tablet'}</p>
          </div>
        );
      },
    },
    {
      accessorKey: 'strength',
      header: 'Strength',
      cell: ({ row }) => <span className="text-sm text-muted-foreground tabular-nums">{row.original.strength ?? '—'}</span>,
    },
    {
      accessorKey: 'manufacturer',
      header: 'Manufacturer',
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.manufacturer ?? '—'}</span>,
    },
    {
      accessorKey: 'availableQuantity',
      header: ({ column }) => <SortableHeader column={column}>Stock Status</SortableHeader>,
      cell: ({ row }) => {
        const qty = row.original.availableQuantity;
        const s = row.original.status;
        const statusMap: Record<string, 'success' | 'warning' | 'error' | 'muted'> = { available: 'success', low_stock: 'warning', out_of_stock: 'error', expired: 'error', damaged: 'muted' };
        return (
          <div>
            <p className={cn('font-semibold tabular-nums text-sm', qty === 0 && 'text-destructive', qty > 0 && qty <= 10 && 'text-warning-600')}>
              {qty} {qty !== 0 && <span className="text-xs font-normal text-muted-foreground">units</span>}
            </p>
            <Badge variant={statusMap[s] ?? 'muted'} dot className="text-2xs mt-0.5 capitalize">{s.replace('_', ' ')}</Badge>
          </div>
        );
      },
    },
    {
      accessorKey: 'batchNumber',
      header: 'Batch No.',
      cell: ({ row }) => (
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{row.original.batchNumber}</code>
      ),
    },
    {
      accessorKey: 'expiryDate',
      header: ({ column }) => <SortableHeader column={column}>Expiry Date</SortableHeader>,
      cell: ({ row }) => {
        const days = daysUntilExpiry(row.original.expiryDate);
        return (
          <div>
            <p className={cn('text-xs font-medium', days < 0 && 'text-destructive', days >= 0 && days <= 30 && 'text-warning-600')}>
              {formatDate(row.original.expiryDate)}
            </p>
            <p className="text-2xs text-muted-foreground">
              {days < 0 ? `Expired ${Math.abs(days)}d ago` : `${days}d left`}
            </p>
          </div>
        );
      },
    },
    {
      accessorKey: 'rackLocation',
      header: 'Rack',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
          <code className="text-xs font-mono">{row.original.rackLocation ?? '—'}</code>
        </div>
      ),
    },
    {
      accessorKey: 'mrp',
      header: 'MRP (₹)',
      cell: ({ row }) => <span className="tabular-nums text-sm font-medium">{formatCurrency(row.original.mrp)}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => addToCart(row.original)} title="Add to cart">
            <ShoppingCart className="h-3.5 w-3.5 text-primary" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setBatchItem(row.original)} title="View batches">
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {can('inventory:edit') && (
                <DropdownMenuItem onClick={() => setAdjustItem(row.original)}>
                  <Edit2 className="h-4 w-4" /> Adjust Stock
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setBatchItem(row.original)}>
                <Layers className="h-4 w-4" /> View All Batches
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info(`Rack ${row.original.rackLocation ?? '—'} — verify physical location`)}>
                <MapPin className="h-4 w-4" /> Rack Location
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => addToCart(row.original)}>
                <ShoppingCart className="h-4 w-4" /> Add to Cart
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(row.original)}>
                <Trash2 className="h-4 w-4" /> Remove Batch
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
      size: 100,
    },
  ];

  const KPI_CARDS = [
    { label: 'Total Medicines', value: statsLoading ? null : stats?.totalMedicines.toLocaleString('en-IN'), sub: '+12% vs last month', icon: Package, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Inventory Value', value: statsLoading ? null : `₹${((stats?.inventoryValue ?? 0) / 100000).toFixed(2)} L`, sub: '+8.4% vs last month', icon: TrendingUp, color: 'text-success', bg: 'bg-success/10' },
    { label: 'Low Stock', value: statsLoading ? null : String(stats?.lowStockCount ?? 0), sub: 'View details →', icon: AlertTriangle, color: 'text-warning-600', bg: 'bg-warning/10', clickStatus: 'low_stock' },
    { label: 'Expiring Soon', value: statsLoading ? null : String(stats?.expiringSoonCount ?? 0), sub: 'In 30 days', icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-50' },
    { label: 'Out of Stock', value: statsLoading ? null : String(stats?.outOfStockCount ?? 0), sub: 'Need attention', icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', clickStatus: 'out_of_stock' },
    { label: 'Pending Transfers', value: statsLoading ? null : String(stats?.pendingTransfers ?? 0), sub: 'Auto reorder', icon: RefreshCw, color: 'text-blue-600', bg: 'bg-blue-50' },
  ];

  function printInventoryLabels() {
    if (data.length === 0) { toast.warning('No inventory items to print labels for'); return; }
    const items = data.slice(0, 20);
    const labelHtml = items.map((item) => {
      const med = item.medicine as { name?: string } | undefined;
      return `<div class="label">
        <div class="med">${med?.name ?? 'Unknown'}</div>
        <div class="row">Batch: ${item.batchNumber} &nbsp; Rack: ${item.rackLocation ?? '—'}</div>
        <div class="row">Expiry: ${formatDate(item.expiryDate)} &nbsp; MRP: ₹${item.mrp}</div>
        <div class="row">Qty: ${item.availableQuantity} ${item.dosageForm ?? ''}</div>
      </div>`;
    }).join('');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Inventory Labels</title>
<style>@page{size:72mm 40mm;margin:0}body{font-family:Arial,sans-serif;margin:0}.label{width:70mm;height:38mm;padding:3mm 4mm;box-sizing:border-box;border:0.5px solid #ccc;page-break-after:always}.med{font-size:11pt;font-weight:bold}.row{font-size:8pt;margin-top:2px;color:#333}</style>
</head><body>${labelHtml}</body></html>`);
    win.document.close();
    win.print();
    toast.success(`${items.length} label${items.length !== 1 ? 's' : ''} sent to printer`);
  }

  const QUICK_ACTIONS = [
    { label: 'Add Medicine', icon: Plus, onClick: () => router.push('/medicines'), perm: 'medicines:create' },
    { label: 'Add Batch', icon: Package, onClick: () => setAddOpen(true), perm: 'inventory:create' },
    { label: 'Stock Adjustment', icon: Edit2, onClick: () => toast.info('Select a medicine from the table, then use the ⋯ menu → Adjust Stock'), perm: 'inventory:edit' },
    { label: 'Stock Transfer', icon: Layers, onClick: () => router.push('/stock?tab=inventory'), perm: 'inventory:edit' },
    { label: 'Purchase Order', icon: RefreshCw, onClick: () => router.push('/vendors'), perm: 'vendors:view' },
    { label: 'Print Labels', icon: Printer, onClick: printInventoryLabels, perm: undefined as string | undefined },
  ].filter((a) => !a.perm || can(a.perm));

  return (
    <div className="flex h-full gap-4">
      {/* Main content */}
      <div className="min-w-0 flex-1 space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Inventory Intelligence Center</h1>
            <p className="text-sm text-muted-foreground">Real-time inventory visibility & smart stock management</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => exportCSV(data)}>
              <Download className="h-4 w-4" /> Export
            </Button>
            {can('inventory:create') && (
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" /> Add Batch
              </Button>
            )}
            <Button
              variant={cartOpen ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCartOpen((v) => !v)}
              className="relative"
            >
              <ShoppingCart className="h-4 w-4" />
              {cart.length > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-2xs text-white font-bold">
                  {cart.length}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <PackageSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 pr-24 h-10"
              placeholder="Search Medicine / SKU / Barcode / Batch No / Composition"
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" onClick={() => toast.info('Voice search — tap and speak')}>
                <Mic className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => toast.info('Barcode scan — press F2 or use camera')}>
                <Scan className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <SlidersHorizontal className="h-4 w-4" /> Filters <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => setStatus('all')}>All Status</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatus('available')}>Available</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatus('low_stock')}>Low Stock</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatus('out_of_stock')}>Out of Stock</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatus('expired')}>Expired</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Recent searches */}
        {!searchInput && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Recent:</span>
            {RECENT_SEARCHES.map((s) => (
              <button key={s} onClick={() => handleSearch(s)} className="rounded-full border border-border bg-muted/50 px-3 py-0.5 text-xs hover:bg-accent transition-colors">
                {s}
              </button>
            ))}
            {status !== 'all' && (
              <Badge variant="warning" className="text-xs gap-1 cursor-pointer" onClick={() => setStatus('all')}>
                {status.replace('_', ' ')} <X className="h-3 w-3" />
              </Badge>
            )}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-3 xl:grid-cols-6">
          {KPI_CARDS.map(({ label, value, sub, icon: Icon, color, bg, clickStatus }) => (
            <div
              key={label}
              className={cn('flex flex-col gap-2 rounded-xl border border-border bg-card p-4', clickStatus && 'cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-colors')}
              onClick={() => clickStatus && setStatus(clickStatus)}
            >
              <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', bg)}>
                <Icon className={cn('h-4 w-4', color)} />
              </div>
              <div>
                {value === null ? (
                  <Skeleton className="h-6 w-12 mb-1" />
                ) : (
                  <p className="text-xl font-bold leading-tight tabular-nums">{value}</p>
                )}
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-2xs text-muted-foreground/70 mt-0.5">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveCategory(tab.value)}
              className={cn(
                'rounded-full px-3.5 py-1 text-xs font-medium transition-colors border',
                activeCategory === tab.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border bg-card text-foreground hover:bg-accent'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Inventory Table */}
        <DataTable
          columns={columns}
          data={data}
          loading={isLoading}
          searchColumn="medicine"
          searchPlaceholder="Search by medicine, batch, or rack…"
          emptyMessage="No inventory items found"
          emptyDescription="Try adjusting your filters or add new stock."
          toolbar={
            <div className="flex items-center gap-2">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Stock Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="low_stock">Low Stock</SelectItem>
                  <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        />

        {/* AI Inventory Insights */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">AI Inventory Insights</h2>
            <Badge variant="muted" className="text-2xs">Live</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {insights.map((insight) => {
              const Icon = AI_INSIGHT_ICONS[insight.type] ?? AlertTriangle;
              return (
                <div key={insight.id} className="rounded-xl border border-border bg-card p-3 flex flex-col gap-2 hover:border-primary/30 transition-colors">
                  <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', AI_INSIGHT_COLORS[insight.priority])}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold leading-snug">{insight.title}</p>
                    <p className="text-2xs text-muted-foreground mt-0.5 leading-relaxed whitespace-pre-line">{insight.description}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-2xs px-2 w-full"
                    onClick={() => {
                      const dest: Record<string, string> = {
                        reorder: '/reorder', low_stock: '/stock?tab=inventory',
                        expiry: '/expiry', transfer: '/stock?tab=inventory',
                        demand: '/billing', dead_stock: '/stock?tab=inventory',
                      };
                      router.push(dest[insight.type] ?? '/stock');
                    }}
                  >
                    {insight.actionLabel}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Quick Actions</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {QUICK_ACTIONS.map(({ label, icon: Icon, onClick }) => (
              <Button key={label} variant="outline" size="sm" className="h-auto flex-col gap-1.5 py-3 text-xs" onClick={onClick}>
                <Icon className="h-4 w-4 text-primary" />
                {label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Billing Cart Panel */}
      {cartOpen && (
        <div className="w-72 shrink-0 flex flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          {/* Cart header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Billing Cart</span>
              {cart.length > 0 && <Badge variant="muted" className="text-2xs">{cart.length}</Badge>}
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => setCartOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <ShoppingCart className="h-10 w-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Cart is empty</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Click the cart icon on any medicine to add it</p>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div key={item.inventoryId} className="px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium leading-tight truncate">{idx + 1}. {item.medicineName}</p>
                      <p className="text-2xs text-muted-foreground">{item.strength} · {item.dosageForm}</p>
                    </div>
                    <button onClick={() => removeFromCart(item.inventoryId)} className="text-muted-foreground hover:text-destructive mt-0.5 shrink-0">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon-sm" className="h-6 w-6" onClick={() => updateCartQty(item.inventoryId, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-xs font-semibold tabular-nums">{item.quantity}</span>
                      <Button variant="outline" size="icon-sm" className="h-6 w-6" onClick={() => updateCartQty(item.inventoryId, 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold tabular-nums">₹{item.amount.toFixed(2)}</p>
                      <p className="text-2xs text-muted-foreground">MRP ₹{item.mrp}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cart totals */}
          {cart.length > 0 && (
            <div className="border-t border-border p-3 space-y-2">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span><span className="tabular-nums">₹{cartSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Discount (2.5%)</span><span className="tabular-nums text-success">-₹{cartDiscount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>GST (12%)</span><span className="tabular-nums">₹{cartGst.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-sm">
                  <span>Total Amount</span>
                  <span className="text-primary tabular-nums">₹{cartTotal.toFixed(2)}</span>
                </div>
              </div>
              <Button className="w-full h-9 text-sm" onClick={() => toast.success('Proceeding to billing…')}>
                Proceed to Billing →
              </Button>
              <div className="grid grid-cols-2 gap-1.5">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => toast.info('Bill held — you can resume later')}>
                  Hold Bill
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => setCart([])}>
                  <RotateCcw className="h-3 w-3" /> Clear Cart
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dialogs / Sheets */}
      <AddStockSheet open={addOpen} onOpenChange={setAddOpen} />
      <AdjustStockDialog open={!!adjustItem} onOpenChange={(o) => !o && setAdjustItem(null)} item={adjustItem} />
      <BatchDetailSheet open={!!batchItem} onOpenChange={(o) => !o && setBatchItem(null)} item={batchItem} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove batch from inventory?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove batch <strong>{deleteTarget?.batchNumber}</strong> from the inventory records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} className="bg-destructive hover:bg-destructive/90">
              Remove Batch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

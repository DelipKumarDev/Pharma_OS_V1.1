'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Plus, Download, Building2, MoreHorizontal, Eye, CreditCard, Package,
  AlertTriangle, CheckCircle, TrendingUp, Upload, Search, Star, Phone,
  Mail, MapPin, ChevronRight, FileText, Clock, Ban, Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Vendor, PurchaseInvoice, VendorStats } from '@pharmaos/types';
import { formatCurrency, formatDate, formatDateTime } from '@pharmaos/utils';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

async function fetchVendorStats(): Promise<VendorStats> {
  const res = await fetch('/api/vendors/stats');
  const json = await res.json() as { success: boolean; data: VendorStats };
  return json.data;
}

async function fetchVendors(search?: string, status?: string): Promise<Vendor[]> {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (status && status !== 'all') params.set('status', status);
  const res = await fetch(`/api/vendors?${params}`);
  const json = await res.json() as { success: boolean; data: { data: Vendor[] } };
  return json.data.data;
}

async function fetchInvoices(status?: string): Promise<PurchaseInvoice[]> {
  const params = new URLSearchParams();
  if (status && status !== 'all') params.set('status', status);
  const res = await fetch(`/api/purchase-invoices?${params}`);
  const json = await res.json() as { success: boolean; data: { data: PurchaseInvoice[] } };
  return json.data.data;
}

async function createVendor(data: Record<string, unknown>): Promise<Vendor> {
  const res = await fetch('/api/vendors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const json = await res.json() as { success: boolean; data: Vendor; message?: string };
  if (!json.success) throw new Error(json.message ?? 'Failed');
  return json.data;
}

async function confirmInvoice(id: string): Promise<void> {
  await fetch(`/api/purchase-invoices/${id}/confirm`, { method: 'PATCH' });
}

const vendorSchema = z.object({
  name: z.string().min(2, 'Name required'),
  phone: z.string().min(10, 'Valid phone required'),
  email: z.string().email().optional().or(z.literal('')),
  gstNumber: z.string().optional(),
  contactPerson: z.string().optional(),
  address: z.string().min(5, 'Address required'),
  city: z.string().min(2, 'City required'),
  state: z.string().min(2, 'State required'),
  pincode: z.string().optional(),
  paymentTerms: z.string().optional(),
  creditLimit: z.coerce.number().optional(),
});

type VendorFormValues = z.infer<typeof vendorSchema>;

function AddVendorDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<VendorFormValues>({ resolver: zodResolver(vendorSchema) });

  const mutation = useMutation({
    mutationFn: (data: VendorFormValues) => createVendor(data as Record<string, unknown>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors'] });
      qc.invalidateQueries({ queryKey: ['vendor-stats'] });
      toast.success('Vendor added successfully');
      onOpenChange(false);
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add New Vendor</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Vendor / Distributor Name <span className="text-destructive">*</span></Label>
              <Input {...register('name')} placeholder="e.g. MedLine Distributors" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Phone <span className="text-destructive">*</span></Label>
              <Input {...register('phone')} placeholder="9876543210" />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input {...register('email')} placeholder="orders@vendor.com" type="email" />
            </div>
            <div className="space-y-1">
              <Label>GST Number</Label>
              <Input {...register('gstNumber')} placeholder="27AABCU9603R1ZX" className="uppercase" />
            </div>
            <div className="space-y-1">
              <Label>Contact Person</Label>
              <Input {...register('contactPerson')} placeholder="Rajesh Sharma" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Address <span className="text-destructive">*</span></Label>
              <Input {...register('address')} placeholder="Street address" />
            </div>
            <div className="space-y-1">
              <Label>City <span className="text-destructive">*</span></Label>
              <Input {...register('city')} placeholder="Mumbai" />
            </div>
            <div className="space-y-1">
              <Label>State <span className="text-destructive">*</span></Label>
              <Input {...register('state')} placeholder="Maharashtra" />
            </div>
            <div className="space-y-1">
              <Label>Payment Terms</Label>
              <select {...register('paymentTerms')} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
                <option value="">Select...</option>
                <option value="Cash">Cash</option>
                <option value="Net 15">Net 15 Days</option>
                <option value="Net 30">Net 30 Days</option>
                <option value="Net 45">Net 45 Days</option>
                <option value="Net 60">Net 60 Days</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Credit Limit (₹)</Label>
              <Input {...register('creditLimit')} type="number" placeholder="100000" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Add Vendor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VendorDetailSheet({ vendor, open, onOpenChange }: { vendor: Vendor | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: invoices = [] } = useQuery({
    queryKey: ['vendor-invoices', vendor?.id],
    queryFn: () => {
      const res = fetch(`/api/vendors/${vendor!.id}/invoices`).then(r => r.json()) as Promise<{ success: boolean; data: { data: PurchaseInvoice[] } }>;
      return res.then(j => j.data.data);
    },
    enabled: !!vendor,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['vendor-payments', vendor?.id],
    queryFn: () => fetch(`/api/vendors/${vendor!.id}/payments`).then(r => r.json()).then((j: { success: boolean; data: { data: unknown[] } }) => j.data.data),
    enabled: !!vendor,
  });

  if (!vendor) return null;

  const statusMap: Record<string, string> = { confirmed: 'success', pending_review: 'warning', draft: 'secondary', completed: 'muted', cancelled: 'destructive' };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <SheetTitle>{vendor.name}</SheetTitle>
              <SheetDescription>{vendor.city}, {vendor.state}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Purchases', value: formatCurrency(vendor.totalPurchases), color: 'text-primary' },
              { label: 'Pending Payment', value: formatCurrency(vendor.pendingPayment), color: vendor.pendingPayment > 0 ? 'text-warning-700' : 'text-success' },
              { label: 'Rating', value: `${vendor.rating ?? 'N/A'} ★`, color: 'text-amber-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-lg border bg-card p-3 text-center">
                <p className={cn('text-lg font-bold', color)}>{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
            <h4 className="text-sm font-semibold">Contact Details</h4>
            <div className="space-y-1.5 text-sm">
              {vendor.contactPerson && <div className="flex items-center gap-2 text-muted-foreground"><Building2 className="h-3.5 w-3.5" />{vendor.contactPerson}</div>}
              <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" />{vendor.phone}</div>
              {vendor.email && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" />{vendor.email}</div>}
              <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{vendor.address}, {vendor.city} — {vendor.pincode}</div>
              {vendor.gstNumber && <div className="flex items-center gap-2 text-muted-foreground"><FileText className="h-3.5 w-3.5" />GST: {vendor.gstNumber}</div>}
              {vendor.paymentTerms && <div className="flex items-center gap-2 text-muted-foreground"><CreditCard className="h-3.5 w-3.5" />Payment: {vendor.paymentTerms}</div>}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Recent Invoices</h4>
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices found</p>
            ) : (
              <div className="space-y-2">
                {invoices.map((inv: PurchaseInvoice) => (
                  <div key={inv.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
                    <div>
                      <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(inv.invoiceDate)} · {inv.items.length} items</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(inv.totalAmount)}</p>
                      <Badge variant={(statusMap[inv.status] as 'success' | 'warning' | 'secondary' | 'muted' | 'destructive') ?? 'secondary'} className="text-xs capitalize">
                        {inv.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Payment History</h4>
            {(payments as Array<{ id: string; amount: number; paymentDate: string; paymentMode: string; referenceNumber?: string }>).length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments recorded</p>
            ) : (
              <div className="space-y-2">
                {(payments as Array<{ id: string; amount: number; paymentDate: string; paymentMode: string; referenceNumber?: string }>).map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
                    <div>
                      <p className="text-sm font-medium capitalize">{p.paymentMode.toUpperCase()}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(p.paymentDate)}{p.referenceNumber ? ` · Ref: ${p.referenceNumber}` : ''}</p>
                    </div>
                    <p className="text-sm font-semibold text-success">{formatCurrency(p.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function InvoiceRow({ invoice, onConfirm }: { invoice: PurchaseInvoice; onConfirm: (id: string) => void }) {
  const statusColors: Record<string, string> = {
    confirmed: 'success', pending_review: 'warning', draft: 'secondary', completed: 'muted', cancelled: 'destructive',
  };
  return (
    <div className={cn('flex items-center justify-between rounded-lg border bg-card p-4', invoice.mismatchFlag && 'border-warning-300 bg-warning/5')}>
      <div className="flex items-center gap-3">
        {invoice.mismatchFlag && <AlertTriangle className="h-4 w-4 text-warning-600 shrink-0" />}
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm">{invoice.invoiceNumber}</p>
            <Badge variant={(statusColors[invoice.status] as 'success' | 'warning' | 'secondary' | 'muted' | 'destructive') ?? 'secondary'} className="text-xs capitalize">
              {invoice.status.replace('_', ' ')}
            </Badge>
            {invoice.mismatchFlag && <Badge variant="warning" className="text-xs">Mismatch</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">{invoice.vendorName} · {invoice.items.length} medicines · {formatDate(invoice.invoiceDate)}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 text-right">
        <div>
          <p className="font-semibold">{formatCurrency(invoice.totalAmount)}</p>
          {invoice.pendingAmount > 0 && <p className="text-xs text-warning-700">Due: {formatCurrency(invoice.pendingAmount)}</p>}
        </div>
        {invoice.status === 'pending_review' && (
          <Button size="sm" onClick={() => onConfirm(invoice.id)}>Confirm</Button>
        )}
      </div>
    </div>
  );
}

export function VendorsView() {
  const [addOpen, setAddOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const qc = useQueryClient();

  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(val), 300);
  }, []);

  const { data: stats } = useQuery({ queryKey: ['vendor-stats'], queryFn: fetchVendorStats });
  const { data: vendors = [], isLoading } = useQuery({ queryKey: ['vendors', debouncedSearch, statusFilter], queryFn: () => fetchVendors(debouncedSearch, statusFilter) });
  const { data: invoices = [], isLoading: invLoading } = useQuery({ queryKey: ['purchase-invoices', invoiceStatusFilter], queryFn: () => fetchInvoices(invoiceStatusFilter) });

  const confirmMutation = useMutation({
    mutationFn: confirmInvoice,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-invoices'] }); toast.success('Invoice confirmed — inventory updated'); },
    onError: () => toast.error('Failed to confirm invoice'),
  });

  function exportCSV() {
    const headers = ['Name', 'GST', 'Phone', 'City', 'State', 'Total Purchases', 'Pending Payment', 'Rating', 'Status'];
    const rows = vendors.map(v => [v.name, v.gstNumber ?? '', v.phone, v.city, v.state, v.totalPurchases, v.pendingPayment, v.rating ?? '', v.status].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `vendors-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Vendor list exported');
  }

  const columns: ColumnDef<Vendor>[] = [
    {
      id: 'vendor',
      accessorFn: (row) => row.name,
      header: 'Vendor',
      cell: ({ row }) => {
        const v = row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">{v.name}</p>
              <p className="text-xs text-muted-foreground">{v.contactPerson ?? v.email ?? v.gstNumber ?? '—'}</p>
            </div>
          </div>
        );
      },
    },
    {
      id: 'contact',
      header: 'Contact',
      cell: ({ row }) => {
        const v = row.original;
        return (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-sm"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{v.phone}</div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{v.city}, {v.state}</div>
          </div>
        );
      },
    },
    {
      accessorKey: 'totalPurchases',
      header: ({ column }) => <SortableHeader column={column}>Total Purchases</SortableHeader>,
      cell: ({ row }) => <span className="font-semibold tabular-nums">{formatCurrency(row.original.totalPurchases)}</span>,
    },
    {
      accessorKey: 'pendingPayment',
      header: 'Pending',
      cell: ({ row }) => {
        const amt = row.original.pendingPayment;
        return <span className={cn('font-medium tabular-nums', amt > 0 ? 'text-warning-700' : 'text-success')}>{formatCurrency(amt)}</span>;
      },
    },
    {
      id: 'rating',
      header: 'Rating',
      cell: ({ row }) => {
        const r = row.original.rating;
        return r ? (
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="text-sm font-medium">{r}</span>
          </div>
        ) : <span className="text-muted-foreground text-xs">Not rated</span>;
      },
    },
    {
      id: 'paymentTerms',
      header: 'Terms',
      cell: ({ row }) => <span className="text-sm">{row.original.paymentTerms ?? '—'}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'active' ? 'success' : 'muted'} dot className="text-xs capitalize">
          {row.original.status}
        </Badge>
      ),
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
            <DropdownMenuItem onClick={() => { setSelectedVendor(row.original); setDetailOpen(true); }}>
              <Eye className="h-4 w-4" /> View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info('Record payment — coming soon')}>
              <Wallet className="h-4 w-4" /> Record Payment
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info('Upload invoice — coming soon')}>
              <Upload className="h-4 w-4" /> Upload Invoice
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onClick={() => toast.info('Deactivate vendor — confirm first')}>
              <Ban className="h-4 w-4" /> Deactivate
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const statCards = [
    { label: 'Total Vendors', value: stats?.totalVendors ?? 0, icon: Building2, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Active Vendors', value: stats?.activeVendors ?? 0, icon: CheckCircle, color: 'text-success', bg: 'bg-success/10' },
    { label: 'This Month Purchases', value: formatCurrency(stats?.totalPurchasesThisMonth ?? 0), icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950' },
    { label: 'Pending Payments', value: formatCurrency(stats?.pendingPayments ?? 0), icon: Clock, color: 'text-warning-700', bg: 'bg-warning/10' },
    { label: 'Overdue Payments', value: formatCurrency(stats?.overduePayments ?? 0), icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10' },
    { label: 'Invoices Pending Review', value: stats?.invoicesPendingReview ?? 0, icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vendor & Procurement</h1>
          <p className="text-sm text-muted-foreground">Manage distributors, purchase invoices, and payments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.info('OCR invoice upload — coming soon')}>
            <Upload className="h-4 w-4" /> Upload Invoice
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Vendor
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', bg)}>
              <Icon className={cn('h-4 w-4', color)} />
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold leading-tight truncate">{value}</p>
              <p className="text-xs text-muted-foreground leading-tight">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="vendors">
        <TabsList>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
          <TabsTrigger value="invoices">
            Purchase Invoices
            {(stats?.invoicesPendingReview ?? 0) > 0 && (
              <Badge variant="warning" className="ml-1.5 h-4 min-w-4 justify-center p-0 text-[10px]">{stats?.invoicesPendingReview}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vendors" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search vendors by name, GST, or city…" value={search} onChange={e => handleSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DataTable
            columns={columns}
            data={vendors}
            loading={isLoading}
            searchColumn="vendor"
            searchPlaceholder="Filter vendors…"
            emptyMessage="No vendors found"
            emptyDescription="Add your first vendor to start tracking procurement."
          />
        </TabsContent>

        <TabsContent value="invoices" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <Select value={invoiceStatusFilter} onValueChange={setInvoiceStatusFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Filter by status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Invoices</SelectItem>
                <SelectItem value="pending_review">Pending Review</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</p>
          </div>
          {invLoading ? (
            <div className="text-center py-10 text-muted-foreground">Loading invoices…</div>
          ) : invoices.length === 0 ? (
            <div className="rounded-xl border border-border bg-card py-16 text-center">
              <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="font-medium">No invoices found</p>
              <p className="text-sm text-muted-foreground">Upload a purchase invoice to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {invoices.map(inv => (
                <InvoiceRow key={inv.id} invoice={inv} onConfirm={id => confirmMutation.mutate(id)} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AddVendorDialog open={addOpen} onOpenChange={setAddOpen} />
      <VendorDetailSheet vendor={selectedVendor} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}

'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Plus, Download, Users, MoreHorizontal, Eye, CreditCard, Star,
  Phone, Mail, MapPin, TrendingUp, Clock, Crown, UserPlus,
  Wallet, Search, Heart, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Customer, CustomerStats, CustomerPurchase } from '@pharmaos/types';
import { formatCurrency, formatDate } from '@pharmaos/utils';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiFetch } from '@/lib/api';

async function fetchCustomerStats(): Promise<CustomerStats> {
  const res = await apiFetch('/api/customers/stats');
  const json = await res.json() as { success: boolean; data: CustomerStats };
  if (!res.ok) throw new Error('Request failed');
  return json.data ?? ({} as CustomerStats);
}

async function fetchCustomers(search?: string, type?: string): Promise<Customer[]> {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (type && type !== 'all') params.set('type', type);
  const res = await apiFetch(`/api/customers?${params}`);
  const json = await res.json() as { success: boolean; data: { data: Customer[] } };
  if (!res.ok) throw new Error('Request failed');
  return json.data?.data ?? ([] as Customer[]);
}

async function fetchCustomerPurchases(id: string): Promise<CustomerPurchase[]> {
  const res = await apiFetch(`/api/customers/${id}/purchases`);
  const json = await res.json() as { success: boolean; data: { data: CustomerPurchase[] } };
  if (!res.ok) throw new Error('Request failed');
  return json.data?.data ?? ([] as CustomerPurchase[]);
}

async function createCustomer(data: Record<string, unknown>): Promise<Customer> {
  const res = await apiFetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const json = await res.json() as { success: boolean; data: Customer; message?: string };
  if (!json.success) throw new Error(json.message ?? 'Failed');
  return json.data;
}

const customerSchema = z.object({
  name: z.string().min(2, 'Name required'),
  phone: z.string().min(10, 'Valid phone required'),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  doctorName: z.string().optional(),
  customerType: z.enum(['walk_in', 'regular', 'vip', 'credit']).optional(),
  notes: z.string().optional(),
});
type CustomerFormValues = z.infer<typeof customerSchema>;

type TypeInfo = { label: string; variant: 'success' | 'warning' | 'secondary' | 'muted' | 'default'; icon: React.ElementType };

const TYPE_LABEL: Record<string, TypeInfo | undefined> = {
  vip: { label: 'VIP', variant: 'warning', icon: Crown },
  regular: { label: 'Regular', variant: 'success', icon: Users },
  credit: { label: 'Credit', variant: 'secondary', icon: CreditCard },
  walk_in: { label: 'Walk-in', variant: 'muted', icon: UserPlus },
};

const DEFAULT_TYPE_INFO: TypeInfo = { label: 'Regular', variant: 'success', icon: Users };

function AddCustomerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CustomerFormValues>({ mode: 'onTouched', resolver: zodResolver(customerSchema) });

  const mutation = useMutation({
    mutationFn: (data: CustomerFormValues) => createCustomer(data as Record<string, unknown>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['customer-stats'] });
      toast.success('Customer added successfully');
      onOpenChange(false);
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Add New Customer</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Full Name <span className="text-destructive">*</span></Label>
              <Input {...register('name')} placeholder="Ramesh Gupta" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Phone <span className="text-destructive">*</span></Label>
              <Input {...register('phone')} placeholder="9876543210" />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input {...register('email')} placeholder="email@example.com" type="email" />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message || 'Enter a valid email'}</p>}
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Address</Label>
              <Input {...register('address')} placeholder="Home or office address" />
            </div>
            <div className="space-y-1">
              <Label>Date of Birth</Label>
              <Input {...register('dateOfBirth')} type="date" />
            </div>
            <div className="space-y-1">
              <Label>Gender</Label>
              <select {...register('gender')} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
                <option value="">Select...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Doctor Name</Label>
              <Input {...register('doctorName')} placeholder="Dr. Anjali Singh" />
            </div>
            <div className="space-y-1">
              <Label>Customer Type</Label>
              <select {...register('customerType')} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm">
                <option value="regular">Regular</option>
                <option value="walk_in">Walk-in</option>
                <option value="vip">VIP</option>
                <option value="credit">Credit Account</option>
              </select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Notes</Label>
              <Input {...register('notes')} placeholder="Any notes about this customer" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : 'Add Customer'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CustomerDetailSheet({ customer, open, onOpenChange }: { customer: Customer | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: purchases = [] } = useQuery({
    queryKey: ['customer-purchases', customer?.id],
    queryFn: () => fetchCustomerPurchases(customer!.id),
    enabled: !!customer,
  });

  if (!customer) return null;
  const typeInfo = TYPE_LABEL[customer.customerType] ?? DEFAULT_TYPE_INFO;
  const TypeIcon = typeInfo.icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <span className="text-xl font-bold text-primary">{customer.name.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <SheetTitle>{customer.name}</SheetTitle>
                <Badge variant={typeInfo.variant} className="text-xs">{typeInfo.label}</Badge>
              </div>
              <SheetDescription>Member since {formatDate(customer.createdAt)}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Spent', value: formatCurrency(customer.totalSpend), color: 'text-primary' },
              { label: 'Total Visits', value: customer.totalVisits.toString(), color: 'text-foreground' },
              { label: 'Loyalty Points', value: customer.loyaltyPoints.toLocaleString(), color: 'text-amber-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-lg border bg-card p-3 text-center">
                <p className={cn('text-lg font-bold', color)}>{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          {customer.creditBalance > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-warning-300 bg-warning/10 p-3">
              <AlertCircle className="h-4 w-4 text-warning-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-warning-700">Credit Balance Outstanding</p>
                <p className="text-xs text-warning-600">{formatCurrency(customer.creditBalance)} due for collection</p>
              </div>
            </div>
          )}

          <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
            <h4 className="text-sm font-semibold">Contact Details</h4>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" />{customer.phone}</div>
              {customer.email && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" />{customer.email}</div>}
              {customer.address && <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{customer.address}</div>}
              {customer.doctorName && <div className="flex items-center gap-2 text-muted-foreground"><Heart className="h-3.5 w-3.5" />Dr. {customer.doctorName}</div>}
              {customer.dateOfBirth && <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-3.5 w-3.5" />DOB: {formatDate(customer.dateOfBirth)}</div>}
            </div>
          </div>

          {customer.medicalConditions && customer.medicalConditions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Medical Conditions</h4>
              <div className="flex flex-wrap gap-1.5">
                {customer.medicalConditions.map(c => (
                  <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Purchase History ({purchases.length})</h4>
            {purchases.length === 0 ? (
              <p className="text-sm text-muted-foreground">No purchases on record</p>
            ) : (
              <div className="space-y-2">
                {purchases.map((p: CustomerPurchase) => (
                  <div key={p.id} className="rounded-lg border bg-card p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-medium">{p.billNumber}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(p.billDate)} · {p.paymentMethod.toUpperCase()}</p>
                      </div>
                      <p className="text-sm font-semibold text-primary">{formatCurrency(p.totalAmount)}</p>
                    </div>
                    <div className="space-y-0.5">
                      {p.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-xs text-muted-foreground">
                          <span>{item.medicineName} × {item.quantity}</span>
                          <span>{formatCurrency(item.amount)}</span>
                        </div>
                      ))}
                    </div>
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

export function CustomersView() {
  const [addOpen, setAddOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(val), 300);
  }, []);

  const { data: stats } = useQuery({ queryKey: ['customer-stats'], queryFn: fetchCustomerStats });
  const { data: customers = [], isLoading } = useQuery({ queryKey: ['customers', debouncedSearch, typeFilter], queryFn: () => fetchCustomers(debouncedSearch, typeFilter) });

  function exportCSV() {
    const headers = ['Name', 'Phone', 'Email', 'Type', 'Visits', 'Total Spend', 'Loyalty Points', 'Credit Balance', 'Last Visit'];
    const rows = customers.map(c => [c.name, c.phone, c.email ?? '', c.customerType, c.totalVisits, c.totalSpend, c.loyaltyPoints, c.creditBalance, c.lastVisitDate ? formatDate(c.lastVisitDate) : ''].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `customers-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${customers.length} customers`);
  }

  const columns: ColumnDef<Customer>[] = [
    {
      id: 'customer',
      accessorFn: (row) => row.name,
      header: 'Customer',
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
              {c.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="font-medium text-sm">{c.name}</p>
                {c.customerType === 'vip' && <Crown className="h-3.5 w-3.5 text-amber-500" />}
              </div>
              {c.doctorName && <p className="text-xs text-muted-foreground">Dr. {c.doctorName}</p>}
            </div>
          </div>
        );
      },
    },
    {
      id: 'contact',
      header: 'Contact',
      cell: ({ row }) => (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-sm"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{row.original.phone}</div>
          {row.original.email && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="h-3 w-3" />{row.original.email}</div>}
        </div>
      ),
    },
    {
      accessorKey: 'customerType',
      header: 'Type',
      cell: ({ row }) => {
        const t = TYPE_LABEL[row.original.customerType] ?? DEFAULT_TYPE_INFO;
        return <Badge variant={t.variant} className="text-xs">{t.label}</Badge>;
      },
    },
    {
      accessorKey: 'totalSpend',
      header: ({ column }) => <SortableHeader column={column}>Total Spend</SortableHeader>,
      cell: ({ row }) => <span className="font-semibold tabular-nums">{formatCurrency(row.original.totalSpend)}</span>,
    },
    {
      accessorKey: 'totalVisits',
      header: ({ column }) => <SortableHeader column={column}>Visits</SortableHeader>,
      cell: ({ row }) => <span className="text-sm">{row.original.totalVisits}</span>,
    },
    {
      accessorKey: 'loyaltyPoints',
      header: 'Points',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
          <span className="text-sm font-medium">{row.original.loyaltyPoints.toLocaleString()}</span>
        </div>
      ),
    },
    {
      accessorKey: 'creditBalance',
      header: 'Credit Due',
      cell: ({ row }) => {
        const amt = row.original.creditBalance;
        return amt > 0
          ? <span className="font-medium text-warning-700 tabular-nums">{formatCurrency(amt)}</span>
          : <span className="text-muted-foreground text-xs">Nil</span>;
      },
    },
    {
      id: 'lastVisit',
      header: 'Last Visit',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.lastVisitDate ? formatDate(row.original.lastVisitDate) : 'Never'}
        </span>
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
            <DropdownMenuItem onClick={() => { setSelectedCustomer(row.original); setDetailOpen(true); }}>
              <Eye className="h-4 w-4" /> View Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              const c = row.original;
              if (!c.phone) { toast.error('No phone number on file for this customer'); return; }
              const digits = c.phone.replace(/\D/g, '');
              const full = digits.length === 10 ? `91${digits}` : digits;
              const msg = encodeURIComponent(`Dear ${c.name.split(' ')[0]},\n\nThis is a reminder from *Pharmacy* for your medicine refill. Please visit us or call to refill your prescription.\n\nThank you! 🙏`);
              window.open(`https://wa.me/${full}?text=${msg}`, '_blank');
            }}>
              <Phone className="h-4 w-4" /> Send Reminder
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setPaymentCustomer(row.original)}>
              <Wallet className="h-4 w-4" /> Record Payment
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const statCards = [
    { label: 'Total Customers', value: stats?.totalCustomers ?? 0, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'VIP Customers', value: stats?.vipCustomers ?? 0, icon: Crown, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950' },
    { label: 'Regular Customers', value: stats?.regularCustomers ?? 0, icon: TrendingUp, color: 'text-success', bg: 'bg-success/10' },
    { label: 'Walk-in Today', value: stats?.walkInToday ?? 0, icon: UserPlus, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950' },
    { label: 'Credit Customers', value: stats?.creditCustomers ?? 0, icon: CreditCard, color: 'text-warning-700', bg: 'bg-warning/10' },
    { label: 'Total Credit Due', value: formatCurrency(stats?.totalCreditOutstanding ?? 0), icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customer Management</h1>
          <p className="text-sm text-muted-foreground">Manage customer profiles, loyalty points, and credit accounts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Customer
          </Button>
        </div>
      </div>

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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search customers by name, phone, or email…" value={search} onChange={e => handleSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="vip">VIP</SelectItem>
            <SelectItem value="regular">Regular</SelectItem>
            <SelectItem value="credit">Credit</SelectItem>
            <SelectItem value="walk_in">Walk-in</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={customers}
        loading={isLoading}
        searchColumn="customer"
        searchPlaceholder="Filter customers…"
        emptyMessage="No customers found"
        emptyDescription="Add your first customer to start building profiles."
      />

      <AddCustomerDialog open={addOpen} onOpenChange={setAddOpen} />
      <CustomerDetailSheet customer={selectedCustomer} open={detailOpen} onOpenChange={setDetailOpen} />

      {/* Credit payment dialog */}
      <Dialog open={!!paymentCustomer} onOpenChange={(o) => { if (!o) setPaymentCustomer(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Record Credit Payment</DialogTitle>
          </DialogHeader>
          {paymentCustomer && (
            <CreditPaymentForm
              customer={paymentCustomer}
              onSuccess={() => setPaymentCustomer(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreditPaymentForm({ customer, onSuccess }: { customer: Customer; onSuccess: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [payMode, setPayMode] = useState('cash');
  const [ref, setRef] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const r = await apiFetch(`/api/customers/${customer.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount), paymentMode: payMode, referenceNumber: ref || undefined, paymentDate: new Date().toISOString() }),
      });
      const j = await r.json() as { success: boolean; message?: string };
      if (!j.success) throw new Error(j.message ?? 'Failed');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['customer-stats'] });
      toast.success('Credit payment recorded');
      onSuccess();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
        <p className="font-medium">{customer.name}</p>
        <p className="text-xs text-warning-700">Credit balance: {formatCurrency(customer.creditBalance ?? 0)}</p>
      </div>
      <div className="space-y-1">
        <Label>Amount Received (₹) <span className="text-destructive">*</span></Label>
        <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>Payment Mode</Label>
        <Select value={payMode} onValueChange={setPayMode}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="upi">UPI</SelectItem>
            <SelectItem value="neft">NEFT / Bank Transfer</SelectItem>
            <SelectItem value="cheque">Cheque</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Reference No.</Label>
        <Input placeholder="Optional" value={ref} onChange={(e) => setRef(e.target.value)} />
      </div>
      <DialogFooter>
        <Button variant="outline" type="button" onClick={onSuccess}>Cancel</Button>
        <Button disabled={!amount || Number(amount) <= 0 || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Saving…' : 'Record Payment'}
        </Button>
      </DialogFooter>
    </div>
  );
}

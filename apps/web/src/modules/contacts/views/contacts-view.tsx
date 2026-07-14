'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Users, Building2, Phone, Mail, MapPin, Plus, MoreHorizontal,
  Eye, ShoppingBag, CreditCard, TrendingUp, Star,
  Bell, MessageCircle, CheckCircle2, AlertCircle, Clock, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Customer, Vendor } from '@pharmaos/types';
import { formatCurrency, formatDate } from '@pharmaos/utils';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

// ─── API ─────────────────────────────────────────────────────────────────────

async function fetchCustomers(): Promise<Customer[]> {
  const r = await apiFetch('/api/customers?limit=200');
  const j = await r.json() as { success: boolean; data: { data: Customer[] } };
  if (!r.ok) throw new Error('Request failed');
  return j.data?.data ?? ([] as Customer[]);
}

async function fetchVendors(): Promise<Vendor[]> {
  const r = await apiFetch('/api/vendors?limit=200');
  const j = await r.json() as { success: boolean; data: { data: Vendor[] } };
  if (!r.ok) throw new Error('Request failed');
  return j.data?.data ?? ([] as Vendor[]);
}

interface RefillReminder {
  id: string; customerId: string; customerName: string; phone: string;
  medicine: string; generic: string; lastPurchaseDate: string; daysSupply: number;
  qty: number; doctorName: string | null; dueDate: string; daysOverdue: number;
  status: 'overdue' | 'due_today' | 'due_soon'; loyaltyPoints: number;
}

interface RefillData {
  reminders: RefillReminder[];
  summary: { overdue: number; dueToday: number; dueSoon: number; total: number };
}

async function fetchRefills(): Promise<RefillData> {
  const r = await apiFetch('/api/refills');
  const j = await r.json() as { success: boolean; data: RefillData };
  if (!r.ok) throw new Error('Request failed');
  return j.data ?? ({} as RefillData);
}

async function sendReminder(id: string): Promise<void> {
  await apiFetch(`/api/refills/${id}/remind`, { method: 'POST' });
}

// ─── Refill Reminders tab ─────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; variant: 'destructive' | 'warning' | 'secondary'; icon: React.ElementType }> = {
  overdue:   { label: 'Overdue',   variant: 'destructive', icon: AlertCircle },
  due_today: { label: 'Due Today', variant: 'warning',     icon: Clock },
  due_soon:  { label: 'Due Soon',  variant: 'secondary',   icon: Bell },
};

function RefillTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['refills'], queryFn: fetchRefills });

  const remindMutation = useMutation({
    mutationFn: sendReminder,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['refills'] });
      const r = data?.reminders.find((x) => x.id === id);
      toast.success(`Reminder sent to ${r?.customerName ?? 'customer'}`);
    },
  });

  function openWhatsApp(r: RefillReminder) {
    const digits = r.phone.replace(/\D/g, '');
    const full = digits.length === 10 ? `91${digits}` : digits;
    const due = r.status === 'overdue'
      ? `Your refill of *${r.medicine}* was due ${r.daysOverdue} day${r.daysOverdue !== 1 ? 's' : ''} ago.`
      : `Your refill of *${r.medicine}* is due today.`;
    const msg = encodeURIComponent(
      `Hello ${r.customerName.split(' ')[0]},\n\n${due} Please visit Divya Pharmacy or call us at +91-9876543210 to refill your prescription.\n\n_Divya Pharmacy, MG Road, Bangalore_`
    );
    window.open(`https://wa.me/${full}?text=${msg}`, '_blank');
    void remindMutation.mutateAsync(r.id);
  }

  function remindAllOverdue() {
    const overdue = data?.reminders.filter((r) => r.status === 'overdue') ?? [];
    if (overdue.length === 0) { toast.info('No overdue reminders'); return; }
    overdue.forEach((r) => void remindMutation.mutateAsync(r.id));
    toast.success(`${overdue.length} overdue reminders queued`, {
      description: 'WhatsApp messages will open in separate tabs.',
    });
    overdue.forEach((r) => {
      const digits = r.phone.replace(/\D/g, '');
      const full = digits.length === 10 ? `91${digits}` : digits;
      const msg = encodeURIComponent(
        `Hello ${r.customerName.split(' ')[0]},\n\nYour refill of *${r.medicine}* is overdue by ${r.daysOverdue} day${r.daysOverdue !== 1 ? 's' : ''}. Please visit us at Divya Pharmacy.\n\n_Divya Pharmacy, MG Road_`
      );
      window.open(`https://wa.me/${full}?text=${msg}`, '_blank');
    });
  }

  if (isLoading) return (
    <div className="space-y-2 pt-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-16 rounded-xl border border-border bg-muted/30 animate-pulse" />
      ))}
    </div>
  );

  const { reminders = [], summary = { overdue: 0, dueToday: 0, dueSoon: 0, total: 0 } } = data ?? {};

  return (
    <div className="space-y-4 pt-4">
      {/* Summary strip */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'Overdue', count: summary.overdue, icon: AlertCircle, color: 'border-destructive/20 bg-destructive/5 text-destructive' },
          { label: 'Due Today', count: summary.dueToday, icon: Clock, color: 'border-warning/20 bg-warning/5 text-warning-600' },
          { label: 'Due Soon', count: summary.dueSoon, icon: Bell, color: 'border-blue-200 bg-blue-50/50 text-blue-600' },
          { label: 'Total', count: summary.total, icon: Users, color: 'border-border bg-muted/30 text-muted-foreground' },
        ].map(({ label, count, icon: Icon, color }) => (
          <div key={label} className={cn('flex items-center gap-2 rounded-xl border px-4 py-2.5', color)}>
            <Icon className="h-4 w-4 shrink-0" />
            <div>
              <p className="text-lg font-bold leading-none">{count}</p>
              <p className="text-xs mt-0.5">{label}</p>
            </div>
          </div>
        ))}
        <div className="ml-auto flex items-center">
          <button
            onClick={remindAllOverdue}
            disabled={summary.overdue === 0}
            className="flex items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Remind All Overdue ({summary.overdue})
          </button>
        </div>
      </div>

      {/* Reminders table */}
      {reminders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle2 className="h-10 w-10 text-success/50 mb-3" />
          <p className="font-medium text-sm">All caught up!</p>
          <p className="text-xs text-muted-foreground mt-1">No refill reminders pending.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] border-b border-border bg-muted/30 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider gap-3">
            <span>Customer</span>
            <span>Medicine</span>
            <span>Due Date</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          <div className="divide-y divide-border">
            {reminders.map((r) => {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              const cfg = (STATUS_CFG[r.status] ?? STATUS_CFG['due_soon'])!;
              const StatusIcon = cfg.icon;
              return (
                <div key={r.id} className="grid grid-cols-[1fr_1fr_auto_auto_auto] items-center px-4 py-3 gap-3 hover:bg-muted/20 transition-colors">
                  <div>
                    <p className="text-sm font-semibold">{r.customerName}</p>
                    <p className="text-xs text-muted-foreground">{r.phone}</p>
                    {r.loyaltyPoints > 0 && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Star className="h-2.5 w-2.5 fill-warning-400 text-warning-400" />
                        <span className="text-[10px] text-warning-600 font-medium">{r.loyaltyPoints} pts</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{r.medicine}</p>
                    <p className="text-xs text-muted-foreground">{r.generic} · {r.qty} units</p>
                    {r.doctorName && <p className="text-xs text-muted-foreground">{r.doctorName}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm tabular-nums">{formatDate(r.dueDate)}</p>
                    {r.daysOverdue > 0 && (
                      <p className="text-xs text-destructive font-medium">{r.daysOverdue}d overdue</p>
                    )}
                    {r.daysOverdue < 0 && (
                      <p className="text-xs text-muted-foreground">in {Math.abs(r.daysOverdue)}d</p>
                    )}
                  </div>
                  <div>
                    <span className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                      r.status === 'overdue' ? 'bg-destructive/10 text-destructive' :
                      r.status === 'due_today' ? 'bg-warning/10 text-warning-600' :
                      'bg-muted text-muted-foreground'
                    )}>
                      <StatusIcon className="h-2.5 w-2.5" />
                      {cfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openWhatsApp(r)}
                      title="Send WhatsApp reminder"
                      className="flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2 py-1.5 text-[11px] font-medium text-green-700 hover:bg-green-100 transition-colors"
                    >
                      <MessageCircle className="h-3 w-3" />
                      WA
                    </button>
                    <button
                      onClick={() => void remindMutation.mutateAsync(r.id)}
                      title="Mark as reminded"
                      className="flex items-center gap-1 rounded-lg border border-border bg-muted px-2 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted/70 transition-colors"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Done
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({ label, value, icon: Icon, colorClass }: {
  label: string; value: string | number | undefined; icon: React.ElementType; colorClass: string;
}) {
  return (
    <div className={cn('flex items-center gap-2.5 rounded-xl border px-4 py-2.5', colorClass)}>
      <Icon className="h-4 w-4 shrink-0" />
      <div>
        <p className="text-lg font-bold leading-none">{value ?? '—'}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ─── Customer status badge ────────────────────────────────────────────────────

const CUST_STATUS: Record<string, { label: string; variant: 'success' | 'muted' | 'warning' }> = {
  active: { label: 'Active', variant: 'success' },
  inactive: { label: 'Inactive', variant: 'muted' },
  vip: { label: 'VIP', variant: 'warning' },
};

const VENDOR_STATUS: Record<string, { label: string; variant: 'success' | 'muted' | 'destructive' }> = {
  active: { label: 'Active', variant: 'success' },
  inactive: { label: 'Inactive', variant: 'muted' },
  blacklisted: { label: 'Blacklisted', variant: 'destructive' },
};

// ─── Main view ────────────────────────────────────────────────────────────────

export function ContactsView() {
  const router = useRouter();
  const [tab, setTab] = useState<'customers' | 'vendors' | 'refills'>('customers');

  const { data: customers = [], isLoading: custLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: fetchCustomers,
  });

  const { data: vendors = [], isLoading: vendLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: fetchVendors,
  });

  const activeCustomers = customers.filter((c) => c.status === 'active').length;
  const activeVendors = vendors.filter((v) => v.status === 'active').length;
  const totalOutstanding = vendors.reduce((s, v) => s + ((v as unknown as Record<string, number>).outstandingAmount ?? 0), 0);

  const customerColumns: ColumnDef<Customer>[] = [
    {
      accessorKey: 'name',
      header: 'Customer',
      cell: ({ row }) => {
        const c = row.original;
        const initials = c.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {initials}
            </div>
            <div>
              <p className="font-semibold text-sm">{c.name}</p>
              {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'totalPurchases',
      header: ({ column }) => <SortableHeader column={column}>Total Purchases</SortableHeader>,
      cell: ({ row }) => {
        const v = (row.original as unknown as Record<string, number>).totalPurchases;
        return <span className="font-semibold text-sm">{v !== undefined ? formatCurrency(v) : '—'}</span>;
      },
    },
    {
      accessorKey: 'lastVisit',
      header: ({ column }) => <SortableHeader column={column}>Last Visit</SortableHeader>,
      cell: ({ row }) => {
        const v = (row.original as unknown as Record<string, string>).lastVisit;
        return <span className="text-xs text-muted-foreground">{v ? formatDate(v) : '—'}</span>;
      },
    },
    {
      accessorKey: 'loyaltyPoints',
      header: 'Loyalty',
      cell: ({ row }) => {
        const pts = (row.original as unknown as Record<string, number>).loyaltyPoints ?? 0;
        return pts > 0 ? (
          <div className="flex items-center gap-1 text-xs text-warning-600 font-semibold">
            <Star className="h-3 w-3 fill-warning-400 text-warning-400" />
            {pts} pts
          </div>
        ) : <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const cfg = CUST_STATUS[row.original.status ?? 'active'] ?? CUST_STATUS['active']!;
        return <Badge variant={cfg!.variant} dot className="text-xs">{cfg!.label}</Badge>;
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
            <DropdownMenuItem><Eye className="h-4 w-4" /> View History</DropdownMenuItem>
            <DropdownMenuItem><ShoppingBag className="h-4 w-4" /> New Bill</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive"><span>Deactivate</span></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const vendorColumns: ColumnDef<Vendor>[] = [
    {
      accessorKey: 'name',
      header: 'Vendor',
      cell: ({ row }) => {
        const v = row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-xs font-bold text-blue-600">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-sm">{v.name}</p>
              {v.contactPerson && <p className="text-xs text-muted-foreground">{v.contactPerson}</p>}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'phone',
      header: 'Contact',
      cell: ({ row }) => (
        <div className="text-xs">
          {row.original.phone && <div className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" />{row.original.phone}</div>}
          {row.original.email && <div className="flex items-center gap-1 text-muted-foreground mt-0.5"><Mail className="h-3 w-3" />{row.original.email}</div>}
        </div>
      ),
    },
    {
      accessorKey: 'city',
      header: 'Location',
      cell: ({ row }) => {
        const city = (row.original as unknown as Record<string, string>).city;
        return city ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />{city}
          </div>
        ) : <span className="text-muted-foreground">—</span>;
      },
    },
    {
      id: 'outstanding',
      header: ({ column }) => <SortableHeader column={column}>Outstanding</SortableHeader>,
      cell: ({ row }) => {
        const amt = (row.original as unknown as Record<string, number>).outstandingAmount ?? 0;
        return (
          <span className={cn('text-sm font-semibold tabular-nums', amt > 0 ? 'text-destructive' : 'text-muted-foreground')}>
            {amt > 0 ? formatCurrency(amt) : '—'}
          </span>
        );
      },
    },
    {
      id: 'paymentTerms',
      header: 'Credit Days',
      cell: ({ row }) => {
        const days = (row.original as unknown as Record<string, number>).paymentTerms ?? 0;
        return <span className="text-xs font-medium">{days > 0 ? `${days} days` : 'Cash'}</span>;
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const cfg = VENDOR_STATUS[(row.original as unknown as Record<string, string>).status ?? 'active'] ?? VENDOR_STATUS['active']!;
        return <Badge variant={cfg!.variant} dot className="text-xs">{cfg!.label}</Badge>;
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
            <DropdownMenuItem><Eye className="h-4 w-4" /> View Invoices</DropdownMenuItem>
            <DropdownMenuItem><CreditCard className="h-4 w-4" /> Record Payment</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive"><span>Deactivate</span></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground">Manage customers and suppliers in one place</p>
        </div>
        <Button size="sm" onClick={() => router.push(tab === 'customers' ? '/customers' : '/vendors')}>
          <Plus className="h-4 w-4" />
          {tab === 'customers' ? 'Add Customer' : 'Add Vendor'}
        </Button>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-3">
        <StatChip icon={Users} label="Total Customers" value={customers.length} colorClass="border-primary/20 bg-primary/5 text-primary" />
        <StatChip icon={TrendingUp} label="Active Customers" value={activeCustomers} colorClass="border-success/30 bg-success/5 text-success" />
        <StatChip icon={Building2} label="Total Vendors" value={vendors.length} colorClass="border-blue-500/20 bg-blue-50/50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" />
        <StatChip icon={CreditCard} label="Outstanding" value={totalOutstanding > 0 ? formatCurrency(totalOutstanding) : '₹0'} colorClass={totalOutstanding > 0 ? 'border-destructive/20 bg-destructive/5 text-destructive' : 'border-border bg-muted/30 text-muted-foreground'} />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="border-b border-border bg-transparent p-0 h-auto rounded-none w-full justify-start gap-0">
          {[
            { value: 'customers', label: 'Customers', icon: Users, count: customers.length },
            { value: 'vendors', label: 'Vendors', icon: Building2, count: vendors.length },
            { value: 'refills', label: 'Refill Reminders', icon: Bell, count: null as number | null },
          ].map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="rounded-none border-b-2 border-transparent px-4 pb-3 pt-0 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary gap-2"
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              {t.count !== null && (
                <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {t.count}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="customers" className="pt-4">
          <DataTable
            columns={customerColumns}
            data={customers}
            loading={custLoading}
            searchColumn="name"
            searchPlaceholder="Search by name or phone…"
            emptyMessage="No customers yet"
            emptyDescription="Add your first customer or import a list from Excel in Settings › Import."
          />
        </TabsContent>

        <TabsContent value="vendors" className="pt-4">
          <DataTable
            columns={vendorColumns}
            data={vendors}
            loading={vendLoading}
            searchColumn="name"
            searchPlaceholder="Search by vendor name or contact…"
            emptyMessage="No vendors added"
            emptyDescription="Add suppliers to track purchases and outstanding payments."
          />
        </TabsContent>

        <TabsContent value="refills">
          <RefillTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

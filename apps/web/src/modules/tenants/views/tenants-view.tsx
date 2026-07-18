'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, Users, Package, TrendingUp, MapPin, Phone, Mail, Calendar, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type { Tenant } from '@pharmaos/types';
import { formatCurrency, formatDate } from '@pharmaos/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

async function fetchTenants(search: string): Promise<Tenant[]> {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  const res = await apiFetch(`/api/tenants?${params}`);
  const json = await res.json() as { success: boolean; data: { data: Tenant[] } };
  return json.data.data;
}

const STATUS_CONFIG = {
  active: { label: 'Active', variant: 'success' as const, icon: CheckCircle },
  suspended: { label: 'Suspended', variant: 'error' as const, icon: XCircle },
  trial: { label: 'Trial', variant: 'warning' as const, icon: Clock },
  pending_verification: { label: 'Pending', variant: 'muted' as const, icon: AlertTriangle },
  expired: { label: 'Expired', variant: 'error' as const, icon: XCircle },
};

const PLAN_CONFIG = {
  starter: { label: 'Starter', color: 'text-muted-foreground' },
  professional: { label: 'Professional', color: 'text-primary' },
  enterprise: { label: 'Enterprise', color: 'text-purple-600' },
};

export function TenantsView() {
  const [search, setSearch] = useState('');

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['tenants', search],
    queryFn: () => fetchTenants(search),
  });

  const stats = {
    total: tenants.length,
    active: tenants.filter((t) => t.status === 'active').length,
    trial: tenants.filter((t) => t.status === 'trial').length,
    suspended: tenants.filter((t) => t.status === 'suspended').length,
    totalRevenue: tenants.reduce((s, t) => s + (t.stats?.monthlyRevenue ?? 0), 0),
  };

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tenants</h1>
          <p className="text-sm text-muted-foreground">Manage pharmacy tenants, plans, and subscriptions</p>
        </div>
        <Button size="sm" onClick={() => toast.info('New tenant registration — contact super admin')}>
          <Building2 className="h-4 w-4" /> Add Tenant
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: 'Total', value: String(stats.total), color: 'text-primary' },
          { label: 'Active', value: String(stats.active), color: 'text-success' },
          { label: 'Trial', value: String(stats.trial), color: 'text-warning-600' },
          { label: 'Suspended', value: String(stats.suspended), color: 'text-destructive' },
          { label: 'Monthly Revenue', value: formatCurrency(stats.totalRevenue), color: 'text-primary' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-border bg-card px-4 py-3">
            <p className={cn('text-lg font-bold', color)}>{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <Input
        placeholder="Search by pharmacy name or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {/* Tenants cards */}
      <div className="space-y-4">
        {tenants.map((tenant) => {
          const statusCfg = STATUS_CONFIG[tenant.status] ?? STATUS_CONFIG.suspended;
          const planCfg = PLAN_CONFIG[tenant.plan] ?? PLAN_CONFIG.starter;
          const StatusIcon = statusCfg.icon;

          return (
            <div key={tenant.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-lg leading-tight">{tenant.name}</h3>
                      <Badge variant={statusCfg.variant} className="text-xs capitalize">{statusCfg.label}</Badge>
                      <span className={cn('text-xs font-semibold', planCfg.color)}>{planCfg.label}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground capitalize">{tenant.type.replace('_', ' ')} pharmacy</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {tenant.address.city}, {tenant.address.state}</span>
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {tenant.phone}</span>
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {tenant.email}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => toast.info(`Managing ${tenant.name}`)}>Manage</Button>
                  {tenant.status === 'active' && (
                    <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => toast.success(`${tenant.name} suspended`)}>
                      Suspend
                    </Button>
                  )}
                  {tenant.status === 'suspended' && (
                    <Button size="sm" onClick={() => toast.success(`${tenant.name} reactivated`)}>
                      Reactivate
                    </Button>
                  )}
                </div>
              </div>

              {/* Stats row */}
              {tenant.stats && (
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-5">
                  {[
                    { label: 'Users', value: tenant.stats.totalUsers, icon: Users },
                    { label: 'Medicines', value: tenant.stats.totalMedicines, icon: Package },
                    { label: 'Stock Batches', value: tenant.stats.totalInventoryItems, icon: Package },
                    { label: 'Monthly Revenue', value: formatCurrency(tenant.stats.monthlyRevenue), icon: TrendingUp },
                    { label: 'Storage', value: `${tenant.stats.storageUsedMb} MB`, icon: Package },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-semibold">{value}</p>
                        <p className="text-[10px] text-muted-foreground">{label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* License info */}
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                <span>License: <span className="text-foreground">{tenant.licenseNumber}</span></span>
                {tenant.gstNumber && <span>GST: <span className="text-foreground">{tenant.gstNumber}</span></span>}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Drug license expires: <span className={cn('ml-1', new Date(tenant.drugLicenseExpiry) < new Date() ? 'text-destructive font-medium' : 'text-foreground')}>{formatDate(tenant.drugLicenseExpiry)}</span>
                </span>
              </div>
            </div>
          );
        })}

        {tenants.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <Building2 className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="font-medium text-muted-foreground">No tenants found</p>
            <p className="text-sm text-muted-foreground">Try a different search term</p>
          </div>
        )}
      </div>
    </div>
  );
}

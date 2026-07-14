'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldCheck, AlertTriangle, Users, Activity, Search,
  Download, Monitor, Lock, FileText, Clock, CheckCircle2, XCircle,
  Eye, Package, ShoppingCart, Building2, Settings, LogIn,
} from 'lucide-react';
import { formatDateTime } from '@pharmaos/utils';
import type { AuditLog, AuditStats, UserSession } from '@pharmaos/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

async function fetchAuditStats(): Promise<AuditStats> {
  const res = await apiFetch('/api/audit/stats');
  const json = await res.json() as { success: boolean; data: AuditStats };
  if (!res.ok) throw new Error('Request failed');
  return json.data ?? ({} as AuditStats);
}

async function fetchAuditLogs(filters: { module?: string; action?: string; severity?: string; search?: string; page?: number }): Promise<{ data: AuditLog[]; total: number }> {
  const params = new URLSearchParams();
  if (filters.module && filters.module !== 'all') params.set('module', filters.module);
  if (filters.action && filters.action !== 'all') params.set('action', filters.action);
  if (filters.severity && filters.severity !== 'all') params.set('severity', filters.severity);
  if (filters.search) params.set('search', filters.search);
  params.set('page', String(filters.page ?? 1));
  params.set('limit', '20');
  const res = await apiFetch(`/api/audit?${params}`);
  const json = await res.json() as { success: boolean; data: { data: AuditLog[]; total: number } };
  if (!res.ok) throw new Error('Request failed');
  return json.data ?? { data: [], total: 0 };
}

async function fetchSessions(): Promise<UserSession[]> {
  const res = await apiFetch('/api/audit/sessions');
  const json = await res.json() as { success: boolean; data: { data: UserSession[] } };
  if (!res.ok) throw new Error('Request failed');
  return json.data?.data ?? ([] as UserSession[]);
}

const MODULE_ICONS: Record<string, React.ElementType> = {
  billing: ShoppingCart,
  inventory: Package,
  medicine: FileText,
  vendor: Building2,
  user: Users,
  settings: Settings,
  auth: Lock,
  report: Eye,
  customer: Users,
  reorder: Package,
};

const MODULE_COLORS: Record<string, string> = {
  billing: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  inventory: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  medicine: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  vendor: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  user: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
  settings: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  auth: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  report: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  customer: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300',
  reorder: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
};

function AuditLogRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const ModIcon = MODULE_ICONS[log.module] ?? Activity;
  const moduleColor = MODULE_COLORS[log.module] ?? 'bg-muted text-muted-foreground';

  const severityIcon = { info: <CheckCircle2 className="h-3.5 w-3.5 text-success" />, warning: <AlertTriangle className="h-3.5 w-3.5 text-warning-600" />, critical: <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> };
  const statusIcon = { success: <CheckCircle2 className="h-3.5 w-3.5 text-success" />, failed: <XCircle className="h-3.5 w-3.5 text-destructive" />, blocked: <XCircle className="h-3.5 w-3.5 text-warning-600" /> };

  return (
    <div className={cn('rounded-lg border bg-card p-3 transition-all', log.severity === 'critical' && 'border-destructive/30 bg-destructive/5')}>
      <div className="flex items-start gap-3">
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs', moduleColor)}>
          <ModIcon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{log.module}</span>
            <span className="text-muted-foreground text-xs">·</span>
            <Badge variant={log.severity === 'critical' ? 'destructive' : log.severity === 'warning' ? 'warning' : 'secondary'} className="text-[10px] px-1.5 py-0">
              {log.action.replace('_', ' ')}
            </Badge>
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              {statusIcon[log.status]}
              <span className="capitalize">{log.status}</span>
            </span>
          </div>
          <p className="text-sm mt-0.5">{log.description}</p>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{log.userName} <span className="opacity-60">({log.userRole})</span></span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDateTime(log.createdAt)}</span>
            {log.ipAddress && <span className="flex items-center gap-1"><Monitor className="h-3 w-3" />{log.ipAddress}</span>}
          </div>
          {(log.beforeValue || log.afterValue) && (
            <button className="mt-2 text-xs text-primary hover:underline" onClick={() => setExpanded(!expanded)}>
              {expanded ? 'Hide' : 'Show'} before/after values
            </button>
          )}
          {expanded && (log.beforeValue || log.afterValue) && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {log.beforeValue && (
                <div className="rounded bg-destructive/10 p-2">
                  <p className="text-[10px] font-semibold uppercase text-destructive/70 mb-1">Before</p>
                  <pre className="text-xs text-destructive/80 whitespace-pre-wrap">{JSON.stringify(log.beforeValue, null, 2)}</pre>
                </div>
              )}
              {log.afterValue && (
                <div className="rounded bg-success/10 p-2">
                  <p className="text-[10px] font-semibold uppercase text-success/70 mb-1">After</p>
                  <pre className="text-xs text-success/80 whitespace-pre-wrap">{JSON.stringify(log.afterValue, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="shrink-0">{severityIcon[log.severity]}</div>
      </div>
    </div>
  );
}

function SessionRow({ session }: { session: UserSession }) {
  const duration = session.logoutAt
    ? Math.round((new Date(session.logoutAt).getTime() - new Date(session.loginAt).getTime()) / 60000)
    : Math.round((Date.now() - new Date(session.loginAt).getTime()) / 60000);

  return (
    <div className={cn('flex items-center justify-between rounded-lg border bg-card p-3', session.isActive && 'border-success/30 bg-success/5')}>
      <div className="flex items-center gap-3">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-full font-bold text-sm', session.isActive ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground')}>
          {session.userName.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{session.userName}</p>
            <Badge variant="secondary" className="text-xs">{session.userRole}</Badge>
            {session.isActive && <Badge variant="success" dot className="text-xs">Active</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            Login: {formatDateTime(session.loginAt)} · {session.deviceInfo ?? 'Unknown Device'}
          </p>
          {session.ipAddress && <p className="text-xs text-muted-foreground">IP: {session.ipAddress}</p>}
        </div>
      </div>
      <div className="text-right text-xs text-muted-foreground">
        <p>{session.actionsCount} actions</p>
        <p>{duration >= 60 ? `${Math.floor(duration / 60)}h ${duration % 60}m` : `${duration}m`} {session.isActive ? 'online' : 'session'}</p>
      </div>
    </div>
  );
}

export function AuditView() {
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');

  const { data: stats } = useQuery({ queryKey: ['audit-stats'], queryFn: fetchAuditStats });
  const { data: logsResult = { data: [], total: 0 }, isLoading } = useQuery({
    queryKey: ['audit-logs', moduleFilter, actionFilter, severityFilter, search],
    queryFn: () => fetchAuditLogs({ module: moduleFilter, action: actionFilter, severity: severityFilter, search }),
  });
  const { data: sessions = [] } = useQuery({ queryKey: ['audit-sessions'], queryFn: fetchSessions });

  function exportAuditCSV() {
    const headers = ['Time', 'User', 'Role', 'Module', 'Action', 'Status', 'Severity', 'Description', 'IP'];
    const rows = logsResult.data.map(l => [formatDateTime(l.createdAt), l.userName, l.userRole, l.module, l.action, l.status, l.severity, `"${l.description}"`, l.ipAddress ?? ''].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${logsResult.data.length} audit entries`);
  }

  const statCards = [
    { label: 'Logs Today', value: stats?.totalLogsToday ?? 0, icon: Activity, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Critical Actions', value: stats?.criticalActions ?? 0, icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10' },
    { label: 'Failed Actions', value: stats?.failedActions ?? 0, icon: XCircle, color: 'text-warning-700', bg: 'bg-warning/10' },
    { label: 'Active Users', value: stats?.activeUsers ?? 0, icon: Users, color: 'text-success', bg: 'bg-success/10' },
    { label: 'Sensitive Actions', value: stats?.sensitiveActionsToday ?? 0, icon: ShieldCheck, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950' },
    { label: 'Total Sessions', value: stats?.totalSessions ?? 0, icon: Monitor, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit & Security</h1>
          <p className="text-sm text-muted-foreground">Complete operational activity trail — tamper-proof accountability</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportAuditCSV}>
          <Download className="h-4 w-4" /> Export Logs
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', bg)}>
              <Icon className={cn('h-4 w-4', color)} />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold leading-tight">{value}</p>
              <p className="text-xs text-muted-foreground leading-tight">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="logs">
        <TabsList>
          <TabsTrigger value="logs">Activity Logs</TabsTrigger>
          <TabsTrigger value="sessions">
            User Sessions
            <Badge variant={sessions.filter(s => s.isActive).length > 0 ? 'success' : 'secondary'} className="ml-1.5 h-4 min-w-4 justify-center p-0 text-[10px]">
              {sessions.filter(s => s.isActive).length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-56">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search audit logs…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Module" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                <SelectItem value="billing">Billing</SelectItem>
                <SelectItem value="inventory">Inventory</SelectItem>
                <SelectItem value="vendor">Vendor</SelectItem>
                <SelectItem value="medicine">Medicine</SelectItem>
                <SelectItem value="user">User Mgmt</SelectItem>
                <SelectItem value="auth">Auth</SelectItem>
                <SelectItem value="settings">Settings</SelectItem>
                <SelectItem value="report">Reports</SelectItem>
                <SelectItem value="customer">Customers</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Severity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{logsResult.total} log entries</p>
          </div>

          {isLoading ? (
            <div className="text-center py-16 text-muted-foreground">Loading audit logs…</div>
          ) : logsResult.data.length === 0 ? (
            <div className="rounded-xl border border-border bg-card py-16 text-center">
              <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="font-medium">No logs found</p>
              <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logsResult.data.map(log => (
                <AuditLogRow key={log.id} log={log} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sessions" className="mt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex h-2 w-2 rounded-full bg-success animate-pulse" />
            {sessions.filter(s => s.isActive).length} active session{sessions.filter(s => s.isActive).length !== 1 ? 's' : ''}
          </div>
          {sessions.map(session => (
            <SessionRow key={session.id} session={session} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

'use client';

import React, { useState, useRef } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle, Clock, AlertTriangle, HardDrive, Upload, Download, Trash2, Package } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@pharmaos/utils';
import { useOffline } from '@/hooks/use-offline';
import { syncQueue } from '@/lib/offline-sync';
import { getQueue, clearSynced, removeOp, offlineStorageBytes, getCatalog, type QueuedOp } from '@/lib/offline';

const STATUS_META: Record<QueuedOp['status'], { label: string; icon: React.ElementType; cls: string; badge: 'warning' | 'success' | 'destructive' | 'secondary' }> = {
  pending: { label: 'Pending', icon: Clock, cls: 'bg-warning/10 text-warning-600', badge: 'warning' },
  syncing: { label: 'Syncing', icon: RefreshCw, cls: 'bg-primary/10 text-primary', badge: 'secondary' },
  synced: { label: 'Synced', icon: CheckCircle, cls: 'bg-success/10 text-success', badge: 'success' },
  failed: { label: 'Failed', icon: AlertTriangle, cls: 'bg-destructive/10 text-destructive', badge: 'destructive' },
};

export function OfflineView() {
  const { online, queue } = useOffline();
  const [syncing, setSyncing] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pending = queue.filter((q) => q.status === 'pending' || q.status === 'failed' || q.status === 'syncing').length;
  const synced = queue.filter((q) => q.status === 'synced').length;
  const failed = queue.filter((q) => q.status === 'failed').length;
  const cat = getCatalog();
  const storageKb = (offlineStorageBytes() / 1024).toFixed(1);

  async function handleSync() {
    if (!online) { toast.warning('Still offline — will sync automatically when the connection returns'); return; }
    setSyncing(true);
    const r = await syncQueue();
    setSyncing(false);
    if (r.synced > 0) toast.success(`Synced ${r.synced} record${r.synced === 1 ? '' : 's'}`);
    else if (r.failed > 0) toast.error(`${r.failed} record(s) were rejected — review them below`);
    else toast.success('Everything is already up to date');
  }

  function handleExport() {
    const payload = { exportedAt: new Date().toISOString(), queue: getQueue(), version: '2.0' };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `pharmaos-offline-queue-${new Date().toISOString().split('T')[0]}.json`,
    });
    a.click();
    toast.success('Offline queue exported');
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { JSON.parse(reader.result as string); toast.success(`Backup read: ${file.name}`, { description: 'Review before syncing.' }); }
      catch { toast.error('Invalid backup file — could not parse JSON'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleClearSynced() { clearSynced(); toast.success('Cleared synced records'); }
  function handleClearAll() {
    if (!clearConfirm) { setClearConfirm(true); return; }
    getQueue().forEach((q) => removeOp(q.id));
    setClearConfirm(false);
    toast.success('Offline queue cleared');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Offline Mode</h1>
          <p className="text-sm text-muted-foreground">Bills made without internet are saved here and sync automatically when you&apos;re back online</p>
        </div>
        <Button onClick={handleSync} disabled={syncing || pending === 0 || !online} className="gap-2">
          <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
          {syncing ? 'Syncing…' : 'Sync Now'}
        </Button>
      </div>

      {/* Connection status */}
      <div className={cn('flex items-center gap-3 rounded-xl border p-4', online ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5')}>
        {online ? <Wifi className="h-5 w-5 text-success" /> : <WifiOff className="h-5 w-5 text-destructive" />}
        <div>
          <p className={cn('font-semibold', online ? 'text-success-700' : 'text-destructive')}>
            {online ? 'Connected — Online' : 'Offline — Working Locally'}
          </p>
          <p className="text-xs text-muted-foreground">
            {online
              ? (pending > 0 ? `${pending} record(s) waiting to sync` : 'All records are synced')
              : 'New bills are being saved on this device and will sync when the connection returns'}
          </p>
        </div>
        <Badge variant={online ? 'success' : 'destructive'} className="ml-auto">{online ? 'Online' : 'Offline'}</Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Pending Sync', value: String(pending), icon: Clock, color: pending > 0 ? 'text-warning-600' : 'text-muted-foreground', bg: pending > 0 ? 'bg-warning/10' : 'bg-muted' },
          { label: 'Synced', value: String(synced), icon: CheckCircle, color: 'text-success', bg: 'bg-success/10' },
          { label: 'Cached Catalogue', value: cat ? `${(cat.medicines as unknown[]).length} meds` : '—', icon: Package, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Local Storage', value: `${storageKb} KB`, icon: HardDrive, color: 'text-muted-foreground', bg: 'bg-muted' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', bg)}><Icon className={cn('h-4 w-4', color)} /></div>
            <div><p className="text-base font-bold leading-tight">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>
          </div>
        ))}
      </div>

      {failed > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-xs text-destructive">{failed} bill(s) were rejected by the server on sync (e.g. stock changed while offline). Review each below and re-enter it in Billing if needed, then remove it from the queue.</p>
        </div>
      )}

      {/* Sync queue */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Sync Queue</CardTitle>
            <CardDescription>Bills saved offline, waiting to reach the server</CardDescription>
          </div>
          {synced > 0 && <Button variant="ghost" size="sm" className="text-xs" onClick={handleClearSynced}>Clear synced</Button>}
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <CheckCircle className="mx-auto mb-2 h-8 w-8 text-success" />
              <p className="text-sm">Nothing queued — all sales are on the server</p>
            </div>
          ) : (
            <div className="space-y-2">
              {queue.slice().reverse().map((item) => {
                const m = STATUS_META[item.status];
                const Icon = m.icon;
                return (
                  <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
                    <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', m.cls)}>
                      <Icon className={cn('h-4 w-4', item.status === 'syncing' && 'animate-spin')} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.type} · {formatDateTime(item.createdAt)}
                        {item.billNumber ? ` · ${item.billNumber}` : ''}
                        {item.error ? ` · ${item.error}` : ''}
                      </p>
                    </div>
                    <Badge variant={m.badge} className="shrink-0 text-xs">{m.label}</Badge>
                    {(item.status === 'synced' || item.status === 'failed') && (
                      <button onClick={() => removeOp(item.id)} title="Remove from queue" className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data management */}
      <Card>
        <CardHeader>
          <CardTitle>Local Data</CardTitle>
          <CardDescription>Back up or clear the offline queue on this device</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div><p className="text-sm font-medium">Export Queue</p><p className="text-xs text-muted-foreground">Download the pending queue as a JSON backup</p></div>
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4" /> Export</Button>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div><p className="text-sm font-medium">Import Queue</p><p className="text-xs text-muted-foreground">Read a previously exported backup (.json)</p></div>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4" /> Import</Button>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <div>
              <p className="text-sm font-medium text-destructive">Clear Offline Queue</p>
              <p className="text-xs text-muted-foreground">{clearConfirm ? 'Click again to confirm — unsynced bills will be lost.' : 'Remove all queued records. Unsynced bills cannot be recovered.'}</p>
            </div>
            <Button variant="destructive" size="sm" onClick={handleClearAll}>{clearConfirm ? 'Confirm Clear' : 'Clear Queue'}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

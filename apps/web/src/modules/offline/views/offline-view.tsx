'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle, Clock, AlertTriangle, HardDrive, Upload, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@pharmaos/utils';

const MOCK_SYNC_QUEUE = [
  { id: 'sq_001', type: 'billing', action: 'CREATE', description: 'Bill INV000047 — Anjali Verma', timestamp: new Date(Date.now() - 3 * 60000).toISOString(), status: 'pending' },
  { id: 'sq_002', type: 'inventory', action: 'UPDATE', description: 'Stock adjustment — Paracetamol 500mg', timestamp: new Date(Date.now() - 8 * 60000).toISOString(), status: 'pending' },
  { id: 'sq_003', type: 'billing', action: 'CREATE', description: 'Bill INV000046 — Walk-in Customer', timestamp: new Date(Date.now() - 15 * 60000).toISOString(), status: 'synced' },
];

export function OfflineView() {
  const [isOnline, setIsOnline] = useState(true);
  const [lastSync, setLastSync] = useState<string>(new Date().toISOString());
  const [syncing, setSyncing] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function update() { setIsOnline(navigator.onLine); }
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  async function handleSync() {
    setSyncing(true);
    await new Promise((r) => setTimeout(r, 1800));
    setLastSync(new Date().toISOString());
    setSyncing(false);
    toast.success('Sync completed — all records up to date');
  }

  function handleExport() {
    const payload = { exportedAt: new Date().toISOString(), syncQueue: MOCK_SYNC_QUEUE, version: '1.0' };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pharmaos-offline-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Offline data exported successfully');
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        JSON.parse(reader.result as string);
        toast.success(`Backup imported: ${file.name}`, { description: 'Local data restored successfully.' });
      } catch {
        toast.error('Invalid backup file — could not parse JSON');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleClearCache() {
    if (!clearConfirm) { setClearConfirm(true); return; }
    localStorage.clear();
    setClearConfirm(false);
    toast.success('Local cache cleared', { description: 'All locally stored data has been removed.' });
  }

  const pendingCount = MOCK_SYNC_QUEUE.filter((i) => i.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Offline Mode</h1>
          <p className="text-sm text-muted-foreground">Manage offline data, sync queue, and local storage</p>
        </div>
        <Button onClick={handleSync} disabled={syncing || !isOnline} className="gap-2">
          <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
          {syncing ? 'Syncing…' : 'Sync Now'}
        </Button>
      </div>

      {/* Connection status banner */}
      <div className={cn(
        'flex items-center gap-3 rounded-xl border p-4',
        isOnline ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'
      )}>
        {isOnline
          ? <Wifi className="h-5 w-5 text-success" />
          : <WifiOff className="h-5 w-5 text-destructive" />}
        <div>
          <p className={cn('font-semibold', isOnline ? 'text-success-700' : 'text-destructive')}>
            {isOnline ? 'Connected — Online Mode Active' : 'Offline — Working Locally'}
          </p>
          <p className="text-xs text-muted-foreground">
            {isOnline
              ? `Last synced: ${formatDateTime(lastSync)}`
              : 'Changes are being saved locally and will sync when connection is restored'}
          </p>
        </div>
        <Badge variant={isOnline ? 'success' : 'error'} className="ml-auto">
          {isOnline ? 'Online' : 'Offline'}
        </Badge>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Pending Sync', value: String(pendingCount), icon: Clock, color: pendingCount > 0 ? 'text-warning-600' : 'text-muted-foreground', bg: pendingCount > 0 ? 'bg-warning/10' : 'bg-muted' },
          { label: 'Synced Records', value: String(MOCK_SYNC_QUEUE.filter((i) => i.status === 'synced').length), icon: CheckCircle, color: 'text-success', bg: 'bg-success/10' },
          { label: 'Local Storage', value: '2.4 MB', icon: HardDrive, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Last Sync', value: formatDateTime(lastSync).split(',')[1]?.trim() ?? '—', icon: RefreshCw, color: 'text-muted-foreground', bg: 'bg-muted' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', bg)}>
              <Icon className={cn('h-4 w-4', color)} />
            </div>
            <div>
              <p className="text-base font-bold leading-tight">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Sync queue */}
      <Card>
        <CardHeader>
          <CardTitle>Sync Queue</CardTitle>
          <CardDescription>Operations performed offline waiting to sync</CardDescription>
        </CardHeader>
        <CardContent>
          {MOCK_SYNC_QUEUE.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <CheckCircle className="mx-auto mb-2 h-8 w-8 text-success" />
              <p className="text-sm">All records are synced</p>
            </div>
          ) : (
            <div className="space-y-2">
              {MOCK_SYNC_QUEUE.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
                  <div className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    item.status === 'pending' ? 'bg-warning/10' : 'bg-success/10'
                  )}>
                    {item.status === 'pending'
                      ? <Clock className="h-4 w-4 text-warning-600" />
                      : <CheckCircle className="h-4 w-4 text-success" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.type} · {item.action} · {formatDateTime(item.timestamp)}
                    </p>
                  </div>
                  <Badge variant={item.status === 'pending' ? 'warning' : 'success'} className="shrink-0 text-xs">
                    {item.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Storage management */}
      <Card>
        <CardHeader>
          <CardTitle>Local Data Management</CardTitle>
          <CardDescription>Export or clear locally cached data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium">Export Offline Data</p>
              <p className="text-xs text-muted-foreground">Download all local data as JSON backup</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium">Import Offline Data</p>
              <p className="text-xs text-muted-foreground">Restore from a previously exported backup (.json)</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4" /> Import
            </Button>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <div>
              <p className="text-sm font-medium text-destructive">Clear Local Cache</p>
              <p className="text-xs text-muted-foreground">
                {clearConfirm ? 'Click again to confirm — this cannot be undone.' : 'Remove all locally stored data. Cannot be undone.'}
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={handleClearCache}>
              {clearConfirm ? 'Confirm Clear' : 'Clear Cache'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { ShieldAlert, Download, Search, FileText, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '@pharmaos/utils';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api';
import { exportToExcel } from '@/lib/export';

interface RegisterEntry {
  id: string;
  billNumber: string | null;
  medicineName: string;
  schedule: 'H' | 'H1' | 'X' | 'G' | 'C' | 'E';
  batchNumber: string;
  quantity: number;
  patientName: string;
  patientAge: number | null;
  patientPhone: string | null;
  doctorName: string;
  doctorRegNumber: string | null;
  dispensedByName: string | null;
  dispensedAt: string;
}

interface RegisterStats {
  total: number;
  thisMonth: number;
  bySchedule: Record<string, number>;
}

async function fetchEntries(schedule: string, search: string): Promise<RegisterEntry[]> {
  const params = new URLSearchParams({ limit: '100' });
  if (schedule !== 'all') params.set('schedule', schedule);
  if (search) params.set('search', search);
  const r = await apiFetch(`/api/schedule-register?${params}`);
  const j = await r.json() as { success: boolean; data: { data: RegisterEntry[] } };
  if (!r.ok) throw new Error('Request failed');
  return j.data?.data ?? [];
}

async function fetchStats(): Promise<RegisterStats> {
  const r = await apiFetch('/api/schedule-register/stats');
  const j = await r.json() as { success: boolean; data: RegisterStats };
  if (!r.ok) throw new Error('Request failed');
  return j.data;
}

function exportRegister(entries: RegisterEntry[]) {
  if (entries.length === 0) { toast.warning('No entries to export'); return; }
  const headers = ['Date', 'Medicine', 'Batch', 'Qty', 'Schedule', 'Patient', 'Patient Phone', 'Prescriber', 'Bill No', 'Dispensed By'];
  const rows = entries.map((e) => [
    formatDateTime(e.dispensedAt), e.medicineName, e.batchNumber, e.quantity, e.schedule,
    e.patientName ?? '', e.patientPhone ?? '', e.doctorName ?? '', e.billNumber ?? '', e.dispensedByName ?? '',
  ]);
  exportToExcel(`schedule-register-${new Date().toISOString().slice(0, 10)}`, headers, rows);
  toast.success('Register exported');
}

const scheduleBadge: Record<string, 'destructive' | 'warning' | 'secondary'> = {
  X: 'destructive', H1: 'destructive', H: 'warning',
};

export function ScheduleRegisterView() {
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');

  const { data: stats } = useQuery({ queryKey: ['schedule-register-stats'], queryFn: fetchStats });
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['schedule-register', tab, search],
    queryFn: () => fetchEntries(tab, search),
  });

  const columns: ColumnDef<RegisterEntry>[] = [
    {
      accessorKey: 'dispensedAt',
      header: ({ column }) => <SortableHeader column={column}>Date</SortableHeader>,
      cell: ({ row }) => <span className="text-xs font-data whitespace-nowrap">{formatDateTime(row.original.dispensedAt)}</span>,
    },
    {
      accessorKey: 'medicineName',
      header: 'Medicine',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-sm">{row.original.medicineName}</p>
          <p className="text-xs text-muted-foreground font-data">Batch: {row.original.batchNumber} · Qty: {row.original.quantity}</p>
        </div>
      ),
    },
    {
      accessorKey: 'schedule',
      header: 'Schedule',
      cell: ({ row }) => (
        <Badge variant={scheduleBadge[row.original.schedule] ?? 'secondary'}>Sch {row.original.schedule}</Badge>
      ),
    },
    {
      accessorKey: 'patientName',
      header: 'Patient',
      cell: ({ row }) => (
        <div>
          <p className="text-sm">{row.original.patientName}{row.original.patientAge ? `, ${row.original.patientAge}y` : ''}</p>
          {row.original.patientPhone && <p className="text-xs text-muted-foreground font-data">{row.original.patientPhone}</p>}
        </div>
      ),
    },
    {
      accessorKey: 'doctorName',
      header: 'Prescriber',
      cell: ({ row }) => (
        <div>
          <p className="text-sm">Dr. {row.original.doctorName}</p>
          {row.original.doctorRegNumber && <p className="text-xs text-muted-foreground font-data">Reg: {row.original.doctorRegNumber}</p>}
        </div>
      ),
    },
    {
      accessorKey: 'billNumber',
      header: 'Bill No',
      cell: ({ row }) => <span className="text-xs font-data">{row.original.billNumber ?? '—'}</span>,
    },
    {
      accessorKey: 'dispensedByName',
      header: 'Dispensed By',
      cell: ({ row }) => <span className="text-xs">{row.original.dispensedByName ?? '—'}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" /> Schedule Drug Register
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Statutory dispensing record for Schedule H, H1 &amp; X drugs — Drugs &amp; Cosmetics Act, 1940
          </p>
        </div>
        <Button onClick={() => exportRegister(entries)} variant="outline" size="sm" className="gap-1.5">
          <Download className="h-4 w-4" /> Export Register (CSV)
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><FileText className="h-3 w-3" /> Total Entries</p>
          <p className="text-2xl font-bold font-data mt-1">{stats?.total ?? '—'}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3 w-3" /> This Month</p>
          <p className="text-2xl font-bold font-data mt-1">{stats?.thisMonth ?? '—'}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Schedule H / H1</p>
          <p className="text-2xl font-bold font-data mt-1">{(stats?.bySchedule?.['H'] ?? 0) + (stats?.bySchedule?.['H1'] ?? 0)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Schedule X</p>
          <p className="text-2xl font-bold font-data mt-1 text-destructive">{stats?.bySchedule?.['X'] ?? 0}</p>
        </CardContent></Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="H">Sch H</TabsTrigger>
            <TabsTrigger value="H1">Sch H1</TabsTrigger>
            <TabsTrigger value="X">Sch X</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search patient, doctor, medicine, bill…" value={search}
            onChange={(e) => setSearch(e.target.value)} className="h-9 pl-8 text-sm" />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : entries.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <ShieldAlert className="h-10 w-10 text-muted-foreground/25 mx-auto mb-3" />
          <p className="text-sm font-medium">No register entries</p>
          <p className="text-xs text-muted-foreground mt-1">
            Entries are recorded automatically when Schedule H/H1/X drugs are billed with patient &amp; doctor details.
          </p>
        </CardContent></Card>
      ) : (
        <DataTable columns={columns} data={entries} />
      )}
    </div>
  );
}

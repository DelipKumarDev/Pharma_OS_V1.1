'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { Lock, Download } from 'lucide-react';
import { formatDateTime } from '@pharmaos/utils';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiFetch } from '@/lib/api';
import { exportToExcel } from '@/lib/export';

interface Entry { id: string; billNumber: string | null; medicineName: string; schedule: string; batchNumber: string; quantity: number; patientName: string; patientPhone: string | null; doctorName: string; dispensedByName: string | null; dispensedAt: string; }

async function fetchEntries(schedule: string): Promise<Entry[]> {
  const r = await apiFetch(`/api/schedule-register?schedule=${schedule}&limit=200`);
  const j = await r.json() as { data: { data: Entry[] } };
  return j.data?.data ?? [];
}

export default function ControlledDrugsPage() {
  // Schedule X = strictly controlled drugs; H1 also requires a register.
  const [schedule, setSchedule] = useState('X');
  const { data = [], isLoading } = useQuery({ queryKey: ['controlled', schedule], queryFn: () => fetchEntries(schedule) });

  const columns: ColumnDef<Entry>[] = [
    { accessorKey: 'dispensedAt', header: ({ column }) => <SortableHeader column={column}>Date</SortableHeader>, cell: ({ row }) => <span className="text-xs whitespace-nowrap">{formatDateTime(row.original.dispensedAt)}</span> },
    { accessorKey: 'medicineName', header: 'Medicine', cell: ({ row }) => <div><p className="font-medium text-sm">{row.original.medicineName}</p><p className="text-xs text-muted-foreground font-mono">Batch: {row.original.batchNumber} · Qty: {row.original.quantity}</p></div> },
    { accessorKey: 'schedule', header: 'Schedule', cell: ({ row }) => <Badge variant="destructive" className="text-xs">Schedule {row.original.schedule}</Badge> },
    { accessorKey: 'patientName', header: 'Patient', cell: ({ row }) => <div><p className="text-sm">{row.original.patientName}</p>{row.original.patientPhone && <p className="text-xs text-muted-foreground">{row.original.patientPhone}</p>}</div> },
    { accessorKey: 'doctorName', header: 'Prescriber', cell: ({ row }) => <span className="text-sm">{row.original.doctorName}</span> },
    { accessorKey: 'billNumber', header: 'Bill No', cell: ({ row }) => <span className="text-xs font-mono text-primary">{row.original.billNumber ?? '—'}</span> },
    { accessorKey: 'dispensedByName', header: 'Dispensed By', cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.dispensedByName ?? '—'}</span> },
  ];

  function doExport() {
    if (!data.length) return;
    exportToExcel(`controlled-drugs-${schedule}-${new Date().toISOString().slice(0, 10)}`,
      ['Date', 'Medicine', 'Batch', 'Qty', 'Schedule', 'Patient', 'Patient Phone', 'Prescriber', 'Bill No', 'Dispensed By'],
      data.map((e) => [formatDateTime(e.dispensedAt), e.medicineName, e.batchNumber, e.quantity, e.schedule, e.patientName, e.patientPhone ?? '', e.doctorName, e.billNumber ?? '', e.dispensedByName ?? '']));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10"><Lock className="h-4 w-4 text-destructive" /></div>
          <div><h1 className="text-2xl font-bold tracking-tight">Controlled Drugs Register</h1><p className="text-sm text-muted-foreground">Statutory dispensing record for narcotic & psychotropic (Schedule X / H1) medicines</p></div>
        </div>
        <Button variant="outline" size="sm" onClick={doExport}><Download className="h-4 w-4" /> Export Register</Button>
      </div>

      <Tabs value={schedule} onValueChange={setSchedule}>
        <TabsList><TabsTrigger value="X">Schedule X</TabsTrigger><TabsTrigger value="H1">Schedule H1</TabsTrigger></TabsList>
      </Tabs>

      <DataTable columns={columns} data={data} loading={isLoading} globalSearch searchPlaceholder="Search by medicine, patient, doctor, bill…"
        emptyMessage={`No Schedule ${schedule} dispensing recorded`} emptyDescription="Entries are created automatically when these medicines are billed." />
    </div>
  );
}

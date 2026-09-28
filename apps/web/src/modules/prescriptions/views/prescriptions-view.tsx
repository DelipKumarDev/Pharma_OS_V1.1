'use client';

import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import {
  FileText, Clock, CheckCircle, XCircle, AlertTriangle, Plus,
  MoreHorizontal, Eye, Check, X, Printer, Receipt, Upload,
  User, Stethoscope, Calendar, Pill, ChevronDown, ChevronUp,
  Loader2, RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Prescription, PrescriptionStats, PrescriptionStatus } from '@pharmaos/types';
import { formatDate, formatDateTime } from '@pharmaos/utils';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { useCan } from '@/lib/permissions';
import { useFormFieldConfig } from '@/lib/form-fields';

// ─── API ─────────────────────────────────────────────────────────────────────

async function fetchStats(): Promise<PrescriptionStats> {
  const r = await apiFetch('/api/prescriptions/stats');
  const j = await r.json() as { success: boolean; data: PrescriptionStats };
  if (!j.success || !j.data) throw new Error('Failed to load prescription stats');
  return j.data;
}

async function fetchRx(status?: string): Promise<Prescription[]> {
  const url = status ? `/api/prescriptions?status=${status}` : '/api/prescriptions';
  const r = await apiFetch(url);
  const j = await r.json() as { success: boolean; data: { data: Prescription[] } };
  if (!r.ok) throw new Error('Request failed');
  return j.data?.data ?? ([] as Prescription[]);
}

async function approveRx(id: string) {
  await apiFetch(`/api/prescriptions/${id}/approve`, { method: 'PATCH' });
}

async function rejectRx(id: string, reason: string) {
  await apiFetch(`/api/prescriptions/${id}/reject`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
}

async function dispenseRx(id: string) {
  await apiFetch(`/api/prescriptions/${id}/dispense`, { method: 'PATCH' });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PrescriptionStatus, { label: string; variant: 'warning' | 'success' | 'muted' | 'destructive' | 'secondary'; icon: React.ElementType }> = {
  pending_review: { label: 'Pending Review', variant: 'warning', icon: Clock },
  approved: { label: 'Approved', variant: 'success', icon: CheckCircle },
  dispensed: { label: 'Dispensed', variant: 'muted', icon: CheckCircle },
  rejected: { label: 'Rejected', variant: 'destructive', icon: XCircle },
  expired: { label: 'Expired', variant: 'secondary', icon: AlertTriangle },
};

function StatusBadge({ status }: { status: PrescriptionStatus }) {
  const cfg = STATUS_CONFIG[status];
  return <Badge variant={cfg.variant} dot className="text-xs capitalize">{cfg.label}</Badge>;
}

// ─── Add prescription schema ──────────────────────────────────────────────────

const addSchema = z.object({
  customerName: z.string().min(2, 'Required'),
  customerPhone: z.string().optional().refine((v) => !v || /^\d{10}$/.test(v), 'Phone must be exactly 10 digits'),
  doctorName: z.string().min(2, 'Required'),
  doctorRegNumber: z.string().optional(),
  hospitalName: z.string().optional(),
  prescriptionDate: z.string().min(1, 'Required'),
  validUntil: z.string().optional(),
  notes: z.string().optional(),
}).refine((d) => {
  // Prescription validity cannot be a past date (Vinay P10.1).
  if (!d.validUntil) return true;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(d.validUntil) >= today;
}, { message: 'Validity date cannot be in the past', path: ['validUntil'] });
type AddFormValues = z.infer<typeof addSchema>;

// ─── Reject dialog ────────────────────────────────────────────────────────────

function RejectDialog({ rx, onClose }: { rx: Prescription; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => rejectRx(rx.id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prescriptions'] });
      qc.invalidateQueries({ queryKey: ['prescription-stats'] });
      toast.success(`RX ${rx.prescriptionNumber} rejected`);
      onClose();
    },
  });
  // Portal to <body> with a z-index above the detail Sheet — otherwise the modal
  // renders inside the Sheet's stacking/overflow context and its content is hidden
  // (Divya R149 / Vinay P10.3: "pop-up appears but content is not visible").
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-lg mb-1">Reject Prescription</h3>
        <p className="text-sm text-muted-foreground mb-4">{rx.prescriptionNumber} — {rx.customerName}</p>
        <Label className="text-xs mb-1.5 block">Reason for rejection <span className="text-destructive">*</span></Label>
        <textarea
          autoFocus
          className="w-full rounded-lg border border-border bg-background p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px]"
          placeholder="e.g. Prescription appears altered, doctor signature missing…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" className="flex-1" disabled={!reason.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reject Prescription'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Prescription detail sheet ────────────────────────────────────────────────

function RxDetailSheet({ rx, onClose }: { rx: Prescription; onClose: () => void }) {
  const router = useRouter();
  const can = useCan();
  const [expanded, setExpanded] = useState(true);
  const [rejectOpen, setRejectOpen] = useState(false);
  const qc = useQueryClient();

  const approveMut = useMutation({
    mutationFn: () => approveRx(rx.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prescriptions'] });
      qc.invalidateQueries({ queryKey: ['prescription-stats'] });
      toast.success('Prescription approved');
      onClose();
    },
  });

  const dispenseMut = useMutation({
    mutationFn: () => dispenseRx(rx.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prescriptions'] });
      qc.invalidateQueries({ queryKey: ['prescription-stats'] });
      toast.success('Marked as dispensed');
      onClose();
    },
  });

  const revokeMut = useMutation({
    mutationFn: async () => { await apiFetch(`/api/prescriptions/${rx.id}/revoke`, { method: 'PATCH' }); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prescriptions'] });
      qc.invalidateQueries({ queryKey: ['prescription-stats'] });
      toast.success('Dispensing revoked — back to Approved');
      onClose();
    },
  });

  return (
    <>
      <Sheet open onOpenChange={onClose}>
        <SheetContent className="flex flex-col w-full sm:max-w-lg" side="right">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              {rx.prescriptionNumber}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Prescription {rx.prescriptionNumber} — status {rx.status}
            </SheetDescription>
            <div>
              <StatusBadge status={rx.status} />
            </div>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-2">
            {/* Customer + Doctor */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/40 p-3">
                <div className="flex items-center gap-1.5 mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <User className="h-3 w-3" /> Patient
                </div>
                <p className="font-semibold text-sm">{rx.customerName}</p>
                {rx.customerPhone && <p className="text-xs text-muted-foreground">{rx.customerPhone}</p>}
              </div>
              <div className="rounded-lg bg-muted/40 p-3">
                <div className="flex items-center gap-1.5 mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <Stethoscope className="h-3 w-3" /> Doctor
                </div>
                <p className="font-semibold text-sm">{rx.doctorName}</p>
                {rx.hospitalName && <p className="text-xs text-muted-foreground">{rx.hospitalName}</p>}
                {rx.doctorRegNumber && <p className="text-xs text-muted-foreground">Reg: {rx.doctorRegNumber}</p>}
              </div>
            </div>

            {/* Dates */}
            <div className="flex gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Prescription Date</p>
                <p className="font-medium">{formatDate(rx.prescriptionDate)}</p>
              </div>
              {rx.validUntil && (
                <div>
                  <p className="text-xs text-muted-foreground">Valid Until</p>
                  <p className="font-medium">{formatDate(rx.validUntil)}</p>
                </div>
              )}
              {rx.billNumber && (
                <div>
                  <p className="text-xs text-muted-foreground">Linked Bill</p>
                  <p className="font-medium text-primary">{rx.billNumber}</p>
                </div>
              )}
            </div>

            {/* Rejection reason */}
            {rx.status === 'rejected' && rx.rejectionReason && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-xs font-semibold text-destructive mb-1">Rejection Reason</p>
                <p className="text-sm">{rx.rejectionReason}</p>
                {rx.reviewedAt && <p className="text-xs text-muted-foreground mt-1">by {rx.reviewedBy} · {formatDateTime(rx.reviewedAt)}</p>}
              </div>
            )}

            {/* Prescribed medicines */}
            <div>
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex w-full items-center justify-between py-1 text-sm font-semibold"
              >
                <span className="flex items-center gap-1.5">
                  <Pill className="h-4 w-4 text-primary" />
                  Prescribed Medicines ({rx.medicines.length})
                </span>
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {expanded && (
                <div className="mt-2 space-y-2">
                  {rx.medicines.map((med) => (
                    <div key={med.id} className={cn(
                      'rounded-lg border p-3 text-sm',
                      med.dispensed ? 'border-success/30 bg-success/5' : 'border-border bg-card'
                    )}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold">{med.medicineName}</p>
                          {med.genericName && <p className="text-xs text-muted-foreground">{med.genericName}</p>}
                        </div>
                        {med.dispensed && <Badge variant="success" className="text-[10px] shrink-0">Dispensed</Badge>}
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-muted-foreground">
                        <div><span className="font-medium text-foreground">Dose:</span> {med.dosage}</div>
                        <div><span className="font-medium text-foreground">Freq:</span> {med.frequency}</div>
                        <div><span className="font-medium text-foreground">Duration:</span> {med.duration}</div>
                        {med.quantity && <div><span className="font-medium text-foreground">Qty:</span> {med.quantity}</div>}
                        {med.instructions && <div className="col-span-2"><span className="font-medium text-foreground">Note:</span> {med.instructions}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            {rx.notes && (
              <div className="rounded-lg bg-muted/40 p-3 text-sm">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
                <p>{rx.notes}</p>
              </div>
            )}

            {/* Uploaded prescription scan */}
            {rx.imageUrl ? (
              rx.imageType === 'pdf' ? (
                <div className="rounded-lg border border-border p-6 text-center">
                  <FileText className="h-10 w-10 text-primary/60 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">PDF prescription attached</p>
                  <a href={rx.imageUrl} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm" className="mt-2">
                      <Eye className="h-3.5 w-3.5" /> Open PDF
                    </Button>
                  </a>
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <a href={rx.imageUrl} target="_blank" rel="noreferrer" title="Open full size">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={rx.imageUrl} alt="Prescription scan" className="w-full max-h-96 object-contain bg-muted" />
                  </a>
                  <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-muted/30">
                    <span className="text-xs text-muted-foreground">Prescription scan</span>
                    <a href={rx.imageUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" /> View full size
                    </a>
                  </div>
                </div>
              )
            ) : (
              <div className="rounded-lg border-2 border-dashed border-border p-6 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No prescription image attached</p>
              </div>
            )}
          </div>

          <SheetFooter className="gap-2 px-6 pb-6 pt-2">
            {rx.status === 'pending_review' && can('prescriptions:approve') && (
              <>
                <Button variant="destructive" className="flex-1" onClick={() => setRejectOpen(true)}>
                  <XCircle className="h-4 w-4" /> Reject
                </Button>
                <Button className="flex-1" onClick={() => approveMut.mutate()} disabled={approveMut.isPending}>
                  {approveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle className="h-4 w-4" /> Approve</>}
                </Button>
              </>
            )}
            {rx.status === 'approved' && (
              <>
                {can('billing:create') && (
                  <Button variant="outline" className="flex-1" onClick={() => { onClose(); router.push(`/billing?rxId=${rx.id}&customerName=${encodeURIComponent(rx.customerName)}`); }}>
                    <Receipt className="h-4 w-4" /> Create Bill
                  </Button>
                )}
                {can('prescriptions:edit') && (
                  <Button className="flex-1" onClick={() => dispenseMut.mutate()} disabled={dispenseMut.isPending}>
                    {dispenseMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Mark Dispensed</>}
                  </Button>
                )}
              </>
            )}
            {rx.status === 'dispensed' && (
              <Button variant="outline" className="flex-1" onClick={() => revokeMut.mutate()} disabled={revokeMut.isPending}>
                {revokeMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RotateCcw className="h-4 w-4" /> Revoke Dispensing</>}
              </Button>
            )}
            {(rx.status === 'dispensed' || rx.status === 'rejected') && (
              <Button variant="outline" className="flex-1" onClick={onClose}>Close</Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {rejectOpen && <RejectDialog rx={rx} onClose={() => { setRejectOpen(false); onClose(); }} />}
    </>
  );
}

// ─── Add prescription sheet ───────────────────────────────────────────────────

// Turn the picked file into a persistable base64 data URL. Images are downscaled
// (max 1400px, JPEG q0.8) so the stored scan stays small; PDFs are embedded as-is.
async function fileToStored(f: File): Promise<{ url: string; type: 'image' | 'pdf' }> {
  const readDataUrl = (file: File) => new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = () => rej(new Error('read failed'));
    fr.readAsDataURL(file);
  });
  const isPdf = /\.pdf$/i.test(f.name) || f.type === 'application/pdf';
  if (isPdf) return { url: await readDataUrl(f), type: 'pdf' };

  const raw = await readDataUrl(f);
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('img')); img.src = raw; });
    const maxDim = 1400;
    let { width, height } = img;
    if (width > maxDim || height > maxDim) {
      const scale = maxDim / Math.max(width, height);
      width = Math.round(width * scale); height = Math.round(height * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { url: raw, type: 'image' };
    ctx.drawImage(img, 0, 0, width, height);
    return { url: canvas.toDataURL('image/jpeg', 0.82), type: 'image' };
  } catch {
    return { url: raw, type: 'image' }; // fall back to the original if canvas fails
  }
}

function AddRxSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const ff = useFormFieldConfig('prescription');
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AddFormValues>({
    mode: 'onTouched',
    resolver: zodResolver(addSchema),
    defaultValues: { prescriptionDate: new Date().toISOString().substring(0, 10) },
  });
  const [medicines, setMedicines] = useState([{ name: '', dosage: '', frequency: '', duration: '', qty: '' }]);
  const [rxFile, setRxFile] = useState<File | null>(null);
  const [rxPreview, setRxPreview] = useState<string | null>(null);
  const [rxStored, setRxStored] = useState<{ url: string; type: 'image' | 'pdf' } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File | undefined) {
    if (!f) return;
    if (!/\.(png|jpe?g|webp|pdf)$/i.test(f.name)) { toast.error('Upload an image (PNG/JPG) or PDF'); return; }
    if (f.size > 10 * 1024 * 1024) { toast.error('File too large (max 10 MB)'); return; }
    setRxFile(f);
    setRxPreview(/\.pdf$/i.test(f.name) ? null : URL.createObjectURL(f));
    setRxStored(null);
    // Convert to a persistable data URL so the scan is saved with the record.
    fileToStored(f).then(setRxStored).catch(() => { toast.error('Could not process the file'); setRxStored(null); });
    toast.success(`Attached: ${f.name}`);
  }

  const mutation = useMutation({
    mutationFn: async (data: AddFormValues) => {
      const meds = medicines.filter((m) => m.name.trim());
      if (meds.length === 0) throw new Error('Add at least one medicine before registering');
      const payload = {
        ...data,
        medicines: meds.map((m) => ({
          medicineName: m.name, dosage: m.dosage, frequency: m.frequency,
          duration: m.duration, quantity: m.qty ? Number(m.qty) : undefined,
        })),
        imageUrl: rxStored?.url,
        imageType: rxStored?.type,
      };
      const r = await apiFetch('/api/prescriptions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json() as { success: boolean; message?: string; data: Prescription };
      // TC_009: surface real failures instead of falsely reporting success.
      if (!r.ok || !j.success) throw new Error(j.message ?? 'Failed to register prescription');
      return j.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prescriptions'] });
      qc.invalidateQueries({ queryKey: ['prescription-stats'] });
      toast.success('Prescription registered for review');
      reset(); setMedicines([{ name: '', dosage: '', frequency: '', duration: '', qty: '' }]);
      setRxFile(null); setRxPreview(null); setRxStored(null);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function addMedRow() { setMedicines((p) => [...p, { name: '', dosage: '', frequency: '', duration: '', qty: '' }]); }
  function removeMedRow(i: number) { setMedicines((p) => p.filter((_, idx) => idx !== i)); }
  function updateMed(i: number, field: string, val: string) {
    setMedicines((p) => p.map((m, idx) => idx === i ? { ...m, [field]: val } : m));
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="flex flex-col w-full sm:max-w-lg" side="right">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" /> Register Prescription
          </SheetTitle>
          <SheetDescription>Enter prescription details to queue for pharmacist review</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-2">
          {/* Upload zone (TC_005) */}
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files?.[0]); }}
            className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4 text-center cursor-pointer hover:bg-primary/10 transition-colors"
          >
            {rxFile ? (
              <div className="flex flex-col items-center gap-2">
                {rxPreview
                  ? <img src={rxPreview} alt="Prescription" className="max-h-32 rounded-lg border border-border" />
                  : <FileText className="h-8 w-8 text-primary" />}
                <p className="text-sm font-medium text-primary">{rxFile.name}</p>
                <button type="button" onClick={(e) => { e.stopPropagation(); setRxFile(null); setRxPreview(null); setRxStored(null); }}
                  className="text-xs text-muted-foreground hover:text-destructive">Remove</button>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 text-primary/50 mx-auto mb-1" />
                <p className="text-sm font-medium text-primary">Upload prescription image or PDF</p>
                <p className="text-xs text-muted-foreground mt-0.5">Click to browse or drag and drop</p>
              </>
            )}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden"
              onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ''; }} />
          </div>

          <Separator />

          {/* Patient */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Patient Details</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <Label className="text-xs">Patient Name *</Label>
                <Input {...register('customerName')} className="mt-1 h-8 text-sm" placeholder="Full name" />
                {errors.customerName && <p className="text-xs text-destructive mt-0.5">{errors.customerName.message}</p>}
              </div>
              {ff.isEnabled('customerPhone') && (
                <div>
                  <Label className="text-xs">{ff.label('customerPhone', 'Phone')}</Label>
                  <Input {...register('customerPhone')} inputMode="numeric" className="mt-1 h-8 text-sm" placeholder="10-digit number" maxLength={10}
                    onInput={(e) => { const t = e.target as HTMLInputElement; t.value = t.value.replace(/\D/g, '').slice(0, 10); }} />
                  {errors.customerPhone && <p className="text-xs text-destructive mt-0.5">{errors.customerPhone.message}</p>}
                </div>
              )}
            </div>
          </div>

          {/* Doctor */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Doctor Details</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <Label className="text-xs">Doctor Name *</Label>
                <Input {...register('doctorName')} className="mt-1 h-8 text-sm" placeholder="Dr. Full Name" />
                {errors.doctorName && <p className="text-xs text-destructive mt-0.5">{errors.doctorName.message}</p>}
              </div>
              {ff.isEnabled('doctorRegNumber') && (
                <div>
                  <Label className="text-xs">{ff.label('doctorRegNumber', 'Reg. Number')}</Label>
                  <Input {...register('doctorRegNumber')} className="mt-1 h-8 text-sm" placeholder="MCI-XXXXX" />
                </div>
              )}
              {ff.isEnabled('hospitalName') && (
                <div>
                  <Label className="text-xs">{ff.label('hospitalName', 'Hospital / Clinic')}</Label>
                  <Input {...register('hospitalName')} className="mt-1 h-8 text-sm" placeholder="Hospital name" />
                </div>
              )}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Prescription Date *</Label>
              <Input type="date" {...register('prescriptionDate')} className="mt-1 h-8 text-sm" />
            </div>
            {ff.isEnabled('validUntil') && (
              <div>
                <Label className="text-xs">{ff.label('validUntil', 'Valid Until')}</Label>
                <Input type="date" min={new Date().toISOString().substring(0, 10)} {...register('validUntil')} className="mt-1 h-8 text-sm" />
                {errors.validUntil && <p className="text-2xs text-destructive mt-1">{errors.validUntil.message}</p>}
              </div>
            )}
          </div>

          {/* Medicines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prescribed Medicines</p>
              <Button type="button" variant="ghost" size="sm" onClick={addMedRow} className="h-6 text-xs">
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>
            <div className="space-y-2">
              {medicines.map((med, i) => (
                <div key={i} className="rounded-lg border border-border p-2.5 space-y-1.5">
                  <div className="flex gap-1.5">
                    <Input value={med.name} onChange={(e) => updateMed(i, 'name', e.target.value)}
                      className="h-7 text-xs flex-1" placeholder="Medicine name" />
                    {medicines.length > 1 && (
                      <button type="button" onClick={() => removeMedRow(i)} className="text-muted-foreground hover:text-destructive">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <Input value={med.dosage} onChange={(e) => updateMed(i, 'dosage', e.target.value)} className="h-7 text-xs" placeholder="Dose" />
                    <Input value={med.frequency} onChange={(e) => updateMed(i, 'frequency', e.target.value)} className="h-7 text-xs" placeholder="Frequency" />
                    <Input value={med.duration} onChange={(e) => updateMed(i, 'duration', e.target.value)} className="h-7 text-xs" placeholder="Duration" />
                    <Input type="number" value={med.qty} onChange={(e) => updateMed(i, 'qty', e.target.value)} className="h-7 text-xs" placeholder="Qty" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">Notes</Label>
            <textarea {...register('notes')} rows={2}
              className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Any special instructions or notes…" />
          </div>
        </form>

        <SheetFooter className="px-6 pb-6 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit((d) => mutation.mutate(d))} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><FileText className="h-4 w-4" /> Register for Review</>}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function PrescriptionsView() {
  const can = useCan();
  const [activeTab, setActiveTab] = useState<PrescriptionStatus | 'all'>('all');
  const [selectedRx, setSelectedRx] = useState<Prescription | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const { data: stats } = useQuery({ queryKey: ['prescription-stats'], queryFn: fetchStats });
  const { data: prescriptions = [], isLoading } = useQuery({
    queryKey: ['prescriptions', activeTab],
    queryFn: () => fetchRx(activeTab === 'all' ? undefined : activeTab),
  });

  const TABS = [
    { key: 'all' as const, label: 'All', count: stats?.total },
    { key: 'pending_review' as const, label: 'Pending Review', count: stats?.pendingReview, urgent: true },
    { key: 'approved' as const, label: 'Approved', count: stats?.approved },
    { key: 'dispensed' as const, label: 'Dispensed', count: stats?.dispensedToday },
    { key: 'rejected' as const, label: 'Rejected', count: stats?.rejected },
  ];

  const columns: ColumnDef<Prescription>[] = [
    {
      accessorKey: 'prescriptionNumber',
      header: 'Rx No.',
      cell: ({ row }) => <span className="font-mono font-semibold text-primary text-sm">{row.original.prescriptionNumber}</span>,
    },
    {
      id: 'patient',
      header: 'Patient',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-sm">{row.original.customerName}</p>
          {row.original.customerPhone && <p className="text-xs text-muted-foreground">{row.original.customerPhone}</p>}
        </div>
      ),
    },
    {
      accessorKey: 'doctorName',
      header: 'Doctor',
      cell: ({ row }) => (
        <div>
          <p className="text-sm">{row.original.doctorName}</p>
          {row.original.hospitalName && <p className="text-xs text-muted-foreground">{row.original.hospitalName}</p>}
        </div>
      ),
    },
    {
      id: 'medicines',
      header: 'Medicines',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.medicines.length} item{row.original.medicines.length !== 1 ? 's' : ''}</span>
      ),
    },
    {
      accessorKey: 'prescriptionDate',
      header: ({ column }) => <SortableHeader column={column}>Date</SortableHeader>,
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDate(row.original.prescriptionDate)}</span>,
    },
    {
      accessorKey: 'validUntil',
      header: 'Valid Until',
      cell: ({ row }) => row.original.validUntil
        ? <span className="text-xs">{formatDate(row.original.validUntil)}</span>
        : <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'bill',
      header: 'Bill',
      cell: ({ row }) => row.original.billNumber
        ? <span className="text-xs font-mono text-primary">{row.original.billNumber}</span>
        : <span className="text-xs text-muted-foreground">—</span>,
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
            <DropdownMenuItem onClick={() => setSelectedRx(row.original)}>
              <Eye className="h-4 w-4" /> View Details
            </DropdownMenuItem>
            {row.original.status === 'pending_review' && can('prescriptions:approve') && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSelectedRx(row.original)}>
                  <Check className="h-4 w-4" /> Approve / Reject
                </DropdownMenuItem>
              </>
            )}
            {row.original.status === 'approved' && can('billing:create') && (
              <DropdownMenuItem onClick={() => setSelectedRx(row.original)}>
                <Receipt className="h-4 w-4" /> Create Bill
              </DropdownMenuItem>
            )}
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
          <h1 className="text-2xl font-bold tracking-tight">Prescriptions</h1>
          <p className="text-sm text-muted-foreground">Review, approve and track prescription dispensing</p>
        </div>
        {can('prescriptions:create') && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Register Prescription
          </Button>
        )}
      </div>

      {/* Stats — each card is a filter for its tab; the ACTIVE tab's card is the
          one highlighted (ring), so the header selection always matches the tab. */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: 'Total', value: stats.total, icon: FileText, color: 'text-primary', bg: 'bg-primary/10', tabKey: 'all' as const },
            { label: 'Pending Review', value: stats.pendingReview, icon: Clock, color: 'text-warning-600', bg: 'bg-warning/10', tabKey: 'pending_review' as const, urgent: stats.pendingReview > 0 },
            { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'text-success', bg: 'bg-success/10', tabKey: 'approved' as const },
            { label: 'Dispensed Today', value: stats.dispensedToday, icon: Pill, color: 'text-blue-600', bg: 'bg-blue-500/10', tabKey: 'dispensed' as const },
            { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', tabKey: 'rejected' as const },
            { label: 'Expiring Soon', value: stats.expiringSoon, icon: AlertTriangle, color: 'text-warning-600', bg: 'bg-warning/10', tabKey: null },
          ].map(({ label, value, icon: Icon, color, bg, urgent, tabKey }) => {
            const selected = tabKey !== null && activeTab === tabKey;
            return (
              <button
                key={label}
                type="button"
                onClick={() => tabKey && setActiveTab(tabKey)}
                disabled={tabKey === null}
                className={cn(
                  'flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition-all',
                  selected ? 'border-primary ring-2 ring-primary/25' : 'border-border',
                  !selected && urgent && 'border-warning/40',
                  tabKey && !selected && 'hover:bg-muted/50 cursor-pointer',
                )}
              >
                <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', bg)}>
                  <Icon className={cn('h-4 w-4', color)} />
                </div>
                <div>
                  <p className="text-lg font-bold leading-tight">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Pending alert */}
      {stats && stats.pendingReview > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-warning/40 bg-warning/8 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-warning-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-warning-600">{stats.pendingReview} prescription{stats.pendingReview !== 1 ? 's' : ''} waiting for pharmacist review</p>
            <p className="text-xs text-muted-foreground">Review and approve before dispensing Rx medicines</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setActiveTab('pending_review')}>
            Review Now <ChevronDown className="h-3.5 w-3.5 rotate-[-90deg]" />
          </Button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={cn(
                'text-[10px] rounded-full px-1.5 py-0.5 font-semibold',
                tab.urgent ? 'bg-warning/20 text-warning-600' : 'bg-muted text-muted-foreground'
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={prescriptions}
        loading={isLoading}
        globalSearch
        searchPlaceholder="Search by Rx number, patient, or doctor…"
        emptyMessage="No prescriptions found"
        emptyDescription="Register a new prescription to get started."
      />

      {/* Sheets */}
      {selectedRx && <RxDetailSheet rx={selectedRx} onClose={() => setSelectedRx(null)} />}
      <AddRxSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

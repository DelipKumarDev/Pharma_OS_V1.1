'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, ScanLine, Sparkles } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useDropdown } from '@/lib/dropdowns';
import { useFormFieldConfig } from '@/lib/form-fields';
import type { Medicine, MedicineCategory, MedicineForm, MedicineUnit, DrugSchedule } from '@pharmaos/types';

// Prescription-mandatory drug schedules: dispensing requires a valid Rx.
const RX_SCHEDULES = ['H', 'H1', 'X'];

// Default GST slab suggested per drug schedule (user can still override).
// Mapping follows common Indian pharmacy practice; GST is ultimately HSN-driven.
const SCHEDULE_GST: Record<string, number> = { none: 5, H: 5, H1: 12, X: 12, G: 12 };

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  genericName: z.string().min(2, 'Generic name is required'),
  brandName: z.string().optional(),
  manufacturer: z.string().min(2, 'Manufacturer is required'),
  category: z.string().min(1, 'Category is required'),
  form: z.string().min(1, 'Form is required'),
  strength: z.string().min(1, 'Strength is required'),
  unit: z.string().min(1, 'Unit is required'),
  composition: z.string().optional(),
  hsn: z.string().min(1, 'HSN code is required'),
  schedule: z.string().min(1, 'Drug schedule is required'),
  requiresPrescription: z.boolean().default(false),
  gstRate: z.coerce.number().min(0).max(28),
  mrp: z.coerce.number().min(0.01, 'MRP is required'),
  purchasePrice: z.coerce.number().min(0).optional(),
  sellingPrice: z.coerce.number().min(0.01, 'Selling price is required'),
  reorderLevel: z.coerce.number().min(0),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medicine?: Medicine;
}

// Drug schedules are statutory (fixed) — not tenant-configurable.
const SCHEDULES: { value: string; label: string }[] = [{ value: 'none', label: 'None (OTC)' }, { value: 'H', label: 'Schedule H' }, { value: 'H1', label: 'Schedule H1' }, { value: 'X', label: 'Schedule X' }, { value: 'G', label: 'Schedule G' }];

async function saveMedicine(data: FormValues, id?: string): Promise<Medicine> {
  const payload = { ...data, schedule: (data.schedule === 'none' ? null : data.schedule) as DrugSchedule };
  const res = await apiFetch(id ? `/api/medicines/${id}` : '/api/medicines', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json() as { success: boolean; data: Medicine; message?: string };
  if (!json.success) throw new Error(json.message ?? 'Failed to save');
  return json.data;
}

export function AddMedicineDialog({ open, onOpenChange, medicine }: Props) {
  const isEdit = !!medicine;
  const qc = useQueryClient();

  const [confirmCancel, setConfirmCancel] = React.useState(false);

  // TC_028: option lists come from tenant config (Settings → Dropdown Options),
  // falling back to built-in defaults.
  const CATEGORIES = useDropdown('medicineCategory');
  const FORMS = useDropdown('medicineForm');
  const UNITS = useDropdown('medicineUnit');
  const GST_RATES = useDropdown('gstRate');

  // Admin-configurable field labels/visibility (Settings → Form Fields → Medicine
  // Master). Statutory/required fields stay put; only safe overrides are honoured.
  const ff = useFormFieldConfig('medicine');

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isDirty } } = useForm<FormValues>({
    mode: 'onTouched',
    resolver: zodResolver(schema),
    defaultValues: medicine
      ? { ...medicine, schedule: medicine.schedule ?? 'none', purchasePrice: medicine.purchasePrice ?? 0 }
      : { requiresPrescription: false, gstRate: 12, reorderLevel: 20, schedule: 'none' },
  });

  React.useEffect(() => {
    if (open) {
      reset(medicine
        ? { ...medicine, schedule: medicine.schedule ?? 'none', purchasePrice: medicine.purchasePrice ?? 0 }
        : { requiresPrescription: false, gstRate: 12, reorderLevel: 20, schedule: 'none' }
      );
    }
  }, [open, medicine, reset]);

  const mutation = useMutation({
    mutationFn: (data: FormValues) => saveMedicine(data, medicine?.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medicines'] });
      toast.success(isEdit ? 'Medicine updated successfully' : 'Medicine added successfully');
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const category = watch('category');
  const form = watch('form');
  const unit = watch('unit');
  const schedule = watch('schedule');
  const gstRate = watch('gstRate');
  const requiresPrescription = watch('requiresPrescription');

  // Selecting a drug schedule auto-populates Requires-Prescription (6th scenario)
  // and a sensible default GST slab (5th scenario). Both remain user-overridable.
  const handleScheduleChange = (v: string) => {
    setValue('schedule', v, { shouldDirty: true });
    // Rx: on for H/H1/X, off for OTC/none (and other non-Rx schedules).
    setValue('requiresPrescription', RX_SCHEDULES.includes(v), { shouldDirty: true });
    // GST: apply the schedule's default slab.
    if (SCHEDULE_GST[v] !== undefined) setValue('gstRate', SCHEDULE_GST[v], { shouldDirty: true });
  };

  // TC_011: guard against losing unsaved edits. If the form is dirty, ask first;
  // otherwise close immediately.
  const attemptClose = () => {
    if (isDirty) setConfirmCancel(true);
    else onOpenChange(false);
  };

  const discardAndClose = () => {
    setConfirmCancel(false);
    reset();
    onOpenChange(false);
  };

  // ── Scan a medicine strip/box photo → best-effort auto-fill (user reviews) ──
  const [scanning, setScanning] = React.useState(false);
  const scanFileRef = React.useRef<HTMLInputElement>(null);

  const runScan = async (file: File) => {
    setScanning(true);
    try {
      const Tesseract = (await import('tesseract.js')).default;
      const { data } = await Tesseract.recognize(file, 'eng');
      const text = (data.text ?? '').replace(/\r/g, '');
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 1);

      let filled = 0;
      const set = (field: keyof FormValues, val: string) => {
        if (val && val.trim()) { setValue(field, val.trim() as never, { shouldValidate: true, shouldDirty: true }); filled++; }
      };

      // Strength: 500mg / 10 ml / 250 mcg / 1000 IU / 5%
      const strength = text.match(/(\d+(?:\.\d+)?)\s?(mg|ml|mcg|gm?|iu|%)\b/i)?.[0];
      if (strength) set('strength', strength.replace(/\s+/g, ''));

      // Name / brand: first prominent alphabetic line that isn't boilerplate
      const skip = /each|contains|tablet|capsule|store|keep|mfd|mfg|manufactured|marketed|batch|exp|mrp|b\.?no|lic|dosage|read|prescription|schedule/i;
      const nameLine = lines.find(l => /[A-Za-z]{3,}/.test(l) && !skip.test(l) && l.length <= 40);
      if (nameLine) { set('name', strength && !new RegExp(strength, 'i').test(nameLine) ? `${nameLine} ${strength}` : nameLine); set('brandName', nameLine); }

      // Composition / generic: "Each ... contains X" or a salt-looking line
      const comp = text.match(/contains?[:\s]+([A-Za-z0-9 ,.\-()]+)/i)?.[1];
      if (comp) { set('composition', comp); const salt = comp.match(/[A-Za-z]{4,}/)?.[0]; if (salt) set('genericName', salt); }

      // Manufacturer: "Mfd by: X" / "Marketed by X" / a line ending in Ltd/Pharma/Labs
      const mfg = text.match(/(?:mfd|mfg|manufactured|marketed)\s*(?:by)?[:.\s]+([A-Za-z0-9 .,&\-()]+)/i)?.[1]
        || lines.find(l => /\b(ltd|limited|pharma|labs?|laboratories|healthcare|remedies)\b/i.test(l));
      if (mfg) set('manufacturer', mfg.replace(/[.,]\s*$/, ''));

      if (filled > 0) toast.success(`Scanned ${filled} field(s). Please review and complete the rest before saving.`);
      else toast.warning('Could not read details clearly — please enter them manually.');
    } catch {
      toast.error('Could not read the photo. Enter the details manually.');
    } finally {
      setScanning(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { if (!o) attemptClose(); else onOpenChange(true); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Medicine' : 'Add New Medicine'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update medicine details in the master.' : 'Add a new medicine to the pharmacy master list.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          {!isEdit && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-primary" />
                <span><span className="font-medium">Scan a medicine strip/box</span> to auto-fill — then review.</span>
              </div>
              <Button type="button" variant="outline" size="sm" className="gap-1 shrink-0" disabled={scanning}
                onClick={() => scanFileRef.current?.click()}>
                {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
                {scanning ? 'Reading…' : 'Scan photo'}
              </Button>
              <input ref={scanFileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) runScan(f); e.target.value = ''; }} />
            </div>
          )}
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Medicine Name <span className="text-destructive">*</span></Label>
              <Input {...register('name')} placeholder="e.g. Paracetamol 500mg" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Generic Name <span className="text-destructive">*</span></Label>
              <Input {...register('genericName')} placeholder="e.g. Paracetamol" />
              {errors.genericName && <p className="text-xs text-destructive">{errors.genericName.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Brand Name</Label>
              <Input {...register('brandName')} placeholder="e.g. Crocin" />
            </div>
            <div className="space-y-1">
              <Label>Manufacturer <span className="text-destructive">*</span></Label>
              <Input {...register('manufacturer')} placeholder="e.g. GSK India" />
              {errors.manufacturer && <p className="text-xs text-destructive">{errors.manufacturer.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>{ff.label('strength', 'Strength')} <span className="text-destructive">*</span></Label>
              <Input {...register('strength')} placeholder="e.g. 500mg" />
              {errors.strength && <p className="text-xs text-destructive">{errors.strength.message}</p>}
            </div>
          </div>

          {/* Category, Form, Unit */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Category <span className="text-destructive">*</span></Label>
              <Select value={category} onValueChange={(v) => setValue('category', v as MedicineCategory)}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent className="max-h-48">
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Form <span className="text-destructive">*</span></Label>
              <Select value={form} onValueChange={(v) => setValue('form', v as MedicineForm)}>
                <SelectTrigger><SelectValue placeholder="Select form" /></SelectTrigger>
                <SelectContent>
                  {FORMS.map((f) => <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.form && <p className="text-xs text-destructive">{errors.form.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Unit <span className="text-destructive">*</span></Label>
              <Select value={unit} onValueChange={(v) => setValue('unit', v as MedicineUnit)}>
                <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => <SelectItem key={u} value={u} className="capitalize">{u}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.unit && <p className="text-xs text-destructive">{errors.unit.message}</p>}
            </div>
          </div>

          {/* Schedule, Rx, GST */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Drug Schedule <span className="text-destructive">*</span></Label>
              <Select value={schedule ?? 'none'} onValueChange={handleScheduleChange}>
                <SelectTrigger><SelectValue placeholder="Schedule" /></SelectTrigger>
                <SelectContent>
                  {SCHEDULES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.schedule && <p className="text-xs text-destructive">{errors.schedule.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>GST Rate (%)</Label>
              <Select value={String(gstRate)} onValueChange={(v) => setValue('gstRate', Number(v))}>
                <SelectTrigger><SelectValue placeholder="GST %" /></SelectTrigger>
                <SelectContent>
                  {GST_RATES.map((r) => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col justify-end space-y-1">
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2.5 text-sm">
                <input type="checkbox" checked={requiresPrescription} onChange={(e) => setValue('requiresPrescription', e.target.checked)} className="h-4 w-4 accent-primary" />
                Requires Prescription (Rx)
              </label>
            </div>
          </div>

          {/* Pricing */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pricing</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>MRP (₹) <span className="text-destructive">*</span></Label>
                <Input type="number" step="0.01" {...register('mrp')} placeholder="0.00" />
                {errors.mrp && <p className="text-xs text-destructive">{errors.mrp.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Selling Price (₹) <span className="text-destructive">*</span></Label>
                <Input type="number" step="0.01" {...register('sellingPrice')} placeholder="0.00" />
                {errors.sellingPrice && <p className="text-xs text-destructive">{errors.sellingPrice.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Purchase Price (₹)</Label>
                <Input type="number" step="0.01" {...register('purchasePrice')} placeholder="0.00" />
              </div>
            </div>
          </div>

          {/* Other */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Composition</Label>
              <Input {...register('composition')} placeholder="Active ingredients" />
            </div>
            <div className="space-y-1">
              <Label>{ff.label('hsnCode', 'HSN Code')} <span className="text-destructive">*</span></Label>
              <Input {...register('hsn')} placeholder="e.g. 30049099" />
              {errors.hsn && <p className="text-xs text-destructive">{errors.hsn.message}</p>}
            </div>
            {ff.isEnabled('reorderLevel') && (
              <div className="space-y-1">
                <Label>{ff.label('reorderLevel', 'Reorder Level')}</Label>
                <Input type="number" {...register('reorderLevel')} placeholder="Minimum stock quantity" />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={attemptClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Add Medicine'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard changes?</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes. Are you sure you want to cancel? Your entries will be lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={discardAndClose}>
            Discard changes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

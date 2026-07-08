'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Medicine, MedicineCategory, MedicineForm, MedicineUnit, DrugSchedule } from '@pharmaos/types';

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
  hsn: z.string().optional(),
  schedule: z.string().optional(),
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

const CATEGORIES: MedicineCategory[] = ['analgesic', 'antibiotic', 'antacid', 'antihistamine', 'antifungal', 'antiviral', 'cardiovascular', 'diabetes', 'dermatology', 'gastroenterology', 'gynecology', 'neurology', 'oncology', 'ophthalmology', 'orthopedic', 'pediatric', 'psychiatry', 'respiratory', 'urology', 'vitamins', 'surgical', 'other'];
const FORMS: MedicineForm[] = ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'ointment', 'drops', 'inhaler', 'powder', 'gel', 'patch', 'spray', 'lotion', 'suspension', 'suppository'];
const UNITS: MedicineUnit[] = ['strip', 'bottle', 'vial', 'tube', 'sachet', 'box', 'piece'];
const SCHEDULES: { value: string; label: string }[] = [{ value: 'none', label: 'None (OTC)' }, { value: 'H', label: 'Schedule H' }, { value: 'H1', label: 'Schedule H1' }, { value: 'X', label: 'Schedule X' }, { value: 'G', label: 'Schedule G' }];
const GST_RATES = [0, 5, 12, 18];

async function saveMedicine(data: FormValues, id?: string): Promise<Medicine> {
  const payload = { ...data, schedule: (data.schedule === 'none' ? null : data.schedule) as DrugSchedule };
  const res = await fetch(id ? `/api/medicines/${id}` : '/api/medicines', {
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

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormValues>({
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Medicine' : 'Add New Medicine'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update medicine details in the master.' : 'Add a new medicine to the pharmacy master list.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
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
              <Label>Strength <span className="text-destructive">*</span></Label>
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
              <Label>Drug Schedule</Label>
              <Select value={schedule ?? 'none'} onValueChange={(v) => setValue('schedule', v)}>
                <SelectTrigger><SelectValue placeholder="Schedule" /></SelectTrigger>
                <SelectContent>
                  {SCHEDULES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
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
              <Label>HSN Code</Label>
              <Input {...register('hsn')} placeholder="e.g. 30049099" />
            </div>
            <div className="space-y-1">
              <Label>Reorder Level</Label>
              <Input type="number" {...register('reorderLevel')} placeholder="Minimum stock quantity" />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Add Medicine'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

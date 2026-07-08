'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Eye, EyeOff, Pencil, Check, X, ChevronUp, ChevronDown,
  Plus, Trash2, GripVertical, Receipt, Pill, Package,
  Users, Building2, FileText, AlertCircle, RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldType = 'text' | 'number' | 'date' | 'select' | 'textarea' | 'phone' | 'email' | 'toggle';

interface FieldConfig {
  id: string;
  originalLabel: string;
  label: string;
  type: FieldType;
  required: boolean;
  enabled: boolean;
  order: number;
  isCustom: boolean;
  placeholder?: string;
  options?: string[];
}

interface FormConfig {
  id: string;
  name: string;
  description: string;
  fields: FieldConfig[];
}

// ─── Default configs ──────────────────────────────────────────────────────────

const DEFAULT_CONFIGS: FormConfig[] = [
  {
    id: 'billing',
    name: 'Billing / POS',
    description: 'Customer info fields on the billing screen',
    fields: [
      { id: 'customerName', originalLabel: 'Customer Name', label: 'Customer Name', type: 'text', required: false, enabled: true, order: 0, isCustom: false, placeholder: 'Patient / customer name' },
      { id: 'customerPhone', originalLabel: 'Phone Number', label: 'Phone Number', type: 'phone', required: false, enabled: true, order: 1, isCustom: false, placeholder: '10-digit mobile' },
      { id: 'doctorName', originalLabel: 'Doctor Name', label: 'Doctor Name', type: 'text', required: false, enabled: true, order: 2, isCustom: false, placeholder: 'Referring doctor' },
      { id: 'globalDiscount', originalLabel: 'Bill Discount %', label: 'Bill Discount %', type: 'number', required: false, enabled: true, order: 3, isCustom: false },
    ],
  },
  {
    id: 'medicine',
    name: 'Medicine Master',
    description: 'Fields in the Add / Edit medicine catalog form',
    fields: [
      { id: 'name', originalLabel: 'Medicine Name', label: 'Medicine Name', type: 'text', required: true, enabled: true, order: 0, isCustom: false },
      { id: 'genericName', originalLabel: 'Generic Name', label: 'Generic Name', type: 'text', required: true, enabled: true, order: 1, isCustom: false },
      { id: 'manufacturer', originalLabel: 'Manufacturer', label: 'Manufacturer', type: 'text', required: true, enabled: true, order: 2, isCustom: false },
      { id: 'category', originalLabel: 'Category', label: 'Category', type: 'select', required: true, enabled: true, order: 3, isCustom: false },
      { id: 'dosageForm', originalLabel: 'Dosage Form', label: 'Dosage Form', type: 'select', required: false, enabled: true, order: 4, isCustom: false },
      { id: 'strength', originalLabel: 'Strength', label: 'Strength', type: 'text', required: false, enabled: true, order: 5, isCustom: false, placeholder: 'e.g. 500mg' },
      { id: 'hsnCode', originalLabel: 'HSN Code', label: 'HSN Code', type: 'text', required: false, enabled: true, order: 6, isCustom: false },
      { id: 'scheduleH', originalLabel: 'Schedule H Drug', label: 'Schedule H Drug', type: 'toggle', required: false, enabled: true, order: 7, isCustom: false },
      { id: 'mrp', originalLabel: 'MRP (₹)', label: 'MRP (₹)', type: 'number', required: true, enabled: true, order: 8, isCustom: false },
      { id: 'sellingPrice', originalLabel: 'Selling Price (₹)', label: 'Selling Price (₹)', type: 'number', required: true, enabled: true, order: 9, isCustom: false },
      { id: 'reorderLevel', originalLabel: 'Reorder Level', label: 'Reorder Level', type: 'number', required: false, enabled: true, order: 10, isCustom: false },
    ],
  },
  {
    id: 'inventory',
    name: 'Add Stock',
    description: 'Fields when recording a new stock / purchase entry',
    fields: [
      { id: 'batchNumber', originalLabel: 'Batch Number', label: 'Batch Number', type: 'text', required: true, enabled: true, order: 0, isCustom: false },
      { id: 'quantity', originalLabel: 'Quantity', label: 'Quantity', type: 'number', required: true, enabled: true, order: 1, isCustom: false },
      { id: 'purchasePrice', originalLabel: 'Purchase Price (₹)', label: 'Purchase Price (₹)', type: 'number', required: true, enabled: true, order: 2, isCustom: false },
      { id: 'mrp', originalLabel: 'MRP (₹)', label: 'MRP (₹)', type: 'number', required: true, enabled: true, order: 3, isCustom: false },
      { id: 'sellingPrice', originalLabel: 'Selling Price (₹)', label: 'Selling Price (₹)', type: 'number', required: false, enabled: true, order: 4, isCustom: false },
      { id: 'manufacturingDate', originalLabel: 'Manufacturing Date', label: 'Manufacturing Date', type: 'date', required: false, enabled: true, order: 5, isCustom: false },
      { id: 'expiryDate', originalLabel: 'Expiry Date', label: 'Expiry Date', type: 'date', required: true, enabled: true, order: 6, isCustom: false },
      { id: 'supplierName', originalLabel: 'Supplier Name', label: 'Supplier Name', type: 'text', required: false, enabled: true, order: 7, isCustom: false },
      { id: 'rackLocation', originalLabel: 'Rack / Shelf Location', label: 'Rack / Shelf Location', type: 'text', required: false, enabled: false, order: 8, isCustom: false },
    ],
  },
  {
    id: 'customer',
    name: 'Customer Profile',
    description: 'Fields when adding or editing a customer record',
    fields: [
      { id: 'name', originalLabel: 'Full Name', label: 'Full Name', type: 'text', required: true, enabled: true, order: 0, isCustom: false },
      { id: 'phone', originalLabel: 'Phone Number', label: 'Phone Number', type: 'phone', required: true, enabled: true, order: 1, isCustom: false },
      { id: 'email', originalLabel: 'Email Address', label: 'Email Address', type: 'email', required: false, enabled: true, order: 2, isCustom: false },
      { id: 'dob', originalLabel: 'Date of Birth', label: 'Date of Birth', type: 'date', required: false, enabled: false, order: 3, isCustom: false },
      { id: 'address', originalLabel: 'Address', label: 'Address', type: 'textarea', required: false, enabled: false, order: 4, isCustom: false },
      { id: 'loyaltyProgram', originalLabel: 'Enroll in Loyalty Program', label: 'Enroll in Loyalty Program', type: 'toggle', required: false, enabled: true, order: 5, isCustom: false },
    ],
  },
  {
    id: 'vendor',
    name: 'Vendor / Supplier',
    description: 'Fields when adding or editing a supplier/vendor',
    fields: [
      { id: 'name', originalLabel: 'Company Name', label: 'Company Name', type: 'text', required: true, enabled: true, order: 0, isCustom: false },
      { id: 'contactPerson', originalLabel: 'Contact Person', label: 'Contact Person', type: 'text', required: false, enabled: true, order: 1, isCustom: false },
      { id: 'phone', originalLabel: 'Phone', label: 'Phone', type: 'phone', required: false, enabled: true, order: 2, isCustom: false },
      { id: 'email', originalLabel: 'Email', label: 'Email', type: 'email', required: false, enabled: true, order: 3, isCustom: false },
      { id: 'gstNumber', originalLabel: 'GST Number', label: 'GST Number', type: 'text', required: false, enabled: true, order: 4, isCustom: false },
      { id: 'paymentTerms', originalLabel: 'Credit Days', label: 'Credit Days', type: 'number', required: false, enabled: true, order: 5, isCustom: false },
      { id: 'creditLimit', originalLabel: 'Credit Limit (₹)', label: 'Credit Limit (₹)', type: 'number', required: false, enabled: true, order: 6, isCustom: false },
      { id: 'city', originalLabel: 'City', label: 'City', type: 'text', required: false, enabled: true, order: 7, isCustom: false },
      { id: 'drugLicense', originalLabel: 'Drug License No.', label: 'Drug License No.', type: 'text', required: false, enabled: false, order: 8, isCustom: false },
    ],
  },
  {
    id: 'prescription',
    name: 'Prescription',
    description: 'Fields on the prescription entry form',
    fields: [
      { id: 'patientName', originalLabel: 'Patient Name', label: 'Patient Name', type: 'text', required: true, enabled: true, order: 0, isCustom: false },
      { id: 'patientAge', originalLabel: 'Age', label: 'Age', type: 'number', required: false, enabled: true, order: 1, isCustom: false },
      { id: 'gender', originalLabel: 'Gender', label: 'Gender', type: 'select', required: false, enabled: false, order: 2, isCustom: false, options: ['Male', 'Female', 'Other'] },
      { id: 'doctorName', originalLabel: 'Doctor Name', label: 'Doctor Name', type: 'text', required: true, enabled: true, order: 3, isCustom: false },
      { id: 'doctorReg', originalLabel: 'Doctor Reg. No.', label: 'Doctor Reg. No.', type: 'text', required: false, enabled: true, order: 4, isCustom: false },
      { id: 'prescriptionNo', originalLabel: 'Prescription No.', label: 'Prescription No.', type: 'text', required: false, enabled: false, order: 5, isCustom: false },
      { id: 'date', originalLabel: 'Prescription Date', label: 'Prescription Date', type: 'date', required: true, enabled: true, order: 6, isCustom: false },
      { id: 'diagnosis', originalLabel: 'Diagnosis / Notes', label: 'Diagnosis / Notes', type: 'textarea', required: false, enabled: false, order: 7, isCustom: false },
    ],
  },
];

const FORM_ICONS: Record<string, React.ElementType> = {
  billing: Receipt,
  medicine: Pill,
  inventory: Package,
  customer: Users,
  vendor: Building2,
  prescription: FileText,
};

const TYPE_COLORS: Record<FieldType, string> = {
  text: 'bg-blue-50 text-blue-700 border-blue-200',
  number: 'bg-amber-50 text-amber-700 border-amber-200',
  date: 'bg-purple-50 text-purple-700 border-purple-200',
  select: 'bg-teal-50 text-teal-700 border-teal-200',
  textarea: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  phone: 'bg-green-50 text-green-700 border-green-200',
  email: 'bg-orange-50 text-orange-700 border-orange-200',
  toggle: 'bg-pink-50 text-pink-700 border-pink-200',
};

const STORAGE_KEY = 'pharmaos_form_config';

// ─── Persistence helpers ──────────────────────────────────────────────────────

function loadConfigs(): FormConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIGS;
    const saved = JSON.parse(raw) as Record<string, FieldConfig[]>;
    return DEFAULT_CONFIGS.map((form) => ({
      ...form,
      fields: saved[form.id] ?? form.fields,
    }));
  } catch {
    return DEFAULT_CONFIGS;
  }
}

function saveConfigs(configs: FormConfig[]) {
  const toSave: Record<string, FieldConfig[]> = {};
  configs.forEach((f) => { toSave[f.id] = f.fields; });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

// ─── Add-field blank ──────────────────────────────────────────────────────────

const BLANK_NEW_FIELD: Omit<FieldConfig, 'id' | 'order'> = {
  originalLabel: '', label: '', type: 'text', required: false,
  enabled: true, isCustom: true, placeholder: '',
};

// ─── Main section ─────────────────────────────────────────────────────────────

export function FormFieldsSection() {
  const [configs, setConfigs] = useState<FormConfig[]>(() => loadConfigs());
  const [selectedForm, setSelectedForm] = useState('billing');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showAddField, setShowAddField] = useState(false);
  const [newField, setNewField] = useState({ ...BLANK_NEW_FIELD });
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  const form = configs.find((c) => c.id === selectedForm)!;
  const fields = [...form.fields].sort((a, b) => a.order - b.order);

  useEffect(() => {
    if (editingId && editInputRef.current) editInputRef.current.focus();
  }, [editingId]);

  function updateFields(formId: string, updater: (fields: FieldConfig[]) => FieldConfig[]) {
    setConfigs((prev) => prev.map((c) =>
      c.id === formId ? { ...c, fields: updater(c.fields) } : c
    ));
    setHasChanges(true);
  }

  function toggleField(fieldId: string) {
    updateFields(selectedForm, (flds) =>
      flds.map((f) => f.id === fieldId ? { ...f, enabled: !f.enabled } : f)
    );
  }

  function toggleRequired(fieldId: string) {
    updateFields(selectedForm, (flds) =>
      flds.map((f) => f.id === fieldId ? { ...f, required: !f.required } : f)
    );
  }

  function startEdit(field: FieldConfig) {
    setEditingId(field.id);
    setEditValue(field.label);
  }

  function commitEdit() {
    if (!editingId || !editValue.trim()) { setEditingId(null); return; }
    updateFields(selectedForm, (flds) =>
      flds.map((f) => f.id === editingId ? { ...f, label: editValue.trim() } : f)
    );
    setEditingId(null);
  }

  function cancelEdit() { setEditingId(null); setEditValue(''); }

  function moveField(fieldId: string, dir: 'up' | 'down') {
    updateFields(selectedForm, (flds) => {
      const sorted = [...flds].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((f) => f.id === fieldId);
      const target = dir === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= sorted.length) return flds;
      // Swap orders
      const a = sorted[idx]!;
      const b = sorted[target]!;
      return flds.map((f) => {
        if (f.id === a.id) return { ...f, order: b.order };
        if (f.id === b.id) return { ...f, order: a.order };
        return f;
      });
    });
  }

  function deleteCustomField(fieldId: string) {
    updateFields(selectedForm, (flds) => flds.filter((f) => f.id !== fieldId));
  }

  function addCustomField() {
    if (!newField.label.trim()) { toast.error('Field name is required'); return; }
    const id = `custom_${Date.now()}`;
    const maxOrder = Math.max(-1, ...fields.map((f) => f.order));
    updateFields(selectedForm, (flds) => [
      ...flds,
      { ...newField, id, originalLabel: newField.label.trim(), label: newField.label.trim(), order: maxOrder + 1 },
    ]);
    setNewField({ ...BLANK_NEW_FIELD });
    setShowAddField(false);
    toast.success(`Field "${newField.label}" added`);
  }

  function resetForm() {
    const defaultForm = DEFAULT_CONFIGS.find((c) => c.id === selectedForm)!;
    setConfigs((prev) => prev.map((c) => c.id === selectedForm ? { ...c, fields: defaultForm.fields } : c));
    setHasChanges(true);
    toast.info(`"${form.name}" reset to defaults`);
  }

  async function save() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    saveConfigs(configs);
    setSaving(false);
    setHasChanges(false);
    toast.success('Form field configuration saved');
  }

  const enabledCount = fields.filter((f) => f.enabled).length;
  const customCount = fields.filter((f) => f.isCustom).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold">Form Fields</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Enable, rename, reorder, and add custom fields to any form in the app
          </p>
        </div>
        {hasChanges && (
          <Button onClick={save} disabled={saving} size="sm">
            {saving
              ? <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              : <Check className="h-3.5 w-3.5" />
            }
            Save Changes
          </Button>
        )}
      </div>

      <div className="grid grid-cols-[220px_1fr] gap-5 items-start">
        {/* Left: Form selector */}
        <div className="space-y-1.5">
          {configs.map((c) => {
            const Icon = FORM_ICONS[c.id] ?? FileText;
            const active = selectedForm === c.id;
            const enabled = c.fields.filter((f) => f.enabled).length;
            const total = c.fields.length;
            return (
              <button
                key={c.id}
                onClick={() => { setSelectedForm(c.id); setShowAddField(false); setEditingId(null); }}
                className={cn(
                  'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all',
                  active ? 'bg-primary/10 text-primary ring-1 ring-primary/20' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', active ? 'bg-primary/20' : 'bg-muted')}>
                  <Icon className={cn('h-3.5 w-3.5', active ? 'text-primary' : 'text-muted-foreground')} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{c.name}</p>
                  <p className="text-2xs text-muted-foreground">{enabled}/{total} fields on</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Field list */}
        <div className="rounded-xl border border-border bg-background overflow-hidden">
          {/* Form header */}
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">{form.name}</p>
              <p className="text-xs text-muted-foreground">{form.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {enabledCount} of {fields.length} enabled
                {customCount > 0 && ` · ${customCount} custom`}
              </span>
              <button
                onClick={resetForm}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="Reset to defaults"
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
            </div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-2 border-b border-border px-3 py-1.5 bg-muted/10">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-8">On</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Field Name</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-14 text-center">Type</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-14 text-center">Required</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-12 text-center">Order</span>
            <span className="w-6" />
          </div>

          {/* Field rows */}
          <div className="divide-y divide-border">
            {fields.map((field, idx) => {
              const isEditing = editingId === field.id;
              const isFirst = idx === 0;
              const isLast = idx === fields.length - 1;

              return (
                <div
                  key={field.id}
                  className={cn(
                    'grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-2 px-3 py-2.5 transition-colors group',
                    !field.enabled && 'bg-muted/20',
                    field.isCustom && 'bg-blue-50/30 dark:bg-blue-900/10'
                  )}
                >
                  {/* Enable toggle */}
                  <button
                    onClick={() => toggleField(field.id)}
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-md transition-colors',
                      field.enabled
                        ? 'text-success hover:bg-success/10'
                        : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted'
                    )}
                    title={field.enabled ? 'Disable field' : 'Enable field'}
                  >
                    {field.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>

                  {/* Label — editable inline */}
                  <div className="flex items-center gap-2 min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-1 flex-1">
                        <input
                          ref={editInputRef}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
                          className="flex-1 h-7 rounded-md border border-primary/50 bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-0"
                        />
                        <button onClick={commitEdit} className="shrink-0 text-success hover:bg-success/10 p-1 rounded">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={cancelEdit} className="shrink-0 text-muted-foreground hover:text-foreground p-1 rounded">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className={cn('text-sm truncate', !field.enabled && 'text-muted-foreground line-through')}>
                          {field.label}
                        </span>
                        {field.label !== field.originalLabel && (
                          <span className="text-[10px] text-muted-foreground shrink-0">(was: {field.originalLabel})</span>
                        )}
                        {field.isCustom && (
                          <Badge className="text-[10px] bg-blue-100 text-blue-700 border-blue-200 shrink-0 px-1.5 py-0">custom</Badge>
                        )}
                        <button
                          onClick={() => startEdit(field)}
                          className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground p-0.5 rounded transition-opacity"
                          title="Rename field"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Type badge */}
                  <div className="w-14 flex justify-center">
                    <span className={cn('inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium capitalize', TYPE_COLORS[field.type])}>
                      {field.type}
                    </span>
                  </div>

                  {/* Required toggle */}
                  <div className="w-14 flex justify-center">
                    <button
                      onClick={() => toggleRequired(field.id)}
                      title={field.required ? 'Mark optional' : 'Mark required'}
                      className={cn(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded border transition-colors',
                        field.required
                          ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                          : 'bg-muted text-muted-foreground border-border hover:bg-muted/70'
                      )}
                    >
                      {field.required ? 'Req' : 'Opt'}
                    </button>
                  </div>

                  {/* Order arrows */}
                  <div className="w-12 flex items-center justify-center gap-0.5">
                    <button
                      onClick={() => moveField(field.id, 'up')}
                      disabled={isFirst}
                      className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors rounded"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => moveField(field.id, 'down')}
                      disabled={isLast}
                      className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors rounded"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Delete (custom only) */}
                  <div className="w-6 flex justify-center">
                    {field.isCustom ? (
                      <button
                        onClick={() => deleteCustomField(field.id)}
                        className="text-muted-foreground hover:text-destructive p-0.5 rounded transition-colors opacity-0 group-hover:opacity-100"
                        title="Remove custom field"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    ) : (
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/20" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add custom field */}
          {showAddField ? (
            <div className="border-t border-dashed border-primary/30 bg-primary/5 p-4 space-y-3">
              <p className="text-xs font-semibold text-primary">New Custom Field</p>
              <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                <Input
                  value={newField.label}
                  onChange={(e) => setNewField((p) => ({ ...p, label: e.target.value }))}
                  placeholder="Field label, e.g. Allergy History"
                  className="h-8 text-sm"
                  onKeyDown={(e) => { if (e.key === 'Enter') addCustomField(); if (e.key === 'Escape') setShowAddField(false); }}
                  autoFocus
                />
                <select
                  value={newField.type}
                  onChange={(e) => setNewField((p) => ({ ...p, type: e.target.value as FieldType }))}
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {(['text', 'number', 'date', 'select', 'textarea', 'phone', 'email', 'toggle'] as FieldType[]).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <div className="flex gap-1">
                  <Button size="sm" className="h-8 px-3" onClick={addCustomField}>
                    <Check className="h-3.5 w-3.5" /> Add
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => { setShowAddField(false); setNewField({ ...BLANK_NEW_FIELD }); }}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newField.required}
                    onChange={(e) => setNewField((p) => ({ ...p, required: e.target.checked }))}
                    className="h-3 w-3 rounded accent-primary"
                  />
                  Required field
                </label>
                <Input
                  value={newField.placeholder ?? ''}
                  onChange={(e) => setNewField((p) => ({ ...p, placeholder: e.target.value }))}
                  placeholder="Placeholder text (optional)"
                  className="h-7 text-xs flex-1"
                />
              </div>
            </div>
          ) : (
            <div className="border-t border-dashed border-border px-4 py-3">
              <button
                onClick={() => setShowAddField(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add Custom Field
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Eye className="h-3 w-3 text-success" /> Field visible in form
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <EyeOff className="h-3 w-3" /> Field hidden (still collected if required)
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <AlertCircle className="h-3 w-3 text-rose-500" /> Pencil icon appears on hover to rename
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">custom</span> Your added field
        </div>
      </div>
    </div>
  );
}

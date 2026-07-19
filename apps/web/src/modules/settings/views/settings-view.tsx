'use client';

import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Store, Users, CreditCard, Upload, Bell, Settings2,
  Save, CheckCircle, Download, FileSpreadsheet,
  Archive, Image as ImageIcon, Loader2,
  Building2, Globe,
  Package, Pill, Receipt, Banknote, Smartphone, BookOpen,
  ChevronRight, Info, Mail, MessageCircle, PhoneCall,
  FormInput, ShieldCheck, UserCog, Shield, ClipboardList, ExternalLink,
  MessageSquare, Plus,
} from 'lucide-react';
import Link from 'next/link';
import { FormFieldsSection } from '../components/form-fields-section';
import { AccessControlSection } from '../components/access-control-section';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

// ─── API ─────────────────────────────────────────────────────────────────────

type SettingsData = {
  profile: Record<string, string | null>;
  system: Record<string, unknown>;
  tax: { enableGST: boolean; gstRegistered: boolean; defaultGST: number; gstSlabs: Array<{ rate: number; category: string; examples: string }> };
  billing: Record<string, unknown>;
  notifications: Record<string, boolean | string>;
  templates?: { values: Record<string, string>; variables: Record<string, string[]> };
};

async function fetchSettings(): Promise<SettingsData> {
  const r = await apiFetch('/api/settings');
  const j = await r.json() as { success: boolean; data: SettingsData };
  if (!j.success || !j.data) throw new Error('Failed to load settings');
  return j.data;
}

async function saveSection(section: string, data: Record<string, unknown>) {
  const r = await apiFetch(`/api/settings/${section}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return r.json();
}

// ─── Shared components ────────────────────────────────────────────────────────

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_1.5fr] items-start gap-4 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors',
        checked ? 'bg-primary' : 'bg-muted-foreground/30'
      )}
    >
      <span className={cn(
        'pointer-events-none absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
        checked ? 'translate-x-4' : 'translate-x-0.5'
      )} />
    </button>
  );
}

function ToggleRow({ label, description, checked, onChange, icon }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
      <div className="flex-1 flex items-start gap-2">
        {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
        <div>
          <p className="text-sm font-medium">{label}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} />
    </div>
  );
}

function SectionHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
      {action}
    </div>
  );
}

function SaveBar({ onSave, saving }: { onSave: () => void; saving: boolean }) {
  return (
    <div className="mt-8 flex justify-end border-t border-border pt-4">
      <Button onClick={onSave} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save Changes
      </Button>
    </div>
  );
}

// ─── Sections ────────────────────────────────────────────────────────────────

function ProfileSection({ data, onSave }: { data: SettingsData; onSave: (section: string, d: Record<string, unknown>) => Promise<void> }) {
  const [form, setForm] = useState({ ...data.profile });
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function set(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  async function save() {
    setSaving(true);
    await onSave('profile', form);
    setSaving(false);
    toast.success('Pharmacy profile saved');
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    toast.success('Logo uploaded — will appear on receipts');
  }

  return (
    <div>
      <SectionHeader title="Pharmacy Profile" description="Your pharmacy's identity — appears on receipts, reports and patient records" />

      {/* Logo */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30">
          {logoPreview ? (
            <img src={logoPreview} alt="Logo" className="h-full w-full rounded-2xl object-cover" />
          ) : (
            <Store className="h-8 w-8 text-muted-foreground/40" />
          )}
        </div>
        <div>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <ImageIcon className="h-4 w-4" /> Upload Logo
          </Button>
          <p className="text-xs text-muted-foreground mt-1.5">PNG or JPG, max 2MB. Appears on printed invoices.</p>
          <input ref={fileRef} type="file" className="hidden" accept="image/*" onChange={handleLogoChange} />
        </div>
      </div>

      <Separator className="mb-4" />

      {/* Basic info */}
      <div className="space-y-0 divide-y divide-border">
        <FieldRow label="Pharmacy Name" hint="As it should appear on invoices">
          <Input value={String(form.pharmacyName ?? '')} onChange={(e) => set('pharmacyName', e.target.value)} className="h-8 text-sm" />
        </FieldRow>
        <FieldRow label="Owner / Pharmacist Name">
          <Input value={String(form.ownerName ?? '')} onChange={(e) => set('ownerName', e.target.value)} className="h-8 text-sm" />
        </FieldRow>
        <FieldRow label="Pharmacy Type">
          <Select value={String(form.pharmacyType ?? '')} onValueChange={(v) => set('pharmacyType', v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Retail Pharmacy">Retail Pharmacy</SelectItem>
              <SelectItem value="Hospital Pharmacy">Hospital Pharmacy</SelectItem>
              <SelectItem value="Wholesale">Wholesale / Distributor</SelectItem>
              <SelectItem value="Online Pharmacy">Online Pharmacy</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Drug License Number" hint="Required for dispensing Schedule-H drugs">
          <Input value={String(form.drugLicenseNumber ?? '')} onChange={(e) => set('drugLicenseNumber', e.target.value)} className="h-8 text-sm font-mono" placeholder="DL-MH-2024-XXXX" />
        </FieldRow>
        <FieldRow label="GST Number" hint="15-character GSTIN">
          <Input value={String(form.gstNumber ?? '')} onChange={(e) => set('gstNumber', e.target.value)} className="h-8 text-sm font-mono" placeholder="27ABCDE1234F1Z5" maxLength={15} />
        </FieldRow>
      </div>

      <Separator className="my-4" />
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Contact & Address</p>

      <div className="space-y-0 divide-y divide-border">
        <FieldRow label="Address">
          <Input value={String(form.address ?? '')} onChange={(e) => set('address', e.target.value)} className="h-8 text-sm" />
        </FieldRow>
        <FieldRow label="City / State / PIN">
          <div className="grid grid-cols-3 gap-2">
            <Input value={String(form.city ?? '')} onChange={(e) => set('city', e.target.value)} className="h-8 text-sm" placeholder="City" />
            <Input value={String(form.state ?? '')} onChange={(e) => set('state', e.target.value)} className="h-8 text-sm" placeholder="State" />
            <Input value={String(form.pincode ?? '')} onChange={(e) => set('pincode', e.target.value)} className="h-8 text-sm font-mono" placeholder="PIN" maxLength={6} />
          </div>
        </FieldRow>
        <FieldRow label="Phone / Mobile">
          <div className="grid grid-cols-2 gap-2">
            <Input value={String(form.phone ?? '')} onChange={(e) => set('phone', e.target.value)} className="h-8 text-sm" placeholder="Landline" />
            <Input value={String(form.mobile ?? '')} onChange={(e) => set('mobile', e.target.value)} className="h-8 text-sm" placeholder="Mobile" />
          </div>
        </FieldRow>
        <FieldRow label="Email">
          <Input value={String(form.email ?? '')} onChange={(e) => set('email', e.target.value)} className="h-8 text-sm" type="email" />
        </FieldRow>
      </div>

      <SaveBar onSave={save} saving={saving} />
    </div>
  );
}

function TaxSection({ data, onSave }: { data: SettingsData; onSave: (s: string, d: Record<string, unknown>) => Promise<void> }) {
  const [form, setForm] = useState({ ...data.tax, gstSlabs: data.tax?.gstSlabs ?? [] });
  const [billing, setBilling] = useState({ ...data.billing });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await Promise.all([onSave('tax', form as unknown as Record<string, unknown>), onSave('billing', billing)]);
    setSaving(false);
    toast.success('Tax & billing settings saved');
  }

  return (
    <div>
      <SectionHeader title="Tax & Billing" description="GST configuration, payment methods and invoice customization" />

      <div className="space-y-4">
        <div className="rounded-xl border border-border p-4 space-y-3">
          <p className="text-sm font-semibold">GST Settings</p>
          <ToggleRow label="GST Registered" description="Enable GST on all transactions" checked={Boolean(form.enableGST)} onChange={(v) => setForm((p) => ({ ...p, enableGST: v }))} />
          <ToggleRow label="Show GST on Invoices" description="Print GST breakdown on patient receipts" checked={Boolean(billing.showGSTOnReceipt)} onChange={(v) => setBilling((p) => ({ ...p, showGSTOnReceipt: v }))} />
          <ToggleRow label="Show Generic Name" description="Print generic name below brand name on receipts" checked={Boolean(billing.showGenericName)} onChange={(v) => setBilling((p) => ({ ...p, showGenericName: v }))} />
        </div>

        <div className="rounded-xl border border-border p-4 space-y-3">
          <p className="text-sm font-semibold">GST Slabs</p>
          <div className="space-y-2">
            {form.gstSlabs.map((slab, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2">
                <Badge variant={slab.rate === 0 ? 'success' : 'muted'} className="w-12 justify-center text-xs font-mono">
                  {slab.rate}%
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">{slab.category}</p>
                  <p className="text-2xs text-muted-foreground truncate">{slab.examples}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">GST slabs are as per Indian pharmacy regulations. Contact support to customize.</p>
        </div>

        <div className="rounded-xl border border-border p-4 space-y-3">
          <p className="text-sm font-semibold">Payment Methods Accepted</p>
          {[
            { key: 'acceptCash', label: 'Cash', Icon: Banknote },
            { key: 'acceptUPI', label: 'UPI / QR', Icon: Smartphone },
            { key: 'acceptCard', label: 'Credit / Debit Card', Icon: CreditCard },
            { key: 'acceptCredit', label: 'Store Credit / Due', Icon: BookOpen },
          ].map(({ key, label, Icon }) => (
            <ToggleRow key={key} label={label} icon={<Icon className="h-3.5 w-3.5 text-muted-foreground" />} checked={Boolean(billing[key])} onChange={(v) => setBilling((p) => ({ ...p, [key]: v }))} />
          ))}
          {Boolean(billing.acceptUPI) && (
            <div className="pt-1">
              <Label className="text-xs">UPI ID</Label>
              <Input value={String(billing.upiId ?? '')} onChange={(e) => setBilling((p) => ({ ...p, upiId: e.target.value }))} className="h-8 text-sm mt-1 font-mono" placeholder="yourpharmacy@upi" />
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border p-4 space-y-3">
          <p className="text-sm font-semibold">Receipt Customization</p>
          <div>
            <Label className="text-xs">Terms & Conditions</Label>
            <textarea
              value={String(billing.termsOnReceipt ?? '')}
              onChange={(e) => setBilling((p) => ({ ...p, termsOnReceipt: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <Label className="text-xs">Thank You Message</Label>
            <Input
              value={String(billing.thankYouMessage ?? '')}
              onChange={(e) => setBilling((p) => ({ ...p, thankYouMessage: e.target.value }))}
              className="h-8 text-sm mt-1"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium">Auto-print receipt on sale</p>
              <p className="text-2xs text-muted-foreground">Sends to default printer after each bill</p>
            </div>
            <ToggleSwitch checked={Boolean(billing.printReceiptOnSale)} onChange={(v) => setBilling((p) => ({ ...p, printReceiptOnSale: v }))} />
          </div>
        </div>
      </div>

      <SaveBar onSave={save} saving={saving} />
    </div>
  );
}

function ImportSection() {
  const [type, setType] = useState('medicines');
  const [phase, setPhase] = useState<'idle' | 'ready' | 'importing' | 'done'>('idle');
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const IMPORT_TYPES = [
    { value: 'medicines', label: 'Medicine Catalog', Icon: Pill, desc: 'Drug master list with prices and GST', ext: '.xlsx .csv' },
    { value: 'inventory', label: 'Inventory / Stock', Icon: Package, desc: 'Current stock with batches and expiry', ext: '.xlsx .csv' },
    { value: 'customers', label: 'Customers', Icon: Users, desc: 'Customer names, phones and addresses', ext: '.xlsx .csv' },
    { value: 'vendors', label: 'Vendors / Suppliers', Icon: Building2, desc: 'Supplier list with payment terms', ext: '.csv' },
  ];

  const EXPORT_TYPES = [
    { value: 'medicines', label: 'Medicine Catalog', Icon: Pill },
    { value: 'inventory', label: 'Current Stock', Icon: Package },
    { value: 'customers', label: 'Customers', Icon: Users },
    { value: 'vendors', label: 'Vendors', Icon: Building2 },
    { value: 'bills', label: 'All Bills', Icon: Receipt },
    { value: 'backup', label: 'Full Data (.json)', Icon: Archive },
  ];

  function handleFile(f: File) { setFile(f); setPhase('ready'); }
  function handleDrop(e: React.DragEvent) { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }

  // Minimal RFC-4180 CSV parser — handles quoted fields, escaped quotes, CRLF
  function parseCsv(text: string): Array<Record<string, string>> {
    const rows: string[][] = [];
    let cell = '', row: string[] = [], inQuotes = false;
    const src = text.replace(/^﻿/, '');
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (inQuotes) {
        if (ch === '"') {
          if (src[i + 1] === '"') { cell += '"'; i++; }
          else inQuotes = false;
        } else cell += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && src[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.some((c) => c.trim() !== '')) rows.push(row);
        row = [];
      } else cell += ch;
    }
    row.push(cell);
    if (row.some((c) => c.trim() !== '')) rows.push(row);
    if (rows.length < 2) return [];
    const headers = rows[0]!.map((h) => h.trim());
    return rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()])));
  }

  async function startImport() {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      toast.error('Please upload a .csv file', { description: 'Open your Excel file and use "Save As → CSV" first.' });
      return;
    }
    setPhase('importing');
    setProgress(0);
    const iv = setInterval(() => setProgress((p) => Math.min(p + 4 + Math.random() * 6, 90)), 150);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) throw new Error('File has no data rows (header + at least one row required)');
      const res = await apiFetch(`/api/settings/import/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json() as { success: boolean; message?: string; data: { imported: number; skipped: number; errors: number; errorDetails?: Array<{ row: number; message: string }> } };
      if (!res.ok || !data.success) throw new Error(data.message ?? 'Import failed');
      clearInterval(iv);
      setProgress(100);
      setResult(data.data);
      setPhase('done');
      if (data.data.errors > 0 && data.data.errorDetails?.length) {
        toast.warning(`${data.data.errors} rows had errors`, {
          description: data.data.errorDetails.slice(0, 3).map((e) => `Row ${e.row}: ${e.message}`).join(' · '),
          duration: 10000,
        });
      }
    } catch (err) {
      clearInterval(iv);
      setPhase('ready');
      toast.error('Import failed', { description: (err as Error).message });
    }
  }

  async function exportData(t: string) {
    const loading = toast.loading(`Exporting ${t}…`);
    const res = await apiFetch(`/api/settings/export/${t}`);
    toast.dismiss(loading);
    if (!res.ok) { toast.error('Export failed'); return; }
    const blob = await res.blob();
    const ext = t === 'backup' ? 'json' : 'csv';
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `pharmaos-${t}-${new Date().toISOString().slice(0, 10)}.${ext}`,
    });
    a.click();
    toast.success(`${t} exported`);
  }

  const TEMPLATE_HEADERS: Record<string, string[]> = {
    medicines: ['Medicine Name', 'Generic Name', 'Manufacturer', 'Category', 'Dosage Form', 'Strength', 'Schedule', 'MRP', 'Selling Price', 'HSN Code', 'GST %'],
    inventory: ['Medicine Name', 'Batch Number', 'Qty', 'Purchase Price', 'MRP', 'Expiry Date (MM/YYYY)', 'Rack Location'],
    customers: ['Name', 'Phone', 'Email', 'Address', 'City', 'Date of Birth', 'Notes'],
    vendors: ['Company Name', 'Contact Person', 'Phone', 'Email', 'Address', 'GST Number', 'Payment Terms (days)', 'Credit Limit'],
  };

  function downloadTemplate() {
    const headers = TEMPLATE_HEADERS[type];
    if (!headers) { toast.error('No template for this type'); return; }
    const sample = type === 'medicines'
      ? '\r\nParacetamol 650mg,Paracetamol,GSK India,analgesic,tablet,650mg,,25,22,30049099,12'
      : '';
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([headers.join(',') + sample], { type: 'text/csv' })),
      download: `pharmaos-${type}-template.csv`,
    });
    a.click();
    toast.success('Template downloaded — fill it in Excel, save as CSV, then upload');
  }

  function reset() { setFile(null); setPhase('idle'); setProgress(0); setResult(null); }

  return (
    <div>
      <SectionHeader
        title="Import & Export"
        description="Migrate your existing data or export for backup and reporting"
      />

      <div className="space-y-6">
        {/* Import */}
        <div className="rounded-xl border border-border p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            <p className="font-semibold text-sm">Import Data</p>
          </div>

          {/* Type picker */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {IMPORT_TYPES.map((t) => {
              const Icon = t.Icon;
              return (
                <button
                  key={t.value}
                  onClick={() => { setType(t.value); reset(); }}
                  className={cn(
                    'rounded-xl border p-3 text-left transition-all',
                    type === t.value ? 'border-primary bg-primary/5 ring-1 ring-primary/50' : 'border-border hover:border-muted-foreground/40'
                  )}
                >
                  <Icon className={cn('h-5 w-5 mb-1', type === t.value ? 'text-primary' : 'text-muted-foreground')} />
                  <p className="text-xs font-semibold mt-1">{t.label}</p>
                  <p className="text-2xs text-muted-foreground">{t.ext}</p>
                </button>
              );
            })}
          </div>

          {/* Template download */}
          <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-success shrink-0" />
              <div>
                <p className="text-xs font-semibold">Download Excel Template</p>
                <p className="text-2xs text-muted-foreground">
                  {IMPORT_TYPES.find((t) => t.value === type)?.desc}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-xs shrink-0" onClick={downloadTemplate}>
              <Download className="h-3 w-3" /> Download
            </Button>
          </div>

          {/* Drop zone */}
          {(phase === 'idle' || phase === 'ready') && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={cn(
                'cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all',
                dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/40',
                phase === 'ready' ? 'border-success bg-success/5' : ''
              )}
            >
              {phase === 'ready' && file ? (
                <div className="space-y-2">
                  <CheckCircle className="h-8 w-8 text-success mx-auto" />
                  <p className="text-sm font-semibold text-success">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                  <button className="text-xs text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); reset(); }}>Remove</button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                  <p className="text-sm text-muted-foreground">Drag & drop file here, or click to browse</p>
                </div>
              )}
              <input ref={inputRef} type="file" className="hidden" accept=".xlsx,.xls,.csv,.zip" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>
          )}

          {/* Progress */}
          {phase === 'importing' && (
            <div className="space-y-2 p-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <p className="text-sm font-medium">Importing…</p>
                <span className="ml-auto text-xs text-muted-foreground">{Math.round(progress)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all duration-200" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {/* Done */}
          {phase === 'done' && result && (
            <div className="rounded-xl border border-success/30 bg-success/5 p-4">
              <div className="flex items-center gap-2 text-success mb-3">
                <CheckCircle className="h-5 w-5" />
                <p className="font-semibold">Import Successful</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-lg bg-background p-2">
                  <p className="text-xl font-bold text-success">{result.imported.toLocaleString()}</p>
                  <p className="text-2xs text-muted-foreground">Imported</p>
                </div>
                <div className="rounded-lg bg-background p-2">
                  <p className="text-xl font-bold text-warning-600">{result.skipped}</p>
                  <p className="text-2xs text-muted-foreground">Skipped</p>
                </div>
                <div className="rounded-lg bg-background p-2">
                  <p className="text-xl font-bold text-destructive">{result.errors}</p>
                  <p className="text-2xs text-muted-foreground">Errors</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="mt-3 w-full text-xs" onClick={reset}>Import More</Button>
            </div>
          )}

          {phase === 'ready' && file && (
            <Button className="w-full" onClick={startImport}>
              <Upload className="h-4 w-4" /> Start Import — {IMPORT_TYPES.find((t) => t.value === type)?.label}
            </Button>
          )}
        </div>

        {/* Export */}
        <div className="rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            <p className="font-semibold text-sm">Export Data</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {EXPORT_TYPES.map((t) => {
              const Icon = t.Icon;
              return (
                <button
                  key={t.value}
                  onClick={() => exportData(t.value)}
                  className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-left transition-all hover:border-primary/40 hover:bg-primary/5"
                >
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs font-semibold">{t.label}</p>
                    <p className="text-2xs text-muted-foreground">Download</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Backup */}
        <div className="rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-primary" />
            <p className="font-semibold text-sm">Backup & Restore</p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Create Full Backup</p>
              <p className="text-xs text-muted-foreground">SQL dump via pg_dump (or JSON snapshot) saved on the server</p>
            </div>
            <Button variant="outline" size="sm" onClick={async () => {
              const t = toast.loading('Creating backup…');
              const res = await apiFetch('/api/settings/backup', { method: 'POST' });
              const j = await res.json() as { success: boolean; message?: string; data?: { file: string; size: string; method: string } };
              toast.dismiss(t);
              if (res.ok && j.success && j.data) {
                toast.success(`Backup created — ${j.data.file} (${j.data.size})`, { description: j.message, duration: 8000 });
              } else {
                toast.error('Backup failed', { description: j.message });
              }
            }}>
              <Archive className="h-4 w-4" /> Backup Now
            </Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Restore from Backup</p>
              <p className="text-xs text-muted-foreground">SQL backups restore via <code className="font-data">psql</code> — see DEPLOYMENT.md. Data CSVs restore via Import above.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const TEMPLATE_META: { key: string; label: string; channel: string; hint: string }[] = [
  { key: 'refillReminder', label: 'Refill Reminder', channel: 'WhatsApp / SMS', hint: 'Sent to a customer when their medicine is due for a refill.' },
  { key: 'paymentDue', label: 'Payment Due', channel: 'WhatsApp / SMS', hint: 'Sent to a customer with a pending credit balance.' },
  { key: 'lowStockAlert', label: 'Low Stock Alert', channel: 'SMS to you', hint: 'Sent to your alert number when items run low.' },
  { key: 'expiryAlert', label: 'Expiry Alert', channel: 'SMS to you', hint: 'Sent to your alert number for near-expiry batches.' },
];

function fillPreview(tpl: string): string {
  const sample: Record<string, string> = {
    customerName: 'Ramesh', medicine: 'Paracetamol 500mg', overdue: ' (3 days overdue)',
    pharmacyName: 'Divya Pharmacy', amount: '450', count: '4', days: '90',
  };
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => sample[k] ?? `{{${k}}}`).replace(/\s{2,}/g, ' ').trim();
}

function TemplatesSection({ data, onSave }: { data: SettingsData; onSave: (s: string, d: Record<string, unknown>) => Promise<void> }) {
  const initial = data.templates?.values ?? {};
  const variables = data.templates?.variables ?? {};
  const [form, setForm] = useState<Record<string, string>>({ ...initial });
  const [saving, setSaving] = useState(false);

  function insertVar(key: string, v: string) {
    setForm((p) => ({ ...p, [key]: `${p[key] ?? ''}{{${v}}}` }));
  }

  async function save() {
    setSaving(true);
    await onSave('templates', { values: form });
    setSaving(false);
    toast.success('Message templates saved');
  }

  return (
    <div>
      <SectionHeader
        title="Message Templates"
        description="Customize the wording of automated messages. Use {{variables}} — they are filled in automatically when a message is sent."
        action={<Button size="sm" onClick={save} disabled={saving} className="gap-1">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save</Button>}
      />
      <div className="space-y-5">
        {TEMPLATE_META.map(({ key, label, channel, hint }) => {
          const value = form[key] ?? initial[key] ?? '';
          const vars = variables[key] ?? [];
          return (
            <div key={key} className="rounded-xl border border-border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-2xs text-muted-foreground">{hint}</p>
                </div>
                <Badge variant="secondary" className="gap-1 text-2xs"><MessageCircle className="h-3 w-3" /> {channel}</Badge>
              </div>
              <textarea
                value={value}
                onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value.slice(0, 500) }))}
                rows={3}
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Message text…"
              />
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-2xs text-muted-foreground mr-1">Insert:</span>
                {vars.map((v) => (
                  <button key={v} type="button" onClick={() => insertVar(key, v)}
                    className="inline-flex items-center gap-0.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-2xs font-medium text-primary hover:bg-primary/20">
                    <Plus className="h-2.5 w-2.5" />{v}
                  </button>
                ))}
                <span className="ml-auto text-2xs text-muted-foreground">{value.length}/500</span>
              </div>
              <div className="rounded-lg bg-muted/60 px-3 py-2">
                <p className="text-2xs font-medium text-muted-foreground mb-0.5">Preview</p>
                <p className="text-xs">{fillPreview(value) || <span className="text-muted-foreground italic">Empty</span>}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NotificationsSection({ data, onSave }: { data: SettingsData; onSave: (s: string, d: Record<string, unknown>) => Promise<void> }) {
  const [form, setForm] = useState({ ...data.notifications });
  const [saving, setSaving] = useState(false);

  function toggle(k: string) { setForm((p) => ({ ...p, [k]: !p[k] })); }

  async function save() {
    setSaving(true);
    await onSave('notifications', form as Record<string, unknown>);
    setSaving(false);
    toast.success('Notification preferences saved');
  }

  return (
    <div>
      <SectionHeader title="Notifications & Alerts" description="Control when and how you receive alerts about stock, expiry and reports" />

      <div className="space-y-4">
        <div className="rounded-xl border border-border p-4 space-y-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Stock Alerts</p>
          <ToggleRow label="Low Stock Alert" description="When an item falls below its reorder level" checked={Boolean(form.lowStockAlert)} onChange={() => toggle('lowStockAlert')} />
          <ToggleRow label="Expiry Alert" description="When batches expire within the configured threshold" checked={Boolean(form.expiryAlert)} onChange={() => toggle('expiryAlert')} />
          <ToggleRow label="Reorder Reminder" description="Suggest reorders when stock is critically low" checked={Boolean(form.reorderAlert)} onChange={() => toggle('reorderAlert')} />
        </div>

        <div className="rounded-xl border border-border p-4 space-y-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Reports</p>
          <ToggleRow label="Daily Sales Summary" description="End-of-day sales report" checked={Boolean(form.dailyReport)} onChange={() => toggle('dailyReport')} />
          <ToggleRow label="Weekly Performance Report" description="Revenue trends and top medicines" checked={Boolean(form.weeklyReport)} onChange={() => toggle('weeklyReport')} />
          <ToggleRow label="Monthly P&L Report" description="Monthly profit and loss summary" checked={Boolean(form.monthlyReport)} onChange={() => toggle('monthlyReport')} />
        </div>

        <div className="rounded-xl border border-border p-4 space-y-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Alert Channels</p>
          <ToggleRow icon={<Globe className="h-3.5 w-3.5 text-muted-foreground" />} label="In-App Notifications" description="Alerts inside PharmaOS (always on)" checked={true} onChange={() => {}} />
          <ToggleRow icon={<Mail className="h-3.5 w-3.5 text-muted-foreground" />} label="Email Alerts" description="Send alerts to your registered email" checked={Boolean(form.emailAlerts)} onChange={() => toggle('emailAlerts')} />
          <ToggleRow icon={<MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />} label="WhatsApp Alerts" description="Receive alerts via WhatsApp Business" checked={Boolean(form.whatsappAlerts)} onChange={() => toggle('whatsappAlerts')} />
          <ToggleRow icon={<PhoneCall className="h-3.5 w-3.5 text-muted-foreground" />} label="SMS Alerts" description="Text message alerts (per-SMS charges apply)" checked={Boolean(form.smsAlerts)} onChange={() => toggle('smsAlerts')} />
        </div>
      </div>

      <SaveBar onSave={save} saving={saving} />
    </div>
  );
}

function SystemSection({ data, onSave }: { data: SettingsData; onSave: (s: string, d: Record<string, unknown>) => Promise<void> }) {
  const [form, setForm] = useState({ ...data.system });
  const [saving, setSaving] = useState(false);

  function set(k: string, v: unknown) { setForm((p) => ({ ...p, [k]: v })); }

  async function save() {
    setSaving(true);
    await onSave('system', form);
    setSaving(false);
    toast.success('System settings saved');
  }

  return (
    <div>
      <SectionHeader title="System Settings" description="Localization, stock thresholds and automatic backup configuration" />

      <div className="space-y-4">
        <div className="rounded-xl border border-border p-4 space-y-0 divide-y divide-border">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Localization</p>
          <FieldRow label="Timezone">
            <Select value={String(form.timezone ?? 'Asia/Kolkata')} onValueChange={(v) => set('timezone', v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</SelectItem>
                <SelectItem value="Asia/Dubai">Asia/Dubai (UAE, UTC+4)</SelectItem>
                <SelectItem value="UTC">UTC</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Date Format">
            <Select value={String(form.dateFormat ?? 'DD/MM/YYYY')} onValueChange={(v) => set('dateFormat', v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (India standard)</SelectItem>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (US)</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (ISO)</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Currency">
            <Select value={String(form.currency ?? 'INR')} onValueChange={(v) => set('currency', v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INR">₹ Indian Rupee (INR)</SelectItem>
                <SelectItem value="USD">$ US Dollar (USD)</SelectItem>
                <SelectItem value="AED">د.إ UAE Dirham (AED)</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
        </div>

        <div className="rounded-xl border border-border p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stock Thresholds</p>
          <FieldRow label="Low Stock Threshold" hint="Items below this quantity are flagged as low stock">
            <Input type="number" value={Number(form.lowStockThreshold ?? 50)} onChange={(e) => set('lowStockThreshold', Number(e.target.value))} className="h-8 text-sm w-28" />
          </FieldRow>
          <FieldRow label="Expiry Alert (days)" hint="Alert when items expire within this many days">
            <Select value={String(form.expiryAlertDays ?? 90)} onValueChange={(v) => set('expiryAlertDays', Number(v))}>
              <SelectTrigger className="h-8 text-sm w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="60">60 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="180">180 days</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
        </div>

        <div className="rounded-xl border border-border p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Auto Backup</p>
          <ToggleRow label="Automatic Backup" description="Automatically backup all data on schedule" checked={Boolean(form.autoBackup)} onChange={(v) => set('autoBackup', v)} />
          {Boolean(form.autoBackup) && (
            <FieldRow label="Backup Frequency">
              <Select value={String(form.backupFrequency ?? 'daily')} onValueChange={(v) => set('backupFrequency', v)}>
                <SelectTrigger className="h-8 text-sm w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily (midnight)</SelectItem>
                  <SelectItem value="weekly">Weekly (Sunday)</SelectItem>
                  <SelectItem value="monthly">Monthly (1st)</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
          )}
        </div>
      </div>

      <SaveBar onSave={save} saving={saving} />
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'profile',        label: 'Pharmacy Profile', icon: Store,        description: 'Name, logo, license, address' },
  { id: 'tax',            label: 'Tax & Billing',    icon: CreditCard,   description: 'GST, payment methods, receipts' },
  { id: 'import',         label: 'Import & Export',  icon: Upload,       description: 'Migration, bulk import, backup' },
  { id: 'notifications',  label: 'Notifications',    icon: Bell,         description: 'Alerts and report preferences' },
  { id: 'templates',      label: 'Message Templates', icon: MessageSquare, description: 'Notification & WhatsApp/SMS wording' },
  { id: 'system',         label: 'System',           icon: Settings2,    description: 'Localization, thresholds, backup' },
  { id: 'form-fields',    label: 'Form Fields',      icon: FormInput,    description: 'Add, rename or disable fields' },
  { id: 'access-control', label: 'Access Control',   icon: ShieldCheck,  description: 'Menu & tab visibility per role' },
];

export function SettingsView() {
  const [activeSection, setActiveSection] = useState('profile');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });

  const mutation = useMutation({
    mutationFn: ({ section, payload }: { section: string; payload: Record<string, unknown> }) =>
      saveSection(section, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  async function onSave(section: string, payload: Record<string, unknown>) {
    await mutation.mutateAsync({ section, payload });
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure everything about your pharmacy — profile, taxes, alerts and more</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-[240px_1fr] gap-6">
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
          </div>
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      ) : data ? (
        <div className="grid grid-cols-[240px_1fr] gap-6 items-start">
          {/* Left nav */}
          <nav className="space-y-1 sticky top-6">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const isActive = activeSection === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-all',
                    isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', isActive ? 'bg-primary/20' : 'bg-muted')}>
                    <Icon className={cn('h-4 w-4', isActive ? 'text-primary' : 'text-muted-foreground')} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{s.label}</p>
                    <p className="text-2xs truncate opacity-60">{s.description}</p>
                  </div>
                  {isActive && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </button>
              );
            })}

            {/* Admin quick-links */}
            <div className="mt-4">
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Administration</p>
              {[
                { href: '/users',  label: 'User Management',  icon: UserCog },
                { href: '/roles',  label: 'Roles & Permissions', icon: Shield },
                { href: '/audit',  label: 'Audit Log',        icon: ClipboardList },
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="text-xs font-semibold flex-1">{label}</span>
                  <ExternalLink className="h-3 w-3 opacity-40" />
                </Link>
              ))}
            </div>

            {/* Info box */}
            <div className="mt-4 rounded-xl bg-muted/50 p-3">
              <div className="flex items-start gap-2">
                <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-2xs text-muted-foreground leading-relaxed">Changes are saved per section. Your data is never shared.</p>
              </div>
            </div>
          </nav>

          {/* Content */}
          <div className="rounded-2xl border border-border bg-card p-6 min-h-[500px]">
            {activeSection === 'profile'        && <ProfileSection data={data} onSave={onSave} />}
            {activeSection === 'tax'            && <TaxSection data={data} onSave={onSave} />}
            {activeSection === 'import'         && <ImportSection />}
            {activeSection === 'notifications'  && <NotificationsSection data={data} onSave={onSave} />}
            {activeSection === 'templates'      && <TemplatesSection data={data} onSave={onSave} />}
            {activeSection === 'system'         && <SystemSection data={data} onSave={onSave} />}
            {activeSection === 'form-fields'    && <FormFieldsSection />}
            {activeSection === 'access-control' && <AccessControlSection />}
          </div>
        </div>
      ) : null}
    </div>
  );
}

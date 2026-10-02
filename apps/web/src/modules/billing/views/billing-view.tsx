'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Search, Plus, Minus, Trash2, Receipt, History, X, Loader2,
  User, Printer, Clock, CheckCircle, MoreHorizontal, Eye,
  Download, Package, Scan, Tag, MessageCircle, QrCode, PackagePlus,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Medicine, Bill } from '@pharmaos/types';
import { formatCurrency, formatDateTime } from '@pharmaos/utils';
import { DataTable, SortableHeader } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { apiFetch } from '@/lib/api';
import { useCan } from '@/lib/permissions';
import { useFormFieldConfig } from '@/lib/form-fields';
import { isOnline, getCatalog, cacheCatalog, enqueueOp } from '@/lib/offline';
import QRCode from 'qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Receipt/print config — mirrors the server default so a missing/partial config
// still renders a clean, compliant receipt.
type PaperSize = 'thermal80' | 'thermal58' | 'a5' | 'a4';
type ReceiptConfig = {
  paperSize: PaperSize;
  showDoctor: boolean; showBatch: boolean; showExpiry: boolean; showHsn: boolean;
  showGstBreakdown: boolean; showSavings: boolean; showCashier: boolean;
  showPhone: boolean; showAddress: boolean; showGstin: boolean; showDrugLicense: boolean;
  showLicense: boolean; showPoweredBy: boolean; showQr: boolean; compact: boolean;
};
const RECEIPT_DEFAULTS: ReceiptConfig = {
  paperSize: 'thermal80',
  showDoctor: true, showBatch: true, showExpiry: true, showHsn: false,
  showGstBreakdown: true, showSavings: true, showCashier: true,
  showPhone: true, showAddress: true, showGstin: true, showDrugLicense: true,
  showLicense: false, showPoweredBy: true, showQr: false, compact: false,
};

// Pharmacy identity printed on the bill (pulled live from the tenant profile).
interface PharmacyInfo {
  name?: string; phone?: string; email?: string;
  address?: string; city?: string; state?: string; pincode?: string;
  gstin?: string; drugLicense?: string; license?: string; upiId?: string; logo?: string;
}

// Build the QR payload for a bill: a real, scannable UPI intent string when the
// pharmacy has a UPI ID configured (so the customer can actually pay), else a
// plain bill reference. Used by both the receipt QR and the checkout QR.
function upiPayString(ph: PharmacyInfo, billNo: string, amount: number): string {
  if (ph.upiId) {
    return `upi://pay?pa=${encodeURIComponent(ph.upiId)}&pn=${encodeURIComponent(ph.name || 'Pharmacy')}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent('Bill ' + billNo)}`;
  }
  return `${ph.name || 'Pharma Ist'}|${billNo}|INR${amount.toFixed(2)}`;
}
// Tax & Billing settings that affect what the printed bill shows (distinct from
// receiptConfig): GST display on/off, generic-name printing, and the custom
// thank-you / terms text — all configured in Settings → Tax & Billing.
interface BillingPrintOpts { showGst?: boolean; showGenericName?: boolean; thankYouMessage?: string; terms?: string; }
interface ReceiptOpts { pharmacy?: PharmacyInfo; phone?: string; cashier?: string; qrDataUrl?: string; config?: Partial<ReceiptConfig>; billing?: BillingPrintOpts; }

// ─── Types ──────────────────────────────────────────────────────────────────

interface CartItem {
  medicineId: string;
  inventoryItemId: string;
  medicineName: string;
  genericName: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  saleUnit: 'pack' | 'unit';     // sold by strip/pack, or as loose tablets/capsules
  unitsPerPack: number;
  packSellingPrice: number;      // base strip price (for switching pack ⇄ unit)
  packMrp: number;
  availableUnits: number;        // total loose units sellable from the resolved batch
  mrp: number;
  sellingPrice: number;
  discount: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
  requiresPrescription: boolean;
  schedule?: string | null;
  stockQty: number;
}

const SCHEDULED_DRUGS = ['H', 'H1', 'X'];

interface HeldBill {
  id: string;
  label: string;
  heldAt: Date;
  items: CartItem[];
  customerName: string;
  customerPhone: string;
  doctor: string;
  globalDiscount: number;
}

// Demo barcodes for quick scan simulation
const DEMO_BARCODES = [
  { code: '8901030654532', label: 'Paracetamol' },
  { code: '8901030867424', label: 'Amoxicillin' },
  { code: '8901030129483', label: 'Pantoprazole' },
  { code: '8901030475829', label: 'Metformin' },
];

// ─── UPI QR Code component ───────────────────────────────────────────────────

function UPIQRCode({ data, size = 130 }: { data: string; size?: number }) {
  // Renders a REAL, scannable QR (via the qrcode lib) from the UPI intent
  // string — the previous hand-drawn pseudo-random grid was not scannable.
  const [src, setSrc] = React.useState<string>('');
  React.useEffect(() => {
    let alive = true;
    if (!data) { setSrc(''); return; }
    QRCode.toDataURL(data, { margin: 1, width: Math.max(size * 2, 240), errorCorrectionLevel: 'M' })
      .then((url) => { if (alive) setSrc(url); })
      .catch(() => { if (alive) setSrc(''); });
    return () => { alive = false; };
  }, [data, size]);
  if (!src) {
    return <div style={{ width: size, height: size }} className="flex items-center justify-center rounded bg-muted text-[9px] text-muted-foreground">QR</div>;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Scan to pay (UPI)" width={size} height={size} style={{ display: 'block' }} />;
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function calcLine(item: CartItem): CartItem {
  const base = item.sellingPrice * item.quantity;
  const discAmt = base * (item.discount / 100);
  const taxable = base - discAmt;
  const gst = taxable * (item.gstRate / 100);
  return { ...item, gstAmount: Number(gst.toFixed(2)), totalAmount: Number((taxable + gst).toFixed(2)) };
}

function stockLabel(qty: number, reorder: number): { text: string; cls: string } {
  if (qty === 0) return { text: 'Out of Stock', cls: 'text-destructive' };
  if (qty < reorder * 0.4) return { text: `Low: ${qty}`, cls: 'text-warning-600' };
  return { text: `${qty} in stock`, cls: 'text-success' };
}

function expiryAlert(exp: string): string | null {
  const days = Math.ceil((new Date(exp).getTime() - Date.now()) / 86400000);
  if (days < 0) return '⚠ EXPIRED';
  if (days < 90) return `⚠ ${Math.ceil(days / 30)}mo left`;
  return null;
}

// Minimal HTML escape for values interpolated into the printed document.
function esc(s?: string | null): string {
  return String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
}

// Geometry per paper size. Thermal → roll printer (80mm/58mm). A5/A4 → a full
// tax-invoice page. `mono` keeps the classic thermal monospace look; page sizes
// use a proportional font and a bordered invoice layout.
const PAPER_GEO: Record<PaperSize, { page: string; width: string; font: string; mono: boolean; win: [number, number] }> = {
  thermal80: { page: '80mm auto', width: '72mm', font: '10.5px', mono: true, win: [360, 640] },
  thermal58: { page: '58mm auto', width: '50mm', font: '9px', mono: true, win: [300, 640] },
  a5:        { page: 'A5',        width: '100%', font: '11px', mono: false, win: [640, 800] },
  a4:        { page: 'A4',        width: '100%', font: '12px', mono: false, win: [820, 900] },
};

// Render + open the print window for a bill in whichever paper format the tenant
// configured. Thermal sizes reuse the compact roll layout; A5/A4 render a full
// GST tax invoice. Pharmacy identity (address / GSTIN / drug licence) is included
// per the receipt config.
function printReceipt(bill: Bill, total: number, payMethod: string, opts: ReceiptOpts = {}) {
  const cfg = { ...RECEIPT_DEFAULTS, ...(opts.config ?? {}) };
  const geo = PAPER_GEO[cfg.paperSize] ?? PAPER_GEO.thermal80;
  const isThermal = cfg.paperSize === 'thermal80' || cfg.paperSize === 'thermal58';
  const compact = cfg.compact || cfg.paperSize === 'thermal58';
  const ph: PharmacyInfo = { ...(opts.pharmacy ?? {}), phone: opts.pharmacy?.phone ?? opts.phone };
  const pharmacyName = ph.name || 'Pharmacy';
  // Tax & Billing toggles (default: show GST, hide generic name, standard thanks).
  const showGst = opts.billing?.showGst !== false;
  const showGenericName = opts.billing?.showGenericName === true;
  const thankYou = (opts.billing?.thankYouMessage || '').trim() || 'Thank you for your purchase! Visit again.';
  const terms = (opts.billing?.terms || '').trim();

  const totalGst = bill.items.reduce((s, i) => s + (i.gstAmount ?? 0), 0);
  const gstBreakup = new Map<number, number>();
  for (const i of bill.items) gstBreakup.set(i.gstRate ?? 0, (gstBreakup.get(i.gstRate ?? 0) ?? 0) + (i.gstAmount ?? 0));
  const gstRows = Array.from(gstBreakup.entries()).filter(([r]) => r > 0).sort(([a], [b]) => a - b);
  const savings = bill.items.reduce((s, i) => s + ((i.mrp ?? i.sellingPrice) * i.quantity), 0) - total;
  const hasScheduled = bill.items.some((i) => {
    const s = (i as { schedule?: string | null }).schedule;
    return s && SCHEDULED_DRUGS.includes(s);
  });
  const custName = (bill as { customerName?: string }).customerName ?? bill.customer?.name;
  const custPhone = (bill as { customerPhone?: string }).customerPhone ?? bill.customer?.phone;
  const doctor = (bill as { doctor?: string }).doctor;
  const totalQty = bill.items.reduce((s, i) => s + i.quantity, 0);

  // ── Shared pharmacy identity lines (address, contact, statutory licences) ──
  const addressLine = [ph.address, [ph.city, ph.state].filter(Boolean).join(', '), ph.pincode].filter(Boolean).join(', ');
  const identityLines: string[] = [];
  if (cfg.showAddress && addressLine) identityLines.push(esc(addressLine));
  const contactBits: string[] = [];
  if (cfg.showPhone && ph.phone) contactBits.push(`Ph: ${esc(ph.phone)}`);
  if (!isThermal && ph.email) contactBits.push(esc(ph.email));
  if (contactBits.length) identityLines.push(contactBits.join('  •  '));
  const licenceBits: string[] = [];
  if (cfg.showGstin && ph.gstin) licenceBits.push(`GSTIN: ${esc(ph.gstin)}`);
  if (cfg.showDrugLicense && ph.drugLicense) licenceBits.push(`D.L. No: ${esc(ph.drugLicense)}`);
  if (cfg.showLicense && ph.license) licenceBits.push(`Licence: ${esc(ph.license)}`);
  const licenceLine = licenceBits.join('  •  ');

  const scheduledNote = 'Schedule H/H1 drug — to be sold by retail on the prescription of a Registered Medical Practitioner only.';

  let content: string;

  if (isThermal) {
    // ── Roll printer layout (80mm / 58mm) ──
    const itemMeta = (i: Bill['items'][number]) => [
      cfg.showBatch ? `B:${esc(i.batchNumber)}` : '',
      cfg.showExpiry ? `E:${new Date(i.expiryDate).toLocaleDateString('en-IN', { month: '2-digit', year: '2-digit' })}` : '',
      i.discount ? `D:${i.discount}%` : '',
    ].filter(Boolean).join(' ');
    const gstSection = !showGst ? ''
      : (cfg.showGstBreakdown && !compact)
      ? gstRows.map(([rate, gst]) => `<tr><td>GST ${rate}% (C ${rate / 2} + S ${rate / 2})</td><td class="r">₹${gst.toFixed(2)}</td></tr>`).join('')
      : (totalGst > 0 ? `<tr><td>GST</td><td class="r">₹${totalGst.toFixed(2)}</td></tr>` : '');

    content = `<html><head><title>Bill ${esc(bill.billNumber)}</title>
<style>
  @page { size: ${geo.page}; margin: 0; }
  @media print { body { width: ${geo.width}; } }
  * { box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: ${geo.font}; width: ${geo.width};
         margin: 0 auto; padding: ${compact ? '2mm 1.5mm' : '4mm 2mm'}; color: #000; }
  h2 { font-size: 13px; margin: 0; text-align: center; }
  .sub { text-align: center; font-size: 8.5px; margin: 1px 0; line-height: 1.25; }
  p { margin: ${compact ? '1px 0' : '2px 0'}; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1.5px 0; vertical-align: top; font-size: ${geo.font}; }
  .r { text-align: right; white-space: nowrap; }
  .c { text-align: center; }
  .tot td { border-top: 1px solid #000; font-weight: bold; font-size: 12px; padding-top: 3px; }
  hr { border: 0; border-top: 1px dashed #000; margin: ${compact ? '2px 0' : '4px 0'}; }
  .small { font-size: 8.5px; }
  .warn { font-size: 8.5px; border: 1px solid #000; padding: 2px 4px; margin: 4px 0; text-align: center; }
</style></head><body>
${ph.logo ? `<p class="c" style="margin:0 0 2px"><img src="${ph.logo}" style="max-height:14mm;max-width:40mm;object-fit:contain"/></p>` : ''}
<h2>${esc(pharmacyName.toUpperCase())}</h2>
${identityLines.map((l) => `<p class="sub">${l}</p>`).join('')}
${licenceLine ? `<p class="sub">${licenceLine}</p>` : ''}
<p class="sub"><b>TAX INVOICE</b></p>
<hr/>
<p>Bill: <b>${esc(bill.billNumber)}</b></p>
<p>Date: ${formatDateTime(bill.createdAt)}</p>
<p>${custName ? `Customer: ${esc(custName)}` : 'Walk-in Customer'}${custPhone ? `<br/>Ph: ${esc(custPhone)}` : ''}</p>
${cfg.showDoctor && doctor ? `<p>Rx by: Dr. ${esc(doctor)}</p>` : ''}
${cfg.showCashier && opts.cashier ? `<p>Cashier: ${esc(opts.cashier)}</p>` : ''}
<hr/>
<table>
<tr><td><b>Item</b></td><td class="r"><b>Qty</b></td><td class="r"><b>Rate</b></td><td class="r"><b>Amt</b></td></tr>
${bill.items.map((i) => { const meta = itemMeta(i); const gen = showGenericName && (i as { genericName?: string }).genericName; return `
<tr><td colspan="4" style="padding-bottom:0">${esc(i.medicineName)}${gen ? `<br/><span class="small" style="font-style:italic">${esc((i as { genericName?: string }).genericName)}</span>` : ''}</td></tr>
<tr><td class="small">${meta}</td>
<td class="r">${i.quantity}</td><td class="r">${i.sellingPrice.toFixed(2)}</td><td class="r">${i.totalAmount.toFixed(2)}</td></tr>`; }).join('')}
</table>
<hr/>
<table>
<tr><td>Subtotal</td><td class="r">₹${bill.subtotal.toFixed(2)}</td></tr>
${bill.discountAmount > 0 ? `<tr><td>Discount (${bill.discountPercent}%)</td><td class="r">-₹${bill.discountAmount.toFixed(2)}</td></tr>` : ''}
${gstSection}
<tr class="tot"><td>TOTAL</td><td class="r">₹${total.toFixed(2)}</td></tr>
<tr><td>Paid (${esc(payMethod.toUpperCase())})</td><td class="r">₹${bill.paidAmount.toFixed(2)}</td></tr>
${bill.balanceAmount > 0 ? `<tr><td><b>Balance Due</b></td><td class="r"><b>₹${bill.balanceAmount.toFixed(2)}</b></td></tr>` : ''}
</table>
${cfg.showSavings && savings > 0.005 ? `<p class="c small">You saved ₹${savings.toFixed(2)}</p>` : ''}
${hasScheduled ? `<div class="warn">${scheduledNote}</div>` : ''}
${cfg.showQr && opts.qrDataUrl ? `<p class="c"><img src="${opts.qrDataUrl}" style="width:34mm;height:34mm"/></p>` : ''}
<hr/>
${compact ? '' : `<p class="c small">Items: ${bill.items.length} · Qty: ${totalQty}</p>`}
${terms ? `<p class="c small">${esc(terms)}</p>` : ''}
<p class="c small">${esc(thankYou)}</p>
${cfg.showPoweredBy ? '<p class="c small">Powered by Pharma Ist</p>' : ''}
<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},150);};</script>
</body></html>`;
  } else {
    // ── A5 / A4 full GST tax-invoice layout ──
    const cols: Array<{ h: string; cls?: string }> = [{ h: '#' }, { h: 'Particulars' }];
    if (cfg.showBatch) cols.push({ h: 'Batch' });
    if (cfg.showExpiry) cols.push({ h: 'Exp' });
    if (cfg.showHsn) cols.push({ h: 'HSN' });
    cols.push({ h: 'Qty', cls: 'r' }, { h: 'Rate', cls: 'r' });
    if (showGst) cols.push({ h: 'GST%', cls: 'r' });
    cols.push({ h: 'Amount', cls: 'r' });

    const rows = bill.items.map((i, idx) => {
      const gen = showGenericName && (i as { genericName?: string }).genericName;
      const cells = [`<td>${idx + 1}</td>`, `<td>${esc(i.medicineName)}${gen ? `<br/><span class="mut" style="font-style:italic">${esc((i as { genericName?: string }).genericName)}</span>` : ''}${i.discount ? ` <span class="mut">(−${i.discount}%)</span>` : ''}</td>`];
      if (cfg.showBatch) cells.push(`<td>${esc(i.batchNumber)}</td>`);
      if (cfg.showExpiry) cells.push(`<td>${new Date(i.expiryDate).toLocaleDateString('en-IN', { month: '2-digit', year: '2-digit' })}</td>`);
      if (cfg.showHsn) cells.push(`<td>${esc((i as { hsn?: string }).hsn ?? '')}</td>`);
      cells.push(`<td class="r">${i.quantity}</td>`, `<td class="r">${i.sellingPrice.toFixed(2)}</td>`);
      if (showGst) cells.push(`<td class="r">${i.gstRate ?? 0}%</td>`);
      cells.push(`<td class="r">${i.totalAmount.toFixed(2)}</td>`);
      return `<tr>${cells.join('')}</tr>`;
    }).join('');

    const gstSummary = !showGst ? ''
      : (cfg.showGstBreakdown && gstRows.length)
      ? gstRows.map(([rate, gst]) => `<tr><td>GST ${rate}% (CGST ${rate / 2}% + SGST ${rate / 2}%)</td><td class="r">₹${gst.toFixed(2)}</td></tr>`).join('')
      : (totalGst > 0 ? `<tr><td>GST</td><td class="r">₹${totalGst.toFixed(2)}</td></tr>` : '');

    content = `<html><head><title>Invoice ${esc(bill.billNumber)}</title>
<style>
  @page { size: ${geo.page}; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: ${geo.font}; color: #111; margin: 0; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #111; padding-bottom: 8px; }
  .ph-name { font-size: ${cfg.paperSize === 'a4' ? '20px' : '16px'}; font-weight: 800; letter-spacing: .3px; }
  .ph-lines { font-size: ${cfg.paperSize === 'a4' ? '11px' : '10px'}; color: #333; line-height: 1.5; margin-top: 2px; }
  .doc-title { text-align: right; }
  .doc-title h1 { font-size: 16px; margin: 0; letter-spacing: 2px; }
  .meta { font-size: 11px; color: #333; margin-top: 4px; line-height: 1.6; }
  .parties { display: flex; justify-content: space-between; gap: 16px; margin: 10px 0; font-size: 11px; }
  .parties .box { border: 1px solid #ccc; border-radius: 6px; padding: 6px 10px; flex: 1; }
  .parties .label { font-size: 9px; text-transform: uppercase; letter-spacing: .5px; color: #777; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 4px; }
  table.items th { background: #f3f4f6; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: .3px; border-bottom: 1px solid #d1d5db; }
  table.items td { padding: 6px 8px; border-bottom: 1px solid #eee; font-size: 11px; vertical-align: top; }
  table.items .r, th.r { text-align: right; }
  .mut { color: #999; font-size: 9px; }
  .foot { display: flex; justify-content: space-between; gap: 24px; margin-top: 10px; }
  .totals { margin-left: auto; min-width: 240px; }
  .totals table { width: 100%; border-collapse: collapse; }
  .totals td { padding: 3px 0; font-size: 11px; }
  .totals .r { text-align: right; }
  .totals .grand td { border-top: 2px solid #111; font-weight: 800; font-size: 14px; padding-top: 6px; }
  .warn { border: 1px solid #b45309; background: #fffbeb; color: #92400e; padding: 6px 10px; border-radius: 6px; font-size: 10px; margin-top: 10px; }
  .thanks { text-align: center; font-size: 10px; color: #666; margin-top: 14px; border-top: 1px dashed #ccc; padding-top: 8px; }
  .sign { text-align: right; font-size: 11px; margin-top: 28px; }
</style></head><body>
<div class="head">
  <div style="display:flex;gap:12px;align-items:flex-start">
    ${ph.logo ? `<img src="${ph.logo}" style="max-height:20mm;max-width:30mm;object-fit:contain"/>` : ''}
    <div>
      <div class="ph-name">${esc(pharmacyName)}</div>
      <div class="ph-lines">
        ${identityLines.join('<br/>')}
        ${licenceLine ? `<br/><b>${licenceLine}</b>` : ''}
      </div>
    </div>
  </div>
  <div class="doc-title">
    <h1>TAX INVOICE</h1>
    <div class="meta">
      <b>${esc(bill.billNumber)}</b><br/>
      ${formatDateTime(bill.createdAt)}
      ${cfg.showCashier && opts.cashier ? `<br/>Billed by: ${esc(opts.cashier)}` : ''}
    </div>
  </div>
</div>

<div class="parties">
  <div class="box">
    <div class="label">Billed To</div>
    ${custName ? `<b>${esc(custName)}</b>` : 'Walk-in Customer'}${custPhone ? `<br/>Ph: ${esc(custPhone)}` : ''}
    ${cfg.showDoctor && doctor ? `<br/>Rx by: Dr. ${esc(doctor)}` : ''}
  </div>
  <div class="box">
    <div class="label">Payment</div>
    Mode: <b>${esc(payMethod.toUpperCase())}</b><br/>
    Paid: ₹${bill.paidAmount.toFixed(2)}${bill.balanceAmount > 0 ? `<br/><b>Balance Due: ₹${bill.balanceAmount.toFixed(2)}</b>` : ''}
  </div>
</div>

<table class="items">
  <thead><tr>${cols.map((c) => `<th class="${c.cls ?? ''}">${c.h}</th>`).join('')}</tr></thead>
  <tbody>${rows}</tbody>
</table>

<div class="foot">
  <div style="font-size:10px;color:#555;max-width:50%">
    ${cfg.showSavings && savings > 0.005 ? `<p><b>You saved ₹${savings.toFixed(2)}</b> vs MRP.</p>` : ''}
    <p>Items: ${bill.items.length} &nbsp;·&nbsp; Total Qty: ${totalQty}</p>
    ${cfg.showQr && opts.qrDataUrl ? `<img src="${opts.qrDataUrl}" style="width:28mm;height:28mm"/>` : ''}
  </div>
  <div class="totals">
    <table>
      <tr><td>Subtotal</td><td class="r">₹${bill.subtotal.toFixed(2)}</td></tr>
      ${bill.discountAmount > 0 ? `<tr><td>Discount (${bill.discountPercent}%)</td><td class="r">−₹${bill.discountAmount.toFixed(2)}</td></tr>` : ''}
      ${gstSummary}
      <tr class="grand"><td>TOTAL</td><td class="r">₹${total.toFixed(2)}</td></tr>
    </table>
    <div class="sign">For ${esc(pharmacyName)}<br/><br/>Authorised Signatory</div>
  </div>
</div>

${hasScheduled ? `<div class="warn">${scheduledNote}</div>` : ''}
${terms ? `<div class="thanks" style="border:0;padding-top:6px">${esc(terms)}</div>` : ''}
<div class="thanks">
  ${esc(thankYou)}
  ${cfg.showPoweredBy ? '<br/>Powered by Pharma Ist' : ''}
</div>
<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},200);};</script>
</body></html>`;
  }

  const w = window.open('', '_blank', `width=${geo.win[0]},height=${geo.win[1]}`);
  if (!w) {
    toast.error('Pop-up blocked — allow pop-ups for this site to print receipts');
    return;
  }
  // Printing waits for the document's onload (script above) so the full receipt
  // is laid out before the print dialog opens (TC_027).
  w.document.write(content);
  w.document.close();
}

// Fetch the tenant's receipt config + pharmacy profile, generate the QR if
// enabled, then print in the configured paper format. Reads settings fresh so
// config changes apply without a reload; offline it falls back to clean defaults.
async function printBill(bill: Bill, total: number, payMethod: string, meta: { pharmacyName?: string; cashier?: string }) {
  let config: Partial<ReceiptConfig> = {};
  const pharmacy: PharmacyInfo = { name: meta.pharmacyName };
  const billingOpts: BillingPrintOpts = {};
  if (isOnline()) {
    try {
      const r = await apiFetch('/api/settings');
      const j = await r.json() as { data?: { receipt?: Partial<ReceiptConfig>; profile?: Record<string, string | null>; billing?: Record<string, unknown> } };
      config = j.data?.receipt ?? {};
      const p = j.data?.profile ?? {};
      pharmacy.name = p['pharmacyName'] || meta.pharmacyName || pharmacy.name;
      pharmacy.phone = p['mobile'] || p['phone'] || undefined;
      pharmacy.email = p['email'] || undefined;
      pharmacy.address = p['address'] || undefined;
      pharmacy.city = p['city'] || undefined;
      pharmacy.state = p['state'] || undefined;
      pharmacy.pincode = p['pincode'] || undefined;
      pharmacy.gstin = p['gstNumber'] || undefined;
      pharmacy.drugLicense = p['drugLicenseNumber'] || undefined;
      pharmacy.license = p['licenseNumber'] || undefined;
      pharmacy.logo = (typeof p['logoUrl'] === 'string' && p['logoUrl']) ? p['logoUrl'] as string : undefined;
      // Tax & Billing settings that shape the printed bill.
      const b = j.data?.billing ?? {};
      pharmacy.upiId = typeof b['upiId'] === 'string' && b['upiId'] ? b['upiId'] as string : undefined;
      billingOpts.showGst = b['showGSTOnReceipt'] !== false;
      billingOpts.showGenericName = b['showGenericName'] === true;
      billingOpts.thankYouMessage = typeof b['thankYouMessage'] === 'string' ? b['thankYouMessage'] as string : undefined;
      billingOpts.terms = typeof b['termsOnReceipt'] === 'string' ? b['termsOnReceipt'] as string : undefined;
    } catch { /* offline / error → defaults */ }
  }
  let qrDataUrl: string | undefined;
  if (config.showQr) {
    try { qrDataUrl = await QRCode.toDataURL(upiPayString(pharmacy, bill.billNumber, total), { margin: 1, width: 240 }); } catch { /* skip QR */ }
  }
  printReceipt(bill, total, payMethod, { pharmacy, cashier: meta.cashier, qrDataUrl, config, billing: billingOpts });
}

// ─── Camera barcode scanner (native BarcodeDetector API) ────────────────────

interface DetectedBarcode { rawValue: string }
interface BarcodeDetectorLike { detect(source: CanvasImageSource): Promise<DetectedBarcode[]> }
declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats: string[] }) => BarcodeDetectorLike;
  }
}

function CameraScanner({ open, onClose, onDetect }: { open: boolean; onClose: () => void; onDetect: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (!window.BarcodeDetector) {
      setError('Camera scanning needs Chrome or Edge. Use a USB scanner or type the barcode instead.');
      return;
    }
    let stream: MediaStream | null = null;
    let stopped = false;
    const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'upc_a', 'upc_e', 'qr_code'] });

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stopped || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const tick = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0 && codes[0]) {
              onDetect(codes[0].rawValue);
              return; // parent closes the dialog
            }
          } catch { /* frame not ready yet */ }
          setTimeout(tick, 200);
        };
        void tick();
      } catch {
        setError('Camera access denied. Allow camera permission and retry.');
      }
    }
    void start();

    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, onDetect]);

  useEffect(() => { if (!open) setError(null); }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="text-sm">Scan barcode with camera</DialogTitle></DialogHeader>
        {error ? (
          <p className="text-xs text-destructive py-4">{error}</p>
        ) : (
          <div className="relative rounded-lg overflow-hidden bg-black aspect-[4/3]">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-16 border-2 border-primary rounded-lg pointer-events-none" />
          </div>
        )}
        <p className="text-2xs text-muted-foreground text-center">Hold the barcode inside the frame — detection is automatic</p>
      </DialogContent>
    </Dialog>
  );
}

// ─── API ─────────────────────────────────────────────────────────────────────

// Offline fallback: filter the cached catalogue by name/generic/barcode.
function searchCachedMeds(q: string): Medicine[] {
  const meds = (getCatalog()?.medicines ?? []) as Medicine[];
  const ql = q.toLowerCase();
  return meds.filter((m) =>
    m.name?.toLowerCase().includes(ql) ||
    m.genericName?.toLowerCase().includes(ql) ||
    (m.barcode ?? '').includes(q),
  ).slice(0, 8);
}

async function searchMeds(q: string): Promise<Medicine[]> {
  if (!isOnline()) return searchCachedMeds(q);
  try {
    const r = await apiFetch(`/api/medicines?search=${encodeURIComponent(q)}&limit=8`);
    const j = await r.json() as { success: boolean; data: { data: Medicine[] } };
    if (!r.ok) throw new Error('Request failed');
    return j.data?.data ?? ([] as Medicine[]);
  } catch {
    return searchCachedMeds(q); // network dropped mid-request → use cache
  }
}

async function fetchBills(): Promise<Bill[]> {
  const r = await apiFetch('/api/billing?limit=100');
  const j = await r.json() as { success: boolean; data: { data: Bill[] } };
  if (!r.ok) throw new Error('Request failed');
  return j.data?.data ?? ([] as Bill[]);
}

interface SubmitResult { bill: Bill; offline: boolean }

// Submit a bill, degrading gracefully offline: when there's no network (or it
// drops mid-request) the bill is queued locally and a printable "OFF-…" receipt
// is returned so the sale completes; it syncs automatically when back online.
// A business rejection (out of stock, expired, Schedule-H) is always surfaced.
async function submitBill(payload: Record<string, unknown>): Promise<SubmitResult> {
  if (isOnline()) {
    try {
      const r = await apiFetch('/api/billing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json() as { success: boolean; data: Bill; message?: string };
      if (!r.ok || !j.success) throw new Error(j.message ?? 'Failed');
      return { bill: j.data, offline: false };
    } catch (e) {
      if (!(e instanceof TypeError)) throw e; // real business error → surface it
      // else: fetch threw (network down) → fall through to the offline path
    }
  }
  const p = payload as { customer?: { name?: string }; items?: unknown[]; totalAmount?: number; paymentMethod?: string };
  const localNo = `OFF-${Date.now().toString().slice(-6)}`;
  const op = enqueueOp({
    type: 'bill',
    label: `${p.customer?.name ?? 'Walk-in'} · ${formatCurrency(p.totalAmount ?? 0)} · ${p.items?.length ?? 0} item(s)`,
    payload,
  });
  const bill = { ...(payload as object), id: op.id, billNumber: localNo, items: p.items ?? [], createdAt: new Date().toISOString(), status: 'completed', paymentMethod: p.paymentMethod } as unknown as Bill;
  return { bill, offline: true };
}

async function lookupBarcode(code: string): Promise<Medicine | null> {
  const r = await apiFetch(`/api/medicines/barcode/${code.trim()}`);
  const j = await r.json() as { success: boolean; data: Medicine };
  return j.success ? j.data : null;
}

interface MedStock {
  // Earliest-expiring non-expired batch with stock (FEFO), or null if none.
  batch: { inventoryItemId: string; batchNumber: string; expiryDate: string; packQty: number; looseUnits: number } | null;
  available: number;    // total non-expired available packs across batches
  expiredOnly: boolean; // stock exists but every batch has expired
}

type RawBatch = { id: string; batchNumber: string; expiryDate: string; quantity: number; reservedQuantity?: number; looseUnits?: number; batchStatus?: string };

// Pure FEFO resolver — earliest-expiring non-expired batch with stock.
function computeStock(batches: RawBatch[]): MedStock {
  const now = Date.now();
  let available = 0, expiredQty = 0, bestExp = Infinity;
  let best: MedStock['batch'] = null;
  for (const b of batches) {
    if (b.batchStatus && b.batchStatus !== 'active') continue;
    const qty = b.quantity - (b.reservedQuantity ?? 0);
    const loose = b.looseUnits ?? 0;
    if (qty <= 0 && loose <= 0) continue;
    const exp = new Date(b.expiryDate).getTime();
    if (exp <= now) { expiredQty += qty; continue; }
    available += qty;
    if (exp < bestExp) { bestExp = exp; best = { inventoryItemId: b.id, batchNumber: b.batchNumber, expiryDate: b.expiryDate, packQty: qty, looseUnits: loose }; }
  }
  return { batch: best, available, expiredOnly: available === 0 && expiredQty > 0 };
}

// Resolve a medicine's billable stock. Uses the cached catalogue when offline
// (or when the network drops mid-request) so the POS keeps working (TC_029/030).
async function fetchMedicineStock(medicineId: string): Promise<MedStock> {
  const fromCache = () => computeStock(((getCatalog()?.batches?.[medicineId]) ?? []) as RawBatch[]);
  if (!isOnline()) return fromCache();
  try {
    const r = await apiFetch(`/api/inventory/batches/${encodeURIComponent(medicineId)}`);
    if (!r.ok) return { batch: null, available: 0, expiredOnly: false };
    const j = await r.json() as { data: RawBatch[] };
    return computeStock(j.data ?? []);
  } catch {
    return fromCache();
  }
}

function exportCSV(data: Bill[]) {
  // Quote text fields — a customer name or the formatted date/time can contain a
  // comma, which otherwise shifts columns and leaves the time under no header (R169).
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = ['Bill No.,Customer,Items,Total,Payment,Status,Date & Time',
    ...data.map((b) => [q(b.billNumber), q(b.customerName || b.customer?.name || 'Walk-in'), b.items.length, b.totalAmount, b.paymentMethod ?? 'cash', b.status, q(formatDateTime(b.createdAt))].join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `bills-${new Date().toISOString().substring(0, 10)}.csv`;
  a.click();
}

// Snapshot the medicine catalogue + inventory batches to local storage so the POS
// can search and resolve stock with no network. Best-effort; refreshed on load
// and whenever the connection returns.
async function refreshCatalogCache(): Promise<void> {
  if (!isOnline()) return;
  try {
    const [mRes, iRes] = await Promise.all([
      apiFetch('/api/medicines?limit=1000'),
      apiFetch('/api/inventory?limit=1000'),
    ]);
    const mj = await mRes.json() as { data?: { data?: unknown[] } };
    const ij = await iRes.json() as { data?: { data?: Array<{ medicineId: string }> } };
    const batches: Record<string, unknown[]> = {};
    for (const it of (ij.data?.data ?? [])) { (batches[it.medicineId] ??= []).push(it); }
    cacheCatalog({ medicines: mj.data?.data ?? [], batches });
  } catch { /* best effort */ }
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function BillingView() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'pos' | 'history'>('pos');
  const [heldBills, setHeldBills] = useState<HeldBill[]>([]);

  // POS state
  const [search, setSearch] = useState('');
  const [showSugg, setShowSugg] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [doctor, setDoctor] = useState('');
  const can = useCan();
  const ff = useFormFieldConfig('billing');
  // Payment methods are controlled by Settings → Tax & Billing → "Payment Methods
  // Accepted" (billing.acceptCash/acceptUPI/acceptCard/acceptCredit). The enabled
  // set is derived from those toggles below (after pharmSettings loads); if the
  // current selection gets disabled, we fall back to the first available one.
  const [payMethod, setPayMethod] = useState<string>('cash');
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [cashTendered, setCashTendered] = useState('');

  // Keep an offline catalogue snapshot fresh (on load + when back online).
  useEffect(() => {
    void refreshCatalogCache();
    const onOnline = () => { void refreshCatalogCache(); };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  // Barcode scanner state
  const [scanMode, setScanMode] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [scanLoading, setScanLoading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [addingMedicineId, setAddingMedicineId] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { user } = useAuthStore();

  // Pharmacy identity for receipts, labels, UPI QR and WhatsApp — name comes from
  // the (kept-fresh) auth user; UPI id / phone / licence from settings.
  const { data: pharmSettings } = useQuery({
    queryKey: ['billing-pharmacy-settings'],
    queryFn: async () => {
      const r = await apiFetch('/api/settings');
      const j = await r.json() as { data?: { profile?: Record<string, string>; billing?: Record<string, unknown> } };
      return j.data ?? {};
    },
    // Re-read settings whenever billing opens so a just-saved UPI ID / pharmacy
    // detail (and the accepted-payment toggles) show immediately — no stale cache.
    staleTime: 0,
    refetchOnMount: 'always',
    networkMode: 'always',
  });
  const pharmacyName = user?.tenantName ?? pharmSettings?.profile?.pharmacyName ?? 'Pharmacy';
  const pharmacyPhone = pharmSettings?.profile?.mobile || pharmSettings?.profile?.phone || '';
  const drugLicense = pharmSettings?.profile?.drugLicenseNumber || '';
  const upiId = (pharmSettings?.billing?.upiId as string | undefined) || '';

  // Accepted payment methods come from the "Payment Methods Accepted" toggles
  // (Settings → Tax & Billing), carried on the auth user so the POS honours them
  // even for cashiers without settings:view (and live via patchUser on save).
  // Falls back to all four when absent (older session / not yet configured).
  const acceptedPayments = user?.acceptedPaymentMethods ?? ['cash', 'upi', 'card', 'credit'];
  const paymentMethods = (['cash', 'upi', 'card', 'credit'] as const).filter((k) => acceptedPayments.includes(k));
  const paymentMethodsKey = paymentMethods.join(',');
  useEffect(() => {
    if (paymentMethods.length && !paymentMethods.includes(payMethod as typeof paymentMethods[number])) setPayMethod(paymentMethods[0]!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMethodsKey, payMethod]);

  const { data: suggestions = [] } = useQuery({
    queryKey: ['med-search', search],
    queryFn: () => searchMeds(search),
    enabled: search.length >= 2,
    networkMode: 'always', // keep running offline (searchMeds falls back to cache)
  });

  const { data: inventoryMap = {} } = useQuery<Record<string, MedStock>>({
    queryKey: ['inv-map', suggestions.map(m => m.id).join(',')],
    queryFn: async () => {
      if (!suggestions.length) return {};
      const results = await Promise.all(suggestions.map(m => fetchMedicineStock(m.id)));
      return Object.fromEntries(suggestions.map((m, i) => [m.id, results[i]!]));
    },
    enabled: suggestions.length > 0 && showSugg,
    networkMode: 'always',
    staleTime: 5 * 60 * 1000,
  });

  // Phone is optional, but if provided it must be a full 10-digit number (TC_012).
  const phoneInvalid = customerPhone.length > 0 && customerPhone.length !== 10;

  const subtotal = items.reduce((s, i) => s + i.sellingPrice * i.quantity * (1 - i.discount / 100), 0);
  const taxTotal = items.reduce((s, i) => s + i.gstAmount, 0);
  const discAmt = subtotal * (globalDiscount / 100);
  const total = subtotal + taxTotal - discAmt;
  const change = payMethod === 'cash' && cashTendered ? Number(cashTendered) - total : 0;

  function clearPOS() {
    setItems([]); setSearch(''); setCustomerName(''); setCustomerPhone('');
    setDoctor(''); setPayMethod('cash'); setGlobalDiscount(0); setCashTendered('');
    setShowSugg(false); setScanMode(false); setScanInput('');
  }

  // ─── WhatsApp share ───────────────────────────────────────────────────────

  function sendWhatsApp(phone: string, billNo: string, amount: number) {
    const digits = phone.replace(/\D/g, '');
    const full = digits.length === 10 ? `91${digits}` : digits;
    const pharmName = user?.tenantName ?? 'Pharmacy';
    const msg = encodeURIComponent(
      `*${pharmName}*\n\nDear Customer, your bill *${billNo}* is ready.\n*Total: ₹${amount.toFixed(2)}*\n\nThank you! Visit again. 🙏`
    );
    window.open(`https://wa.me/${full}?text=${msg}`, '_blank');
  }

  // ─── Barcode scanner ──────────────────────────────────────────────────────

  const handleBarcode = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setScanLoading(true);
    try {
      const med = await lookupBarcode(trimmed);
      if (med) {
        await addMedicine(med);
        setScanInput('');
        toast.success(`Scanned: ${med.name}`, { description: `₹${med.sellingPrice} · GST ${med.gstRate}%` });
      } else {
        toast.error('Barcode not found', { description: `Code: ${trimmed}` });
        setScanInput('');
      }
    } catch {
      toast.error('Scanner error');
    } finally {
      setScanLoading(false);
      scanRef.current?.focus();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleScan() {
    setScanMode((v) => {
      if (!v) setTimeout(() => scanRef.current?.focus(), 60);
      return !v;
    });
    setScanInput('');
  }

  // ─── Label printing ───────────────────────────────────────────────────────

  function printLabels() {
    if (items.length === 0) { toast.warning('Add items to print labels'); return; }
    const today = new Date().toLocaleDateString('en-IN');
    const labelHtml = items.map((item) => `
      <div class="label">
        <div class="med">${item.medicineName} &times;${item.quantity}</div>
        <div class="generic">${item.genericName}</div>
        ${customerName ? `<div class="row">Patient: ${customerName}</div>` : ''}
        ${doctor ? `<div class="row">Dr.: ${doctor}</div>` : ''}
        <div class="row">Date: ${today} &nbsp; Batch: ${item.batchNumber}</div>
        <div class="row">Expiry: ${new Date(item.expiryDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</div>
        <div class="footer">${[pharmacyName, pharmacyPhone, drugLicense ? `DL: ${drugLicense}` : ''].filter(Boolean).join(' &bull; ')}</div>
      </div>`
    ).join('');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Dispensing Labels</title>
<style>
  @page { size: 72mm 40mm; margin: 0; }
  body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
  .label { width: 70mm; height: 38mm; padding: 3mm 4mm; box-sizing: border-box;
           border: 0.5px solid #ccc; page-break-after: always; overflow: hidden; }
  .med { font-size: 11pt; font-weight: bold; line-height: 1.2; }
  .generic { font-size: 8pt; color: #555; margin-bottom: 2px; }
  .row { font-size: 8pt; margin-top: 1px; }
  .footer { font-size: 7pt; color: #777; margin-top: 3px; border-top: 0.5px solid #ddd; padding-top: 2px; }
</style></head><body>${labelHtml}</body></html>`);
    win.document.close();
    win.print();
    toast.success(`${items.length} label${items.length !== 1 ? 's' : ''} sent to printer`);
  }

  // ─── Mutations ────────────────────────────────────────────────────────────

  const mutation = useMutation({
    mutationFn: submitBill,
    networkMode: 'always', // must run offline so the bill can be queued locally
    onSuccess: ({ bill, offline }) => {
      if (!offline) qc.invalidateQueries({ queryKey: ['billing'] });
      const savedTotal = total;
      const savedPhone = customerPhone;
      const savedBillNo = bill.billNumber;
      void printBill(bill, savedTotal, payMethod, { pharmacyName: user?.tenantName, cashier: user?.name });
      clearPOS();
      if (offline) {
        toast.warning('Saved offline — will sync automatically', {
          description: `${formatCurrency(savedTotal)} · ${payMethod.toUpperCase()} · queued as ${savedBillNo}`,
          duration: 8000,
        });
      } else {
        toast.success(`Bill ${savedBillNo} created`, {
          description: `${formatCurrency(savedTotal)} · ${payMethod.toUpperCase()}`,
          duration: 5000, // auto-dismiss within ~5s (Divya R162)
          action: savedPhone ? {
            label: 'Send WhatsApp',
            onClick: () => sendWhatsApp(savedPhone, savedBillNo, savedTotal),
          } : undefined,
        });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMedicine = useCallback(async (med: Medicine) => {
    setSearch(''); setShowSugg(false);
    setAddingMedicineId(med.id);
    try {
      // A medicine is billable only when it has live, non-expired stock (TC_029/030).
      const stock = await fetchMedicineStock(med.id);
      if (!stock.batch || stock.available <= 0) {
        toast.error(
          stock.expiredOnly
            ? `${med.name}: only expired stock available — cannot be billed`
            : `${med.name} is not in stock — add stock in Stock & Inventory before billing`,
        );
        return;
      }
      const { inventoryItemId, batchNumber, expiryDate, packQty, looseUnits } = stock.batch;
      const unitsPerPack = Math.max(1, (med as Medicine & { unitsPerPack?: number }).unitsPerPack ?? 1);
      const availableUnits = packQty * unitsPerPack + looseUnits;
      setItems((prev) => {
        const idx = prev.findIndex((i) => i.medicineId === med.id);
        if (idx >= 0) {
          const existing = prev[idx]!;
          const max = existing.saleUnit === 'unit' ? existing.availableUnits : stock.available;
          if (existing.quantity >= max) {
            toast.warning(`Only ${max} ${existing.saleUnit === 'unit' ? 'unit' : 'pack'}(s) of ${med.name} in stock`);
            return prev;
          }
          return prev.map((item, i) => i === idx ? calcLine({ ...item, quantity: item.quantity + 1 }) : item);
        }
        return [...prev, calcLine({
          medicineId: med.id, inventoryItemId, medicineName: med.name, genericName: med.genericName,
          batchNumber, expiryDate,
          quantity: 1, saleUnit: 'pack', unitsPerPack, packSellingPrice: med.sellingPrice, packMrp: med.mrp, availableUnits,
          mrp: med.mrp, sellingPrice: med.sellingPrice, discount: 0,
          gstRate: med.gstRate, gstAmount: 0, totalAmount: 0,
          requiresPrescription: med.requiresPrescription, schedule: med.schedule ?? null, stockQty: stock.available,
        })];
      });
    } catch {
      toast.error(`Could not load inventory for ${med.name}`);
    } finally {
      setAddingMedicineId(null);
    }
  }, []);

  // Prescription → Bill: when arriving from an approved prescription
  // (/billing?rxId=…), pull its prescribed medicines and auto-add each in-stock
  // one to the cart, and prefill the customer name (Vinay P10.7 / P12.1). Runs once.
  const rxPopulated = useRef(false);
  React.useEffect(() => {
    const rxId = searchParams.get('rxId');
    const cName = searchParams.get('customerName');
    if (!rxId || rxPopulated.current) return;
    rxPopulated.current = true;
    if (cName) setCustomerName(cName);
    (async () => {
      try {
        const r = await apiFetch(`/api/prescriptions/${rxId}`);
        const j = await r.json() as { success: boolean; data?: { customerName?: string; customerPhone?: string; doctorName?: string; medicines?: Array<{ medicineName: string; quantity?: number }> } };
        if (!j.success || !j.data) return;
        if (j.data.customerName && !cName) setCustomerName(j.data.customerName);
        if (j.data.customerPhone) setCustomerPhone(j.data.customerPhone);
        if (j.data.doctorName) setDoctor(j.data.doctorName);
        const meds = j.data.medicines ?? [];
        let added = 0, missing = 0;
        for (const pm of meds) {
          const matches = await searchMeds(pm.medicineName);
          const med = matches.find((m) => m.name.toLowerCase() === pm.medicineName.toLowerCase()) ?? matches[0];
          if (med) { await addMedicine(med); added++; } else { missing++; }
        }
        if (added) toast.success(`Loaded ${added} prescribed medicine${added !== 1 ? 's' : ''} from the prescription`);
        if (missing) toast.warning(`${missing} prescribed item${missing !== 1 ? 's' : ''} not found in catalog — add manually`);
      } catch { /* non-fatal — user can add manually */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const updateItem = useCallback((idx: number, field: keyof CartItem, value: number) => {
    setItems((prev) => prev.map((item, i) => i === idx ? calcLine({ ...item, [field]: value }) : item));
  }, []);

  // Switch a line between whole-strip and loose-unit selling. Price is derived
  // per unit from the strip price so 4 of a 15-tab strip costs 4×(₹strip/15).
  const setSaleUnit = useCallback((idx: number, unit: 'pack' | 'unit') => {
    setItems((prev) => prev.map((item, i) => {
      if (i !== idx || item.saleUnit === unit) return item;
      const round2 = (n: number) => Number(n.toFixed(2));
      if (unit === 'unit') {
        const price = round2(item.packSellingPrice / item.unitsPerPack);
        const mrp = round2(item.packMrp / item.unitsPerPack);
        const qty = Math.min(Math.max(1, item.quantity), item.availableUnits);
        return calcLine({ ...item, saleUnit: 'unit', sellingPrice: price, mrp, quantity: qty });
      }
      const qty = Math.min(Math.max(1, item.quantity), item.stockQty);
      return calcLine({ ...item, saleUnit: 'pack', sellingPrice: item.packSellingPrice, mrp: item.packMrp, quantity: qty });
    }));
  }, []);

  const removeItem = useCallback((idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handlePay = useCallback(() => {
    if (items.length === 0) { toast.error('Add at least one medicine'); return; }
    if (customerPhone && customerPhone.length !== 10) {
      toast.error('Enter a valid 10-digit phone number, or leave it blank');
      return;
    }
    const scheduled = items.filter((i) => i.schedule && SCHEDULED_DRUGS.includes(i.schedule));
    if (scheduled.length > 0 && (!customerName.trim() || !doctor.trim())) {
      toast.error('Schedule H/H1/X drug — patient & doctor details required', {
        description: `${scheduled.map((i) => i.medicineName).join(', ')} cannot be dispensed without prescription details (Drugs & Cosmetics Act).`,
        duration: 8000,
      });
      return;
    }
    const billItems = items.map((item, i) => ({ id: `bi_${Date.now()}_${i}`, ...item }));
    mutation.mutate({
      type: 'sale',
      customer: customerName ? { name: customerName, phone: customerPhone || undefined } : undefined,
      doctor: doctor || undefined,
      items: billItems,
      subtotal: Number(subtotal.toFixed(2)),
      discountAmount: Number(discAmt.toFixed(2)),
      discountPercent: globalDiscount,
      taxAmount: Number(taxTotal.toFixed(2)),
      totalAmount: Number(total.toFixed(2)),
      paidAmount: Number(total.toFixed(2)),
      balanceAmount: payMethod === 'credit' ? Number(total.toFixed(2)) : 0,
      paymentMethod: payMethod,
    });
  }, [items, customerName, customerPhone, doctor, payMethod, globalDiscount, subtotal, discAmt, taxTotal, total, mutation]);

  const handleHold = useCallback(() => {
    if (items.length === 0) { toast.warning('Nothing to hold'); return; }
    const label = customerName || `Bill #${Date.now().toString().slice(-4)}`;
    setHeldBills((prev) => [...prev, { id: Date.now().toString(), label, heldAt: new Date(), items, customerName, customerPhone, doctor, globalDiscount }]);
    clearPOS();
    toast.success(`"${label}" held — recall it anytime`);
  }, [items, customerName, customerPhone, doctor, globalDiscount]);

  const recallHeld = useCallback((held: HeldBill) => {
    if (items.length > 0 && !confirm('Replace current bill with held bill?')) return;
    setItems(held.items); setCustomerName(held.customerName); setCustomerPhone(held.customerPhone);
    setDoctor(held.doctor); setGlobalDiscount(held.globalDiscount);
    setHeldBills((prev) => prev.filter((h) => h.id !== held.id));
    toast.success(`"${held.label}" restored`);
  }, [items]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as Element).tagName;
      if (e.key === 'F1') { e.preventDefault(); setScanMode(false); setTimeout(() => searchRef.current?.focus(), 50); }
      if (e.key === 'F8') { e.preventDefault(); toggleScan(); }
      if (e.key === 'F9') { e.preventDefault(); handlePay(); }
      if (e.key === 'F4') { e.preventDefault(); handleHold(); }
      if (e.key === 'Escape') { setShowSugg(false); setScanMode(false); searchRef.current?.blur(); }
      if (e.key === 'Enter' && showSugg && suggestions.length > 0 && tag !== 'INPUT') {
        e.preventDefault();
        const first = suggestions[0];
        if (first) void addMedicine(first);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlePay, handleHold, showSugg, suggestions, addMedicine]);

  // Real UPI collect QR from the tenant's configured UPI id (empty → no QR shown).
  const upiData = upiId ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(pharmacyName)}&am=${total.toFixed(2)}&cu=INR` : '';

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="-mx-4 -my-4 md:-mx-6 md:-my-6 flex flex-col overflow-hidden" style={{ height: 'calc(100vh - var(--header-height))' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-border bg-card px-5 py-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <Receipt className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">Billing POS</span>
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-1.5">
            <div className={cn('h-1.5 w-1.5 rounded-full', mode === 'pos' ? 'bg-success' : 'bg-muted-foreground')} />
            <span className="text-xs text-muted-foreground">{mode === 'pos' ? 'POS Active' : 'History'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:block">F1=Search · F8=Scan · F4=Hold · F9=Pay</span>
          {heldBills.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-xs">Held ({heldBills.length})</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                {heldBills.map((h) => (
                  <DropdownMenuItem key={h.id} onClick={() => recallHeld(h)} className="flex flex-col items-start gap-0.5">
                    <span className="font-medium text-sm">{h.label}</span>
                    <span className="text-xs text-muted-foreground">{h.items.length} items · {h.heldAt.toLocaleTimeString()}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant={mode === 'history' ? 'default' : 'outline'} size="sm" onClick={() => setMode(mode === 'pos' ? 'history' : 'pos')} className="gap-1.5">
            {mode === 'pos' ? <><History className="h-3.5 w-3.5" /> History</> : <><Receipt className="h-3.5 w-3.5" /> POS</>}
          </Button>
        </div>
      </div>

      {/* POS mode */}
      {mode === 'pos' && (
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Medicine search */}
          <div className="flex w-[55%] flex-col border-r border-border overflow-hidden">
            <div className="p-4 pb-2 shrink-0 space-y-2">
              {/* Search + Scan toggle */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={searchRef}
                    className="pl-9 pr-8 h-11 text-sm font-medium"
                    placeholder="Search medicine by name or generic… (F1)"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setShowSugg(true); }}
                    onFocus={() => search.length >= 2 && setShowSugg(true)}
                    onBlur={() => setTimeout(() => setShowSugg(false), 150)}
                    autoComplete="off"
                  />
                  {search && (
                    <button onClick={() => { setSearch(''); setShowSugg(false); searchRef.current?.focus(); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button
                  variant={scanMode ? 'default' : 'outline'}
                  size="sm"
                  className="h-11 px-3 shrink-0 gap-1.5"
                  onClick={toggleScan}
                  title="Barcode Scanner (F8)"
                >
                  <Scan className="h-4 w-4" />
                  <span className="text-xs hidden sm:inline">F8</span>
                </Button>
              </div>

              {/* Barcode scan input */}
              {scanMode && (
                <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-3 space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Scan className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold text-primary">Scan Mode Active</span>
                    <span className="ml-auto text-2xs text-muted-foreground">Press Esc to close</span>
                  </div>
                  <div className="relative">
                    <input
                      ref={scanRef}
                      value={scanInput}
                      onChange={(e) => setScanInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { handleBarcode(scanInput); }
                        if (e.key === 'Escape') { setScanMode(false); setScanInput(''); }
                      }}
                      placeholder="Point scanner at barcode… or type barcode + Enter"
                      className="w-full h-9 px-3 pr-20 text-sm font-mono border border-primary/30 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                      autoComplete="off"
                    />
                    {scanLoading && <Loader2 className="absolute right-20 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />}
                    <button
                      onClick={() => setCameraOpen(true)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-2xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                      title="Scan with camera (Chrome/Edge)"
                    >
                      <QrCode className="h-3 w-3" /> Camera
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-2xs text-muted-foreground">Demo scan:</span>
                    {DEMO_BARCODES.map((b) => (
                      <button
                        key={b.code}
                        onClick={() => handleBarcode(b.code)}
                        className="text-2xs bg-white border border-border rounded-md px-2 py-0.5 hover:bg-primary/5 hover:border-primary/40 transition-colors font-medium"
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto">
              {search.length >= 2 && showSugg && (
                <div className="px-4 pb-4 space-y-1.5">
                  {suggestions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Package className="h-10 w-10 text-muted-foreground/30 mb-2" />
                      <p className="text-sm text-muted-foreground">No medicines found for "{search}"</p>
                    </div>
                  ) : (
                    suggestions.map((med, idx) => {
                      const inv = inventoryMap[med.id];
                      const loaded = inv !== undefined;
                      const stock = loaded ? inv.available : null;
                      const batchNum = inv?.batch?.batchNumber ?? '—';
                      const expiry = inv?.batch?.expiryDate;
                      const expiredOnly = inv?.expiredOnly ?? false;
                      const { text: stockText, cls: stockCls } =
                        !loaded ? { text: 'Checking stock…', cls: 'text-muted-foreground' }
                        : expiredOnly ? { text: 'Expired — cannot bill', cls: 'text-destructive' }
                        : stock === 0 ? { text: 'Out of Stock', cls: 'text-destructive' }
                        : stockLabel(stock!, med.reorderLevel);
                      // Only the chosen (non-expired) batch drives the expiry hint,
                      // so a medicine with valid stock never shows "EXPIRED" (TC_003).
                      const expWarn = expiry ? expiryAlert(expiry) : null;
                      const outOfStock = loaded && stock === 0; // covers no-stock and expired-only
                      const isAdding = addingMedicineId === med.id;
                      return (
                        <button
                          key={med.id}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); if (!outOfStock && !isAdding) void addMedicine(med); }}
                          disabled={outOfStock || isAdding}
                          className={cn(
                            'group w-full rounded-lg border border-border bg-card p-3 text-left transition-all',
                            idx === 0 && 'border-primary/40 bg-primary/5',
                            outOfStock ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/50 hover:bg-accent cursor-pointer'
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-semibold text-sm truncate">{med.name}</span>
                                {idx === 0 && !outOfStock && (
                                  <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-medium shrink-0">↵ Enter</span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{med.genericName} · {med.manufacturer}</p>
                              <div className="flex items-center gap-3 mt-1.5">
                                {isAdding
                                  ? <span className="text-xs text-primary flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Adding…</span>
                                  : <span className={cn('text-xs font-medium', stockCls)}>{stockText}</span>
                                }
                                <span className="text-xs text-muted-foreground">Batch: {batchNum}</span>
                                {expWarn && <span className="text-xs text-warning-600 font-medium">{expWarn}</span>}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-bold text-primary">₹{med.sellingPrice}</p>
                              <p className="text-[10px] text-muted-foreground line-through">MRP ₹{med.mrp}</p>
                              <div className="flex gap-1 mt-1 justify-end">
                                {med.requiresPrescription && (
                                  <span className="text-[10px] bg-warning/15 text-warning-600 px-1.5 py-0.5 rounded font-semibold">Rx</span>
                                )}
                                <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">GST {med.gstRate}%</span>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              {/* Empty / hint state */}
              {(search.length < 2 || !showSugg) && !scanMode && (
                <div className="flex flex-col items-center justify-center h-full pb-16 text-center px-8">
                  {items.length === 0 ? (
                    <>
                      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Search className="h-7 w-7 text-primary/60" />
                      </div>
                      <p className="font-medium text-foreground mb-1">Search to add medicines</p>
                      <p className="text-sm text-muted-foreground mb-4">Type 2+ characters or press F8 to use barcode scanner</p>
                      <div className="flex flex-wrap gap-2 justify-center text-xs text-muted-foreground">
                        {[['F1', 'Focus search'], ['F8', 'Scan barcode'], ['↵', 'Add first result'], ['F4', 'Hold bill'], ['F9', 'Pay & print']].map(([k, v]) => (
                          <span key={k} className="flex items-center gap-1 bg-muted px-2 py-1 rounded">
                            <kbd className="font-mono font-bold text-foreground">{k}</kbd> {v}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center mb-3">
                        <CheckCircle className="h-6 w-6 text-success" />
                      </div>
                      <p className="font-medium text-sm">{items.length} item{items.length !== 1 ? 's' : ''} in cart</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Search or scan to add more, or press F9 to pay</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Cart + payment */}
          <div className="flex w-[45%] flex-col overflow-hidden bg-card">
            {/* Customer */}
            <div className="px-4 pt-3 pb-2 shrink-0 border-b border-border">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Customer (optional)</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input placeholder={ff.label('customerName', 'Customer name')} value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="h-8 text-xs pl-7" />
                </div>
                {ff.isEnabled('customerPhone') && (
                  <Input
                    placeholder={ff.label('customerPhone', 'Phone number')}
                    inputMode="numeric"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    maxLength={10}
                    className={cn('h-8 text-xs', phoneInvalid && 'border-destructive focus-visible:ring-destructive')}
                  />
                )}
              </div>
              {phoneInvalid && (
                <p className="mt-1 text-[10px] text-destructive font-medium">Phone number must be exactly 10 digits.</p>
              )}
              {ff.isEnabled('doctorName') && (
                <Input placeholder={`${ff.label('doctorName', 'Doctor name')} (for Rx)`} value={doctor} onChange={(e) => setDoctor(e.target.value)} className="mt-1.5 h-8 text-xs" />
              )}
              {items.some((i) => i.schedule && SCHEDULED_DRUGS.includes(i.schedule)) && (!customerName.trim() || !doctor.trim()) && (
                <p className="mt-1.5 text-[10px] text-destructive font-medium bg-destructive/10 rounded px-2 py-1">
                  ⚠ Schedule H/H1/X drug in cart — patient name &amp; doctor name are mandatory
                </p>
              )}
            </div>

            {/* Cart */}
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <PackagePlus className="h-8 w-8 text-muted-foreground/25 mb-2" />
                  <p className="text-xs text-muted-foreground">No medicines added — search to add medicines</p>
                </div>
              ) : (
                items.map((item, idx) => (
                  <div key={idx} className="rounded-lg border border-border p-2.5 bg-background">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate leading-tight">{item.medicineName}</p>
                        <p className="text-[10px] text-muted-foreground">{item.genericName} · GST {item.gstRate}%
                          {item.schedule && SCHEDULED_DRUGS.includes(item.schedule)
                            ? <span className="ml-1 text-destructive font-semibold">· Sch {item.schedule}</span>
                            : item.requiresPrescription && <span className="ml-1 text-warning-600 font-semibold">· Rx</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-sm font-bold text-primary">₹{item.totalAmount.toFixed(2)}</span>
                        <button onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive transition-colors p-0.5">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {item.unitsPerPack > 1 && (
                      <div className="mb-2 flex items-center gap-2">
                        <div className="inline-flex rounded-md border border-border p-0.5 text-[10px] font-semibold">
                          <button onClick={() => setSaleUnit(idx, 'pack')}
                            className={`rounded px-2 py-0.5 transition-colors ${item.saleUnit === 'pack' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Strip</button>
                          <button onClick={() => setSaleUnit(idx, 'unit')}
                            className={`rounded px-2 py-0.5 transition-colors ${item.saleUnit === 'unit' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Loose</button>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {item.saleUnit === 'unit'
                            ? `₹${item.packSellingPrice.toFixed(2)}/strip ÷ ${item.unitsPerPack} · ${item.availableUnits} units left`
                            : `${item.unitsPerPack} units/strip · ${item.stockQty} strips left`}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center rounded-md border border-border">
                        <button onClick={() => item.quantity > 1 && updateItem(idx, 'quantity', item.quantity - 1)}
                          className="px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors rounded-l-md">
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
                        <button onClick={() => { const max = item.saleUnit === 'unit' ? item.availableUnits : item.stockQty; if (item.quantity < max) updateItem(idx, 'quantity', item.quantity + 1); else toast.warning(`Only ${max} ${item.saleUnit === 'unit' ? 'unit' : 'strip'}(s) in stock`); }}
                          className="px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors rounded-r-md">
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="relative flex-1">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">₹</span>
                        <input type="number" step="0.01" value={item.sellingPrice}
                          onChange={(e) => updateItem(idx, 'sellingPrice', Number(e.target.value))}
                          className="w-full h-7 pl-5 pr-1 text-xs border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                      <div className="relative w-16">
                        <input type="number" min={0} max={100} value={item.discount}
                          onChange={(e) => updateItem(idx, 'discount', Number(e.target.value))}
                          className="w-full h-7 pl-2 pr-5 text-xs border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Totals + payment */}
            <div className="shrink-0 border-t border-border px-4 pb-3 pt-2 space-y-2.5 bg-card">
              {/* Bill discount */}
              {ff.isEnabled('globalDiscount') && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground flex-1">{ff.label('globalDiscount', 'Bill discount %')}</span>
                  <input type="number" min={0} max={100} value={globalDiscount}
                    onChange={(e) => setGlobalDiscount(Number(e.target.value))}
                    className="w-16 h-6 text-xs border border-border rounded px-2 text-center bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              )}

              {/* Totals */}
              <div className="space-y-1 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                <div className="flex justify-between text-muted-foreground text-xs">
                  <span>Subtotal</span><span className="tabular-nums">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground text-xs">
                  <span>GST</span><span className="tabular-nums">₹{taxTotal.toFixed(2)}</span>
                </div>
                {discAmt > 0 && (
                  <div className="flex justify-between text-success text-xs">
                    <span>Discount ({globalDiscount}%)</span><span className="tabular-nums">-₹{discAmt.toFixed(2)}</span>
                  </div>
                )}
                <Separator className="my-1" />
                <div className="flex justify-between font-bold text-base">
                  <span>TOTAL</span>
                  <span className="text-primary tabular-nums">{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Payment method */}
              <div className={cn('grid gap-1.5', paymentMethods.length <= 4 ? 'grid-cols-4' : 'grid-cols-3')}>
                {paymentMethods.map((m) => (
                  <button key={m} onClick={() => setPayMethod(m)} className={cn(
                    'rounded-lg py-2 text-xs font-semibold uppercase tracking-wide border transition-all',
                    payMethod === m
                      ? m === 'cash' ? 'bg-success text-white border-success'
                        : m === 'upi' ? 'bg-blue-500 text-white border-blue-500'
                          : m === 'card' ? 'bg-purple-500 text-white border-purple-500'
                            : 'bg-warning text-white border-warning'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  )}>
                    {m}
                  </button>
                ))}
              </div>

              {/* Cash tendered */}
              {payMethod === 'cash' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Tendered ₹</span>
                  <Input type="number" placeholder={total.toFixed(2)} value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)} className="h-7 text-sm flex-1" />
                  {change > 0 && (
                    <span className="text-xs font-bold text-success whitespace-nowrap">Change: ₹{change.toFixed(2)}</span>
                  )}
                </div>
              )}

              {/* UPI QR panel */}
              {payMethod === 'upi' && items.length > 0 && (
                upiId ? (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 flex items-center gap-3">
                    <div className="shrink-0 rounded-lg overflow-hidden border border-blue-200 bg-white p-1">
                      <UPIQRCode data={upiData} size={80} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <QrCode className="h-3.5 w-3.5 text-blue-600" />
                        <p className="text-xs font-bold text-blue-700">Scan to Pay via UPI</p>
                      </div>
                      <p className="text-xl font-bold text-blue-900 tabular-nums leading-none mb-1">
                        {formatCurrency(total)}
                      </p>
                      <p className="text-xs font-mono text-blue-600 truncate">{upiId}</p>
                      <button
                        className="mt-1.5 text-2xs text-blue-500 underline underline-offset-2"
                        onClick={() => { navigator.clipboard?.writeText(upiId); toast.success('UPI ID copied'); }}
                      >
                        Copy UPI ID
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-warning-700">
                    No UPI ID configured. Add one in <span className="font-semibold">Settings → Tax &amp; Billing</span> to show a scan-to-pay QR here.
                  </div>
                )
              )}

              {/* Action buttons */}
              <div className="flex gap-1.5 pt-0.5">
                <Button
                  variant="outline" size="sm"
                  className="flex-1 gap-1 text-xs"
                  onClick={printLabels}
                  disabled={items.length === 0}
                  title="Print dispensing labels"
                >
                  <Tag className="h-3.5 w-3.5" /> Labels
                </Button>
                <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs" onClick={handleHold}>
                  <Clock className="h-3.5 w-3.5" /> F4 Hold
                </Button>
                <Button size="sm" className="flex-[2] gap-1.5 font-semibold text-xs" onClick={handlePay} disabled={mutation.isPending || items.length === 0 || !can('billing:create')} title={!can('billing:create') ? 'You do not have permission to create bills' : undefined}>
                  {mutation.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <><Printer className="h-3.5 w-3.5" /> F9 Pay{items.length > 0 && ` · ${formatCurrency(total)}`}</>
                  }
                </Button>
              </div>

              {/* WhatsApp hint when customer phone entered */}
              {customerPhone && items.length > 0 && (
                <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                  <MessageCircle className="h-3 w-3 text-green-600" />
                  <span>Bill share link will be offered via WhatsApp after payment</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* History mode */}
      {mode === 'history' && (
        <BillHistory onNewBill={() => setMode('pos')} />
      )}

      <CameraScanner
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onDetect={(code) => { setCameraOpen(false); void handleBarcode(code); }}
      />
    </div>
  );
}

// ─── Bill history panel ───────────────────────────────────────────────────────

function BillHistory({ onNewBill }: { onNewBill: () => void }) {
  const router = useRouter();
  const can = useCan();
  const { user } = useAuthStore();
  const [viewBill, setViewBill] = useState<Bill | null>(null);
  const { data = [], isLoading } = useQuery({ queryKey: ['billing'], queryFn: fetchBills });

  const revenue = data.filter((b) => b.status === 'completed').reduce((s, b) => s + b.totalAmount, 0);

  const PAYMENT_COLOR: Record<string, string> = {
    cash: 'text-success', upi: 'text-blue-600', card: 'text-purple-600', credit: 'text-warning-600',
  };

  function doPrint(bill: Bill) {
    void printBill(bill, bill.totalAmount, bill.paymentMethod ?? 'cash', { pharmacyName: user?.tenantName, cashier: user?.name });
  }

  const columns: ColumnDef<Bill>[] = [
    {
      accessorKey: 'billNumber',
      header: 'Bill No.',
      cell: ({ row }) => <span className="font-mono font-semibold text-primary text-sm">{row.original.billNumber}</span>,
    },
    {
      id: 'customer',
      header: 'Customer',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-sm">{row.original.customerName || row.original.customer?.name || 'Walk-in'}</p>
          {(row.original.customerPhone || row.original.customer?.phone) && <p className="text-xs text-muted-foreground">{row.original.customerPhone || row.original.customer?.phone}</p>}
        </div>
      ),
    },
    {
      id: 'items',
      header: 'Items',
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.items.length}</span>,
    },
    {
      accessorKey: 'totalAmount',
      header: ({ column }) => <SortableHeader column={column}>Total</SortableHeader>,
      cell: ({ row }) => <span className="font-semibold tabular-nums">{formatCurrency(row.original.totalAmount)}</span>,
    },
    {
      accessorKey: 'paymentMethod',
      header: 'Payment',
      cell: ({ row }) => {
        const m = row.original.paymentMethod ?? 'cash';
        return <span className={cn('text-sm font-semibold capitalize', PAYMENT_COLOR[m])}>{m}</span>;
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const s = row.original.status;
        const v = { completed: 'success', partially_paid: 'warning', cancelled: 'muted', draft: 'secondary' } as const;
        return <Badge variant={v[s as keyof typeof v] ?? 'secondary'} dot className="text-xs capitalize">{s.replace('_', ' ')}</Badge>;
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <SortableHeader column={column}>Date</SortableHeader>,
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDateTime(row.original.createdAt)}</span>,
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
            <DropdownMenuItem onClick={() => setViewBill(row.original)}>
              <Eye className="h-4 w-4" /> View Bill
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => doPrint(row.original)}>
              <Printer className="h-4 w-4" /> Reprint Receipt
            </DropdownMenuItem>
            {row.original.customer?.phone && (
              <DropdownMenuItem onClick={() => {
                const phone = row.original.customer!.phone!.replace(/\D/g, '');
                const full = phone.length === 10 ? `91${phone}` : phone;
                const msg = encodeURIComponent(`*${user?.tenantName ?? 'Pharmacy'}* — Bill ${row.original.billNumber}\nTotal: ₹${row.original.totalAmount.toFixed(2)}\nThank you! 🙏`);
                window.open(`https://wa.me/${full}?text=${msg}`, '_blank');
              }}>
                <MessageCircle className="h-4 w-4" /> Send WhatsApp
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onClick={() => router.push(`/returns?billId=${row.original.id}&billNumber=${encodeURIComponent(row.original.billNumber)}`)}>
              Process Return
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <>
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex gap-6">
          {[
            { label: 'Total Bills', value: data.length },
            { label: 'Revenue', value: formatCurrency(revenue) },
            { label: 'Completed', value: data.filter((b) => b.status === 'completed').length },
            { label: 'Partially Paid', value: data.filter((b) => b.status === 'partially_paid').length },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-bold text-sm">{value}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCSV(data)}>
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          {can('billing:create') && (
            <Button size="sm" onClick={onNewBill}>
              <Receipt className="h-3.5 w-3.5" /> New Bill
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <DataTable
          columns={columns}
          data={data}
          loading={isLoading}
          searchColumn="billNumber"
          searchPlaceholder="Search by bill number…"
          emptyMessage="No bills found"
          emptyDescription="Switch to POS to create your first bill."
        />
      </div>
    </div>

    {/* Bill detail dialog */}
    <Dialog open={!!viewBill} onOpenChange={() => setViewBill(null)}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-primary">{viewBill?.billNumber}</DialogTitle>
        </DialogHeader>
        {viewBill && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 rounded-lg bg-muted/40 p-3 text-sm">
              <div><span className="text-muted-foreground">Date: </span>{formatDateTime(viewBill.createdAt)}</div>
              <div><span className="text-muted-foreground">Payment: </span><span className="capitalize font-medium">{viewBill.paymentMethod ?? 'cash'}</span></div>
              <div><span className="text-muted-foreground">Customer: </span>{viewBill.customerName || viewBill.customer?.name || 'Walk-in'}</div>
              <div><span className="text-muted-foreground">Status: </span>
                <Badge variant={viewBill.status === 'completed' ? 'success' : viewBill.status === 'cancelled' ? 'muted' : 'warning'} dot className="text-xs capitalize">{viewBill.status.replace('_', ' ')}</Badge>
              </div>
              {(viewBill.customerPhone || viewBill.customer?.phone) && <div className="col-span-2"><span className="text-muted-foreground">Phone: </span>{viewBill.customerPhone || viewBill.customer?.phone}</div>}
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-1.5 font-medium">Medicine</th>
                  <th className="text-right py-1.5 font-medium">Qty</th>
                  <th className="text-right py-1.5 font-medium">Rate</th>
                  <th className="text-right py-1.5 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {viewBill.items.map((item, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2">
                      <p className="font-medium">{item.medicineName}</p>
                      {item.discount > 0 && <p className="text-xs text-success">{item.discount}% off</p>}
                    </td>
                    <td className="text-right py-2 tabular-nums">{item.quantity}</td>
                    <td className="text-right py-2 tabular-nums">₹{item.sellingPrice}</td>
                    <td className="text-right py-2 tabular-nums font-semibold">₹{Number(item.totalAmount ?? 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="space-y-1 rounded-lg bg-muted/40 px-3 py-2">
              <div className="flex justify-between text-muted-foreground text-xs"><span>Subtotal</span><span>₹{Number(viewBill.subtotal ?? 0).toFixed(2)}</span></div>
              {(viewBill.discountAmount ?? 0) > 0 && (
                <div className="flex justify-between text-success text-xs"><span>Discount</span><span>-₹{Number(viewBill.discountAmount).toFixed(2)}</span></div>
              )}
              <div className="flex justify-between text-muted-foreground text-xs"><span>GST</span><span>₹{Number(viewBill.taxAmount ?? 0).toFixed(2)}</span></div>
              <Separator className="my-1" />
              <div className="flex justify-between font-bold text-base">
                <span>Total</span>
                <span className="text-primary tabular-nums">{formatCurrency(viewBill.totalAmount)}</span>
              </div>
              {(viewBill.balanceAmount ?? 0) > 0 && (
                <div className="flex justify-between text-warning-700 text-xs font-semibold"><span>Balance Due</span><span>₹{Number(viewBill.balanceAmount).toFixed(2)}</span></div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => doPrint(viewBill)}>
                <Printer className="h-3.5 w-3.5" /> Print Receipt
              </Button>
              {can('returns:create') && (
                <Button size="sm" variant="destructive" className="flex-1 gap-1.5" onClick={() => { setViewBill(null); router.push(`/returns?billId=${viewBill.id}&billNumber=${encodeURIComponent(viewBill.billNumber)}`); }}>
                  Process Return
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}

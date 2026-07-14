'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Search, Plus, Minus, Trash2, Receipt, History, X, Loader2,
  User, Printer, Clock, CheckCircle, MoreHorizontal, Eye,
  Download, Package, Scan, Tag, MessageCircle, QrCode,
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
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { apiFetch } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CartItem {
  medicineId: string;
  medicineName: string;
  genericName: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
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
  const N = 21;
  // Finder pattern (7×7): outer ring, white ring, center 3×3
  const FP = [
    [1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1],
    [1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1],
    [1,0,1,1,1,0,1],
    [1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1],
  ] as const;

  type Cell = boolean | undefined;
  const grid: Cell[][] = Array.from({ length: N }, () => Array(N).fill(undefined) as Cell[]);

  function placeFP(sr: number, sc: number) {
    for (let r = 0; r < 7; r++)
      for (let c = 0; c < 7; c++)
        grid[sr + r]![sc + c] = FP[r]![c] === 1;
    // White separator strip
    for (let i = -1; i <= 7; i++) {
      if (sr + i >= 0 && sr + i < N) {
        if (sc - 1 >= 0) grid[sr + i]![sc - 1] = false;
        if (sc + 7 < N)  grid[sr + i]![sc + 7] = false;
      }
      if (sc + i >= 0 && sc + i < N) {
        if (sr - 1 >= 0) grid[sr - 1]![sc + i] = false;
        if (sr + 7 < N)  grid[sr + 7]![sc + i] = false;
      }
    }
  }

  placeFP(0, 0);   // top-left
  placeFP(0, 14);  // top-right
  placeFP(14, 0);  // bottom-left

  // Timing patterns on row 6 and col 6
  for (let i = 8; i <= 12; i++) {
    grid[6]![i] = i % 2 === 0;
    grid[i]![6] = i % 2 === 0;
  }

  // Seeded pseudo-random for data modules
  let seed = Array.from(data).reduce((h, c) => ((h * 31 + c.charCodeAt(0)) | 0), 0x7FABCD12);
  function nextBool(): boolean {
    seed = (seed * 1664525 + 1013904223) | 0;
    const u = (seed >>> 0) / 0xFFFFFFFF;
    return u > 0.46;
  }

  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      if (grid[r]![c] === undefined)
        grid[r]![c] = nextBool();

  return (
    <svg
      viewBox={`-2 -2 ${N + 4} ${N + 4}`}
      width={size} height={size}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', imageRendering: 'pixelated' }}
    >
      <rect x={-2} y={-2} width={N + 4} height={N + 4} fill="white" />
      {(grid as boolean[][]).map((row, r) =>
        row.map((dark, c) =>
          dark ? (
            <rect key={`${r},${c}`} x={c} y={r} width={0.92} height={0.92} rx={0.08} fill="#111827" />
          ) : null
        )
      )}
    </svg>
  );
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

// 80mm thermal receipt (72mm printable width). Works with thermal printer
// Windows drivers (Epson TM series, etc.) as well as A4 printers.
function printReceipt(bill: Bill, total: number, payMethod: string, pharmacyName = 'Pharmacy') {
  // GST rate-wise breakup (statutory requirement on tax invoices)
  const gstBreakup = new Map<number, { taxable: number; gst: number }>();
  for (const i of bill.items) {
    const rate = i.gstRate ?? 0;
    const e = gstBreakup.get(rate) ?? { taxable: 0, gst: 0 };
    e.taxable += i.totalAmount - (i.gstAmount ?? 0);
    e.gst += i.gstAmount ?? 0;
    gstBreakup.set(rate, e);
  }
  const gstRows = Array.from(gstBreakup.entries())
    .filter(([rate]) => rate > 0)
    .sort(([a], [b]) => a - b)
    .map(([rate, v]) =>
      `<tr><td>GST ${rate}% (CGST ${rate / 2}% + SGST ${rate / 2}%)</td><td class="r">₹${v.gst.toFixed(2)}</td></tr>`)
    .join('');

  const hasScheduled = bill.items.some((i) => {
    const s = (i as { schedule?: string | null }).schedule;
    return s && SCHEDULED_DRUGS.includes(s);
  });

  const content = `<html><head><title>Bill ${bill.billNumber}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  @media print { body { width: 72mm; } }
  * { box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 10.5px; width: 72mm;
         margin: 0 auto; padding: 4mm 2mm; color: #000; }
  h2 { font-size: 13px; margin: 0; text-align: center; }
  .sub { text-align: center; font-size: 9px; margin: 1px 0; }
  p { margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1.5px 0; vertical-align: top; font-size: 10.5px; }
  .r { text-align: right; white-space: nowrap; }
  .c { text-align: center; }
  .tot td { border-top: 1px solid #000; font-weight: bold; font-size: 12px; padding-top: 3px; }
  hr { border: 0; border-top: 1px dashed #000; margin: 4px 0; }
  .small { font-size: 9px; }
  .warn { font-size: 9px; border: 1px solid #000; padding: 2px 4px; margin: 4px 0; text-align: center; }
</style></head><body>
<h2>${pharmacyName.toUpperCase()}</h2>
<p class="sub">TAX INVOICE</p>
<hr/>
<p>Bill: <b>${bill.billNumber}</b></p>
<p>Date: ${formatDateTime(bill.createdAt)}</p>
<p>Patient: ${bill.customer?.name ?? 'Walk-in Customer'}${bill.customer?.phone ? `<br/>Ph: ${bill.customer.phone}` : ''}</p>
${(bill as { doctor?: string }).doctor ? `<p>Rx by: Dr. ${(bill as { doctor?: string }).doctor}</p>` : ''}
<hr/>
<table>
<tr><td><b>Item</b></td><td class="r"><b>Qty</b></td><td class="r"><b>Rate</b></td><td class="r"><b>Amt</b></td></tr>
${bill.items.map((i) => `
<tr><td colspan="4" style="padding-bottom:0">${i.medicineName}</td></tr>
<tr><td class="small">B:${i.batchNumber} E:${new Date(i.expiryDate).toLocaleDateString('en-IN', { month: '2-digit', year: '2-digit' })}${i.discount ? ` D:${i.discount}%` : ''}</td>
<td class="r">${i.quantity}</td><td class="r">${i.sellingPrice.toFixed(2)}</td><td class="r">${i.totalAmount.toFixed(2)}</td></tr>`).join('')}
</table>
<hr/>
<table>
<tr><td>Subtotal</td><td class="r">₹${bill.subtotal.toFixed(2)}</td></tr>
${bill.discountAmount > 0 ? `<tr><td>Discount (${bill.discountPercent}%)</td><td class="r">-₹${bill.discountAmount.toFixed(2)}</td></tr>` : ''}
${gstRows}
<tr class="tot"><td>TOTAL</td><td class="r">₹${total.toFixed(2)}</td></tr>
<tr><td>Paid (${payMethod.toUpperCase()})</td><td class="r">₹${bill.paidAmount.toFixed(2)}</td></tr>
${bill.balanceAmount > 0 ? `<tr><td><b>Balance Due</b></td><td class="r"><b>₹${bill.balanceAmount.toFixed(2)}</b></td></tr>` : ''}
</table>
${hasScheduled ? '<div class="warn">Schedule H/H1 drug — to be sold on prescription of a Registered Medical Practitioner only</div>' : ''}
<hr/>
<p class="c small">Items: ${bill.items.length} · Qty: ${bill.items.reduce((s, i) => s + i.quantity, 0)}</p>
<p class="c small">Thank you for your purchase!<br/>Get well soon. Visit again.</p>
</body></html>`;
  const w = window.open('', '_blank', 'width=340,height=600');
  if (w) { w.document.write(content); w.document.close(); w.print(); }
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

async function searchMeds(q: string): Promise<Medicine[]> {
  const r = await apiFetch(`/api/medicines?search=${encodeURIComponent(q)}&limit=8`);
  const j = await r.json() as { success: boolean; data: { data: Medicine[] } };
  if (!r.ok) throw new Error('Request failed');
  return j.data?.data ?? ([] as Medicine[]);
}

async function fetchBills(): Promise<Bill[]> {
  const r = await apiFetch('/api/billing?limit=100');
  const j = await r.json() as { success: boolean; data: { data: Bill[] } };
  if (!r.ok) throw new Error('Request failed');
  return j.data?.data ?? ([] as Bill[]);
}

async function createBill(payload: object): Promise<Bill> {
  const r = await apiFetch('/api/billing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const j = await r.json() as { success: boolean; data: Bill; message?: string };
  if (!j.success) throw new Error(j.message ?? 'Failed');
  return j.data;
}

async function lookupBarcode(code: string): Promise<Medicine | null> {
  const r = await apiFetch(`/api/medicines/barcode/${code.trim()}`);
  const j = await r.json() as { success: boolean; data: Medicine };
  return j.success ? j.data : null;
}

async function fetchMedicineInventory(medicineId: string): Promise<{ batchNumber: string; expiryDate: string; quantity: number } | null> {
  try {
    const r = await apiFetch(`/api/inventory?medicineId=${encodeURIComponent(medicineId)}&status=available&limit=1`);
    if (!r.ok) return null;
    const j = await r.json() as { data: { data: Array<{ batchNumber: string; expiryDate: string; availableQuantity: number }> } };
    const item = j.data.data?.[0];
    return item ? { batchNumber: item.batchNumber, expiryDate: item.expiryDate, quantity: item.availableQuantity } : null;
  } catch {
    return null;
  }
}

function exportCSV(data: Bill[]) {
  const csv = ['Bill No.,Customer,Items,Total,Payment,Status,Date',
    ...data.map((b) => [b.billNumber, b.customer?.name ?? 'Walk-in', b.items.length, b.totalAmount, b.paymentMethod ?? 'cash', b.status, formatDateTime(b.createdAt)].join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `bills-${new Date().toISOString().substring(0, 10)}.csv`;
  a.click();
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function BillingView() {
  const [mode, setMode] = useState<'pos' | 'history'>('pos');
  const [heldBills, setHeldBills] = useState<HeldBill[]>([]);

  // POS state
  const [search, setSearch] = useState('');
  const [showSugg, setShowSugg] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [doctor, setDoctor] = useState('');
  const [payMethod, setPayMethod] = useState<'cash' | 'upi' | 'card' | 'credit'>('cash');
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [cashTendered, setCashTendered] = useState('');

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

  const { data: suggestions = [] } = useQuery({
    queryKey: ['med-search', search],
    queryFn: () => searchMeds(search),
    enabled: search.length >= 2,
  });

  const { data: inventoryMap = {} } = useQuery<Record<string, { batchNumber: string; expiryDate: string; quantity: number } | null>>({
    queryKey: ['inv-map', suggestions.map(m => m.id).join(',')],
    queryFn: async () => {
      if (!suggestions.length) return {};
      const results = await Promise.all(suggestions.map(m => fetchMedicineInventory(m.id)));
      return Object.fromEntries(suggestions.map((m, i) => [m.id, results[i] ?? null]));
    },
    enabled: suggestions.length > 0 && showSugg,
    staleTime: 5 * 60 * 1000,
  });

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
        <div class="footer">Divya Pharmacy &bull; +91-9876543210 &bull; DL/KA/2024/0234</div>
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
    mutationFn: createBill,
    onSuccess: (bill) => {
      qc.invalidateQueries({ queryKey: ['billing'] });
      const savedTotal = total;
      const savedPhone = customerPhone;
      const savedBillNo = bill.billNumber;
      printReceipt(bill, savedTotal, payMethod, user?.tenantName);
      clearPOS();
      toast.success(`Bill ${savedBillNo} created`, {
        description: `${formatCurrency(savedTotal)} · ${payMethod.toUpperCase()}`,
        duration: savedPhone ? 15000 : 5000,
        action: savedPhone ? {
          label: 'Send WhatsApp',
          onClick: () => sendWhatsApp(savedPhone, savedBillNo, savedTotal),
        } : undefined,
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMedicine = useCallback(async (med: Medicine) => {
    setSearch(''); setShowSugg(false);
    setAddingMedicineId(med.id);
    try {
      const inv = await fetchMedicineInventory(med.id);
      const batchNum = inv?.batchNumber ?? 'AUTO';
      const expiryDate = inv?.expiryDate ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const stockQty = inv?.quantity ?? 0;
      setItems((prev) => {
        const idx = prev.findIndex((i) => i.medicineId === med.id);
        if (idx >= 0) {
          return prev.map((item, i) => i === idx ? calcLine({ ...item, quantity: item.quantity + 1 }) : item);
        }
        return [...prev, calcLine({
          medicineId: med.id, medicineName: med.name, genericName: med.genericName,
          batchNumber: batchNum, expiryDate,
          quantity: 1, mrp: med.mrp, sellingPrice: med.sellingPrice, discount: 0,
          gstRate: med.gstRate, gstAmount: 0, totalAmount: 0,
          requiresPrescription: med.requiresPrescription, schedule: med.schedule ?? null, stockQty,
        })];
      });
    } catch {
      toast.error(`Could not load inventory for ${med.name}`);
    } finally {
      setAddingMedicineId(null);
    }
  }, []);

  const updateItem = useCallback((idx: number, field: keyof CartItem, value: number) => {
    setItems((prev) => prev.map((item, i) => i === idx ? calcLine({ ...item, [field]: value }) : item));
  }, []);

  const removeItem = useCallback((idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handlePay = useCallback(() => {
    if (items.length === 0) { toast.error('Add at least one medicine'); return; }
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

  const upiData = `upi://pay?pa=divyapharmacy@upi&pn=Divya%20Pharmacy&am=${total.toFixed(2)}&cu=INR`;

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
                      const stock = inv != null ? inv.quantity : null;
                      const batchNum = inv?.batchNumber ?? '—';
                      const expiry = inv?.expiryDate;
                      const { text: stockText, cls: stockCls } = stock !== null
                        ? stockLabel(stock, med.reorderLevel)
                        : { text: 'Checking stock…', cls: 'text-muted-foreground' };
                      const expWarn = expiry ? expiryAlert(expiry) : null;
                      const outOfStock = stock === 0;
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
                  <Input placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="h-8 text-xs pl-7" />
                </div>
                <Input placeholder="Phone number" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} maxLength={10} className="h-8 text-xs" />
              </div>
              <Input placeholder="Doctor name (for Rx)" value={doctor} onChange={(e) => setDoctor(e.target.value)} className="mt-1.5 h-8 text-xs" />
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
                  <Receipt className="h-8 w-8 text-muted-foreground/25 mb-2" />
                  <p className="text-xs text-muted-foreground">Cart is empty</p>
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
                    <div className="flex items-center gap-2">
                      <div className="flex items-center rounded-md border border-border">
                        <button onClick={() => item.quantity > 1 && updateItem(idx, 'quantity', item.quantity - 1)}
                          className="px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors rounded-l-md">
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
                        <button onClick={() => updateItem(idx, 'quantity', item.quantity + 1)}
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
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground flex-1">Bill discount %</span>
                <input type="number" min={0} max={100} value={globalDiscount}
                  onChange={(e) => setGlobalDiscount(Number(e.target.value))}
                  className="w-16 h-6 text-xs border border-border rounded px-2 text-center bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>

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
              <div className="grid grid-cols-4 gap-1.5">
                {(['cash', 'upi', 'card', 'credit'] as const).map((m) => (
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
                    <p className="text-xs font-mono text-blue-600">divyapharmacy@upi</p>
                    <button
                      className="mt-1.5 text-2xs text-blue-500 underline underline-offset-2"
                      onClick={() => { navigator.clipboard?.writeText('divyapharmacy@upi'); toast.success('UPI ID copied'); }}
                    >
                      Copy UPI ID
                    </button>
                  </div>
                </div>
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
                <Button size="sm" className="flex-[2] gap-1.5 font-semibold text-xs" onClick={handlePay} disabled={mutation.isPending || items.length === 0}>
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
  const { user } = useAuthStore();
  const [viewBill, setViewBill] = useState<Bill | null>(null);
  const { data = [], isLoading } = useQuery({ queryKey: ['billing'], queryFn: fetchBills });

  const revenue = data.filter((b) => b.status === 'completed').reduce((s, b) => s + b.totalAmount, 0);

  const PAYMENT_COLOR: Record<string, string> = {
    cash: 'text-success', upi: 'text-blue-600', card: 'text-purple-600', credit: 'text-warning-600',
  };

  function doPrint(bill: Bill) {
    printReceipt(bill, bill.totalAmount, bill.paymentMethod ?? 'cash', user?.tenantName);
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
          <p className="font-medium text-sm">{row.original.customer?.name ?? 'Walk-in'}</p>
          {row.original.customer?.phone && <p className="text-xs text-muted-foreground">{row.original.customer.phone}</p>}
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
                const msg = encodeURIComponent(`*Divya Pharmacy* — Bill ${row.original.billNumber}\nTotal: ₹${row.original.totalAmount.toFixed(2)}\nThank you! 🙏`);
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
          <Button size="sm" onClick={onNewBill}>
            <Receipt className="h-3.5 w-3.5" /> New Bill
          </Button>
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
              <div><span className="text-muted-foreground">Customer: </span>{viewBill.customer?.name ?? 'Walk-in'}</div>
              <div><span className="text-muted-foreground">Status: </span>
                <Badge variant={viewBill.status === 'completed' ? 'success' : viewBill.status === 'cancelled' ? 'muted' : 'warning'} dot className="text-xs capitalize">{viewBill.status.replace('_', ' ')}</Badge>
              </div>
              {viewBill.customer?.phone && <div className="col-span-2"><span className="text-muted-foreground">Phone: </span>{viewBill.customer.phone}</div>}
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
              <Button size="sm" variant="destructive" className="flex-1 gap-1.5" onClick={() => { setViewBill(null); router.push(`/returns?billId=${viewBill.id}&billNumber=${encodeURIComponent(viewBill.billNumber)}`); }}>
                Process Return
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}

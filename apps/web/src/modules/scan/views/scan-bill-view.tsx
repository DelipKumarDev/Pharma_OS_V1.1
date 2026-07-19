'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Upload, ScanLine, Plus, Trash2, Check, Loader2, FileImage, RotateCcw, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';

interface Row {
  medicineName: string;
  genericName: string;
  batchNumber: string;
  expiryDate: string;
  quantity: string;
  purchasePrice: string;
  mrp: string;
  sellingPrice: string;
  gstRate: string;
}

const emptyRow = (): Row => ({ medicineName: '', genericName: '', batchNumber: '', expiryDate: '', quantity: '', purchasePrice: '', mrp: '', sellingPrice: '', gstRate: '12' });

type Stage = 'upload' | 'processing' | 'review' | 'done';

// Best-effort parse of raw OCR text into candidate line items. Deliberately
// permissive — the user reviews and corrects everything before committing.
function parseOcr(text: string): { vendor: string; rows: Row[] } {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const vendor = lines[0] ?? '';
  const rows: Row[] = [];
  for (const line of lines) {
    // a plausible item line has a word-y start and at least two numbers (qty + price)
    const nums = line.match(/\d+(?:\.\d+)?/g);
    const name = line.replace(/[\d.,%₹|]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (name.length >= 3 && nums && nums.length >= 2 && !/gst|total|invoice|bill|tax|amount|qty|rate/i.test(name)) {
      const r = emptyRow();
      r.medicineName = name;
      r.quantity = nums[0] ?? '';
      r.purchasePrice = nums[1] ?? '';
      r.mrp = nums[2] ?? '';
      rows.push(r);
    }
  }
  return { vendor, rows: rows.slice(0, 30) };
}

export function ScanBillView() {
  const [stage, setStage] = useState<Stage>('upload');
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rawText, setRawText] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [vendorName, setVendorName] = useState('');
  const [vendorGst, setVendorGst] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [committing, setCommitting] = useState(false);
  const [summary, setSummary] = useState<{ batchesAdded: number; newMedicineCount: number; medicinesCreated: string[]; vendor: { name: string; created: boolean }; invoice: { invoiceNumber: string; totalAmount: number } } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const runOcr = useCallback(async (file: File) => {
    setStage('processing');
    setProgress(0);
    setPreviewUrl(URL.createObjectURL(file));
    try {
      const Tesseract = (await import('tesseract.js')).default;
      const { data } = await Tesseract.recognize(file, 'eng', {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100));
        },
      });
      const text = data.text ?? '';
      setRawText(text);
      const parsed = parseOcr(text);
      if (parsed.vendor) setVendorName(parsed.vendor);
      setRows(parsed.rows.length ? parsed.rows : [emptyRow()]);
      setStage('review');
      toast.success(`Scanned — ${parsed.rows.length} line item(s) detected. Please review and correct before saving.`);
    } catch (e) {
      toast.error('Could not read the image. You can still enter the items manually.');
      setStage('review');
    }
  }, []);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) runOcr(f);
  };

  const setCell = (i: number, key: keyof Row, val: string) =>
    setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  const addRow = () => setRows(rs => [...rs, emptyRow()]);
  const removeRow = (i: number) => setRows(rs => rs.filter((_, idx) => idx !== i));

  const reset = () => {
    setStage('upload'); setProgress(0); setPreviewUrl(null); setRawText(''); setVendorName(''); setVendorGst('');
    setInvoiceNumber(''); setRows([emptyRow()]); setSummary(null);
  };

  const validRows = rows.filter(r => r.medicineName.trim() && r.batchNumber.trim() && r.expiryDate && Number(r.quantity) > 0);

  const commit = async () => {
    if (!vendorName.trim()) { toast.error('Enter the vendor / supplier name'); return; }
    if (validRows.length === 0) { toast.error('Each item needs a name, batch number, expiry date and quantity'); return; }
    setCommitting(true);
    try {
      const body = {
        vendor: { name: vendorName.trim(), gstNumber: vendorGst.trim() || undefined },
        invoiceNumber: invoiceNumber.trim() || undefined,
        items: validRows.map(r => ({
          medicineName: r.medicineName.trim(),
          genericName: r.genericName.trim() || undefined,
          batchNumber: r.batchNumber.trim(),
          expiryDate: r.expiryDate,
          quantity: Number(r.quantity),
          purchasePrice: Number(r.purchasePrice) || 0,
          mrp: Number(r.mrp) || 0,
          sellingPrice: Number(r.sellingPrice) || Number(r.mrp) || 0,
          gstRate: Number(r.gstRate) || 12,
        })),
      };
      const res = await apiFetch('/api/scan/commit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { toast.error(json.message ?? 'Failed to save'); return; }
      setSummary(json.data);
      setStage('done');
      toast.success('Stock updated from scanned bill');
    } catch {
      toast.error('Something went wrong while saving');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2"><ScanLine className="h-6 w-6 text-primary" /> Scan Purchase Bill</h1>
          <p className="text-sm text-muted-foreground">Upload a supplier bill photo — we extract the items, you review, then it updates stock, medicines and the vendor.</p>
        </div>
        {stage !== 'upload' && <Button variant="outline" size="sm" onClick={reset} className="gap-1"><RotateCcw className="h-4 w-4" /> Start over</Button>}
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-xs">
        {(['Upload', 'Review', 'Confirm'] as const).map((s, i) => {
          const active = (stage === 'upload' && i === 0) || (['processing', 'review'].includes(stage) && i === 1) || (stage === 'done' && i === 2);
          const done = (i === 0 && stage !== 'upload') || (i === 1 && stage === 'done');
          return (
            <React.Fragment key={s}>
              <span className={`flex items-center gap-1 rounded-full px-3 py-1 ${active ? 'bg-primary text-primary-foreground' : done ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                {done ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>} {s}
              </span>
              {i < 2 && <span className="h-px w-6 bg-border" />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Upload */}
      {stage === 'upload' && (
        <Card>
          <CardContent className="py-12">
            <div
              className="mx-auto flex max-w-lg cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border p-10 text-center hover:border-primary hover:bg-primary/5"
              onClick={() => fileRef.current?.click()}
            >
              <div className="rounded-full bg-primary/10 p-4"><Upload className="h-8 w-8 text-primary" /></div>
              <p className="font-medium">Click to upload a bill photo</p>
              <p className="text-xs text-muted-foreground">JPG / PNG · a clear, flat, well-lit photo reads best</p>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processing */}
      {stage === 'processing' && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="font-medium">Reading the bill… {progress}%</p>
            <div className="h-2 w-64 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">Text recognition runs on your device — the image is not uploaded.</p>
          </CardContent>
        </Card>
      )}

      {/* Review */}
      {stage === 'review' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="lg:col-span-3 space-y-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Vendor & Invoice</CardTitle><CardDescription>Confirm the supplier. New vendors are created automatically.</CardDescription></CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1"><Label>Vendor name *</Label><Input value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="Supplier name" /></div>
                <div className="space-y-1"><Label>GST number</Label><Input value={vendorGst} onChange={e => setVendorGst(e.target.value)} placeholder="Optional" /></div>
                <div className="space-y-1"><Label>Invoice number</Label><Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Optional" /></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 flex-row items-center justify-between">
                <div><CardTitle className="text-sm">Line items ({validRows.length} ready)</CardTitle><CardDescription>Correct anything the scan got wrong. Rows missing name / batch / expiry / qty are skipped.</CardDescription></div>
                <Button size="sm" variant="outline" className="gap-1" onClick={addRow}><Plus className="h-4 w-4" /> Add row</Button>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-xs">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      {['Medicine *', 'Generic', 'Batch *', 'Expiry *', 'Qty *', 'Purchase ₹', 'MRP ₹', 'Sell ₹', 'GST%', ''].map(h => <th key={h} className="pb-2 pr-2 font-semibold whitespace-nowrap">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-1 pr-2"><Input className="h-8 min-w-[150px]" value={r.medicineName} onChange={e => setCell(i, 'medicineName', e.target.value)} /></td>
                        <td className="py-1 pr-2"><Input className="h-8 min-w-[110px]" value={r.genericName} onChange={e => setCell(i, 'genericName', e.target.value)} /></td>
                        <td className="py-1 pr-2"><Input className="h-8 w-24" value={r.batchNumber} onChange={e => setCell(i, 'batchNumber', e.target.value)} /></td>
                        <td className="py-1 pr-2"><Input type="date" className="h-8 w-36" value={r.expiryDate} onChange={e => setCell(i, 'expiryDate', e.target.value)} /></td>
                        <td className="py-1 pr-2"><Input type="number" className="h-8 w-16" value={r.quantity} onChange={e => setCell(i, 'quantity', e.target.value)} /></td>
                        <td className="py-1 pr-2"><Input type="number" className="h-8 w-20" value={r.purchasePrice} onChange={e => setCell(i, 'purchasePrice', e.target.value)} /></td>
                        <td className="py-1 pr-2"><Input type="number" className="h-8 w-20" value={r.mrp} onChange={e => setCell(i, 'mrp', e.target.value)} /></td>
                        <td className="py-1 pr-2"><Input type="number" className="h-8 w-20" value={r.sellingPrice} onChange={e => setCell(i, 'sellingPrice', e.target.value)} /></td>
                        <td className="py-1 pr-2"><Input type="number" className="h-8 w-14" value={r.gstRate} onChange={e => setCell(i, 'gstRate', e.target.value)} /></td>
                        <td className="py-1"><button onClick={() => removeRow(i)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {rawText && (
              <Card>
                <button className="flex w-full items-center justify-between p-4 text-sm font-medium" onClick={() => setShowRaw(s => !s)}>
                  <span>Raw scanned text (reference)</span><ChevronDown className={`h-4 w-4 transition-transform ${showRaw ? 'rotate-180' : ''}`} />
                </button>
                {showRaw && <CardContent><pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-2xs text-muted-foreground">{rawText}</pre></CardContent>}
              </Card>
            )}

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={reset}>Cancel</Button>
              <Button onClick={commit} disabled={committing || validRows.length === 0} className="gap-1">
                {committing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Confirm & update stock ({validRows.length})
              </Button>
            </div>
          </div>

          {previewUrl && (
            <div className="lg:col-span-1">
              <Card className="sticky top-4">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><FileImage className="h-4 w-4" /> Uploaded bill</CardTitle></CardHeader>
                <CardContent><img src={previewUrl} alt="bill" className="w-full rounded-lg border border-border" /></CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Done */}
      {stage === 'done' && summary && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="rounded-full bg-success/15 p-4"><Check className="h-8 w-8 text-success" /></div>
            <h2 className="text-lg font-semibold">Stock updated</h2>
            <div className="flex flex-wrap justify-center gap-2">
              <Badge variant="success">{summary.batchesAdded} batches added</Badge>
              <Badge variant="secondary">{summary.newMedicineCount} new medicines</Badge>
              <Badge variant={summary.vendor.created ? 'warning' : 'muted'}>Vendor: {summary.vendor.name}{summary.vendor.created ? ' (new)' : ''}</Badge>
              <Badge variant="muted">Invoice {summary.invoice.invoiceNumber} · ₹{summary.invoice.totalAmount}</Badge>
            </div>
            {summary.medicinesCreated.length > 0 && (
              <p className="text-xs text-muted-foreground">New in Medicine Master: {summary.medicinesCreated.join(', ')}</p>
            )}
            <Button onClick={reset} className="gap-1"><ScanLine className="h-4 w-4" /> Scan another bill</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

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

// Convert a "MM/YY" or "MM/YYYY" expiry to an ISO date (last day of the month).
function expiryToIso(mmYY: string): string {
  const m = mmYY.match(/^(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) return '';
  const month = Math.min(12, Math.max(1, parseInt(m[1]!, 10)));
  let year = parseInt(m[2]!, 10);
  if (year < 100) year += 2000;
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

// Token-aware parse of a pharmacy purchase bill. Each product row typically has
// (rack) description qty (free) pack BATCH exp/date prices... GST HSN. We classify
// tokens by shape rather than position so it works across bill layouts. Everything
// is reviewed by the user before commit.
const FORM_WORDS = /^(tab|tabs|cap|caps|syp|syrup|susp|sus;|inj|cream|gel|drops|spray|soln|sol|lotion|oint|powder|sachet|kit|ml|mg|mcg|gm|iu|s|nos)$/i;

function parseItemRow(line: string): Row | null {
  // ignore obvious non-product lines
  if (/^(rack|description|qty|free|pack|batch|hsn|total|tax\b|taxable|invoice|gst|sgst|cgst|igst|amount|sale value|grand|round|net value|new mrp|old mrp|trade|disc|scm|prep|checked|s\.?no)/i.test(line)) return null;

  const tokens = line.split(/\s+/).filter(Boolean);
  if (tokens.length < 4) return null;

  // leading rack code, e.g. "G0569" — a letter followed by digits, not a batch
  const rack = /^[A-Za-z]\d{2,}$/.test(tokens[0]!) ? tokens[0]! : null;
  // expiry MM/YY (strong signal of a product row)
  const expiryTok = tokens.find(t => /^(0?[1-9]|1[0-2])\/(\d{2}|\d{4})$/.test(t));
  // HSN: the LAST 6–8 digit pure integer in the row (batches can also be numeric)
  const hsnTok = [...tokens].reverse().find(t => /^\d{6,8}$/.test(t));
  // batch: letter+digit, length >=5, not the rack code / a pack unit / form word / date / HSN
  const batchTok = tokens.find(t =>
    t !== rack && /[A-Za-z]/.test(t) && /\d/.test(t) &&
    t.replace(/[^A-Za-z0-9]/g, '').length >= 5 && !/\//.test(t) &&
    !/^\d+('?s|ml|md|gm|mg|mcg|iu|gr|cc|kg)$/i.test(t) &&
    !FORM_WORDS.test(t) && t !== hsnTok);
  // all 2-decimal money values, in order
  const decimals = tokens.filter(t => /^\d+\.\d{2}$/.test(t)).map(t => parseFloat(t));

  // A product row needs an expiry or (a batch + a price)
  if (!expiryTok && !(batchTok && decimals.length)) return null;

  // medicine name: leading alphabetic-ish tokens, after an optional rack code
  const nameTokens: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i]!;
    if (i === 0 && rack) continue;                              // skip rack code e.g. G0569
    if (tk === batchTok || tk === expiryTok) break;
    if (/^\d+$/.test(tk) || /'/.test(tk) || /^\d+\.\d{2}$/.test(tk)) break; // qty / pack (15'S) / price (keep strength like 10MG)
    if (/[A-Za-z]/.test(tk)) nameTokens.push(tk); else break;
  }
  const medicineName = nameTokens.join(' ').replace(/\s+/g, ' ').trim();
  if (medicineName.length < 3) return null;

  // quantity: first small integer after the name, before the batch
  const nameEnd = tokens.indexOf(nameTokens[nameTokens.length - 1] ?? '') + 1;
  const batchIdx = batchTok ? tokens.indexOf(batchTok) : (expiryTok ? tokens.indexOf(expiryTok) : tokens.length);
  let quantity = '';
  for (let i = Math.max(0, nameEnd); i < batchIdx; i++) {
    if (/^\d{1,4}$/.test(tokens[i]!)) { quantity = tokens[i]!; break; }
  }

  // prices: first two non-zero 2-decimals after the expiry (NEW MRP, TRADE PRICE)
  const expIdx = expiryTok ? tokens.indexOf(expiryTok) : -1;
  const afterExp = tokens.slice(expIdx + 1).filter(t => /^\d+\.\d{2}$/.test(t)).map(parseFloat).filter(n => n > 0);
  const pricesPool = (afterExp.length ? afterExp : decimals.filter(n => n > 0));
  const mrp = pricesPool[0] ?? '';
  const purchase = pricesPool[1] ?? '';

  // GST %: a standalone 0/5/12/18/28 token (not part of a decimal)
  const gstTok = [...tokens].reverse().find(t => /^(0|5|12|18|28)$/.test(t) && t !== hsnTok);

  const r = emptyRow();
  r.medicineName = medicineName;
  r.batchNumber = batchTok ?? '';
  r.expiryDate = expiryTok ? expiryToIso(expiryTok) : '';
  r.quantity = quantity;
  r.mrp = mrp === '' ? '' : String(mrp);
  r.purchasePrice = purchase === '' ? '' : String(purchase);
  r.sellingPrice = mrp === '' ? '' : String(mrp);
  r.gstRate = gstTok ?? '12';
  return r;
}

// Best-effort parse of raw OCR text into candidate line items. Deliberately
// permissive — the user reviews and corrects everything before committing.
function parseOcr(text: string): { vendor: string; rows: Row[] } {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  // vendor = the most prominent line near the top (longest alphabetic line in the first 6)
  const vendor = [...lines.slice(0, 6)]
    .filter(l => /[A-Za-z]{4,}/.test(l) && !/invoice|tax|gst|date|bill|no\.?\b/i.test(l))
    .sort((a, b) => b.replace(/[^A-Za-z]/g, '').length - a.replace(/[^A-Za-z]/g, '').length)[0] ?? lines[0] ?? '';

  const rows: Row[] = [];
  for (const line of lines) {
    const r = parseItemRow(line);
    if (r) rows.push(r);
  }
  return { vendor: vendor.trim(), rows: rows.slice(0, 40) };
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

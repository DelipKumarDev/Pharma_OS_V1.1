// Per-tenant receipt/print configuration. Stored as JSON on the tenant; missing
// keys fall back to sensible defaults (clean, compliant out of the box).

// Physical paper the bill prints on. Thermal sizes drive an 80mm/58mm roll POS
// printer; A5/A4 produce a full GST tax-invoice page (wholesale / B2B / records).
export type PaperSize = 'thermal80' | 'thermal58' | 'a5' | 'a4';
export const PAPER_SIZES: PaperSize[] = ['thermal80', 'thermal58', 'a5', 'a4'];

export interface ReceiptConfig {
  /** Paper size / print format the bill renders in. */
  paperSize: PaperSize;
  // Line-item detail
  showDoctor: boolean;
  showBatch: boolean;
  showExpiry: boolean;
  showHsn: boolean;
  showGstBreakdown: boolean;
  showSavings: boolean;
  showCashier: boolean;
  // Pharmacy identity block (statutory details on an Indian pharmacy invoice)
  showPhone: boolean;
  showAddress: boolean;
  showGstin: boolean;
  showDrugLicense: boolean;
  showLicense: boolean;
  // Extras
  showPoweredBy: boolean;
  showQr: boolean;
  compact: boolean;
}

export const DEFAULT_RECEIPT_CONFIG: ReceiptConfig = {
  paperSize: 'thermal80',
  showDoctor: true,
  showBatch: true,
  showExpiry: true,
  showHsn: false,
  showGstBreakdown: true,
  showSavings: true,
  showCashier: true,
  showPhone: true,
  showAddress: true,
  showGstin: true,
  showDrugLicense: true,
  showLicense: false,
  showPoweredBy: true,
  showQr: false,
  compact: false,
};

export function resolveReceiptConfig(raw: unknown): ReceiptConfig {
  const r = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
  const out = { ...DEFAULT_RECEIPT_CONFIG };
  for (const k of Object.keys(DEFAULT_RECEIPT_CONFIG) as Array<keyof ReceiptConfig>) {
    if (k === 'paperSize') {
      if (typeof r[k] === 'string' && (PAPER_SIZES as string[]).includes(r[k] as string)) {
        out.paperSize = r[k] as PaperSize;
      }
    } else if (typeof r[k] === 'boolean') {
      (out[k] as boolean) = r[k] as boolean;
    }
  }
  return out;
}

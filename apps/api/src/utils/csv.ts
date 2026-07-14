import type { Response } from 'express';

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | Date | null | undefined;
}

function escapeCell(v: string | number | boolean | Date | null | undefined): string {
  if (v === null || v === undefined) return '';
  let s: string;
  if (v instanceof Date) s = v.toISOString();
  else s = String(v);
  // Guard against CSV formula injection when opened in Excel
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map(c => escapeCell(c.header)).join(',');
  const body = rows.map(row => columns.map(c => escapeCell(c.value(row))).join(','));
  return [header, ...body].join('\r\n');
}

export function sendCsv(res: Response, filename: string, csv: string): void {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  // BOM so Excel opens UTF-8 (₹, Hindi names) correctly
  res.send('﻿' + csv);
}

// Shared Excel (.xls) export: an HTML-table workbook Excel opens natively, with
// BOLD, UPPERCASE, shaded header row clearly distinct from the data rows.
// Use this everywhere instead of plain CSV so exports have a proper format.

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function exportToExcel(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): void {
  // Auto-fit: size each column to its widest cell (header or data), clamped to a
  // sensible range, so the exported sheet is readable without manual resizing.
  const colWidths = headers.map((h, i) => {
    const maxLen = Math.max(String(h).length, ...rows.map((r) => String(r[i] ?? '').length));
    return Math.min(360, Math.max(64, maxLen * 8 + 16)); // px
  });
  const colgroup = `<colgroup>${colWidths.map((w) => `<col style="width:${w}px">`).join('')}</colgroup>`;
  const thead = `<tr>${headers
    .map((h) => `<th style="font-weight:bold;text-transform:uppercase;background:#1f2937;color:#ffffff;border:1px solid #111827;padding:6px 10px;text-align:left;white-space:nowrap">${esc(h)}</th>`)
    .join('')}</tr>`;
  const tbody = rows
    .map((r) => `<tr>${r.map((c) => `<td style="border:1px solid #d1d5db;padding:4px 10px;mso-number-format:'\\@'">${esc(c)}</td>`).join('')}</tr>`)
    .join('');
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Export</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table>${colgroup}${thead}${tbody}</table></body></html>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: /\.xlsx?$/i.test(filename) ? filename : `${filename}.xls`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

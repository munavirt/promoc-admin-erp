/**
 * Client-side CSV helpers for exporting data the user already loaded from the API
 * (the backend has no export endpoints).
 */
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

/** RFC 4180 quoting, plus a guard against spreadsheet formula injection (=, +, -, @, tab, CR). */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const lines = [columns.map((c) => csvCell(c.header)).join(",")];
  for (const row of rows) lines.push(columns.map((c) => csvCell(c.value(row))).join(","));
  return lines.join("\r\n");
}

/** Triggers a browser download. `baseName` gets today's date and `.csv` appended. */
export function downloadCsv(baseName: string, csv: string): void {
  // BOM so Excel opens UTF-8 text correctly.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${baseName}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

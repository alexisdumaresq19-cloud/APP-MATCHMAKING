/** CSV for French Excel: UTF-8 with BOM, `;` separator, CRLF, values quoted when needed. */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [header.map(escape).join(";"), ...rows.map((row) => row.map(escape).join(";"))];
  return "﻿" + lines.join("\r\n") + "\r\n";
}

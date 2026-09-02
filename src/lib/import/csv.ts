/** Small, dependency-free CSV parser: auto-detects `;`, `,` or tab; handles quotes, BOM and CRLF. */

export type ParsedCsv = { header: string[]; rows: string[][]; delimiter: string };

export function detectDelimiter(firstLine: string): string {
  const candidates = [";", ",", "\t"];
  let best = ";";
  let bestCount = -1;
  for (const candidate of candidates) {
    const count = firstLine.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

export function parseCsv(text: string, options: { maxRows?: number } = {}): ParsedCsv {
  const content = text.replace(/^﻿/, "");
  const firstLineEnd = content.search(/\r?\n/);
  const delimiter = detectDelimiter(firstLineEnd === -1 ? content : content.slice(0, firstLineEnd));
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    if (quoted) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && content[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      if (options.maxRows && rows.length > options.maxRows) break;
    } else field += char;
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  }
  const header = (rows.shift() ?? []).map((cell) => cell.trim());
  return { header, rows, delimiter };
}

/** Normalizes a header cell to a key: lowercase, no accents, spaces → underscore. */
export function headerKey(cell: string): string {
  return cell
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

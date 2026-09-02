import ExcelJS from "exceljs";

export type Sheet = {
  name: string;
  header: string[];
  rows: (string | number | null | undefined)[][];
  widths?: number[];
};

/** Builds a workbook with bold headers, auto-filter and frozen first row. */
export async function buildWorkbook(sheets: Sheet[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Jumelage";
  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name.slice(0, 31));
    worksheet.addRow(sheet.header);
    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    for (const row of sheet.rows) worksheet.addRow(row.map((cell) => cell ?? ""));
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.header.length },
    };
    sheet.header.forEach((label, index) => {
      const column = worksheet.getColumn(index + 1);
      column.width = sheet.widths?.[index] ?? Math.min(48, Math.max(12, label.length + 4));
    });
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

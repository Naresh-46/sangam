export type CsvColumn = { key: string; header: string };

function escapeCsvValue(value: unknown): string {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(
  rows: Record<string, unknown>[],
  columns: CsvColumn[],
): string {
  return [
    columns.map((column) => escapeCsvValue(column.header)).join(","),
    ...rows.map((row) =>
      columns.map((column) => escapeCsvValue(row[column.key])).join(","),
    ),
  ].join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

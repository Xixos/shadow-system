"use client";

/**
 * Generic CSV exporter with proper typing and escaping.
 */
export function exportCsv<T extends Record<string, unknown>>(
  rows: T[],
  headers: Array<keyof T>,
  filename = "data.csv"
) {
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const headerLine = headers.join(",");
  const lines = rows.map((row) => headers.map((h) => escape(row[h])).join(","));
  const csv = [headerLine, ...lines].join("\n");

  if (typeof window !== "undefined") {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

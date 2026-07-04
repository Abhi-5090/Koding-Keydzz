/**
 * Hand-rolled CSV helpers (no external dependency).
 */

/**
 * Escape a single CSV field. Wraps the value in double quotes when it contains
 * a comma, double quote, or newline, doubling any embedded quotes (RFC 4180).
 * Nullish values become an empty string.
 */
export function escapeCsvValue(value) {
  const str = value == null ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build a CSV string from a header array and an array of row arrays.
 * Every value is CSV-escaped. Rows are joined with CRLF line endings.
 */
export function buildCsv(headers = [], rows = []) {
  const lines = [headers, ...rows].map((row) =>
    row.map((cell) => escapeCsvValue(cell)).join(',')
  );
  return lines.join('\r\n');
}

export default { escapeCsvValue, buildCsv };

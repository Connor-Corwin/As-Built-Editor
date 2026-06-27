import type { Connection, SignalType } from '../db/models';
import { SIGNAL_TYPES } from './signalColors';

/**
 * CSV import/export for the connection (cable) schedule. Endpoints are written
 * and read as plain text so the file opens cleanly in Excel/Sheets; imported
 * rows store those names as free-text endpoints (not linked to rack device ids).
 */

const HEADERS = [
  'From Device',
  'From Port',
  'To Device',
  'To Port',
  'Signal Type',
  'Cable Label',
] as const;

function escapeCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Resolve an endpoint's display name (rack device label or free text). */
export type DeviceNameResolver = (deviceId?: string) => string | undefined;

export function connectionsToCsv(
  connections: Connection[],
  resolveDevice: DeviceNameResolver,
): string {
  const lines = [HEADERS.join(',')];
  for (const c of connections) {
    const from = resolveDevice(c.fromDeviceId) ?? c.fromLabel ?? '';
    const to = resolveDevice(c.toDeviceId) ?? c.toLabel ?? '';
    lines.push(
      [
        from,
        c.fromPort ?? '',
        to,
        c.toPort ?? '',
        c.signalType,
        c.cableLabel ?? '',
      ]
        .map((v) => escapeCell(String(v)))
        .join(','),
    );
  }
  return lines.join('\r\n');
}

/** Parse a CSV string into rows of cells (handles quotes, commas, newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') {
      cell += ch;
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const VALID_TYPES = new Set<string>(SIGNAL_TYPES);

/** Convert parsed CSV (with our header row) into connection data. */
export function csvToConnections(
  text: string,
): Array<Omit<Connection, 'id' | 'projectId'>> {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  // Drop a header row if present.
  const start =
    rows[0][0]?.trim().toLowerCase() === 'from device' ? 1 : 0;
  const out: Array<Omit<Connection, 'id' | 'projectId'>> = [];
  for (let i = start; i < rows.length; i++) {
    const [from = '', fromPort = '', to = '', toPort = '', type = '', label = ''] =
      rows[i];
    const signalType = (
      VALID_TYPES.has(type.trim().toLowerCase())
        ? type.trim().toLowerCase()
        : 'other'
    ) as SignalType;
    out.push({
      fromLabel: from.trim() || undefined,
      fromPort: fromPort.trim() || undefined,
      toLabel: to.trim() || undefined,
      toPort: toPort.trim() || undefined,
      signalType,
      cableLabel: label.trim() || undefined,
    });
  }
  return out;
}

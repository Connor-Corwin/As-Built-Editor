import { useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  createConnection,
  deleteConnection,
  listConnections,
  listProjectDevices,
  updateConnection,
} from '../../db/repository';
import { downloadBlob } from '../../db/projectIO';
import { connectionsToCsv, csvToConnections } from '../../lib/csv';
import { SIGNAL_COLORS, SIGNAL_TYPES } from '../../lib/signalColors';
import type { Connection, SignalType } from '../../db/models';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../components/Button';

interface Props {
  projectId: string;
}

const CUSTOM = '__custom__';

export function ConnectionsSection({ projectId }: Props) {
  const connectionMode = useAppStore((s) => s.connectionMode);
  const toggleConnectionMode = useAppStore((s) => s.toggleConnectionMode);
  const selectedId = useAppStore((s) => s.selectedConnectionId);
  const setSelected = useAppStore((s) => s.setSelectedConnection);
  const selectDocument = useAppStore((s) => s.selectDocument);
  const setPage = useAppStore((s) => s.setPage);
  const importRef = useRef<HTMLInputElement>(null);

  const connections = useLiveQuery(
    () => listConnections(projectId),
    [projectId],
    [],
  );
  const devices = useLiveQuery(
    () => listProjectDevices(projectId),
    [projectId],
    [],
  );
  const deviceName = (id?: string) => devices.find((d) => d.id === id)?.label;

  const selected = connections.find((c) => c.id === selectedId) ?? null;

  function endpointText(c: Connection, side: 'from' | 'to'): string {
    const id = side === 'from' ? c.fromDeviceId : c.toDeviceId;
    const label = side === 'from' ? c.fromLabel : c.toLabel;
    const port = side === 'from' ? c.fromPort : c.toPort;
    const base = deviceName(id) ?? label ?? '—';
    return port ? `${base}:${port}` : base;
  }

  function selectConnection(c: Connection) {
    setSelected(c.id);
    if (c.documentId && c.page) {
      selectDocument(c.documentId);
      setPage(c.page);
    }
  }

  async function handleExport() {
    const csv = connectionsToCsv(connections, deviceName);
    downloadBlob(
      new Blob([csv], { type: 'text/csv' }),
      'connections.csv',
    );
  }

  async function handleImport(file: File) {
    const rows = csvToConnections(await file.text());
    for (const row of rows) await createConnection(projectId, row);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={connectionMode ? 'primary' : 'secondary'}
          onClick={toggleConnectionMode}
        >
          {connectionMode ? 'Stop drawing' : 'Draw on drawing'}
        </Button>
        <Button variant="secondary" onClick={handleExport} disabled={!connections.length}>
          Export CSV
        </Button>
        <Button variant="secondary" onClick={() => importRef.current?.click()}>
          Import CSV
        </Button>
        <input
          ref={importRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleImport(f);
            e.target.value = '';
          }}
        />
      </div>
      <p className="text-xs text-slate-400">
        Open a drawing and use “Draw on drawing” to place connection lines, or
        import a cable schedule from CSV.
      </p>

      {/* Selected connection editor */}
      {selected && (
        <div className="space-y-2 rounded-md bg-slate-50 p-2">
          <Endpoint
            title="From"
            devices={devices}
            deviceId={selected.fromDeviceId}
            label={selected.fromLabel}
            port={selected.fromPort}
            onChange={(changes) => updateConnection(selected.id, changes)}
            side="from"
          />
          <Endpoint
            title="To"
            devices={devices}
            deviceId={selected.toDeviceId}
            label={selected.toLabel}
            port={selected.toPort}
            onChange={(changes) => updateConnection(selected.id, changes)}
            side="to"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Signal</label>
            <select
              value={selected.signalType}
              onChange={(e) =>
                updateConnection(selected.id, {
                  signalType: e.target.value as SignalType,
                })
              }
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            >
              {SIGNAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              value={selected.cableLabel ?? ''}
              onChange={(e) =>
                updateConnection(selected.id, { cableLabel: e.target.value })
              }
              placeholder="Cable label"
              className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="danger"
              onClick={async () => {
                await deleteConnection(selected.id);
                setSelected(null);
              }}
            >
              Delete
            </Button>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Done
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      {connections.length === 0 ? (
        <p className="text-sm text-slate-400">No connections yet.</p>
      ) : (
        <ul className="space-y-1">
          {connections.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => selectConnection(c)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                  c.id === selectedId ? 'bg-sky-50 ring-1 ring-sky-200' : 'hover:bg-slate-50'
                }`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: SIGNAL_COLORS[c.signalType] }}
                  title={c.signalType}
                />
                <span className="min-w-0 flex-1 truncate text-slate-700">
                  {endpointText(c, 'from')} → {endpointText(c, 'to')}
                </span>
                {c.cableLabel && (
                  <span className="shrink-0 text-xs text-slate-400">
                    {c.cableLabel}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface EndpointProps {
  title: string;
  side: 'from' | 'to';
  devices: Array<{ id: string; label: string; rackName: string }>;
  deviceId?: string;
  label?: string;
  port?: string;
  onChange: (changes: Partial<Connection>) => void;
}

/** From/To endpoint editor: rack device dropdown, custom text, and port. */
function Endpoint({
  title,
  side,
  devices,
  deviceId,
  label,
  port,
  onChange,
}: EndpointProps) {
  const isCustom = !deviceId && label != null;
  const selectValue = deviceId ?? (isCustom ? CUSTOM : '');
  const keys =
    side === 'from'
      ? { dev: 'fromDeviceId', lbl: 'fromLabel', prt: 'fromPort' }
      : { dev: 'toDeviceId', lbl: 'toLabel', prt: 'toPort' };

  return (
    <div className="flex items-center gap-1">
      <span className="w-10 text-xs text-slate-500">{title}</span>
      <select
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === CUSTOM) {
            onChange({ [keys.dev]: undefined, [keys.lbl]: label ?? '' });
          } else if (v === '') {
            onChange({ [keys.dev]: undefined, [keys.lbl]: undefined });
          } else {
            onChange({ [keys.dev]: v, [keys.lbl]: undefined });
          }
        }}
        className="min-w-0 flex-1 rounded border border-slate-300 px-1.5 py-1 text-sm"
      >
        <option value="">— none —</option>
        <optgroup label="Rack devices">
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
              {d.rackName ? ` (${d.rackName})` : ''}
            </option>
          ))}
        </optgroup>
        <option value={CUSTOM}>Custom…</option>
      </select>
      {isCustom && (
        <input
          value={label ?? ''}
          onChange={(e) => onChange({ [keys.lbl]: e.target.value })}
          placeholder="Name"
          className="w-24 rounded border border-slate-300 px-1.5 py-1 text-sm"
        />
      )}
      <input
        value={port ?? ''}
        onChange={(e) => onChange({ [keys.prt]: e.target.value })}
        placeholder="Port"
        className="w-16 rounded border border-slate-300 px-1.5 py-1 text-sm"
      />
    </div>
  );
}

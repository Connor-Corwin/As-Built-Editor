import { useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  createConnection,
  createRack,
  deleteConnection,
  deletePoint,
  listConnections,
  listPoints,
  updateConnection,
  updatePoint,
} from '../../db/repository';
import { downloadBlob } from '../../db/projectIO';
import { connectionsToCsv, csvToConnections } from '../../lib/csv';
import { SIGNAL_COLORS, SIGNAL_TYPES } from '../../lib/signalColors';
import type { SignalType } from '../../db/models';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../components/Button';

interface Props {
  projectId: string;
}

export function ConnectionsSection({ projectId }: Props) {
  const editMode = useAppStore((s) => s.editMode);
  const toggleEditMode = useAppStore((s) => s.toggleEditMode);
  const setEditTool = useAppStore((s) => s.setEditTool);
  const selectedPointId = useAppStore((s) => s.selectedPointId);
  const setSelectedPoint = useAppStore((s) => s.setSelectedPoint);
  const selectedConnectionId = useAppStore((s) => s.selectedConnectionId);
  const setSelectedConnection = useAppStore((s) => s.setSelectedConnection);
  const selectRack = useAppStore((s) => s.selectRack);
  const importRef = useRef<HTMLInputElement>(null);

  const points = useLiveQuery(() => listPoints(projectId), [projectId], []);
  const connections = useLiveQuery(
    () => listConnections(projectId),
    [projectId],
    [],
  );
  const pointLabel = (id?: string) => {
    const p = points.find((pt) => pt.id === id);
    return p ? p.label || '(unlabeled)' : undefined;
  };

  const selPoint = points.find((p) => p.id === selectedPointId) ?? null;
  const selConn = connections.find((c) => c.id === selectedConnectionId) ?? null;

  function endpointText(id?: string, label?: string, port?: string): string {
    const base = pointLabel(id) ?? label ?? '—';
    return port ? `${base}:${port}` : base;
  }

  async function handleExport() {
    const csv = connectionsToCsv(connections, pointLabel);
    downloadBlob(new Blob([csv], { type: 'text/csv' }), 'connections.csv');
  }

  async function handleImport(file: File) {
    const rows = csvToConnections(await file.text());
    for (const row of rows) await createConnection(projectId, row);
  }

  async function makeRack() {
    if (!selPoint) return;
    const rack = await createRack(projectId, selPoint.label || 'Rack', 42);
    await updatePoint(selPoint.id, { rackId: rack.id });
    selectRack(rack.id);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={editMode ? 'primary' : 'secondary'}
          onClick={() => {
            if (!editMode) setEditTool('point');
            toggleEditMode();
          }}
        >
          {editMode ? 'Stop editing' : 'Edit plan'}
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
        Open a drawing, hit “Edit plan”, then add points, drag to move them, and
        link them. Click a point or line to edit it here.
      </p>

      {/* Selected point editor */}
      {selPoint && (
        <div className="space-y-2 rounded-md bg-slate-50 p-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Point
          </div>
          <input
            value={selPoint.label ?? ''}
            onChange={(e) => updatePoint(selPoint.id, { label: e.target.value })}
            placeholder="Label (e.g. Display, Speaker, Rack 1)"
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            {selPoint.rackId ? (
              <Button variant="primary" onClick={() => selectRack(selPoint.rackId!)}>
                Open rack elevation
              </Button>
            ) : (
              <Button variant="secondary" onClick={makeRack}>
                Make this a rack
              </Button>
            )}
            <Button
              variant="danger"
              onClick={async () => {
                await deletePoint(selPoint.id);
                setSelectedPoint(null);
              }}
            >
              Delete point
            </Button>
          </div>
        </div>
      )}

      {/* Selected connection editor */}
      {selConn && (
        <div className="space-y-2 rounded-md bg-slate-50 p-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Connection
          </div>
          <div className="text-sm text-slate-700">
            {endpointText(selConn.fromPointId, selConn.fromLabel)} →{' '}
            {endpointText(selConn.toPointId, selConn.toLabel)}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={selConn.fromPort ?? ''}
              onChange={(e) =>
                updateConnection(selConn.id, { fromPort: e.target.value })
              }
              placeholder="From port"
              className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
            />
            <input
              value={selConn.toPort ?? ''}
              onChange={(e) =>
                updateConnection(selConn.id, { toPort: e.target.value })
              }
              placeholder="To port"
              className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selConn.signalType}
              onChange={(e) =>
                updateConnection(selConn.id, {
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
              value={selConn.cableLabel ?? ''}
              onChange={(e) =>
                updateConnection(selConn.id, { cableLabel: e.target.value })
              }
              placeholder="Cable label"
              className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <Button
            variant="danger"
            onClick={async () => {
              await deleteConnection(selConn.id);
              setSelectedConnection(null);
            }}
          >
            Delete connection
          </Button>
        </div>
      )}

      {/* Connections list */}
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Connections ({connections.length})
        </div>
        {connections.length === 0 ? (
          <p className="text-sm text-slate-400">None yet.</p>
        ) : (
          <ul className="space-y-1">
            {connections.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setSelectedConnection(c.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                    c.id === selectedConnectionId
                      ? 'bg-sky-50 ring-1 ring-sky-200'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: SIGNAL_COLORS[c.signalType] }}
                    title={c.signalType}
                  />
                  <span className="min-w-0 flex-1 truncate text-slate-700">
                    {endpointText(c.fromPointId, c.fromLabel)} →{' '}
                    {endpointText(c.toPointId, c.toLabel)}
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

      {/* Points list */}
      {points.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Points ({points.length})
          </div>
          <ul className="space-y-1">
            {points.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => setSelectedPoint(p.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                    p.id === selectedPointId
                      ? 'bg-sky-50 ring-1 ring-sky-200'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: p.rackId ? '#059669' : '#0284c7' }}
                  />
                  <span className="min-w-0 flex-1 truncate text-slate-700">
                    {p.label || '(unlabeled)'}
                  </span>
                  {p.rackId && (
                    <span className="shrink-0 text-xs text-emerald-600">rack</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

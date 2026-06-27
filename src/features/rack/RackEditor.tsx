import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  addEquipment,
  deleteEquipment,
  getRack,
  listEquipment,
  updateEquipment,
  updateRack,
} from '../../db/repository';
import { EQUIPMENT_LIBRARY } from '../../db/equipmentLibrary';
import type { RackEquipment } from '../../db/models';
import { Button } from '../../components/Button';

const ROW_H = 26; // px per rack unit

interface Props {
  rackId: string;
}

interface DragState {
  id: string;
  mode: 'move' | 'resize';
  startY: number;
  origStartU: number;
  origHeightU: number;
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

export function RackEditor({ rackId }: Props) {
  const rack = useLiveQuery(() => getRack(rackId), [rackId]);
  const equipment = useLiveQuery(() => listEquipment(rackId), [rackId], []);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    id: string;
    startU: number;
    heightU: number;
  } | null>(null);
  const dragRef = useRef<DragState | null>(null);

  if (!rack) return null;
  const ru = rack.ruHeight;

  // Effective placement for a device (drag preview overrides stored values).
  const place = (e: RackEquipment) =>
    preview && preview.id === e.id
      ? { startU: preview.startU, heightU: preview.heightU }
      : { startU: e.startU, heightU: e.heightU };

  /** Lowest free start-U (searching from the top) that fits `heightU`. */
  function findFreeSlot(heightU: number): number {
    const occupied = new Set<number>();
    for (const e of equipment) {
      for (let u = e.startU; u < e.startU + e.heightU; u++) occupied.add(u);
    }
    for (let start = ru - heightU + 1; start >= 1; start--) {
      let ok = true;
      for (let u = start; u < start + heightU; u++) {
        if (occupied.has(u)) {
          ok = false;
          break;
        }
      }
      if (ok) return start;
    }
    return 1; // fall back to bottom (may overlap)
  }

  async function addItem(label: string, heightU: number) {
    const item = await addEquipment(rackId, {
      label,
      startU: findFreeSlot(heightU),
      heightU,
    });
    setSelectedId(item.id);
  }

  function onPointerDown(
    e: React.PointerEvent,
    item: RackEquipment,
    mode: DragState['mode'],
  ) {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(item.id);
    dragRef.current = {
      id: item.id,
      mode,
      startY: e.clientY,
      origStartU: item.startU,
      origHeightU: item.heightU,
    };
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    if (d.mode === 'move') {
      const dU = Math.round((d.startY - e.clientY) / ROW_H); // up = +
      const startU = clamp(d.origStartU + dU, 1, ru - d.origHeightU + 1);
      setPreview({ id: d.id, startU, heightU: d.origHeightU });
    } else {
      const topU = d.origStartU + d.origHeightU - 1; // keep top fixed
      const dDown = Math.round((e.clientY - d.startY) / ROW_H);
      const startU = clamp(d.origStartU - dDown, 1, topU);
      setPreview({ id: d.id, startU, heightU: topU - startU + 1 });
    }
  }

  async function onPointerUp() {
    const d = dragRef.current;
    dragRef.current = null;
    if (d && preview && preview.id === d.id) {
      await updateEquipment(d.id, {
        startU: preview.startU,
        heightU: preview.heightU,
      });
    }
    setPreview(null);
  }

  const selected = equipment.find((e) => e.id === selectedId) ?? null;

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="border-b border-slate-200 bg-white px-4 py-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-sm font-semibold text-slate-800">{rack.name}</span>
          <label className="flex items-center gap-1 text-xs text-slate-500">
            Height (U)
            <input
              type="number"
              min={1}
              max={60}
              value={ru}
              onChange={(e) =>
                updateRack(rackId, {
                  ruHeight: clamp(Math.round(Number(e.target.value)), 1, 60),
                })
              }
              className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm"
            />
          </label>
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-xs text-slate-500">Add:</span>
            {EQUIPMENT_LIBRARY.map((lib) => (
              <button
                key={lib.label}
                onClick={() => addItem(lib.label, lib.heightU)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:border-sky-400 hover:bg-sky-50"
                title={`${lib.label} (${lib.heightU}U)`}
              >
                {lib.label}
              </button>
            ))}
            <button
              onClick={() => addItem('New device', 1)}
              className="rounded border border-dashed border-slate-400 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              + Custom
            </button>
          </div>
        </div>

        {/* Selected-item editor */}
        {selected && (
          <div className="mt-2 flex flex-wrap items-end gap-2 rounded-md bg-slate-50 p-2">
            <Field label="Label">
              <input
                value={selected.label}
                onChange={(e) =>
                  updateEquipment(selected.id, { label: e.target.value })
                }
                className="w-40 rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label="Manufacturer">
              <input
                value={selected.manufacturer ?? ''}
                onChange={(e) =>
                  updateEquipment(selected.id, { manufacturer: e.target.value })
                }
                className="w-32 rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label="Model">
              <input
                value={selected.model ?? ''}
                onChange={(e) =>
                  updateEquipment(selected.id, { model: e.target.value })
                }
                className="w-32 rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label="Start U">
              <input
                type="number"
                min={1}
                max={ru}
                value={selected.startU}
                onChange={(e) =>
                  updateEquipment(selected.id, {
                    startU: clamp(
                      Math.round(Number(e.target.value)),
                      1,
                      ru - selected.heightU + 1,
                    ),
                  })
                }
                className="w-16 rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </Field>
            <Field label="Height U">
              <input
                type="number"
                min={1}
                max={ru}
                value={selected.heightU}
                onChange={(e) =>
                  updateEquipment(selected.id, {
                    heightU: clamp(
                      Math.round(Number(e.target.value)),
                      1,
                      ru - selected.startU + 1,
                    ),
                  })
                }
                className="w-16 rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </Field>
            <Button
              variant="danger"
              onClick={async () => {
                await deleteEquipment(selected.id);
                setSelectedId(null);
              }}
            >
              Delete
            </Button>
            <Button variant="ghost" onClick={() => setSelectedId(null)}>
              Done
            </Button>
          </div>
        )}
      </div>

      {/* Rack grid */}
      <div
        className="flex-1 overflow-auto bg-slate-200 p-6"
        onClick={() => setSelectedId(null)}
      >
        <div className="mx-auto flex w-max gap-2">
          {/* U-number gutter */}
          <div
            className="relative select-none text-right"
            style={{ height: ru * ROW_H, width: 32 }}
          >
            {Array.from({ length: ru }, (_, i) => {
              const u = ru - i; // top row is the highest U
              return (
                <div
                  key={u}
                  className="absolute right-0 text-[10px] leading-none text-slate-500"
                  style={{ top: i * ROW_H + 2, width: 30 }}
                >
                  {u}
                </div>
              );
            })}
          </div>

          {/* Rack frame */}
          <div
            className="relative border-2 border-slate-700 bg-white"
            style={{ width: 280, height: ru * ROW_H }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {/* RU rows */}
            {Array.from({ length: ru }, (_, i) => (
              <div
                key={i}
                className="absolute left-0 right-0 border-b border-slate-100"
                style={{ top: i * ROW_H, height: ROW_H }}
              />
            ))}

            {/* Equipment */}
            {equipment.map((item) => {
              const p = place(item);
              const topU = p.startU + p.heightU - 1;
              const top = (ru - topU) * ROW_H;
              const height = p.heightU * ROW_H;
              const isSel = item.id === selectedId;
              return (
                <div
                  key={item.id}
                  onPointerDown={(e) => onPointerDown(e, item, 'move')}
                  onClick={(e) => e.stopPropagation()}
                  className={`absolute left-1 right-1 cursor-move touch-none overflow-hidden rounded-sm border text-xs ${
                    isSel
                      ? 'border-sky-500 bg-sky-100 ring-2 ring-sky-300'
                      : 'border-slate-400 bg-slate-100 hover:bg-slate-200'
                  }`}
                  style={{ top: top + 1, height: height - 2 }}
                >
                  <div className="px-1.5 py-0.5 font-medium text-slate-800">
                    {item.label}
                    {item.model ? (
                      <span className="font-normal text-slate-500">
                        {' '}
                        · {item.model}
                      </span>
                    ) : null}
                  </div>
                  {/* Resize handle (bottom edge) */}
                  <div
                    onPointerDown={(e) => onPointerDown(e, item, 'resize')}
                    className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize bg-slate-400/40"
                    title="Drag to resize"
                  />
                </div>
              );
            })}

            {equipment.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-slate-400">
                Add equipment from the toolbar, then drag to position it.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

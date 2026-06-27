import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  createRack,
  deleteRack,
  listRacks,
  updateRack,
} from '../../db/repository';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../components/Button';

interface Props {
  projectId: string;
}

/** List of the project's racks (right drawer); select one to open its editor. */
export function RacksSection({ projectId }: Props) {
  const currentRackId = useAppStore((s) => s.currentRackId);
  const activeView = useAppStore((s) => s.activeView);
  const selectRack = useAppStore((s) => s.selectRack);
  const [name, setName] = useState('');
  const [ru, setRu] = useState(42);

  const racks = useLiveQuery(() => listRacks(projectId), [projectId], []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const rack = await createRack(projectId, name || 'New rack', ru);
    setName('');
    selectRack(rack.id);
  }

  async function handleRename(id: string, current: string) {
    const next = window.prompt('Rename rack', current);
    if (next != null) await updateRack(id, { name: next.trim() || 'New rack' });
  }

  async function handleDelete(id: string, rackName: string) {
    if (window.confirm(`Delete rack "${rackName}" and its equipment?`)) {
      await deleteRack(id);
      if (currentRackId === id) selectRack(null);
    }
  }

  return (
    <div>
      <form onSubmit={handleCreate} className="mb-3 space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Rack name (e.g. Rack 1 — Head End)"
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Height (U)</label>
          <input
            type="number"
            min={1}
            max={60}
            value={ru}
            onChange={(e) => setRu(Number(e.target.value))}
            className="w-16 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
          <Button type="submit" variant="primary" className="ml-auto">
            + Add rack
          </Button>
        </div>
      </form>

      {racks.length === 0 ? (
        <p className="text-sm text-slate-400">No racks yet.</p>
      ) : (
        <ul className="space-y-1">
          {racks.map((rack) => {
            const active = rack.id === currentRackId && activeView === 'rack';
            return (
              <li key={rack.id}>
                <div
                  className={`group flex items-center gap-2 rounded-md px-2 py-2 ${
                    active ? 'bg-sky-50 ring-1 ring-sky-200' : 'hover:bg-slate-50'
                  }`}
                >
                  <button
                    onClick={() => selectRack(rack.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate text-sm font-medium text-slate-700">
                      {rack.name}
                    </div>
                    <div className="text-xs text-slate-400">{rack.ruHeight}U</div>
                  </button>
                  <button
                    onClick={() => handleRename(rack.id, rack.name)}
                    className="invisible shrink-0 rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 group-hover:visible"
                    title="Rename rack"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => handleDelete(rack.id, rack.name)}
                    className="invisible shrink-0 rounded px-1.5 py-0.5 text-xs text-red-500 hover:bg-red-50 group-hover:visible"
                    title="Delete rack"
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

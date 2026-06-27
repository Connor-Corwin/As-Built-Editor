import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  createProject,
  deleteProject,
  listProjects,
  renameProject,
} from '../../db/repository';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../components/Button';

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function ProjectList() {
  const projects = useLiveQuery(() => listProjects(), [], []);
  const openProject = useAppStore((s) => s.openProject);
  const [name, setName] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const project = await createProject(name);
    setName('');
    openProject(project.id);
  }

  async function handleRename(id: string, current: string) {
    const next = window.prompt('Rename project', current);
    if (next != null) await renameProject(id, next);
  }

  async function handleDelete(id: string, projectName: string) {
    if (
      window.confirm(
        `Delete "${projectName}" and all its uploaded drawings? This cannot be undone.`,
      )
    ) {
      await deleteProject(id);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">
          As-Built Editor
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload AVL as-built drawings and build an editable digital version.
        </p>
      </header>

      <form onSubmit={handleCreate} className="mb-8 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New project name (e.g. Building A — Conf Rooms)"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
        <Button type="submit" variant="primary" disabled={!name.trim()}>
          Create project
        </Button>
      </form>

      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Your projects
      </h2>

      {projects.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-400">
          No projects yet. Create one above to get started.
        </p>
      ) : (
        <ul className="space-y-2">
          {projects.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-4 py-3 hover:border-sky-300"
            >
              <button
                onClick={() => openProject(p.id)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="truncate font-medium text-slate-800">
                  {p.name}
                </div>
                <div className="text-xs text-slate-400">
                  Updated {formatDate(p.updatedAt)}
                </div>
              </button>
              <div className="ml-3 flex shrink-0 gap-1">
                <Button variant="ghost" onClick={() => handleRename(p.id, p.name)}>
                  Rename
                </Button>
                <Button
                  variant="danger"
                  onClick={() => handleDelete(p.id, p.name)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

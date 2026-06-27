import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  renameProject,
} from '../../db/repository';
import {
  downloadBlob,
  exportProject,
  importProject,
} from '../../db/projectIO';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../components/Button';

interface Props {
  projectId: string;
}

/** Project management: save/load to file, switch, rename, new, delete. */
export function ProjectSection({ projectId }: Props) {
  const openProject = useAppStore((s) => s.openProject);
  const closeProject = useAppStore((s) => s.closeProject);
  const importRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | 'save' | 'load'>(null);
  const [error, setError] = useState<string | null>(null);

  const project = useLiveQuery(() => getProject(projectId), [projectId]);
  const projects = useLiveQuery(() => listProjects(), [], []);
  const others = projects.filter((p) => p.id !== projectId);

  async function handleSave() {
    setError(null);
    setBusy('save');
    try {
      const { blob, fileName } = await exportProject(projectId);
      downloadBlob(blob, fileName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setBusy(null);
    }
  }

  async function handleLoadFile(file: File) {
    setError(null);
    setBusy('load');
    try {
      const newId = await importProject(file);
      openProject(newId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setBusy(null);
    }
  }

  async function handleNew() {
    const name = window.prompt('New project name');
    if (name == null) return;
    const p = await createProject(name);
    openProject(p.id);
  }

  async function handleRename() {
    if (!project) return;
    const next = window.prompt('Rename project', project.name);
    if (next != null) await renameProject(project.id, next);
  }

  async function handleDelete() {
    if (!project) return;
    if (
      window.confirm(
        `Delete "${project.name}" and all its drawings? This cannot be undone.`,
      )
    ) {
      await deleteProject(project.id);
      closeProject();
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="truncate text-sm font-semibold text-slate-800">
          {project?.name ?? 'Project'}
        </div>
        <button
          onClick={handleRename}
          className="text-xs text-sky-600 hover:underline"
        >
          Rename
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={handleSave} disabled={busy !== null}>
          {busy === 'save' ? 'Saving…' : 'Save to file'}
        </Button>
        <Button
          variant="secondary"
          onClick={() => importRef.current?.click()}
          disabled={busy !== null}
        >
          {busy === 'load' ? 'Loading…' : 'Load from file'}
        </Button>
        <input
          ref={importRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleLoadFile(f);
            e.target.value = '';
          }}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={handleNew}>
          + New project
        </Button>
        <Button variant="danger" onClick={handleDelete}>
          Delete project
        </Button>
      </div>

      {others.length > 0 && (
        <div>
          <div className="mb-1 mt-2 text-xs font-medium text-slate-400">
            Switch to
          </div>
          <ul className="space-y-1">
            {others.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => openProject(p.id)}
                  className="w-full truncate rounded-md px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

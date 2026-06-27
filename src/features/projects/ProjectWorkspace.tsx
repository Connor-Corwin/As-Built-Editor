import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  deleteDocument,
  getProject,
  listDocuments,
} from '../../db/repository';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../components/Button';
import { PdfUpload } from '../upload/PdfUpload';
import { PdfViewer } from '../viewer/PdfViewer';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  projectId: string;
}

export function ProjectWorkspace({ projectId }: Props) {
  const closeProject = useAppStore((s) => s.closeProject);
  const currentDocumentId = useAppStore((s) => s.currentDocumentId);
  const selectDocument = useAppStore((s) => s.selectDocument);

  const project = useLiveQuery(() => getProject(projectId), [projectId]);
  const documents = useLiveQuery(
    () => listDocuments(projectId),
    [projectId],
    [],
  );

  // Auto-select the first document when none is chosen.
  useEffect(() => {
    if (!currentDocumentId && documents.length > 0) {
      selectDocument(documents[0].id);
    }
  }, [documents, currentDocumentId, selectDocument]);

  async function handleDeleteDoc(id: string, name: string) {
    if (window.confirm(`Remove "${name}" from this project?`)) {
      await deleteDocument(id);
      if (currentDocumentId === id) selectDocument(null);
    }
  }

  return (
    <div className="flex h-screen flex-col">
      {/* App bar */}
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
        <Button variant="ghost" onClick={closeProject}>
          ← Projects
        </Button>
        <h1 className="truncate text-base font-semibold text-slate-800">
          {project?.name ?? 'Project'}
        </h1>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Documents sidebar */}
        <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <PdfUpload projectId={projectId} onUploaded={selectDocument} />
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-3">
            <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Drawings
            </h2>
            {documents.length === 0 ? (
              <p className="px-1 text-sm text-slate-400">
                No drawings uploaded yet.
              </p>
            ) : (
              <ul className="space-y-1">
                {documents.map((doc) => {
                  const active = doc.id === currentDocumentId;
                  return (
                    <li key={doc.id}>
                      <div
                        className={`group flex items-center gap-2 rounded-md px-2 py-2 ${
                          active ? 'bg-sky-50 ring-1 ring-sky-200' : 'hover:bg-slate-50'
                        }`}
                      >
                        <button
                          onClick={() => selectDocument(doc.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="truncate text-sm font-medium text-slate-700">
                            {doc.fileName}
                          </div>
                          <div className="text-xs text-slate-400">
                            {doc.pageCount} page{doc.pageCount === 1 ? '' : 's'} ·{' '}
                            {formatSize(doc.size)}
                          </div>
                        </button>
                        <button
                          onClick={() => handleDeleteDoc(doc.id, doc.fileName)}
                          className="invisible shrink-0 rounded px-1.5 py-0.5 text-xs text-red-500 hover:bg-red-50 group-hover:visible"
                          title="Remove drawing"
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
        </aside>

        {/* Viewer */}
        <main className="min-w-0 flex-1">
          {currentDocumentId ? (
            <PdfViewer documentId={currentDocumentId} />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-400">
              Upload a PDF drawing or select one from the left to view it.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

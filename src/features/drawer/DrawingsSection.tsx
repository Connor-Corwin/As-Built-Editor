import { useLiveQuery } from 'dexie-react-hooks';
import { deleteDocument, listDocuments } from '../../db/repository';
import { useAppStore } from '../../store/useAppStore';
import { PdfUpload } from '../upload/PdfUpload';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  projectId: string;
}

/** Upload + list of the project's PDF drawings (lives in the right drawer). */
export function DrawingsSection({ projectId }: Props) {
  const currentDocumentId = useAppStore((s) => s.currentDocumentId);
  const selectDocument = useAppStore((s) => s.selectDocument);
  const documents = useLiveQuery(
    () => listDocuments(projectId),
    [projectId],
    [],
  );

  async function handleDeleteDoc(id: string, name: string) {
    if (window.confirm(`Remove "${name}" from this project?`)) {
      await deleteDocument(id);
      if (currentDocumentId === id) selectDocument(null);
    }
  }

  return (
    <div>
      <PdfUpload projectId={projectId} onUploaded={selectDocument} />

      {documents.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">No drawings uploaded yet.</p>
      ) : (
        <ul className="mt-3 space-y-1">
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
  );
}

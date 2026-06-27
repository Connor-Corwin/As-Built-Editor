import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getProject, listDocuments } from '../../db/repository';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../components/Button';
import { PdfViewer } from '../viewer/PdfViewer';
import { RackEditor } from '../rack/RackEditor';
import { RightDrawer } from '../drawer/RightDrawer';

interface Props {
  projectId: string;
}

export function ProjectWorkspace({ projectId }: Props) {
  const closeProject = useAppStore((s) => s.closeProject);
  const currentDocumentId = useAppStore((s) => s.currentDocumentId);
  const selectDocument = useAppStore((s) => s.selectDocument);
  const rightDrawerOpen = useAppStore((s) => s.rightDrawerOpen);
  const toggleRightDrawer = useAppStore((s) => s.toggleRightDrawer);
  const activeView = useAppStore((s) => s.activeView);
  const currentRackId = useAppStore((s) => s.currentRackId);

  const project = useLiveQuery(() => getProject(projectId), [projectId]);
  const documents = useLiveQuery(
    () => listDocuments(projectId),
    [projectId],
    [],
  );

  // Auto-select the first drawing when none is chosen.
  useEffect(() => {
    if (!currentDocumentId && documents.length > 0) {
      selectDocument(documents[0].id);
    }
  }, [documents, currentDocumentId, selectDocument]);

  return (
    <div className="flex h-screen flex-col">
      {/* App bar */}
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
        <Button variant="ghost" onClick={closeProject}>
          ← Projects
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-slate-800">
          {project?.name ?? 'Project'}
        </h1>
        <Button variant="secondary" onClick={toggleRightDrawer}>
          {rightDrawerOpen ? 'Hide panel' : 'Menu'}
        </Button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Main work area: PDF viewer or rack editor */}
        <main className="min-w-0 flex-1">
          {activeView === 'rack' && currentRackId ? (
            <RackEditor rackId={currentRackId} />
          ) : currentDocumentId ? (
            <PdfViewer documentId={currentDocumentId} />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-400">
              Open the panel on the right to upload a PDF drawing or create a
              rack, then select it to start.
            </div>
          )}
        </main>

        {/* Right tools drawer */}
        <RightDrawer projectId={projectId} />
      </div>
    </div>
  );
}

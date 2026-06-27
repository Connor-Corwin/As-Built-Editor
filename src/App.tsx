import { useAppStore } from './store/useAppStore';
import { ProjectList } from './features/projects/ProjectList';
import { ProjectWorkspace } from './features/projects/ProjectWorkspace';

export default function App() {
  const currentProjectId = useAppStore((s) => s.currentProjectId);

  return currentProjectId ? (
    <ProjectWorkspace projectId={currentProjectId} />
  ) : (
    <ProjectList />
  );
}

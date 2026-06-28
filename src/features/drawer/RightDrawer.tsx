import { useAppStore, type DrawerTab } from '../../store/useAppStore';
import { ProjectSection } from './ProjectSection';
import { DrawingsSection } from './DrawingsSection';
import { RacksSection } from './RacksSection';
import { ConnectionsSection } from './ConnectionsSection';

interface Props {
  projectId: string;
}

const TABS: { id: DrawerTab; label: string }[] = [
  { id: 'project', label: 'Project' },
  { id: 'drawings', label: 'Drawings' },
  { id: 'racks', label: 'Racks' },
  { id: 'connections', label: 'Connections' },
];

/**
 * The right-hand tools drawer. Sections are switched via tabs (not dropdowns)
 * so only one is shown at a time, giving each room to work.
 */
export function RightDrawer({ projectId }: Props) {
  const open = useAppStore((s) => s.rightDrawerOpen);
  const toggle = useAppStore((s) => s.toggleRightDrawer);
  const tab = useAppStore((s) => s.drawerTab);
  const setTab = useAppStore((s) => s.setDrawerTab);

  return (
    <div className="flex h-full">
      {/* Edge toggle button — always visible so the drawer can be reopened. */}
      <button
        onClick={toggle}
        title={open ? 'Hide panel' : 'Show panel'}
        className="flex w-6 shrink-0 items-center justify-center border-l border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600"
      >
        {open ? '›' : '‹'}
      </button>

      {open && (
        <aside className="flex w-80 shrink-0 flex-col border-l border-slate-200 bg-white">
          {/* Tab bar */}
          <div className="flex shrink-0 border-b border-slate-200">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 border-b-2 px-1 py-2 text-xs font-medium transition-colors ${
                  tab === t.id
                    ? 'border-sky-500 text-sky-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Active tab content */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {tab === 'project' && <ProjectSection projectId={projectId} />}
            {tab === 'drawings' && <DrawingsSection projectId={projectId} />}
            {tab === 'racks' && <RacksSection projectId={projectId} />}
            {tab === 'connections' && (
              <ConnectionsSection projectId={projectId} />
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

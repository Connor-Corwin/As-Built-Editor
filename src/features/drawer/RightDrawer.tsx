import { useAppStore } from '../../store/useAppStore';
import { CollapsibleSection } from '../../components/CollapsibleSection';
import { ProjectSection } from './ProjectSection';
import { DrawingsSection } from './DrawingsSection';
import { RacksSection } from './RacksSection';

interface Props {
  projectId: string;
}

/**
 * The right-hand tools drawer. Holds project save/load and the drawings list
 * today; new sections (racks, connections, labels) slot in as more
 * CollapsibleSections without touching the layout.
 */
export function RightDrawer({ projectId }: Props) {
  const open = useAppStore((s) => s.rightDrawerOpen);
  const toggle = useAppStore((s) => s.toggleRightDrawer);

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
        <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white">
          <CollapsibleSection title="Project">
            <ProjectSection projectId={projectId} />
          </CollapsibleSection>
          <CollapsibleSection title="Drawings">
            <DrawingsSection projectId={projectId} />
          </CollapsibleSection>
          <CollapsibleSection title="Racks">
            <RacksSection projectId={projectId} />
          </CollapsibleSection>
          {/* Future: Connections, Labels sections go here. */}
        </aside>
      )}
    </div>
  );
}

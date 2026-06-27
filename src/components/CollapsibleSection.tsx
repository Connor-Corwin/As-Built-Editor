import { useState, type ReactNode } from 'react';

interface Props {
  title: string;
  /** Optional right-aligned content in the header (e.g. a count badge). */
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * A titled, collapsible panel. The drawer is composed of these so new tool
 * sections (racks, connections, labels) can be dropped in later.
 */
export function CollapsibleSection({
  title,
  badge,
  defaultOpen = true,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-slate-200">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </span>
        <span className="flex items-center gap-2">
          {badge}
          <span
            className={`text-slate-400 transition-transform ${
              open ? 'rotate-90' : ''
            }`}
          >
            ›
          </span>
        </span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

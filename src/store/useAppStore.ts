import { create } from 'zustand';

/** How the page is sized to the viewport. */
export type FitMode = 'none' | 'fit' | 'fill';

/**
 * Transient app/UI state. The single source of truth for the page transform
 * (scale + fit mode) lives here so the PDF canvas and the Konva overlay stay
 * aligned. Durable data lives in IndexedDB (see db/repository.ts).
 */
interface AppState {
  /** Currently opened project, or null for the project list / home view. */
  currentProjectId: string | null;
  /** Currently selected document within the open project. */
  currentDocumentId: string | null;
  /** 1-based page number being viewed. */
  page: number;
  /** Manual render scale (zoom). 1 = 100%. Used when fitMode === 'none'. */
  scale: number;
  /** Auto-sizing mode: fit whole page, fill width, or manual zoom. */
  fitMode: FitMode;
  /** Whether the right-hand tools drawer is open. */
  rightDrawerOpen: boolean;

  openProject: (projectId: string) => void;
  closeProject: () => void;
  selectDocument: (documentId: string | null) => void;
  setPage: (page: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setScale: (scale: number) => void;
  setFitMode: (mode: FitMode) => void;
  toggleRightDrawer: () => void;
  setRightDrawerOpen: (open: boolean) => void;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

export const useAppStore = create<AppState>((set) => ({
  currentProjectId: null,
  currentDocumentId: null,
  page: 1,
  scale: 1,
  fitMode: 'fit',
  rightDrawerOpen: true,

  openProject: (projectId) =>
    set({
      currentProjectId: projectId,
      currentDocumentId: null,
      page: 1,
      scale: 1,
      fitMode: 'fit',
    }),
  closeProject: () =>
    set({ currentProjectId: null, currentDocumentId: null, page: 1, scale: 1 }),
  selectDocument: (documentId) =>
    set({ currentDocumentId: documentId, page: 1 }),
  setPage: (page) => set({ page: Math.max(1, page) }),
  // Manual zoom takes over from any active fit mode.
  zoomIn: () =>
    set((s) => ({ scale: clampScale(s.scale * 1.25), fitMode: 'none' })),
  zoomOut: () =>
    set((s) => ({ scale: clampScale(s.scale / 1.25), fitMode: 'none' })),
  setScale: (scale) => set({ scale: clampScale(scale), fitMode: 'none' }),
  setFitMode: (fitMode) => set({ fitMode }),
  toggleRightDrawer: () =>
    set((s) => ({ rightDrawerOpen: !s.rightDrawerOpen })),
  setRightDrawerOpen: (rightDrawerOpen) => set({ rightDrawerOpen }),
}));

export { MIN_SCALE, MAX_SCALE };

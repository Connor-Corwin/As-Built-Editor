import { create } from 'zustand';

/**
 * Transient app/UI state. The single source of truth for the page transform
 * (scale) lives here so the PDF canvas and the Konva overlay stay aligned.
 * Durable data lives in IndexedDB (see db/repository.ts).
 */
interface AppState {
  /** Currently opened project, or null for the project list / home view. */
  currentProjectId: string | null;
  /** Currently selected document within the open project. */
  currentDocumentId: string | null;
  /** 1-based page number being viewed. */
  page: number;
  /** Render scale (zoom). 1 = 100%. */
  scale: number;

  openProject: (projectId: string) => void;
  closeProject: () => void;
  selectDocument: (documentId: string | null) => void;
  setPage: (page: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setScale: (scale: number) => void;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

export const useAppStore = create<AppState>((set) => ({
  currentProjectId: null,
  currentDocumentId: null,
  page: 1,
  scale: 1,

  openProject: (projectId) =>
    set({ currentProjectId: projectId, currentDocumentId: null, page: 1, scale: 1 }),
  closeProject: () =>
    set({ currentProjectId: null, currentDocumentId: null, page: 1, scale: 1 }),
  selectDocument: (documentId) =>
    set({ currentDocumentId: documentId, page: 1 }),
  setPage: (page) => set({ page: Math.max(1, page) }),
  zoomIn: () => set((s) => ({ scale: clampScale(s.scale * 1.25) })),
  zoomOut: () => set((s) => ({ scale: clampScale(s.scale / 1.25) })),
  setScale: (scale) => set({ scale: clampScale(scale) }),
}));

export { MIN_SCALE, MAX_SCALE };

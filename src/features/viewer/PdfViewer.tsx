import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAppStore, type FitMode } from '../../store/useAppStore';
import {
  getPageBaseSize,
  getPageHighlights,
  isRenderCancelled,
  renderPageToCanvas,
  searchDocument,
  type HighlightRect,
  type SearchHit,
} from '../../lib/pdf';
import { createConnection, listConnections } from '../../db/repository';
import { Button } from '../../components/Button';
import { usePdfDocument } from './usePdfDocument';
import { OverlayLayer } from './OverlayLayer';
import { useGestureZoom } from './useGestureZoom';

interface Props {
  documentId: string;
}

const PADDING = 48; // matches the p-6 scroll-area padding (24px * 2)

function computeScale(
  mode: FitMode,
  manual: number,
  base: { width: number; height: number },
  cw: number,
  ch: number,
): number {
  if (mode === 'none' || base.width <= 0 || base.height <= 0) return manual;
  const availW = Math.max(cw - PADDING, 50);
  const availH = Math.max(ch - PADDING, 50);
  const scale =
    mode === 'fill'
      ? availW / base.width
      : Math.min(availW / base.width, availH / base.height);
  return Math.min(Math.max(scale, 0.05), 8);
}

/**
 * Renders the selected PDF page with page navigation, zoom, fit/fill sizing,
 * and full-text search with on-page highlights (drawn on the Konva overlay).
 */
export function PdfViewer({ documentId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { pdf, fileName, loading, error } = usePdfDocument(documentId);

  const page = useAppStore((s) => s.page);
  const scale = useAppStore((s) => s.scale);
  const fitMode = useAppStore((s) => s.fitMode);
  const setPage = useAppStore((s) => s.setPage);
  const setScale = useAppStore((s) => s.setScale);
  const setFitMode = useAppStore((s) => s.setFitMode);
  const projectId = useAppStore((s) => s.currentProjectId);
  const connectionMode = useAppStore((s) => s.connectionMode);
  const toggleConnectionMode = useAppStore((s) => s.toggleConnectionMode);
  const selectedConnectionId = useAppStore((s) => s.selectedConnectionId);
  const setSelectedConnection = useAppStore((s) => s.setSelectedConnection);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [effScale, setEffScale] = useState(1);

  // Search state.
  const [searchInput, setSearchInput] = useState('');
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [activeHit, setActiveHit] = useState(0);
  const [searching, setSearching] = useState(false);
  const [hasText, setHasText] = useState(true);
  const [highlights, setHighlights] = useState<HighlightRect[]>([]);
  // Set when a match should be scrolled into view after the next render.
  const wantScrollRef = useRef(false);

  // Connection drawing: first placed point awaiting its pair.
  const [pendingStart, setPendingStart] = useState<{ x: number; y: number } | null>(
    null,
  );

  const numPages = pdf?.numPages ?? 0;
  const pageNum = Math.min(Math.max(1, page), numPages || 1);

  // Connections drawn on the current document + page.
  const connections = useLiveQuery(
    () => (projectId ? listConnections(projectId) : Promise.resolve([])),
    [projectId],
    [],
  );
  const pageConnections = connections.filter(
    (c) => c.documentId === documentId && c.page === pageNum && c.x1 != null,
  );

  async function placePoint(nx: number, ny: number) {
    if (!projectId) return;
    if (!pendingStart) {
      setPendingStart({ x: nx, y: ny });
      return;
    }
    const conn = await createConnection(projectId, {
      signalType: 'video',
      documentId,
      page: pageNum,
      x1: pendingStart.x,
      y1: pendingStart.y,
      x2: nx,
      y2: ny,
    });
    setPendingStart(null);
    setSelectedConnection(conn.id);
  }

  // Leaving connection mode clears any half-drawn line.
  useEffect(() => {
    if (!connectionMode) setPendingStart(null);
  }, [connectionMode]);

  // Which highlight rect on the current page is the active match. Highlights and
  // hits are both enumerated in text-item order, so the active hit's position
  // among same-page hits indexes directly into the page's highlight rects.
  const activeHitPage = hits[activeHit]?.page;
  const activeRectIndex =
    activeHitPage === pageNum
      ? hits.slice(0, activeHit).filter((h) => h.page === pageNum).length
      : -1;

  // Measure the scroll area (and react to drawer open/close, window resize).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () =>
      setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Pinch / ctrl+wheel zoom that re-renders the page sharp (keeps it crisp on
  // touch devices instead of the browser blur-stretching the bitmap).
  useGestureZoom({ scrollRef, canvasRef, scale: effScale, onScaleChange: setScale });

  // Clamp page if a shorter document is selected.
  useEffect(() => {
    if (numPages > 0 && page > numPages) setPage(numPages);
  }, [numPages, page, setPage]);

  // Render whenever doc, page, sizing, or container size changes. A superseded
  // render is cancelled so it neither paints stale content nor logs noise.
  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    (async () => {
      try {
        const base = await getPageBaseSize(pdf, pageNum);
        const eff = computeScale(
          fitMode,
          scale,
          base,
          containerSize.width,
          containerSize.height,
        );
        const render = await renderPageToCanvas(
          pdf,
          pageNum,
          eff,
          canvasRef.current!,
        );
        task = render.task;
        await render.task.promise;
        if (!cancelled) {
          render.commit(); // swap the finished image in (no white flash)
          setSize({ width: render.width, height: render.height });
          setEffScale(eff);
        }
      } catch (err) {
        if (!cancelled && !isRenderCancelled(err)) {
          console.error('PDF render failed', err);
        }
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, pageNum, fitMode, scale, containerSize.width, containerSize.height]);

  // Recompute search highlights for the current page/scale.
  useEffect(() => {
    if (!pdf || !term) {
      setHighlights([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const rects = await getPageHighlights(pdf, pageNum, term, effScale);
      if (!cancelled) setHighlights(rects);
    })();
    return () => {
      cancelled = true;
    };
  }, [pdf, pageNum, term, effScale]);

  // After navigating/zooming to a match, center it in the scroll area.
  useEffect(() => {
    if (!wantScrollRef.current) return;
    const el = scrollRef.current;
    const canvas = canvasRef.current;
    const rect = highlights[activeRectIndex];
    if (!el || !canvas || !rect) return;
    wantScrollRef.current = false;
    const cont = el.getBoundingClientRect();
    const cv = canvas.getBoundingClientRect();
    const centerX = cv.left - cont.left + el.scrollLeft + rect.x + rect.width / 2;
    const centerY = cv.top - cont.top + el.scrollTop + rect.y + rect.height / 2;
    el.scrollTo({
      left: centerX - el.clientWidth / 2,
      top: centerY - el.clientHeight / 2,
      behavior: 'smooth',
    });
  }, [highlights, activeRectIndex]);

  async function runSearch() {
    if (!pdf) return;
    const q = searchInput.trim();
    if (!q) {
      clearSearch();
      return;
    }
    setSearching(true);
    try {
      const { hits: found, totalTextItems } = await searchDocument(pdf, q);
      setTerm(q);
      setHits(found);
      setHasText(totalTextItems > 0);
      setActiveHit(0);
      if (found.length) {
        wantScrollRef.current = true;
        setPage(found[0].page);
      }
    } finally {
      setSearching(false);
    }
  }

  function clearSearch() {
    setSearchInput('');
    setTerm('');
    setHits([]);
    setHighlights([]);
    setHasText(true);
  }

  function stepHit(delta: number) {
    if (hits.length === 0) return;
    const next = (activeHit + delta + hits.length) % hits.length;
    setActiveHit(next);
    wantScrollRef.current = true;
    setPage(hits[next].page);
  }

  /** Zoom in on the active match and center it. */
  function zoomToMatch() {
    if (hits.length === 0) return;
    wantScrollRef.current = true;
    // Jump to a readable zoom (never zoom out from the current level).
    setScale(Math.max(effScale * 2, 2));
  }

  const zoomDisabled = loading || !pdf;

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-200 bg-white px-4 py-2">
        <span className="mr-1 max-w-[12rem] truncate text-sm font-medium text-slate-600">
          {fileName ?? 'Document'}
        </span>

        {/* Page nav */}
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            onClick={() => setPage(page - 1)}
            disabled={zoomDisabled || pageNum <= 1}
          >
            ‹
          </Button>
          <span className="px-1 text-sm tabular-nums text-slate-600">
            {numPages ? `${pageNum} / ${numPages}` : '—'}
          </span>
          <Button
            variant="secondary"
            onClick={() => setPage(page + 1)}
            disabled={zoomDisabled || pageNum >= numPages}
          >
            ›
          </Button>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            onClick={() => setScale(effScale / 1.25)}
            disabled={zoomDisabled}
          >
            −
          </Button>
          <span className="w-12 text-center text-sm tabular-nums text-slate-600">
            {Math.round(effScale * 100)}%
          </span>
          <Button
            variant="secondary"
            onClick={() => setScale(effScale * 1.25)}
            disabled={zoomDisabled}
          >
            +
          </Button>
        </div>

        {/* Fit / Fill */}
        <div className="flex items-center gap-1">
          <Button
            variant={fitMode === 'fit' ? 'primary' : 'secondary'}
            onClick={() => setFitMode('fit')}
            disabled={zoomDisabled}
            title="Scale the whole page to fit"
          >
            Fit
          </Button>
          <Button
            variant={fitMode === 'fill' ? 'primary' : 'secondary'}
            onClick={() => setFitMode('fill')}
            disabled={zoomDisabled}
            title="Scale to fill the width"
          >
            Fill
          </Button>
        </div>

        {/* Connections */}
        <Button
          variant={connectionMode ? 'primary' : 'secondary'}
          onClick={toggleConnectionMode}
          disabled={zoomDisabled}
          title="Draw connection lines on the drawing"
        >
          {connectionMode ? 'Connecting…' : 'Connect'}
        </Button>

        {/* Search */}
        <div className="ml-auto flex items-center gap-1">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder="Search drawing…"
            disabled={zoomDisabled}
            className="w-44 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <Button variant="secondary" onClick={runSearch} disabled={zoomDisabled}>
            {searching ? '…' : 'Find'}
          </Button>
          {term && (
            <>
              <Button variant="ghost" onClick={() => stepHit(-1)} disabled={!hits.length}>
                ‹
              </Button>
              <span className="text-xs tabular-nums text-slate-500">
                {hits.length ? `${activeHit + 1}/${hits.length}` : '0'}
              </span>
              <Button variant="ghost" onClick={() => stepHit(1)} disabled={!hits.length}>
                ›
              </Button>
              <Button
                variant="secondary"
                onClick={zoomToMatch}
                disabled={!hits.length}
                title="Zoom in on this match"
              >
                🔍+
              </Button>
              <Button variant="ghost" onClick={clearSearch} title="Clear search">
                ✕
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Search status line */}
      {term && !searching && hits.length === 0 && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-700">
          {hasText
            ? `No matches for “${term}”.`
            : `No text found — this looks like a scanned drawing. OCR search is a planned feature.`}
        </div>
      )}

      {/* Connection-mode hint */}
      {connectionMode && (
        <div className="border-b border-sky-200 bg-sky-50 px-4 py-1.5 text-xs text-sky-700">
          {pendingStart
            ? 'Click the second point to finish the connection.'
            : 'Click the first point of a connection (then a second). Click a line to select it. Edit details in the Connections panel.'}
        </div>
      )}

      {/* Scroll/pan area */}
      <div
        ref={scrollRef}
        className="relative flex-1 overflow-auto bg-slate-200 p-6"
        // Allow one-finger panning but let us handle two-finger pinch.
        style={{ touchAction: 'pan-x pan-y' }}
      >
        {error && (
          <div className="mx-auto mt-10 max-w-md rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {loading && (
          <div className="mt-10 text-center text-sm text-slate-500">
            Loading drawing…
          </div>
        )}
        {!error && (
          <div
            className="relative mx-auto shadow-lg"
            style={{ width: size.width || undefined }}
          >
            <canvas ref={canvasRef} className="block bg-white" />
            {size.width > 0 && (
              <OverlayLayer
                width={size.width}
                height={size.height}
                highlights={highlights}
                activeIndex={activeRectIndex}
                connections={pageConnections}
                selectedConnectionId={selectedConnectionId}
                connectionMode={connectionMode}
                pendingStart={pendingStart}
                onPlacePoint={placePoint}
                onSelectConnection={setSelectedConnection}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

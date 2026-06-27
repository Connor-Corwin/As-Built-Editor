import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { isRenderCancelled, renderPageToCanvas } from '../../lib/pdf';
import { Button } from '../../components/Button';
import { usePdfDocument } from './usePdfDocument';
import { OverlayLayer } from './OverlayLayer';

interface Props {
  documentId: string;
}

/**
 * Renders the selected PDF page to a canvas with page navigation and
 * zoom, and lays the (scaffolded) Konva overlay on top, aligned to the
 * rendered page dimensions.
 */
export function PdfViewer({ documentId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { pdf, fileName, loading, error } = usePdfDocument(documentId);

  const page = useAppStore((s) => s.page);
  const scale = useAppStore((s) => s.scale);
  const setPage = useAppStore((s) => s.setPage);
  const zoomIn = useAppStore((s) => s.zoomIn);
  const zoomOut = useAppStore((s) => s.zoomOut);
  const setScale = useAppStore((s) => s.setScale);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const numPages = pdf?.numPages ?? 0;

  // Clamp page if a different (shorter) document is selected.
  useEffect(() => {
    if (numPages > 0 && page > numPages) setPage(numPages);
  }, [numPages, page, setPage]);

  // Render whenever the doc, page, or scale changes. A superseded render is
  // cancelled so it neither paints stale content nor logs noise.
  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    const pageNum = Math.min(Math.max(1, page), pdf.numPages);
    (async () => {
      try {
        const render = await renderPageToCanvas(
          pdf,
          pageNum,
          scale,
          canvasRef.current!,
        );
        task = render.task;
        await render.task.promise;
        if (!cancelled) setSize({ width: render.width, height: render.height });
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
  }, [pdf, page, scale]);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
        <span className="mr-2 truncate text-sm font-medium text-slate-600">
          {fileName ?? 'Document'}
        </span>

        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            onClick={() => setPage(page - 1)}
            disabled={loading || page <= 1}
          >
            ‹ Prev
          </Button>
          <span className="px-1 text-sm tabular-nums text-slate-600">
            {numPages ? `${Math.min(page, numPages)} / ${numPages}` : '—'}
          </span>
          <Button
            variant="secondary"
            onClick={() => setPage(page + 1)}
            disabled={loading || page >= numPages}
          >
            Next ›
          </Button>
        </div>

        <div className="ml-2 flex items-center gap-1">
          <Button variant="secondary" onClick={zoomOut} disabled={loading}>
            −
          </Button>
          <span className="w-12 text-center text-sm tabular-nums text-slate-600">
            {Math.round(scale * 100)}%
          </span>
          <Button variant="secondary" onClick={zoomIn} disabled={loading}>
            +
          </Button>
          <Button
            variant="ghost"
            onClick={() => setScale(1)}
            disabled={loading}
          >
            Reset
          </Button>
        </div>
      </div>

      {/* Scroll/pan area */}
      <div className="relative flex-1 overflow-auto bg-slate-200 p-6">
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
              <OverlayLayer width={size.width} height={size.height} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useRef } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { getPageBaseSize, renderPageToCanvas } from '../../lib/pdf';
import { useAppStore } from '../../store/useAppStore';
import { usePdfDocument } from './usePdfDocument';

const THUMB_WIDTH = 120;

interface Props {
  documentId: string;
}

/** A vertical rail of page thumbnails for the current document. */
export function PageThumbnails({ documentId }: Props) {
  const { pdf, loading } = usePdfDocument(documentId);
  const page = useAppStore((s) => s.page);
  const setPage = useAppStore((s) => s.setPage);

  if (loading) {
    return (
      <div className="p-3 text-xs text-slate-400">Loading pages…</div>
    );
  }
  if (!pdf) return null;

  return (
    <div className="flex flex-col items-center gap-2 p-2">
      {Array.from({ length: pdf.numPages }, (_, i) => {
        const n = i + 1;
        return (
          <button
            key={n}
            onClick={() => setPage(n)}
            className={`w-full rounded border bg-white p-1 text-center ${
              page === n
                ? 'border-sky-500 ring-1 ring-sky-300'
                : 'border-slate-300 hover:border-sky-400'
            }`}
          >
            <Thumb pdf={pdf} pageNumber={n} />
            <div className="mt-0.5 text-[10px] text-slate-500">{n}</div>
          </button>
        );
      })}
    </div>
  );
}

function Thumb({ pdf, pageNumber }: { pdf: PDFDocumentProxy; pageNumber: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    (async () => {
      try {
        const base = await getPageBaseSize(pdf, pageNumber);
        const scale = THUMB_WIDTH / base.width;
        const render = await renderPageToCanvas(pdf, pageNumber, scale, ref.current!);
        task = render.task;
        await render.task.promise;
        if (!cancelled) render.commit();
      } catch {
        /* cancelled or failed render — ignore */
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, pageNumber]);

  return <canvas ref={ref} className="block w-full" />;
}

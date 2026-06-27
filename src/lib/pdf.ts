import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

/**
 * PDF.js setup + render helpers.
 *
 * PDF.js renders BOTH vector (CAD export) and raster (scanned) PDFs to a
 * canvas, so the viewer never depends on selectable/extractable text — exactly
 * what we need for a mix of source files.
 *
 * The worker is loaded as a module worker via Vite's `?url` import so heavy
 * parsing/rendering runs off the main thread.
 */
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = PdfWorker;

/** Open a PDF from raw bytes. Caller owns the returned document's lifecycle. */
export async function loadPdf(
  data: ArrayBuffer | Uint8Array,
): Promise<PDFDocumentProxy> {
  // PDF.js may detach/transfer the buffer, so callers should pass a copy if
  // they need to keep their own.
  return pdfjs.getDocument({ data }).promise;
}

/** Read just the page count without keeping the document open. */
export async function getPdfPageCount(
  data: ArrayBuffer | Uint8Array,
): Promise<number> {
  const doc = await loadPdf(data);
  try {
    return doc.numPages;
  } finally {
    await doc.destroy();
  }
}

export interface PageRender {
  /** The in-flight render task; await `.promise`, call `.cancel()` to abort. */
  task: RenderTask;
  /** CSS width of the rendered page in pixels (at the given scale). */
  width: number;
  /** CSS height of the rendered page in pixels (at the given scale). */
  height: number;
}

/** True for the benign exception PDF.js throws when a render is cancelled. */
export function isRenderCancelled(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { name?: string }).name === 'RenderingCancelledException'
  );
}

/**
 * Start rendering a single page into a canvas at `scale`, accounting for
 * device pixel ratio so output stays crisp on HiDPI displays. Returns the
 * render task (so callers can cancel a superseded render) plus the CSS
 * dimensions the canvas was sized to (used to align the Konva overlay).
 */
export async function renderPageToCanvas(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  scale: number,
  canvas: HTMLCanvasElement,
): Promise<PageRender> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  const cssWidth = Math.floor(viewport.width);
  const cssHeight = Math.floor(viewport.height);

  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not get 2D canvas context');

  const task = page.render({
    canvasContext: context,
    viewport,
    transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
  });

  return { task, width: cssWidth, height: cssHeight };
}

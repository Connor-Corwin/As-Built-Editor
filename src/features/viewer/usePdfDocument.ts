import { useEffect, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { getDocument } from '../../db/repository';
import { loadPdf } from '../../lib/pdf';

interface PdfDocumentState {
  pdf: PDFDocumentProxy | null;
  fileName: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Loads a stored PDF blob into a live PDF.js document. Cleans up (destroys)
 * the previous document when the selected document changes or on unmount.
 */
export function usePdfDocument(documentId: string | null): PdfDocumentState {
  const [state, setState] = useState<PdfDocumentState>({
    pdf: null,
    fileName: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!documentId) {
      setState({ pdf: null, fileName: null, loading: false, error: null });
      return;
    }

    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    setState({ pdf: null, fileName: null, loading: true, error: null });

    (async () => {
      try {
        const record = await getDocument(documentId);
        if (!record) throw new Error('Document not found.');
        const buffer = await record.blob.arrayBuffer();
        const pdf = await loadPdf(buffer);
        loaded = pdf;
        if (cancelled) {
          await pdf.destroy();
          return;
        }
        setState({
          pdf,
          fileName: record.fileName,
          loading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          pdf: null,
          fileName: null,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to open PDF.',
        });
      }
    })();

    return () => {
      cancelled = true;
      void loaded?.destroy();
    };
  }, [documentId]);

  return state;
}

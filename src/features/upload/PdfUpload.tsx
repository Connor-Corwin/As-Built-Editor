import { useRef, useState } from 'react';
import { addPdfDocument } from '../../db/repository';
import { Button } from '../../components/Button';

interface Props {
  projectId: string;
  onUploaded?: (documentId: string) => void;
}

/** Drag-and-drop + file-picker upload for one or more PDFs. */
export function PdfUpload({ projectId, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ingest(files: FileList | File[]) {
    const pdfs = Array.from(files).filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
    );
    if (pdfs.length === 0) {
      setError('Please choose PDF files.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      let lastId: string | null = null;
      for (const file of pdfs) {
        const doc = await addPdfDocument(projectId, file);
        lastId = doc.id;
      }
      if (lastId) onUploaded?.(lastId);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : 'Failed to read one of the PDFs.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void ingest(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragOver
            ? 'border-sky-500 bg-sky-50'
            : 'border-slate-300 bg-white hover:border-sky-400'
        }`}
      >
        <p className="text-sm font-medium text-slate-700">
          {busy ? 'Reading PDF…' : 'Drop PDF drawings here, or click to browse'}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Vector CAD exports and scanned drawings both work.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void ingest(e.target.files);
            e.target.value = '';
          }}
        />
        <Button
          type="button"
          variant="primary"
          className="mt-4"
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
        >
          Choose files
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

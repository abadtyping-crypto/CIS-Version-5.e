import { useEffect, useMemo, useRef, useState } from 'react';

const toFileName = (filePath = '') => String(filePath).split(/[/\\\\]/).pop() || 'Document.pdf';

/**
 * ACIS Version 5.0 Sovereign Viewer
 * Rule: No External APIs. 100% Local (Electron internal Chromium PDF engine).
 */
const PDFViewer = ({ localFilePath }) => {
  const iframeRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [sovereignUrl, setSovereignUrl] = useState('');
  const [error, setError] = useState('');

  const fileName = useMemo(() => toFileName(localFilePath), [localFilePath]);
  const isElectron = typeof window !== 'undefined' && Boolean(window.electron?.pdf?.resolveSovereignUrl);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setSovereignUrl('');

    if (!localFilePath) {
      setLoading(false);
      setError('No PDF selected.');
      return () => {};
    }

    if (!isElectron) {
      setLoading(false);
      setError('Internal PDF Viewer is available only in Electron.');
      return () => {};
    }

    void (async () => {
      const res = await window.electron.pdf.resolveSovereignUrl(localFilePath);
      if (!active) return;
      if (!res?.ok) {
        setError(String(res?.error || 'Failed to resolve PDF path.'));
        setLoading(false);
        return;
      }
      setSovereignUrl(String(res.url || ''));
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [isElectron, localFilePath]);

  const handlePrint = () => {
    const frame = iframeRef.current;
    const win = frame?.contentWindow;
    if (win && typeof win.print === 'function') {
      win.print();
      return;
    }
    window.print();
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] shadow-sm">
      {/* Sovereign Toolbar: Fixed 40px (h-10) */}
      <div className="glass flex h-10 w-full items-center gap-3 border-b border-[var(--c-border)] px-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--c-text)]">
            INTERNAL VIEW: {fileName}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="h-8 rounded-lg border border-[var(--c-border)] bg-[var(--c-panel)] px-3 text-xs font-bold uppercase tracking-widest text-[var(--c-text)] transition hover:bg-[color:color-mix(in_srgb,var(--c-panel)_70%,transparent)]"
          >
            Print
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 items-start">
          <div className="h-1 w-full bg-[var(--c-panel)]">
            <div className="h-1 w-1/2 animate-pulse bg-[var(--c-accent)]" />
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <p className="text-sm font-bold text-[var(--c-muted)]">{error}</p>
        </div>
      ) : (
        <iframe
          ref={iframeRef}
          src={sovereignUrl}
          className="flex-1 w-full border-none"
          title="Sovereign Document"
          onLoad={() => setLoading(false)}
        />
      )}
    </div>
  );
};

export default PDFViewer;



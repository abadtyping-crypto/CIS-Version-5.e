import React, { useEffect, useState } from 'react';
import { X, Maximize2, Minimize2, Download, Printer } from 'lucide-react';

/**
 * Sovereign PDF Viewer Component
 * Uses Electron's internal PDF plugin and a secure acis-pdf:// protocol.
 */
const SovereignViewer = ({ localFilePath, onClose, title = 'Document Viewer' }) => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!localFilePath) return;

    window.electron.pdf.resolveSovereignUrl(localFilePath)
      .then(res => {
        if (res.ok) {
          setUrl(res.url);
        } else {
          setError(res.error || 'Failed to resolve PDF URL.');
        }
      })
      .catch(err => {
        setError(String(err?.message || 'Unexpected viewer error.'));
      });
  }, [localFilePath]);

  if (!localFilePath) return null;

  const handlePrint = async () => {
    // If we have the local path, we could print directly if Electron main supports it.
    // main.js's document-print-pdf takes base64. 
    // For now, let's just use the browser's internal PDF print button or shell.openPath.
    // If the iframe is focused, Ctrl+P works too.
  };

  return (
    <div className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/60 backdrop-blur-md p-4 transition-all duration-300 ${isMaximized ? 'p-0' : 'p-4 md:p-12'}`}>
      <div className={`relative flex flex-col w-full h-full bg-[#0f172a] border border-white/10 shadow-2xl overflow-hidden transition-all duration-300 ${isMaximized ? 'rounded-0' : 'rounded-3xl'}`}>
        
        {/* Header / TitleBar */}
        <div className="flex h-14 items-center justify-between border-b border-white/5 bg-white/5 px-6 backdrop-blur-xl">
          <div className="flex items-center gap-3">
             <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/20 text-orange-500">
               <span className="text-xs font-black">PDF</span>
             </div>
             <div className="flex flex-col">
               <h3 className="text-xs font-bold text-white leading-tight">{title}</h3>
               <p className="text-[10px] text-white/40 font-medium truncate max-w-[200px]">{localFilePath}</p>
             </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsMaximized(!isMaximized)}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              {isMaximized ? <Minimize2 strokeWidth={1.5} size={16} /> : <Maximize2 strokeWidth={1.5} size={16} />}
            </button>
            <button 
              onClick={onClose}
              className="group flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 transition hover:bg-rose-500 hover:text-white"
            >
              <X strokeWidth={1.5} size={18} />
            </button>
          </div>
        </div>

        {/* Viewer Area */}
        <div className="relative flex-1 bg-[#1e293b]">
          {error ? (
            <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center text-rose-400">
              <span className="mb-4 text-4xl">⚠️</span>
              <p className="max-w-md text-sm font-bold">{error}</p>
              <button 
                onClick={onClose}
                className="mt-6 rounded-xl bg-white/10 px-6 py-2 text-xs font-bold text-white hover:bg-white/20"
              >
                Dismiss
              </button>
            </div>
          ) : !url ? (
            <div className="flex h-full w-full flex-col items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-500/20 border-t-orange-500" />
              <p className="mt-4 text-xs font-bold text-white/40">Initializing Sovereign Pipeline...</p>
            </div>
          ) : (
            <iframe 
              src={url} 
              className="h-full w-full border-none shadow-inner"
              title="Sovereign PDF Content"
            />
          )}
        </div>
        
        {/* Footer / Info Bar */}
        <div className="flex h-12 items-center justify-between border-t border-white/5 bg-white/5 px-6 backdrop-blur-xl">
           <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
             ACIS-SOVEREIGN SECURE ISOLATION ACTIVE
           </p>
           <div className="flex items-center gap-4 text-white/40">
             <div className="flex items-center gap-1">
               <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[9px] font-bold uppercase">Shield V5.0</span>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default SovereignViewer;

import { useLayoutEffect, useRef, useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

export default function FundusLightbox({ open, title, subtitle, src, alt, onClose }) {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const [zoom, setZoom] = useState(1);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && src && !dialog.open) {
      previousFocusRef.current = document.activeElement;
      dialog.showModal();
    } else if ((!open || !src) && dialog.open) {
      dialog.close();
      const previousFocus = previousFocusRef.current;
      previousFocusRef.current = null;
      if (previousFocus?.isConnected) previousFocus.focus();
    }
  }, [open, src]);

  const handleClose = () => {
    setZoom(1);
    if (dialogRef.current?.open) {
      dialogRef.current.close();
      const previousFocus = previousFocusRef.current;
      previousFocusRef.current = null;
      if (previousFocus?.isConnected) previousFocus.focus();
    }
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="clinical-lightbox"
      aria-hidden={!open || !src}
      onCancel={(event) => {
        event.preventDefault();
        handleClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose();
      }}
      aria-label={title || 'Fundus image inspection'}
    >
      <div className="flex flex-col max-h-[calc(100dvh-24px)]">
        <header className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-200 bg-white">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 truncate">{title || 'Fundus scan'}</h3>
            {subtitle && <p className="text-xs text-slate-600 truncate mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(1, Number((z - 0.5).toFixed(1))))}
              disabled={zoom <= 1}
              aria-label="Zoom out"
              className="clinical-btn-secondary px-2.5 py-1.5 min-h-[34px] text-xs"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-slate-700 ui-tabular w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3, Number((z + 0.5).toFixed(1))))}
              disabled={zoom >= 3}
              aria-label="Zoom in"
              className="clinical-btn-secondary px-2.5 py-1.5 min-h-[34px] text-xs"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              disabled={zoom === 1}
              aria-label="Reset zoom"
              className="clinical-btn-secondary px-2.5 py-1.5 min-h-[34px] text-xs"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              autoFocus
              onClick={handleClose}
              aria-label="Close image viewer"
              className="clinical-btn-secondary px-2.5 py-1.5 min-h-[34px]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>
        <div className={`flex-1 overflow-auto bg-slate-950 p-4 min-h-[320px] ${zoom === 1 ? 'flex items-center justify-center' : 'block'}`}>
          <img
            src={src}
            alt={alt || title || 'Retinal fundus image'}
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
            className="max-w-full max-h-[72dvh] object-contain transition-transform duration-150"
          />
        </div>
      </div>
    </dialog>
  );
}

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
  destructive?: boolean;
}

export default function Modal({ open, onClose, title, description, children, wide, destructive }: ModalProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[5vh] px-4" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={clsx(
        'relative w-full max-h-[88vh] flex flex-col rounded-2xl',
        'bg-[#161936] backdrop-blur-xl border border-[rgba(255,255,255,0.1)]',
        'shadow-[0_24px_80px_-12px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.05)]',
        wide ? 'max-w-3xl' : 'max-w-xl',
      )} style={{ animation: 'fade-in-scale 0.15s ease-out' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(255,255,255,0.06)] shrink-0">
          <div>
            <h2 className={clsx('text-base font-semibold tracking-tight', destructive ? 'text-[#F43F5E]' : 'text-white')}>{title}</h2>
            {description && <p className="text-xs text-[#A7A9C0] mt-0.5">{description}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#A7A9C0] hover:text-white hover:bg-white/[0.05] transition-colors" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}

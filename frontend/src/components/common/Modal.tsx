import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

interface ModalProps { open: boolean; title: string; children: ReactNode; onClose: () => void; footer?: ReactNode; width?: 'small' | 'medium' | 'large' }

export function Modal({ open, title, children, onClose, footer, width = 'medium' }: ModalProps) {
  useEffect(() => { if (!open) return; const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && onClose(); document.body.style.overflow = 'hidden'; window.addEventListener('keydown', closeOnEscape); return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', closeOnEscape); }; }, [open, onClose]);
  if (!open) return null;
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className={`modal-panel modal-${width}`} role="dialog" aria-modal="true" aria-labelledby="modal-title"><header className="modal-header"><h2 id="modal-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></header><div className="modal-body">{children}</div>{footer && <footer className="modal-footer">{footer}</footer>}</section></div>;
}
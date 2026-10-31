import { Search, X, LoaderCircle, ArrowRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { globalSearch, type GlobalSearchResult } from '@/services/globalSearch';

interface GlobalSearchModalProps { open: boolean; onClose: () => void }

export function GlobalSearchModal({ open, onClose }: GlobalSearchModalProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    setTerm('');
    setResults([]);
    setActiveIndex(0);
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => { window.clearTimeout(focusTimer); document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = term.trim();
    if (trimmed.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const debounceTimer = window.setTimeout(() => {
      globalSearch(trimmed).then((rows) => { setResults(rows); setActiveIndex(0); }).finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(debounceTimer);
  }, [term, open]);

  useEffect(() => {
    if (!open) return;
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { onClose(); return; }
      if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((current) => Math.min(current + 1, results.length - 1)); return; }
      if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((current) => Math.max(current - 1, 0)); return; }
      if (event.key === 'Enter' && results[activeIndex]) { event.preventDefault(); goTo(results[activeIndex]); }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, results, activeIndex, onClose]);

  const grouped = useMemo(() => {
    const groups = new Map<string, GlobalSearchResult[]>();
    results.forEach((result) => { const bucket = groups.get(result.category) ?? []; bucket.push(result); groups.set(result.category, bucket); });
    return [...groups.entries()];
  }, [results]);

  function goTo(result: GlobalSearchResult) {
    navigate(result.path);
    onClose();
  }

  if (!open) return null;
  const trimmed = term.trim();
  let flatIndex = -1;

  return createPortal(<div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="command-palette" role="dialog" aria-modal="true" aria-label="Search workspace">
      <div className="command-palette-input">
        <Search size={17} />
        <input ref={inputRef} type="text" value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Search vehicles, drivers, firms, trips..." autoComplete="off" />
        {loading && <LoaderCircle size={16} className="spin" />}
        <button className="icon-button" onClick={onClose} aria-label="Close search"><X size={16} /></button>
      </div>
      <div className="command-palette-body">
        {trimmed.length < 2 && <p className="command-palette-hint">Type at least 2 characters to search across vehicles, drivers, firms, companies, routes, contracts, and trips.</p>}
        {trimmed.length >= 2 && !loading && !results.length && <p className="command-palette-hint">No matches for &ldquo;{trimmed}&rdquo;.</p>}
        {grouped.map(([category, items]) => <div key={category} className="command-palette-group">
          <p className="command-palette-group-label">{category}</p>
          {items.map((item) => { flatIndex += 1; const index = flatIndex; return <button key={item.id} className={`command-palette-item ${index === activeIndex ? 'active' : ''}`} onClick={() => goTo(item)} onMouseEnter={() => setActiveIndex(index)}>
            <div><strong>{item.title}</strong>{item.subtitle && <small>{item.subtitle}</small>}</div>
            <ArrowRight size={14} />
          </button>; })}
        </div>)}
      </div>
      <div className="command-palette-footer" aria-hidden="true"><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>Enter</kbd> Open</span><span><kbd>Esc</kbd> Close</span></div>
    </section>
  </div>, document.body);
}

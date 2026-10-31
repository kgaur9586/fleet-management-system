import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { PanelLeftClose, X } from 'lucide-react';
import { Tooltip } from '@/components/common/Tooltip';
import { BrandMark } from './BrandMark';
import { navigation } from './navigation';

const MOBILE_QUERY = '(max-width: 900px)';

interface SidebarProps { open: boolean; collapsed: boolean; onClose: () => void; onToggleCollapsed: () => void }

export function Sidebar({ open, collapsed, onClose, onToggleCollapsed }: SidebarProps) {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  const compact = collapsed && !isMobile;

  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  // Lock page scroll behind the drawer on mobile so only the sidebar scrolls.
  useEffect(() => {
    if (!open || !isMobile) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', closeOnEscape);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', closeOnEscape); };
  }, [open, isMobile, onClose]);

  return <>
    {open && <button className="sidebar-scrim" aria-label="Close navigation" onClick={onClose} />}
    <aside className={`sidebar ${open ? 'sidebar-open' : ''} ${collapsed ? 'sidebar-collapsed' : ''}`} aria-label="Primary">
      <div className="brand-row">
        <BrandMark />
        <div><strong>Fleet Ledger</strong><span>Operations &amp; billing</span></div>
        <button className="icon-button mobile-only" onClick={onClose} aria-label="Close navigation"><X size={18} /></button>
      </div>
      <nav className="sidebar-nav">
        {navigation.map((section) => <div className="nav-section" key={section.label}>
          <p className="nav-label">{section.label}</p>
          {section.items.map(({ to, label, icon: Icon, end }) => <Tooltip key={to} label={label} side="right" disabled={!compact}>
            <NavLink to={to} end={end} onClick={onClose} aria-label={compact ? label : undefined} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}><Icon size={18} strokeWidth={1.9} /><span>{label}</span></NavLink>
          </Tooltip>)}
        </div>)}
      </nav>
      <div className="sidebar-footer">
        <Tooltip label="Expand sidebar" side="right" disabled={!compact}>
          <button type="button" className="sidebar-collapse" onClick={onToggleCollapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-pressed={collapsed}><PanelLeftClose size={18} strokeWidth={1.9} /><span>Collapse</span></button>
        </Tooltip>
      </div>
    </aside>
  </>;
}

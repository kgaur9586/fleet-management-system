import { ChevronDown, LogOut, Menu, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { notify } from '@/lib/toast';
import { Badge, Breadcrumbs } from '@/components/common';
import { GlobalSearchModal } from './GlobalSearchModal';
import { breadcrumbsFor } from './navigation';

interface TopbarProps { onMenu: () => void }

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);
const initials = (name?: string) => (name || 'Admin').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', closeOnOutside);
    window.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('mousedown', closeOnOutside); window.removeEventListener('keydown', closeOnEscape); };
  }, [open]);

  async function handleLogout() {
    setOpen(false);
    await logout();
    notify.success('You have been signed out.');
    navigate('/login', { replace: true });
  }

  return <div className="user-menu" ref={menuRef}>
    <button type="button" className="user-chip" onClick={() => setOpen((current) => !current)} aria-haspopup="menu" aria-expanded={open}><span className="avatar">{initials(user?.name)}</span><strong>{user?.name || 'Admin'}</strong><ChevronDown size={14} /></button>
    {open && <div className="dropdown-menu" role="menu">
      <div className="dropdown-header"><span className="avatar large">{initials(user?.name)}</span><div><strong>{user?.name || 'Admin'}</strong>{user?.email && <small>{user.email}</small>}{user?.role && <Badge tone="info">{user.role}</Badge>}</div></div>
      <button type="button" role="menuitem" className="dropdown-item danger" onClick={() => void handleLogout()}><LogOut size={15} />Sign out</button>
    </div>}
  </div>;
}

export function Topbar({ onMenu }: TopbarProps) {
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  return <header className="topbar">
    <div className="topbar-start">
      <button className="icon-button mobile-only" onClick={onMenu} aria-label="Open navigation"><Menu size={20} /></button>
      <Breadcrumbs items={breadcrumbsFor(location.pathname)} />
    </div>
    <div className="topbar-actions">
      <button className="topbar-search" onClick={() => setSearchOpen(true)} aria-label="Search workspace"><Search size={15} /><span>Search...</span><kbd>{isMac ? '⌘K' : 'Ctrl K'}</kbd></button>
      <span className="topbar-divider" aria-hidden="true" />
      <UserMenu />
    </div>
    <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
  </header>;
}

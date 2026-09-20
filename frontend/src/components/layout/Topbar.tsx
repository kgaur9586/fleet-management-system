import { Menu, Bell, Search, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { notify } from '@/lib/toast';

interface TopbarProps { onMenu: () => void }

export function Topbar({ onMenu }: TopbarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  async function handleLogout() {
    await logout();
    notify.success('You have been signed out.');
    navigate('/login', { replace: true });
  }
  return <header className="topbar">
    <button className="icon-button mobile-only" onClick={onMenu} aria-label="Open navigation"><Menu size={20} /></button>
    <div className="topbar-search"><Search size={17} /><span>Search workspace</span><kbd>⌘ K</kbd></div>
    <div className="topbar-actions"><button className="icon-button" aria-label="Notifications"><Bell size={18} /></button><div className="user-chip"><span>{user?.name?.slice(0, 2).toUpperCase() || 'AD'}</span><strong>{user?.name || 'Admin'}</strong></div><button className="icon-button" onClick={handleLogout} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button></div>
  </header>;
}
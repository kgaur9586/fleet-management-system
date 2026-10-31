import { Outlet } from 'react-router-dom';
import { useCallback, useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { useLoading } from '@/hooks/useLoading';

const COLLAPSED_KEY = 'fleet:sidebar-collapsed';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === '1');
  const { isLoading } = useLoading();
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleCollapsed = useCallback(() => setCollapsed((current) => { localStorage.setItem(COLLAPSED_KEY, current ? '0' : '1'); return !current; }), []);
  return <div className="app-shell">
    <Sidebar open={sidebarOpen} collapsed={collapsed} onClose={closeSidebar} onToggleCollapsed={toggleCollapsed} />
    <div className="main-column"><Topbar onMenu={() => setSidebarOpen(true)} />{isLoading && <div className="loading-bar" />}<main className="page-content"><Outlet /></main></div>
  </div>;
}

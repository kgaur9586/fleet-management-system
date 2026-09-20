import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { useLoading } from '@/hooks/useLoading';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isLoading } = useLoading();
  return <div className="app-shell">
    <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    <div className="main-column"><Topbar onMenu={() => setSidebarOpen(true)} />{isLoading && <div className="loading-bar" />}<main className="page-content"><Outlet /></main></div>
  </div>;
}
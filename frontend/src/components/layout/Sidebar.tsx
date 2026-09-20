import { NavLink } from 'react-router-dom';
import { BarChart3, Boxes, ClipboardList, FileText, Gauge, Map, ReceiptText, Route, Truck, Users, X } from 'lucide-react';

const links = [
  { to: '/', label: 'Overview', icon: Gauge },
  { to: '/vehicles', label: 'Vehicles', icon: Truck },
  { to: '/drivers', label: 'Drivers', icon: Users },
  { to: '/firms', label: 'Firms', icon: Boxes },
  { to: '/routes', label: 'Routes', icon: Route },
  { to: '/contracts', label: 'Contracts', icon: FileText },
  { to: '/trips', label: 'Trips', icon: Map },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
];

const billingLinks = [
  { to: '/billing', label: 'Billing Overview' },
  { to: '/billing/monthly', label: 'Monthly Billing' },
  { to: '/billing/invoices', label: 'Invoice History' },
];

interface SidebarProps { open: boolean; onClose: () => void }

export function Sidebar({ open, onClose }: SidebarProps) {
  return <>
    {open && <button className="sidebar-scrim" aria-label="Close navigation" onClick={onClose} />}
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <div className="brand-row">
        <div className="brand-mark"><ClipboardList size={18} /></div>
        <div><strong>Fleet Ledger</strong><span>Operations desk</span></div>
        <button className="icon-button mobile-only" onClick={onClose} aria-label="Close navigation"><X size={18} /></button>
      </div>
      <p className="nav-label">Workspace</p>
      <nav>{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} onClick={onClose} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}><Icon size={18} /><span>{label}</span></NavLink>)}<div className="nav-group"><div className="nav-group-heading"><ReceiptText size={18} /><span>Billing</span></div>{billingLinks.map(({ to, label }) => <NavLink key={to} to={to} end={to === '/billing'} onClick={onClose} className={({ isActive }) => isActive ? 'nav-link nav-sub-link active' : 'nav-link nav-sub-link'}>{label}</NavLink>)}</div></nav>
      <div className="sidebar-footer"><span className="status-dot" />System foundation ready</div>
    </aside>
  </>;
}
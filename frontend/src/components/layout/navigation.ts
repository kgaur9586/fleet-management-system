import { Banknote, BarChart3, Building2, CalendarRange, CreditCard, Files, FileText, FolderOpen, Fuel, HandCoins, Landmark, LayoutDashboard, Map, ReceiptText, Route, Truck, Users, Wallet, type LucideIcon } from 'lucide-react';

export interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean }
export interface NavSection { label: string; items: NavItem[] }

export const navigation: NavSection[] = [
  { label: 'Overview', items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  { label: 'Fleet', items: [
    { to: '/vehicles', label: 'Vehicles', icon: Truck },
    { to: '/drivers', label: 'Drivers', icon: Users },
    { to: '/routes', label: 'Routes', icon: Route },
    { to: '/trips', label: 'Trips', icon: Map },
  ] },
  { label: 'Business', items: [
    { to: '/companies', label: 'Companies', icon: Landmark },
    { to: '/firms', label: 'Firms', icon: Building2 },
    { to: '/contracts', label: 'Contracts', icon: FileText },
  ] },
  { label: 'Billing', items: [
    { to: '/billing', label: 'Billing overview', icon: ReceiptText, end: true },
    { to: '/billing/monthly', label: 'Monthly billing', icon: CalendarRange },
    { to: '/billing/invoices', label: 'Invoices', icon: Files },
  ] },
  { label: 'Finance', items: [
    { to: '/expenses', label: 'Expenses', icon: Wallet },
    { to: '/payments', label: 'Payments', icon: CreditCard },
    { to: '/driver-advances', label: 'Driver advances', icon: HandCoins },
    { to: '/salary', label: 'Payroll', icon: Banknote },
    { to: '/hsd-rates', label: 'HSD rates', icon: Fuel },
  ] },
  { label: 'Administration', items: [
    { to: '/documents', label: 'Documents', icon: FolderOpen },
    { to: '/reports', label: 'Reports', icon: BarChart3 },
  ] },
];

const segmentLabels: Record<string, string> = {
  vehicles: 'Vehicles', drivers: 'Drivers', routes: 'Routes', trips: 'Trips', companies: 'Companies', firms: 'Firms', contracts: 'Contracts',
  billing: 'Billing', monthly: 'Monthly billing', invoices: 'Invoices', expenses: 'Expenses', payments: 'Payments', 'driver-advances': 'Driver advances',
  salary: 'Payroll', 'hsd-rates': 'HSD rates', documents: 'Documents', reports: 'Reports', new: 'New', edit: 'Edit',
};

export function breadcrumbsFor(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  if (!segments.length) return [{ label: 'Dashboard' }];
  const crumbs: { label: string; to?: string }[] = [];
  let path = '';
  segments.forEach((segment, index) => {
    path += `/${segment}`;
    if (segment === 'versions') return;
    const label = segment === 'new' && segments[index - 1] === 'versions' ? 'New version' : segmentLabels[segment] ?? (index === 0 ? 'Not found' : 'Details');
    crumbs.push({ label, to: path });
  });
  return crumbs;
}

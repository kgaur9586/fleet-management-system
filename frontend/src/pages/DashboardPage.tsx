import { Activity, CalendarDays, ChartNoAxesCombined, CircleDollarSign, FileClock, LoaderCircle, ReceiptText, Route, ShieldAlert, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Badge, Button, Card } from '@/components/common';
import { getApiErrorMessage } from '@/services/apiClient';
import { getDashboardSnapshot, type DashboardSnapshot } from '@/services/dashboardApi';
import { notify } from '@/lib/toast';

const todayLabel = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

function MetricCard({ icon, tone, label, value, detail }: { icon: ReactNode; tone: string; label: string; value: string | number; detail: string }) {
  return <div className="metric-card dashboard-metric"><span className={`metric-icon ${tone}`}>{icon}</span><span className="metric-label">{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function UnavailableCard({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return <div className="unavailable-card"><span className="unavailable-icon">{icon}</span><div><strong>{title}</strong><p>{detail}</p></div><Badge tone="neutral">Not available</Badge></div>;
}

export function DashboardPage() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try { setSnapshot(await getDashboardSnapshot()); }
    catch (caught) { setError(getApiErrorMessage(caught)); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  return <div className="dashboard-page"><div className="page-heading"><div><p className="eyebrow">Operations overview</p><h1>Good morning, Admin.</h1><p className="muted">A focused view of the fleet and work recorded today.</p></div><Button variant="secondary" icon={<CalendarDays size={17} />} onClick={() => void load()}>Refresh overview</Button></div>{error && <Alert tone="error" title="Dashboard data unavailable" onDismiss={() => setError('')}>{error}<button className="inline-retry" onClick={() => { void load(); }}>Retry</button></Alert>}{loading ? <div className="dashboard-loading"><LoaderCircle size={22} className="spin" /><span>Loading operating totals...</span></div> : <>{snapshot && <><section className="dashboard-section"><div className="section-heading"><div><p className="eyebrow">Fleet</p><h2>People and machines in view</h2></div><Truck size={20} /></div><div className="metric-grid"><MetricCard icon={<Truck size={18} />} tone="ink" label="Total vehicles" value={snapshot.fleet.totalVehicles} detail="All vehicle records" /><MetricCard icon={<Activity size={18} />} tone="coral" label="Active vehicles" value={snapshot.fleet.activeVehicles} detail="Currently active" /><MetricCard icon={<ShieldAlert size={18} />} tone="gold" label="Inactive vehicles" value={snapshot.fleet.inactiveVehicles} detail="Marked inactive" /></div></section><section className="dashboard-section"><div className="section-heading"><div><p className="eyebrow">Operations</p><h2>Daily movement</h2></div><Route size={20} /></div><div className="metric-grid"><MetricCard icon={<CalendarDays size={18} />} tone="ink" label="Trips today" value={snapshot.operations.tripsToday} detail="Backend trip total" /><MetricCard icon={<Route size={18} />} tone="coral" label="Trips this month" value={snapshot.operations.tripsThisMonth} detail="Backend trip total" /><MetricCard icon={<Truck size={18} />} tone="gold" label="Vehicles currently active" value={snapshot.operations.vehiclesCurrentlyActive} detail="Active vehicle records" /></div></section></> }<section className="dashboard-section"><div className="section-heading"><div><p className="eyebrow">Finance</p><h2>Financial reporting</h2></div><CircleDollarSign size={20} /></div><div className="unavailable-grid"><UnavailableCard icon={<ReceiptText size={18} />} title="Current month billing" detail="Billing summary API is not available yet." /><UnavailableCard icon={<CircleDollarSign size={18} />} title="Current month expenses" detail="Expense API is not available yet." /><UnavailableCard icon={<ReceiptText size={18} />} title="Payments received" detail="Payment API is not available yet." /><UnavailableCard icon={<ChartNoAxesCombined size={18} />} title="Outstanding invoices" detail="Invoice API is not available yet." /></div></section><section className="dashboard-section"><div className="section-heading"><div><p className="eyebrow">Documents and reports</p><h2>More visibility, when the APIs arrive</h2></div><FileClock size={20} /></div><div className="unavailable-grid"><UnavailableCard icon={<FileClock size={18} />} title="Documents expiring soon" detail="Document tracking API is not available yet." /><UnavailableCard icon={<ShieldAlert size={18} />} title="Expired documents" detail="Document tracking API is not available yet." /><UnavailableCard icon={<ChartNoAxesCombined size={18} />} title="Monthly billing trend" detail="Report API is not available yet." /><UnavailableCard icon={<ChartNoAxesCombined size={18} />} title="Vehicle-wise reports" detail="Report API is not available yet." /></div></section></>}</div>;
}
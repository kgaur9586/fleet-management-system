import { Activity, AlertTriangle, CalendarDays, CircleDollarSign, FileClock, LoaderCircle, ReceiptText, RefreshCw, Route, ShieldAlert, Truck, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Badge, Button } from '@/components/common';
import { getApiErrorMessage } from '@/services/apiClient';
import { getDashboardSnapshot, type DashboardSnapshot, type VehicleTotal } from '@/services/dashboardApi';
import { money } from '@/lib/financial';

const dateFormatter = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });

function MetricCard({ icon, tone, label, value, detail }: { icon: ReactNode; tone: string; label: string; value: string | number; detail: string }) {
  return <div className="metric-card dashboard-metric"><span className={`metric-icon ${tone}`}>{icon}</span><span className="metric-label">{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function VehicleTotals({ title, rows, tone }: { title: string; rows: VehicleTotal[]; tone: string }) {
  return <section className="dashboard-panel"><div className="panel-title"><strong>{title}</strong><Badge tone="neutral">{rows.length} vehicles</Badge></div>{rows.length === 0 ? <p className="dashboard-empty">No recorded values for this month.</p> : <div className="dashboard-ranking">{rows.slice(0, 6).map((row) => <div className="dashboard-ranking-row" key={row.vehicleId}><span className={`ranking-dot ${tone}`} /><div><strong>{row.registrationNumber}</strong><small>{row.totalTrips} trip{row.totalTrips === 1 ? '' : 's'} · {row.totalKm} km</small></div><b>{money.format(row.total)}</b></div>)}</div>}</section>;
}

function AlertList({ title, rows, expired }: { title: string; rows: DashboardSnapshot['documentAlerts']['expired']; expired?: boolean }) {
  return <section className="dashboard-panel"><div className="panel-title"><strong>{title}</strong><Badge tone={expired ? 'danger' : 'warning'}>{rows.length}</Badge></div>{rows.length === 0 ? <p className="dashboard-empty">Nothing needs attention.</p> : <div className="dashboard-alert-list">{rows.slice(0, 5).map((row) => <div className="dashboard-alert-row" key={row.documentId}><span className={`alert-symbol ${expired ? 'danger' : 'warning'}`}>{expired ? <AlertTriangle size={15} /> : <FileClock size={15} />}</span><div><strong>{row.registrationNumber} · {row.documentType}</strong><small>{expired ? 'Expired' : 'Expires'} {dateFormatter.format(new Date(row.expiryDate))}</small></div></div>)}</div>}</section>;
}

export function DashboardPage() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try { setSnapshot(await getDashboardSnapshot()); } catch (caught) { setError(getApiErrorMessage(caught)); } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  return <div className="dashboard-page"><div className="page-heading"><div><p className="eyebrow">Operations overview</p><h1>Fleet control room.</h1><p className="muted">A live view of movement, receivables, costs, and compliance.</p></div><Button variant="secondary" icon={<RefreshCw size={16} />} onClick={() => void load()}>Refresh</Button></div>{error && <Alert tone="error" title="Dashboard data unavailable" onDismiss={() => setError('')}>{error}</Alert>}{loading ? <div className="dashboard-loading"><LoaderCircle size={22} className="spin" /><span>Loading operating totals...</span></div> : snapshot && <><div className="dashboard-period"><CalendarDays size={16} /> {monthFormatter.format(new Date(snapshot.period.year, snapshot.period.month - 1, 1))}<span>Updated from recorded transactions</span></div><section className="dashboard-section"><div className="section-heading"><div><p className="eyebrow">Fleet and work</p><h2>What is moving today</h2></div><Truck size={20} /></div><div className="metric-grid"><MetricCard icon={<Truck size={18} />} tone="ink" label="Total vehicles" value={snapshot.fleet.totalVehicles} detail={`${snapshot.fleet.activeVehicles} active · ${snapshot.fleet.inactiveVehicles} inactive`} /><MetricCard icon={<Users size={18} />} tone="gold" label="Total drivers" value={snapshot.fleet.totalDrivers} detail="Driver records" /><MetricCard icon={<Activity size={18} />} tone="coral" label="Trips today" value={snapshot.operations.tripsToday} detail={`${snapshot.operations.tripsThisMonth} this month`} /></div></section><section className="dashboard-section"><div className="section-heading"><div><p className="eyebrow">Monthly finance</p><h2>Revenue and cash position</h2></div><CircleDollarSign size={20} /></div><div className="metric-grid"><MetricCard icon={<ReceiptText size={18} />} tone="ink" label="Monthly billing" value={money.format(snapshot.finance.monthlyBilling)} detail={`${snapshot.source.billingInvoiceCount} finalized invoices`} /><MetricCard icon={<CircleDollarSign size={18} />} tone="coral" label="Payments received" value={money.format(snapshot.finance.monthlyPaymentsReceived)} detail={`${snapshot.source.paymentCount} received payments`} /><MetricCard icon={<ShieldAlert size={18} />} tone="gold" label="Outstanding invoices" value={money.format(snapshot.finance.outstandingInvoices.amount)} detail={`${snapshot.finance.outstandingInvoices.count} invoices open`} /><MetricCard icon={<ReceiptText size={18} />} tone="ink" label="Monthly expenses" value={money.format(snapshot.finance.monthlyExpenses)} detail={`${snapshot.source.expenseCount} recorded expenses`} /></div></section><section className="dashboard-section"><div className="section-heading"><div><p className="eyebrow">By vehicle</p><h2>Where the month is landing</h2></div><Route size={20} /></div><div className="dashboard-two-column"><VehicleTotals title="Billing" rows={snapshot.vehicleBilling} tone="billing" /><VehicleTotals title="Expenses" rows={snapshot.vehicleExpenses} tone="expense" /></div></section><section className="dashboard-section"><div className="section-heading"><div><p className="eyebrow">Compliance watch</p><h2>Documents needing attention</h2></div><FileClock size={20} /></div><div className="dashboard-two-column"><AlertList title="Expiring within 30 days" rows={snapshot.documentAlerts.expiringSoon} /><AlertList title="Already expired" rows={snapshot.documentAlerts.expired} expired /></div></section></>}</div>;
}

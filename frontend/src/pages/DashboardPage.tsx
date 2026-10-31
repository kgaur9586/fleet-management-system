import { Activity, AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, CircleDollarSign, FileClock, ReceiptText, RefreshCw, Route, ShieldAlert, Truck, Users, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Badge, Button, Skeleton } from '@/components/common';
import { getApiErrorMessage } from '@/services/apiClient';
import { getDashboardSnapshot, type DashboardSnapshot, type VehicleTotal } from '@/services/dashboardApi';
import { money } from '@/lib/financial';

const dateFormatter = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });

function MetricCard({ icon, tone, label, value, detail, compact }: { icon: ReactNode; tone: string; label: string; value: string | number; detail: string; compact?: boolean }) {
  return <div className={`metric-card dashboard-metric ${compact ? 'metric-compact' : ''}`}><div className="metric-card-top"><span className="metric-label">{label}</span><span className={`metric-icon ${tone}`}>{icon}</span></div><strong>{value}</strong><small>{detail}</small></div>;
}

function SectionHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{action}</div>;
}

function VehicleTotals({ title, description, rows, tone, to }: { title: string; description: string; rows: VehicleTotal[]; tone: 'billing' | 'expense'; to: string }) {
  const top = rows.slice(0, 6);
  const max = Math.max(...top.map((row) => Math.abs(row.total)), 1);
  return <section className="dashboard-panel"><div className="panel-title"><div><strong>{title}</strong><small>{description}</small></div><Badge tone="neutral">{rows.length} vehicle{rows.length === 1 ? '' : 's'}</Badge></div>{top.length === 0 ? <p className="dashboard-empty"><Truck size={20} />No recorded values for this month.</p> : <div className="dashboard-ranking">{top.map((row) => <div className="dashboard-ranking-row" key={row.vehicleId}><div><strong>{row.registrationNumber}</strong><small>{row.totalTrips} trip{row.totalTrips === 1 ? '' : 's'} · {row.totalKm.toLocaleString(undefined, { maximumFractionDigits: 2 })} km</small></div><b>{money.format(row.total)}</b><span className={`ranking-bar ${tone}`} aria-hidden="true"><span style={{ width: `${Math.max(2, (Math.abs(row.total) / max) * 100)}%` }} /></span></div>)}</div>}{rows.length > 0 && <Link className="text-link panel-link" to={to}>View all <ArrowRight size={14} /></Link>}</section>;
}

function AlertList({ title, rows, expired }: { title: string; rows: DashboardSnapshot['documentAlerts']['expired']; expired?: boolean }) {
  return <section className="dashboard-panel"><div className="panel-title"><div><strong>{title}</strong><small>{expired ? 'Renew these documents to stay compliant' : 'Plan renewals before they lapse'}</small></div><Badge tone={rows.length ? expired ? 'danger' : 'warning' : 'success'}>{rows.length}</Badge></div>{rows.length === 0 ? <p className="dashboard-empty"><CheckCircle2 size={20} />Nothing needs attention.</p> : <div className="dashboard-alert-list">{rows.slice(0, 5).map((row) => <div className="dashboard-alert-row" key={row.documentId}><span className={`alert-symbol ${expired ? 'danger' : 'warning'}`}>{expired ? <AlertTriangle size={15} /> : <FileClock size={15} />}</span><div><strong>{row.registrationNumber} · <span className="capitalize">{row.documentType}</span></strong><small>{row.documentNumber ? `${row.documentNumber} · ` : ''}{expired ? 'Expired' : 'Expires'} {dateFormatter.format(new Date(row.expiryDate))}</small></div></div>)}</div>}</section>;
}

function DashboardSkeleton() {
  return <div className="dashboard-skeleton" aria-busy="true" aria-label="Loading dashboard"><div className="metric-grid">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} />)}</div><div className="metric-grid">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} />)}</div><div className="dashboard-two-column"><Skeleton /><Skeleton /></div></div>;
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

  const period = snapshot ? monthFormatter.format(new Date(snapshot.period.year, snapshot.period.month - 1, 1)) : '';

  return <div className="dashboard-page">
    <div className="page-heading"><div><p className="eyebrow">Overview</p><h1>Dashboard</h1><p className="muted">A live view of movement, receivables, costs, and compliance.</p></div><div className="heading-actions">{snapshot && <span className="dashboard-period"><CalendarDays size={14} />{period}<span>From recorded transactions</span></span>}<Button variant="secondary" loading={loading} icon={<RefreshCw size={16} />} onClick={() => void load()}>Refresh</Button></div></div>
    {error && <Alert tone="error" title="Dashboard data unavailable" onDismiss={() => setError('')}>{error}</Alert>}
    {loading && !snapshot ? <DashboardSkeleton /> : snapshot && <>
      <section className="dashboard-section"><SectionHeading eyebrow="Monthly finance" title="Revenue and cash position" action={<Link className="text-link" to="/billing">Billing overview <ArrowRight size={14} /></Link>} /><div className="metric-grid">
        <MetricCard icon={<ReceiptText size={17} />} tone="primary" label="Monthly billing" value={money.format(snapshot.finance.monthlyBilling)} detail={`${snapshot.source.billingInvoiceCount} finalized invoice${snapshot.source.billingInvoiceCount === 1 ? '' : 's'}`} />
        <MetricCard icon={<CircleDollarSign size={17} />} tone="success" label="Payments received" value={money.format(snapshot.finance.monthlyPaymentsReceived)} detail={`${snapshot.source.paymentCount} received payment${snapshot.source.paymentCount === 1 ? '' : 's'}`} />
        <MetricCard icon={<ShieldAlert size={17} />} tone="warning" label="Outstanding invoices" value={money.format(snapshot.finance.outstandingInvoices.amount)} detail={`${snapshot.finance.outstandingInvoices.count} invoice${snapshot.finance.outstandingInvoices.count === 1 ? '' : 's'} open`} />
        <MetricCard icon={<Wallet size={17} />} tone="neutral" label="Monthly expenses" value={money.format(snapshot.finance.monthlyExpenses)} detail={`${snapshot.source.expenseCount} recorded expense${snapshot.source.expenseCount === 1 ? '' : 's'}`} />
      </div></section>
      <section className="dashboard-section"><SectionHeading eyebrow="Fleet and work" title="Operations" /><div className="metric-grid">
        <MetricCard compact icon={<Truck size={17} />} tone="primary" label="Total vehicles" value={snapshot.fleet.totalVehicles} detail={`${snapshot.fleet.activeVehicles} active · ${snapshot.fleet.inactiveVehicles} inactive`} />
        <MetricCard compact icon={<Users size={17} />} tone="neutral" label="Total drivers" value={snapshot.fleet.totalDrivers} detail="Driver records" />
        <MetricCard compact icon={<Activity size={17} />} tone="success" label="Trips today" value={snapshot.operations.tripsToday} detail="Recorded for today" />
        <MetricCard compact icon={<Route size={17} />} tone="neutral" label="Trips this month" value={snapshot.operations.tripsThisMonth} detail={period} />
      </div></section>
      <section className="dashboard-section"><SectionHeading eyebrow="By vehicle" title="Where the month is landing" /><div className="dashboard-two-column"><VehicleTotals title="Billing" description="Top vehicles by billed amount" rows={snapshot.vehicleBilling} tone="billing" to="/billing" /><VehicleTotals title="Expenses" description="Top vehicles by recorded spend" rows={snapshot.vehicleExpenses} tone="expense" to="/expenses" /></div></section>
      <section className="dashboard-section"><SectionHeading eyebrow="Compliance watch" title="Documents needing attention" action={<Link className="text-link" to="/documents">All documents <ArrowRight size={14} /></Link>} /><div className="dashboard-two-column"><AlertList title="Expiring within 30 days" rows={snapshot.documentAlerts.expiringSoon} /><AlertList title="Already expired" rows={snapshot.documentAlerts.expired} expired /></div></section>
    </>}
  </div>;
}

import { Edit3, Filter, Plus, RefreshCw, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Badge, Button, Card } from '@/components/common';
import { DataTable, type DataTableColumn } from '@/components/tables';
import { Select } from '@/components/forms';
import { expensesApi } from '@/services/expensesApi';
import { vehiclesApi } from '@/services/vehiclesApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { money } from '@/lib/financial';
import type { Expense, ExpenseCategory, ExpenseSummary, Page, Vehicle } from '@/types';

const categoryOptions: Array<{ value: ExpenseCategory | ''; label: string }> = [
  { value: '', label: 'All categories' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'toll', label: 'Toll' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'service', label: 'Service' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'loading_unloading', label: 'Loading / unloading' },
  { value: 'driver_wages', label: 'Driver wages' },
  { value: 'driver_advance', label: 'Driver advance' },
  { value: 'other', label: 'Other' },
];
const categoryLabel = (category: ExpenseCategory) => categoryOptions.find((option) => option.value === category)?.label ?? category;
const vehicleLabel = (vehicle: Expense['vehicle']) => typeof vehicle === 'object' && vehicle ? vehicle.registrationNumber : undefined;

export function ExpenseListPage() {
  const navigate = useNavigate();
  const [result, setResult] = useState<Page<Expense>>({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } });
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState(''); const [category, setCategory] = useState<ExpenseCategory | ''>(''); const [vehicleId, setVehicleId] = useState(''); const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [expensePage, summaryResult] = await Promise.all([
        expensesApi.list({ page, limit: 10, search: search || undefined, category: category || undefined, vehicleId: vehicleId || undefined }),
        expensesApi.summary({}),
      ]);
      setResult(expensePage); setSummary(summaryResult);
    } catch (caught) { setError(getApiErrorMessage(caught)); } finally { setLoading(false); }
  }, [category, page, search, vehicleId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { vehiclesApi.list({ page: 1, limit: 100, isActive: true }).then((result) => setVehicles(result.data)).catch(() => undefined); }, []);

  const vehicleOptions = useMemo(() => [{ value: '', label: 'All vehicles' }, ...vehicles.map((vehicle) => ({ value: vehicle._id, label: vehicle.registrationNumber }))], [vehicles]);
  const columns = useMemo<DataTableColumn<Expense>[]>(() => [
    { key: 'date', header: 'Date', render: (expense) => new Date(expense.date).toLocaleDateString('en-IN') },
    { key: 'category', header: 'Category', render: (expense) => <Badge tone="info">{categoryLabel(expense.category)}</Badge> },
    { key: 'description', header: 'Description', render: (expense) => <div className="table-primary"><span>{expense.description}</span><small>{vehicleLabel(expense.vehicle) || 'No vehicle'}</small></div> },
    { key: 'vendor', header: 'Vendor', render: (expense) => expense.vendor || <span className="muted">Not set</span> },
    { key: 'amount', header: 'Amount', render: (expense) => money.format(expense.amount) },
    { key: 'status', header: 'Payment', render: (expense) => <Badge tone={expense.paymentStatus === 'paid' ? 'success' : expense.paymentStatus === 'partial' ? 'warning' : expense.paymentStatus === 'cancelled' ? 'danger' : 'neutral'}>{expense.paymentStatus ?? 'pending'}</Badge> },
    { key: 'actions', header: '', render: (expense) => <div className="table-actions"><Button variant="ghost" icon={<Edit3 size={15} />} aria-label="Edit expense" onClick={() => navigate(`/expenses/${expense._id}/edit`)} /></div> },
  ], [navigate]);

  const hasFilters = Boolean(search || category || vehicleId);
  const clearFilters = () => { setSearch(''); setCategory(''); setVehicleId(''); setPage(1); };

  return <div className="vehicle-page">
    <div className="page-heading"><div><p className="eyebrow">Operations expense</p><h1>Expenses</h1><p className="muted">Actual company costs, tracked separately from factory billing.</p></div><Button icon={<Plus size={17} />} onClick={() => navigate('/expenses/new')}>Add expense</Button></div>
    {error && <Alert tone="error" title="Could not load expenses" onDismiss={() => setError('')}>{error}</Alert>}
    {summary && <div className="metric-grid">
      <div className="metric-card dashboard-metric"><span className="metric-label">This month's total</span><strong>{money.format(summary.monthlyTotal)}</strong></div>
      {Object.entries(summary.categoryTotals).slice(0, 3).map(([cat, total]) => <div key={cat} className="metric-card dashboard-metric"><span className="metric-label">{categoryLabel(cat as ExpenseCategory)}</span><strong>{money.format(total)}</strong></div>)}
    </div>}
    <Card className="vehicle-list-card">
      <div className="vehicle-toolbar">
        <div className="search-field"><Search size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search description, vendor, or notes" aria-label="Search expenses" />{search && <button className="clear-search" onClick={() => setSearch('')} aria-label="Clear search"><X size={14} /></button>}</div>
        <div className="filter-controls driver-filter-controls">
          <Select label="Category" hideLabel options={categoryOptions.map((option) => ({ value: option.value, label: option.label }))} value={category} onChange={(event) => { setCategory(event.target.value as ExpenseCategory | ''); setPage(1); }} />
          <Select label="Vehicle" hideLabel options={vehicleOptions} value={vehicleId} onChange={(event) => { setVehicleId(event.target.value); setPage(1); }} />
          <Button variant="secondary" icon={<RefreshCw size={15} />} onClick={() => void load()} aria-label="Refresh expenses"><span className="button-label">Refresh</span></Button>
        </div>
      </div>
      {hasFilters && <div className="active-filter-row"><span>Filtered results</span><button type="button" onClick={clearFilters}>Clear all <X size={13} /></button></div>}
      <DataTable rows={result.data} columns={columns} getRowKey={(expense) => expense._id} loading={loading}
        empty={<div className="table-empty"><span className="empty-icon"><Filter size={20} /></span><strong>{hasFilters ? 'No expenses match these filters' : 'No expenses recorded yet'}</strong><p>{hasFilters ? 'Try clearing a filter or changing your search.' : 'Record fuel, toll, or maintenance costs as they happen.'}</p><Button variant="secondary" onClick={() => hasFilters ? clearFilters() : navigate('/expenses/new')}>{hasFilters ? 'Clear filters' : 'Add expense'}</Button></div>}
        page={result.meta.page} totalPages={result.meta.totalPages} onPageChange={setPage} />
    </Card>
  </div>;
}

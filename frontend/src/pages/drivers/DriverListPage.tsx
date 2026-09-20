import { Eye, Filter, MoreHorizontal, Plus, RefreshCw, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Badge, Button, Card, ConfirmationDialog, StatusBadge } from '@/components/common';
import { DataTable, type DataTableColumn } from '@/components/tables';
import { Select } from '@/components/forms';
import { driversApi } from '@/services/driversApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { notify } from '@/lib/toast';
import type { Driver, Page } from '@/types';

const statusOptions = [{ value: '', label: 'All statuses' }, { value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }];
const decimalText = (value: Driver['dailyWage']) => typeof value === 'object' ? value.$numberDecimal || '-' : String(value);

export function DriverListPage() {
  const navigate = useNavigate();
  const [result, setResult] = useState<Page<Driver>>({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } });
  const [search, setSearch] = useState(''); const [isActive, setIsActive] = useState('true'); const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [target, setTarget] = useState<Driver | null>(null); const [changing, setChanging] = useState(false);
  const load = useCallback(async () => { setLoading(true); setError(''); try { setResult(await driversApi.list({ page, limit: 10, search: search || undefined, isActive: isActive === '' ? undefined : isActive })); } catch (caught) { setError(getApiErrorMessage(caught)); } finally { setLoading(false); } }, [isActive, page, search]);
  useEffect(() => { void load(); }, [load]);
  async function changeStatus() { if (!target) return; setChanging(true); try { await driversApi.update(target._id, { isActive: !target.isActive }); notify.success(target.isActive ? 'Driver deactivated.' : 'Driver activated.'); setTarget(null); await load(); } catch (caught) { notify.error(caught); } finally { setChanging(false); } }
  const columns = useMemo<DataTableColumn<Driver>[]>(() => [
    { key: 'name', header: 'Driver', render: (driver) => <div className="table-primary"><Link to={`/drivers/${driver._id}`}>{driver.name}</Link><small>{driver.employeeId || 'No reference ID'}</small></div> },
    { key: 'mobile', header: 'Contact', render: (driver) => driver.mobile },
    { key: 'employeeId', header: 'Reference ID', render: (driver) => driver.employeeId || <span className="muted">Not set</span> },
    { key: 'dailyWage', header: 'Daily wage', render: (driver) => `₹ ${decimalText(driver.dailyWage)}` },
    { key: 'status', header: 'Status', render: (driver) => <StatusBadge status={driver.isActive ? 'active' : 'inactive'} /> },
    { key: 'history', header: 'History', render: (driver) => <Badge tone="neutral">{driver.history?.length || 0} events</Badge> },
    { key: 'actions', header: '', render: (driver) => <div className="table-actions"><Button variant="ghost" icon={<Eye size={15} />} aria-label="View driver" onClick={() => navigate(`/drivers/${driver._id}`)} /><Button variant="ghost" icon={<MoreHorizontal size={15} />} aria-label="Change driver status" onClick={() => setTarget(driver)} /></div> },
  ], [navigate]);
  const hasFilters = Boolean(search || isActive !== 'true'); const clearFilters = () => { setSearch(''); setIsActive('true'); setPage(1); };
  return <div className="vehicle-page"><div className="page-heading"><div><p className="eyebrow">People</p><h1>Drivers</h1><p className="muted">Keep driver records current while assignments stay trip-specific.</p></div><Button icon={<Plus size={17} />} onClick={() => navigate('/drivers/new')}>Add driver</Button></div>{error && <Alert tone="error" title="Could not load drivers" onDismiss={() => setError('')}>{error}</Alert>}<Card className="vehicle-list-card"><div className="vehicle-toolbar"><div className="search-field"><Search size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search name, mobile, or reference ID" aria-label="Search drivers" />{search && <button className="clear-search" onClick={() => setSearch('')} aria-label="Clear search"><X size={14} /></button>}</div><div className="filter-controls driver-filter-controls"><Select label="Status" hideLabel options={statusOptions} value={isActive} onChange={(event) => { setIsActive(event.target.value); setPage(1); }} /><Button variant="secondary" icon={<RefreshCw size={15} />} onClick={() => void load()} aria-label="Refresh drivers"><span className="button-label">Refresh</span></Button></div></div>{hasFilters && <div className="active-filter-row"><span>Filtered results</span><button type="button" onClick={clearFilters}>Clear all <X size={13} /></button></div>}<DataTable rows={result.data} columns={columns} getRowKey={(driver) => driver._id} loading={loading} empty={<div className="table-empty"><span className="empty-icon"><Filter size={20} /></span><strong>{hasFilters ? 'No drivers match these filters' : 'No drivers added yet'}</strong><p>{hasFilters ? 'Try clearing a filter or changing your search.' : 'Add your first driver to start recording assignments.'}</p><Button variant="secondary" onClick={() => hasFilters ? clearFilters() : navigate('/drivers/new')}>{hasFilters ? 'Clear filters' : 'Add driver'}</Button></div>} page={result.meta.page} totalPages={result.meta.totalPages} total={result.meta.total} onPageChange={setPage} /></Card><ConfirmationDialog open={Boolean(target)} title={`${target?.isActive ? 'Deactivate' : 'Activate'} driver?`} message={`${target?.name || 'This driver'} will be ${target?.isActive ? 'marked inactive' : 'available for new assignments'}. Historical trip assignments remain unchanged.`} confirmLabel={target?.isActive ? 'Deactivate' : 'Activate'} loading={changing} onConfirm={() => void changeStatus()} onCancel={() => setTarget(null)} /></div>;
}
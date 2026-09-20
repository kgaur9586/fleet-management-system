import { Eye, Filter, MoreHorizontal, Plus, RefreshCw, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Badge, Button, Card, ConfirmationDialog, StatusBadge } from '@/components/common';
import { DataTable, type DataTableColumn } from '@/components/tables';
import { Select } from '@/components/forms';
import { vehiclesApi } from '@/services/vehiclesApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { notify } from '@/lib/toast';
import type { Firm, Page, Vehicle } from '@/types';
import { firmsApi } from '@/services/firmsApi';

const statusOptions = [{ value: '', label: 'All statuses' }, { value: 'available', label: 'Available' }, { value: 'on_trip', label: 'On trip' }, { value: 'maintenance', label: 'Maintenance' }];
const firmName = (vehicle: Vehicle) => typeof vehicle.firmId === 'string' ? vehicle.firmId : vehicle.firmId?.name || 'Unassigned';

export function VehicleListPage() {
  const navigate = useNavigate();
  const [result, setResult] = useState<Page<Vehicle>>({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } });
  const [firms, setFirms] = useState<Firm[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [firmId, setFirmId] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deactivateTarget, setDeactivateTarget] = useState<Vehicle | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const data = await vehiclesApi.list({ page, limit: 10, search: search || undefined, status: status || undefined, firmId: firmId || undefined }); setResult(data); }
    catch (caught) { setError(getApiErrorMessage(caught)); }
    finally { setLoading(false); }
  }, [firmId, page, search, status]);

  useEffect(() => { firmsApi.list({ page: 1, limit: 100, isActive: true }).then((data) => setFirms(data.data)).catch(() => undefined); }, []);
  useEffect(() => { void load(); }, [load]);

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    setChangingStatus(true);
    try { await vehiclesApi.update(deactivateTarget._id, { isActive: false }); notify.success('Vehicle deactivated.'); setDeactivateTarget(null); await load(); }
    catch (caught) { notify.error(caught); } finally { setChangingStatus(false); }
  }

  const columns = useMemo<DataTableColumn<Vehicle>[]>(() => [
    { key: 'registrationNumber', header: 'Vehicle', render: (vehicle) => <div className="table-primary"><Link to={`/vehicles/${vehicle._id}`}>{vehicle.registrationNumber}</Link><small>{vehicle.make || vehicle.vehicleModel || 'Fleet vehicle'}</small></div> },
    { key: 'vehicleType', header: 'Type', render: (vehicle) => vehicle.vehicleType },
    { key: 'capacity', header: 'Capacity', render: (vehicle) => `${vehicle.capacity}` },
    { key: 'status', header: 'Status', render: (vehicle) => <StatusBadge status={vehicle.status} /> },
    { key: 'operational', header: 'Operational', render: (vehicle) => vehicle.status === 'on_trip' ? <Badge tone="warning">On trip</Badge> : <Badge tone="neutral">{vehicle.isActive ? 'Idle' : 'Inactive'}</Badge> },
    { key: 'firm', header: 'Firm / customer', render: (vehicle) => firmName(vehicle) },
    { key: 'actions', header: '', render: (vehicle) => <div className="table-actions"><Button variant="ghost" icon={<Eye size={15} />} aria-label="View vehicle" onClick={() => navigate(`/vehicles/${vehicle._id}`)} /><Button variant="ghost" icon={<MoreHorizontal size={15} />} aria-label="Vehicle actions" onClick={() => setDeactivateTarget(vehicle)} /></div> },
  ], [navigate]);

  const hasFilters = Boolean(search || status || firmId);
  const clearFilters = () => { setSearch(''); setStatus(''); setFirmId(''); setPage(1); };

  return <div className="vehicle-page"><div className="page-heading"><div><p className="eyebrow">Fleet master</p><h1>Vehicles</h1><p className="muted">A clear view of the machines moving the business.</p></div><Button icon={<Plus size={17} />} onClick={() => navigate('/vehicles/new')}>Add vehicle</Button></div>{error && <Alert tone="error" title="Could not load vehicles" onDismiss={() => setError('')}>{error}</Alert>}<Card className="vehicle-list-card"><div className="vehicle-toolbar"><div className="search-field"><Search size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search registration, make, or model" aria-label="Search vehicles" />{search && <button className="clear-search" onClick={() => setSearch('')} aria-label="Clear search"><X size={14} /></button>}</div><div className="filter-controls"><Select label="Status" hideLabel options={statusOptions} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} /><Select label="Firm" hideLabel options={[{ value: '', label: 'All firms' }, ...firms.map((firm) => ({ value: firm._id, label: firm.name }))]} value={firmId} onChange={(event) => { setFirmId(event.target.value); setPage(1); }} /><Button variant="secondary" icon={<RefreshCw size={15} />} onClick={() => void load()} aria-label="Refresh vehicles"><span className="button-label">Refresh</span></Button></div></div>{hasFilters && <div className="active-filter-row"><span>Filtered results</span><button type="button" onClick={clearFilters}>Clear all <X size={13} /></button></div>}<DataTable rows={result.data} columns={columns} getRowKey={(vehicle) => vehicle._id} loading={loading} empty={<div className="table-empty"><span className="empty-icon"><Filter size={20} /></span><strong>{hasFilters ? 'No vehicles match these filters' : 'No vehicles added yet'}</strong><p>{hasFilters ? 'Try clearing a filter or changing your search.' : 'Add your first vehicle to start building the fleet.'}</p><Button variant="secondary" onClick={() => hasFilters ? clearFilters() : navigate('/vehicles/new')}>{hasFilters ? 'Clear filters' : 'Add vehicle'}</Button></div>} page={result.meta.page} totalPages={result.meta.totalPages} total={result.meta.total} onPageChange={setPage} /></Card><ConfirmationDialog open={Boolean(deactivateTarget)} title="Deactivate vehicle?" message={`${deactivateTarget?.registrationNumber || 'This vehicle'} will be marked inactive and remain available in historical records.`} confirmLabel="Deactivate" loading={changingStatus} onConfirm={() => void confirmDeactivate()} onCancel={() => setDeactivateTarget(null)} /></div>;
}
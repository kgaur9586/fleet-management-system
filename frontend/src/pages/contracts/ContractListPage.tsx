import { Eye, Filter, Plus, RefreshCw, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Badge, Button, Card, StatusBadge } from '@/components/common';
import { DataTable, type DataTableColumn } from '@/components/tables';
import { Select } from '@/components/forms';
import { contractsApi } from '@/services/contractsApi';
import { firmsApi } from '@/services/firmsApi';
import { getApiErrorMessage } from '@/services/apiClient';
import type { Contract, ContractVersion, Firm, Page } from '@/types';

const statusOptions = [{ value: '', label: 'All statuses' }, { value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }];
const dateText = (value?: string) => value ? new Date(value).toLocaleDateString() : 'Open-ended';

export function ContractListPage() {
  const navigate = useNavigate();
  const [result, setResult] = useState<Page<Contract>>({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } });
  const [firms, setFirms] = useState<Firm[]>([]); const [activeVersions, setActiveVersions] = useState<Record<string, ContractVersion | null>>({});
  const [search, setSearch] = useState(''); const [firmId, setFirmId] = useState(''); const [isActive, setIsActive] = useState('true'); const [page, setPage] = useState(1); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const firmName = useMemo(() => new Map(firms.map((firm) => [firm._id, firm.name])), [firms]);
  const load = useCallback(async () => { setLoading(true); setError(''); try { const data = await contractsApi.list({ page, limit: 10, search: search || undefined, firmId: firmId || undefined, isActive: isActive === '' ? undefined : isActive }); setResult(data); const versions = await Promise.all(data.data.map(async (contract) => { try { return [contract._id, await contractsApi.getActiveVersion(contract._id)] as const; } catch { return [contract._id, null] as const; } })); setActiveVersions(Object.fromEntries(versions)); } catch (caught) { setError(getApiErrorMessage(caught)); } finally { setLoading(false); } }, [firmId, isActive, page, search]);
  useEffect(() => { firmsApi.list({ page: 1, limit: 100, isActive: true }).then((data) => setFirms(data.data)).catch(() => undefined); }, []);
  useEffect(() => { void load(); }, [load]);
  const columns = useMemo<DataTableColumn<Contract>[]>(() => [
    { key: 'name', header: 'Contract', render: (contract) => <div className="table-primary"><Link to={`/contracts/${contract._id}`}>{contract.name}</Link><small>{contract.description || 'Commercial agreement'}</small></div> },
    { key: 'firm', header: 'Firm', render: (contract) => firmName.get(contract.firmId) || contract.firmId },
    { key: 'dates', header: 'Current dates', render: (contract) => { const version = activeVersions[contract._id]; return version ? `${dateText(version.effectiveFrom)} - ${dateText(version.effectiveTo)}` : <span className="muted">No active version</span>; } },
    { key: 'status', header: 'Status', render: (contract) => <StatusBadge status={contract.isActive ? 'active' : 'inactive'} /> },
    { key: 'version', header: 'Current version', render: (contract) => activeVersions[contract._id] ? <Badge tone="success">V{activeVersions[contract._id]?.version} current</Badge> : <Badge tone="neutral">Unavailable</Badge> },
    { key: 'actions', header: '', render: (contract) => <Button variant="ghost" icon={<Eye size={15} />} aria-label="View contract" onClick={() => navigate(`/contracts/${contract._id}`)} /> },
  ], [activeVersions, firmName, navigate]);
  const hasFilters = Boolean(search || firmId || isActive !== 'true'); const clearFilters = () => { setSearch(''); setFirmId(''); setIsActive('true'); setPage(1); };
  return <div className="vehicle-page"><div className="page-heading"><div><p className="eyebrow">Commercial setup</p><h1>Contracts</h1><p className="muted">Versioned commercial rules that preserve historical billing context.</p></div><Button icon={<Plus size={17} />} onClick={() => navigate('/contracts/new')}>Add contract</Button></div>{error && <Alert tone="error" title="Could not load contracts" onDismiss={() => setError('')}>{error}</Alert>}<Card className="vehicle-list-card"><div className="vehicle-toolbar"><div className="search-field"><Search size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search contract name or description" aria-label="Search contracts" />{search && <button className="clear-search" onClick={() => setSearch('')} aria-label="Clear search"><X size={14} /></button>}</div><div className="filter-controls contract-filter-controls"><Select label="Firm" hideLabel options={[{ value: '', label: 'All firms' }, ...firms.map((firm) => ({ value: firm._id, label: firm.name }))]} value={firmId} onChange={(event) => { setFirmId(event.target.value); setPage(1); }} /><Select label="Status" hideLabel options={statusOptions} value={isActive} onChange={(event) => { setIsActive(event.target.value); setPage(1); }} /><Button variant="secondary" icon={<RefreshCw size={15} />} onClick={() => void load()} aria-label="Refresh contracts"><span className="button-label">Refresh</span></Button></div></div>{hasFilters && <div className="active-filter-row"><span>Filtered results</span><button type="button" onClick={clearFilters}>Clear all <X size={13} /></button></div>}<DataTable rows={result.data} columns={columns} getRowKey={(contract) => contract._id} loading={loading} empty={<div className="table-empty"><span className="empty-icon"><Filter size={20} /></span><strong>{hasFilters ? 'No contracts match these filters' : 'No contracts added yet'}</strong><p>{hasFilters ? 'Try clearing a filter or changing your search.' : 'Add a contract to configure dated billing rules.'}</p><Button variant="secondary" onClick={() => hasFilters ? clearFilters() : navigate('/contracts/new')}>{hasFilters ? 'Clear filters' : 'Add contract'}</Button></div>} page={result.meta.page} totalPages={result.meta.totalPages} total={result.meta.total} onPageChange={setPage} /></Card></div>;
}
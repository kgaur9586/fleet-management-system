import { Eye, Filter, MoreHorizontal, Plus, RefreshCw, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Alert, Button, Card, StatusBadge } from '@/components/common';
import { DataTable, type DataTableColumn } from '@/components/tables';
import { Select } from '@/components/forms';
import { companiesApi } from '@/services/companiesApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { notify } from '@/lib/toast';
import type { Company, Page } from '@/types';

const statusOptions = [{ value: '', label: 'All statuses' }, { value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }];
const addressText = (company: Company) => [company.address?.city, company.address?.state].filter(Boolean).join(', ') || company.address?.street || 'No address added';

export function CompanyListPage() {
  const navigate = useNavigate();
  const [result, setResult] = useState<Page<Company>>({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } });
  const [search, setSearch] = useState(''); const [isActive, setIsActive] = useState('true'); const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = useCallback(async () => { setLoading(true); setError(''); try { setResult(await companiesApi.list({ page, limit: 10, search: search || undefined, isActive: isActive === '' ? undefined : isActive })); } catch (caught) { setError(getApiErrorMessage(caught)); } finally { setLoading(false); } }, [isActive, page, search]);
  useEffect(() => { void load(); }, [load]);
  async function toggleStatus(company: Company) { try { await companiesApi.update(company._id, { isActive: !company.isActive }); notify.success(company.isActive ? 'Company deactivated.' : 'Company activated.'); await load(); } catch (caught) { notify.error(caught); } }
  const columns = useMemo<DataTableColumn<Company>[]>(() => [
    { key: 'name', header: 'Company', render: (company) => <div className="table-primary"><Link to={`/companies/${company._id}`}>{company.name}</Link><small>{company.legalName || 'No legal name'}</small></div> },
    { key: 'address', header: 'Address', render: addressText },
    { key: 'gst', header: 'GST / tax', render: (company) => company.gstNumber || <span className="muted">Not set</span> },
    { key: 'status', header: 'Status', render: (company) => <StatusBadge status={company.isActive ? 'active' : 'inactive'} /> },
    { key: 'actions', header: '', render: (company) => <div className="table-actions"><Button variant="ghost" icon={<Eye size={15} />} aria-label="View company" onClick={() => navigate(`/companies/${company._id}`)} /><Button variant="ghost" icon={<MoreHorizontal size={15} />} aria-label="Change company status" onClick={() => void toggleStatus(company)} /></div> },
  ], [navigate]);
  const hasFilters = Boolean(search || isActive !== 'true'); const clearFilters = () => { setSearch(''); setIsActive('true'); setPage(1); };
  return <div className="vehicle-page">
    <div className="page-heading"><div><p className="eyebrow">Commercial setup</p><h1>Companies</h1><p className="muted">Factories and customers that receive bills from your firms.</p></div><Button icon={<Plus size={17} />} onClick={() => navigate('/companies/new')}>Add company</Button></div>
    {error && <Alert tone="error" title="Could not load companies" onDismiss={() => setError('')}>{error}</Alert>}
    <Card className="vehicle-list-card">
      <div className="vehicle-toolbar">
        <div className="search-field"><Search size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search name, legal name, or GST" aria-label="Search companies" />{search && <button className="clear-search" onClick={() => setSearch('')} aria-label="Clear search"><X size={14} /></button>}</div>
        <div className="filter-controls driver-filter-controls"><Select label="Status" hideLabel options={statusOptions} value={isActive} onChange={(event) => { setIsActive(event.target.value); setPage(1); }} /><Button variant="secondary" icon={<RefreshCw size={15} />} onClick={() => void load()} aria-label="Refresh companies"><span className="button-label">Refresh</span></Button></div>
      </div>
      {hasFilters && <div className="active-filter-row"><span>Filtered results</span><button type="button" onClick={clearFilters}>Clear all <X size={13} /></button></div>}
      <DataTable rows={result.data} columns={columns} getRowKey={(company) => company._id} loading={loading}
        empty={<div className="table-empty"><span className="empty-icon"><Filter size={20} /></span><strong>{hasFilters ? 'No companies match these filters' : 'No companies added yet'}</strong><p>{hasFilters ? 'Try clearing a filter or changing your search.' : 'Add the factory that your firms bill.'}</p><Button variant="secondary" onClick={() => hasFilters ? clearFilters() : navigate('/companies/new')}>{hasFilters ? 'Clear filters' : 'Add company'}</Button></div>}
        page={result.meta.page} totalPages={result.meta.totalPages} onPageChange={setPage} />
    </Card>
  </div>;
}

import { Eye, Filter, MoreHorizontal, Plus, RefreshCw, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Badge, Button, Card, ConfirmationDialog, StatusBadge } from '@/components/common';
import { DataTable, type DataTableColumn } from '@/components/tables';
import { Select } from '@/components/forms';
import { firmsApi } from '@/services/firmsApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { notify } from '@/lib/toast';
import type { Firm, Page } from '@/types';

const statusOptions = [{ value: '', label: 'All statuses' }, { value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }];
const contactText = (firm: Firm) => firm.contactDetails?.name || firm.contactDetails?.mobile || firm.contactDetails?.email || 'No contact added';
const addressText = (firm: Firm) => [firm.address?.city, firm.address?.state].filter(Boolean).join(', ') || firm.address?.street || 'No address added';

export function FirmListPage() {
  const navigate = useNavigate();
  const [result, setResult] = useState<Page<Firm>>({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } });
  const [search, setSearch] = useState(''); const [isActive, setIsActive] = useState('true'); const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [target, setTarget] = useState<Firm | null>(null); const [changing, setChanging] = useState(false);
  const load = useCallback(async () => { setLoading(true); setError(''); try { setResult(await firmsApi.list({ page, limit: 10, search: search || undefined, isActive: isActive === '' ? undefined : isActive })); } catch (caught) { setError(getApiErrorMessage(caught)); } finally { setLoading(false); } }, [isActive, page, search]);
  useEffect(() => { void load(); }, [load]);
  async function changeStatus() { if (!target) return; setChanging(true); try { await firmsApi.update(target._id, { isActive: !target.isActive }); notify.success(target.isActive ? 'Firm deactivated.' : 'Firm activated.'); setTarget(null); await load(); } catch (caught) { notify.error(caught); } finally { setChanging(false); } }
  const columns = useMemo<DataTableColumn<Firm>[]>(() => [
    { key: 'name', header: 'Firm', render: (firm) => <div className="table-primary"><Link to={`/firms/${firm._id}`}>{firm.name}</Link><small>{firm.billingName || 'No billing name'}</small></div> },
    { key: 'contact', header: 'Contact', render: (firm) => contactText(firm) },
    { key: 'address', header: 'Address', render: (firm) => addressText(firm) },
    { key: 'gst', header: 'GST / tax', render: (firm) => firm.gstNumber || <span className="muted">Not set</span> },
    { key: 'status', header: 'Status', render: (firm) => <StatusBadge status={firm.isActive ? 'active' : 'inactive'} /> },
    { key: 'configuration', header: 'Billing setup', render: (firm) => <Badge tone={firm.billingConfiguration && Object.keys(firm.billingConfiguration).length ? 'success' : 'neutral'}>{firm.billingConfiguration && Object.keys(firm.billingConfiguration).length ? 'Configured' : 'Not configured'}</Badge> },
    { key: 'actions', header: '', render: (firm) => <div className="table-actions"><Button variant="ghost" icon={<Eye size={15} />} aria-label="View firm" onClick={() => navigate(`/firms/${firm._id}`)} /><Button variant="ghost" icon={<MoreHorizontal size={15} />} aria-label="Change firm status" onClick={() => setTarget(firm)} /></div> },
  ], [navigate]);
  const hasFilters = Boolean(search || isActive !== 'true'); const clearFilters = () => { setSearch(''); setIsActive('true'); setPage(1); };
  return <div className="vehicle-page"><div className="page-heading"><div><p className="eyebrow">Commercial setup</p><h1>Firms</h1><p className="muted">Manage the independent firms and billing identities in your fleet.</p></div><Button icon={<Plus size={17} />} onClick={() => navigate('/firms/new')}>Add firm</Button></div>{error && <Alert tone="error" title="Could not load firms" onDismiss={() => setError('')}>{error}</Alert>}<Card className="vehicle-list-card"><div className="vehicle-toolbar"><div className="search-field"><Search size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search name, billing name, contact, or GST" aria-label="Search firms" />{search && <button className="clear-search" onClick={() => setSearch('')} aria-label="Clear search"><X size={14} /></button>}</div><div className="filter-controls driver-filter-controls"><Select label="Status" hideLabel options={statusOptions} value={isActive} onChange={(event) => { setIsActive(event.target.value); setPage(1); }} /><Button variant="secondary" icon={<RefreshCw size={15} />} onClick={() => void load()} aria-label="Refresh firms"><span className="button-label">Refresh</span></Button></div></div>{hasFilters && <div className="active-filter-row"><span>Filtered results</span><button type="button" onClick={clearFilters}>Clear all <X size={13} /></button></div>}<DataTable rows={result.data} columns={columns} getRowKey={(firm) => firm._id} loading={loading} empty={<div className="table-empty"><span className="empty-icon"><Filter size={20} /></span><strong>{hasFilters ? 'No firms match these filters' : 'No firms added yet'}</strong><p>{hasFilters ? 'Try clearing a filter or changing your search.' : 'Add a firm to manage its billing identity and contacts.'}</p><Button variant="secondary" onClick={() => hasFilters ? clearFilters() : navigate('/firms/new')}>{hasFilters ? 'Clear filters' : 'Add firm'}</Button></div>} page={result.meta.page} totalPages={result.meta.totalPages} total={result.meta.total} onPageChange={setPage} /></Card><ConfirmationDialog open={Boolean(target)} title={`${target?.isActive ? 'Deactivate' : 'Activate'} firm?`} message={`${target?.name || 'This firm'} will be ${target?.isActive ? 'marked inactive' : 'made available for new operations'}. Historical records remain unchanged.`} confirmLabel={target?.isActive ? 'Deactivate' : 'Activate'} loading={changing} onConfirm={() => void changeStatus()} onCancel={() => setTarget(null)} /></div>;
}
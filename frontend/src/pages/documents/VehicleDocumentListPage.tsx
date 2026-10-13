import { Download, Plus, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Badge, Button, Card } from '@/components/common';
import { DataTable, type DataTableColumn } from '@/components/tables';
import { Select } from '@/components/forms';
import { vehicleDocumentsApi } from '@/services/vehicleDocumentsApi';
import { useActiveVehiclesQuery } from '@/services/billingQueries';
import { getApiErrorMessage } from '@/services/apiClient';
import { notify } from '@/lib/toast';
import type { Vehicle, VehicleDocument, VehicleDocumentStatus, VehicleDocumentType } from '@/types';

const typeOptions: Array<{ value: VehicleDocumentType | ''; label: string }> = [
  { value: '', label: 'All types' }, { value: 'rc', label: 'RC' }, { value: 'insurance', label: 'Insurance' },
  { value: 'permit', label: 'Permit' }, { value: 'fitness', label: 'Fitness' }, { value: 'pollution', label: 'Pollution' }, { value: 'other', label: 'Other' },
];
const statusOptions: Array<{ value: VehicleDocumentStatus | ''; label: string }> = [
  { value: '', label: 'All statuses' }, { value: 'active', label: 'Active' }, { value: 'expiring_soon', label: 'Expiring soon' }, { value: 'expired', label: 'Expired' },
];
// Mirrors the backend's expiry window so the badge shown here matches server-side filtering.
const computeStatus = (expiryDate: string): VehicleDocumentStatus => {
  const now = Date.now(); const expiry = new Date(expiryDate).getTime(); const days = (expiry - now) / 86_400_000;
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring_soon';
  return 'active';
};
const statusTone = (status: VehicleDocumentStatus) => status === 'expired' ? 'danger' : status === 'expiring_soon' ? 'warning' : 'success';
const vehicleLabel = (vehicleId: VehicleDocument['vehicleId']) => typeof vehicleId === 'object' ? vehicleId.registrationNumber : vehicleId;

export function VehicleDocumentListPage() {
  const navigate = useNavigate();
  const [vehicleId, setVehicleId] = useState(''); const [documentType, setDocumentType] = useState<VehicleDocumentType | ''>(''); const [status, setStatus] = useState<VehicleDocumentStatus | ''>('');
  const vehiclesQuery = useActiveVehiclesQuery();
  const documentsQuery = useQuery({
    queryKey: ['vehicle-documents', { vehicleId, documentType, status }],
    queryFn: () => vehicleDocumentsApi.list({ page: 1, limit: 100, vehicleId: vehicleId || undefined, documentType: documentType || undefined, status: status || undefined }),
  });
  const vehicles = vehiclesQuery.data?.data ?? [];
  const result = documentsQuery.data ?? { data: [], meta: { total: 0, page: 1, limit: 100, totalPages: 0 } };
  const error = documentsQuery.error || vehiclesQuery.error;

  async function download(document: VehicleDocument) {
    try {
      const { blob, filename } = await vehicleDocumentsApi.downloadFile(document._id);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url; anchor.download = filename || document.fileName || 'document';
      window.document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (caught) { notify.error(caught); }
  }

  const columns = useMemo<DataTableColumn<VehicleDocument>[]>(() => [
    { key: 'vehicle', header: 'Vehicle', render: (document) => vehicleLabel(document.vehicleId) },
    { key: 'type', header: 'Type', render: (document) => <Badge tone="info">{typeOptions.find((option) => option.value === document.documentType)?.label ?? document.documentType}</Badge> },
    { key: 'number', header: 'Document no.', render: (document) => document.documentNumber || <span className="muted">Not set</span> },
    { key: 'expiry', header: 'Expiry', render: (document) => new Date(document.expiryDate).toLocaleDateString('en-IN') },
    { key: 'status', header: 'Status', render: (document) => <Badge tone={statusTone(computeStatus(document.expiryDate))}>{computeStatus(document.expiryDate).replace('_', ' ')}</Badge> },
    { key: 'actions', header: '', render: (document) => <div className="table-actions">{document.fileReference && <Button variant="ghost" icon={<Download size={15} />} aria-label="Download document" onClick={() => void download(document)} />}</div> },
  ], []);

  return <div className="vehicle-page">
    <div className="page-heading"><div><p className="eyebrow">Compliance</p><h1>Vehicle documents</h1><p className="muted">RC, insurance, permit, fitness, and pollution certificates with expiry tracking.</p></div><Button icon={<Plus size={17} />} onClick={() => navigate('/documents/new')}>Upload document</Button></div>
    {error && <Alert tone="error" title="Could not load documents" onDismiss={() => void documentsQuery.refetch()}>{getApiErrorMessage(error)}</Alert>}
    <Card className="vehicle-list-card">
      <div className="vehicle-toolbar">
        <div className="filter-controls driver-filter-controls">
          <Select label="Vehicle" hideLabel options={[{ value: '', label: 'All vehicles' }, ...vehicles.map((vehicle: Vehicle) => ({ value: vehicle._id, label: vehicle.registrationNumber }))]} value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} />
          <Select label="Type" hideLabel options={typeOptions} value={documentType} onChange={(event) => setDocumentType(event.target.value as VehicleDocumentType | '')} />
          <Select label="Status" hideLabel options={statusOptions} value={status} onChange={(event) => setStatus(event.target.value as VehicleDocumentStatus | '')} />
          <Button variant="secondary" icon={<RefreshCw size={15} />} onClick={() => void documentsQuery.refetch()} aria-label="Refresh documents"><span className="button-label">Refresh</span></Button>
        </div>
      </div>
      <DataTable rows={result.data} columns={columns} getRowKey={(document) => document._id} loading={documentsQuery.isLoading}
        empty={<div className="table-empty"><strong>No documents uploaded yet</strong><p>Upload RC, insurance, permit, fitness, or pollution certificates to track expiry.</p><Button variant="secondary" onClick={() => navigate('/documents/new')}>Upload document</Button></div>} />
    </Card>
  </div>;
}

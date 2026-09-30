import { ArrowLeft, Upload } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Card } from '@/components/common';
import { DateInput, Select, TextInput, Textarea } from '@/components/forms';
import { VehicleSelector } from '@/components/business';
import { vehicleDocumentsApi } from '@/services/vehicleDocumentsApi';
import { vehiclesApi } from '@/services/vehiclesApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { notify } from '@/lib/toast';
import type { Vehicle, VehicleDocumentType } from '@/types';

const typeOptions: Array<{ value: VehicleDocumentType; label: string }> = [
  { value: 'rc', label: 'RC' }, { value: 'insurance', label: 'Insurance' }, { value: 'permit', label: 'Permit' },
  { value: 'fitness', label: 'Fitness' }, { value: 'pollution', label: 'Pollution' }, { value: 'other', label: 'Other' },
];

export function VehicleDocumentFormPage() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [documentType, setDocumentType] = useState<VehicleDocumentType>('rc');
  const [documentNumber, setDocumentNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { vehiclesApi.list({ page: 1, limit: 100, isActive: true }).then((page) => setVehicles(page.data)).catch(() => undefined); }, []);
  const vehicleOptions = useMemo(() => vehicles.map((vehicle) => ({ value: vehicle._id, label: vehicle.registrationNumber })), [vehicles]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (!vehicleId || !expiryDate || !file) { setError('Vehicle, expiry date, and a file are required.'); return; }
    if (issueDate && issueDate > expiryDate) { setError('Issue date must be on or before the expiry date.'); return; }
    setSaving(true);
    try {
      await vehicleDocumentsApi.upload({
        vehicleId, documentType, documentNumber: documentNumber || undefined,
        issueDate: issueDate ? new Date(`${issueDate}T00:00:00.000Z`).toISOString() : undefined,
        expiryDate: new Date(`${expiryDate}T00:00:00.000Z`).toISOString(),
        notes: notes || undefined, file,
      });
      notify.success('Document uploaded.');
      navigate('/documents');
    } catch (caught) { setError(getApiErrorMessage(caught)); notify.error(caught); } finally { setSaving(false); }
  }

  return <div className="vehicle-page">
    <div className="page-heading"><div><Link className="back-link" to="/documents"><ArrowLeft size={15} /> Documents</Link><p className="eyebrow">Compliance</p><h1>Upload document</h1><p className="muted">PDF, JPG, or PNG up to 10MB.</p></div></div>
    {error && <Alert tone="error" title="Unable to upload document">{error}</Alert>}
    <form onSubmit={submit} className="vehicle-form-grid">
      <Card title="Document details"><div className="form-grid">
        <VehicleSelector value={vehicleId} options={vehicleOptions} onChange={setVehicleId} />
        <Select id="documentType" label="Document type" options={typeOptions} value={documentType} onChange={(event) => setDocumentType(event.target.value as VehicleDocumentType)} />
        <TextInput id="documentNumber" label="Document number" value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} />
        <DateInput id="issueDate" label="Issue date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
        <DateInput id="expiryDate" label="Expiry date" required value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} />
      </div>
      <div className="form-field">
        <label htmlFor="file">File</label>
        <input id="file" type="file" accept="application/pdf,image/jpeg,image/png" className="form-control" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        {file && <small className="muted">{file.name}</small>}
      </div>
      <Textarea id="notes" label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Card>
      <div className="form-actions"><Button type="button" variant="secondary" onClick={() => navigate('/documents')}>Cancel</Button><Button type="submit" loading={saving} icon={<Upload size={16} />}>Upload document</Button></div>
    </form>
  </div>;
}

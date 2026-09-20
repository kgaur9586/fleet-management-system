import { ArrowLeft, Save } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Alert } from '@/components/common';
import { Select, TextInput, NumberInput } from '@/components/forms';
import { FirmSelector } from '@/components/business';
import { firmsApi } from '@/services/firmsApi';
import { vehiclesApi } from '@/services/vehiclesApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { notify } from '@/lib/toast';
import type { Firm, VehiclePayload } from '@/types';

const statusOptions = [
  { value: 'available', label: 'Available' },
  { value: 'on_trip', label: 'On trip' },
  { value: 'maintenance', label: 'Maintenance' },
];

export function VehicleFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [form, setForm] = useState<VehiclePayload>({ registrationNumber: '', vehicleType: '', capacity: 0, make: '', vehicleModel: '', firmId: '', status: 'available' });
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      firmsApi.list({ page: 1, limit: 100, isActive: true }),
      editing && id ? vehiclesApi.get(id) : Promise.resolve(null),
    ]).then(([firmPage, vehicle]) => {
      setFirms(firmPage.data);
      if (vehicle) setForm({ registrationNumber: vehicle.registrationNumber, vehicleType: vehicle.vehicleType, capacity: vehicle.capacity, make: vehicle.make || '', vehicleModel: vehicle.vehicleModel || '', firmId: typeof vehicle.firmId === 'string' ? vehicle.firmId : vehicle.firmId?._id || '', status: vehicle.status, metadata: vehicle.metadata });
    }).catch((caught) => setError(getApiErrorMessage(caught))).finally(() => setLoading(false));
  }, [editing, id]);

  const update = (field: keyof VehiclePayload, value: unknown) => setForm((current) => ({ ...current, [field]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!form.registrationNumber?.trim() || !form.vehicleType?.trim() || !form.capacity || form.capacity <= 0) {
      setError('Registration number, vehicle type, and a positive capacity are required.');
      return;
    }
    setSaving(true);
    try {
      if (editing && id) await vehiclesApi.update(id, form);
      else await vehiclesApi.create(form);
      notify.success(editing ? 'Vehicle updated.' : 'Vehicle added.');
      navigate('/vehicles');
    } catch (caught) { setError(getApiErrorMessage(caught)); notify.error(caught); } finally { setSaving(false); }
  }

  if (loading) return <div className="route-loading">Loading vehicle...</div>;
  return <div className="vehicle-page"><div className="page-heading"><div><Link className="back-link" to="/vehicles"><ArrowLeft size={15} /> Vehicles</Link><p className="eyebrow">Fleet master</p><h1>{editing ? 'Edit vehicle' : 'Add vehicle'}</h1><p className="muted">Keep the fleet record factual and operationally useful.</p></div></div>{error && <Alert tone="error" title="Unable to save vehicle">{error}</Alert>}<form onSubmit={submit} className="vehicle-form-grid"><Card title="Vehicle identity" description="The fields used to identify this vehicle in operations."><div className="form-grid"><TextInput id="registrationNumber" label="Registration number" required value={form.registrationNumber || ''} onChange={(event) => update('registrationNumber', event.target.value)} placeholder="e.g. MH12AB1234" /><TextInput id="vehicleType" label="Vehicle type" required value={form.vehicleType || ''} onChange={(event) => update('vehicleType', event.target.value)} placeholder="e.g. Truck" /><NumberInput id="capacity" label="Capacity" required min={0.1} step="any" value={form.capacity || ''} onChange={(event) => update('capacity', Number(event.target.value))} hint="Use the same unit used by your fleet records." /><Select id="status" label="Status" options={statusOptions} value={form.status || 'available'} onChange={(event) => update('status', event.target.value)} /></div></Card><Card title="Assignment" description="A vehicle can be associated with its current billing firm."><FirmSelector value={typeof form.firmId === 'string' ? form.firmId : ''} options={firms.map((firm) => ({ value: firm._id, label: firm.name }))} onChange={(value) => update('firmId', value)} /><div className="form-grid"><TextInput id="make" label="Make" value={form.make || ''} onChange={(event) => update('make', event.target.value)} placeholder="e.g. Tata" /><TextInput id="vehicleModel" label="Model" value={form.vehicleModel || ''} onChange={(event) => update('vehicleModel', event.target.value)} placeholder="e.g. Prima" /></div></Card><div className="form-actions"><Button type="button" variant="secondary" onClick={() => navigate('/vehicles')}>Cancel</Button><Button type="submit" loading={saving} icon={<Save size={16} />}>{editing ? 'Save changes' : 'Add vehicle'}</Button></div></form></div>;
}
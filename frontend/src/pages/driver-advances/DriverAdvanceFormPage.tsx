import { ArrowLeft, Save } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Button, Card } from '@/components/common';
import { DateInput, NumberInput, Textarea } from '@/components/forms';
import { DriverSelector } from '@/components/business';
import { driverAdvancesApi } from '@/services/driverAdvancesApi';
import { driversApi } from '@/services/driversApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { notify } from '@/lib/toast';
import type { Driver } from '@/types';

export function DriverAdvanceFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverId, setDriverId] = useState(searchParams.get('driverId') ?? '');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { driversApi.list({ page: 1, limit: 100, isActive: true }).then((page) => setDrivers(page.data)).catch(() => undefined); }, []);
  const driverOptions = useMemo(() => drivers.map((driver) => ({ value: driver._id, label: driver.name })), [drivers]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (!driverId || amount <= 0) { setError('Driver and a positive amount are required.'); return; }
    setSaving(true);
    try {
      await driverAdvancesApi.create({ driverId, amount, date: new Date(`${date}T00:00:00.000Z`).toISOString(), notes: notes || undefined });
      notify.success('Advance recorded.');
      navigate(`/driver-advances?driverId=${driverId}`);
    } catch (caught) { setError(getApiErrorMessage(caught)); notify.error(caught); } finally { setSaving(false); }
  }

  return <div className="vehicle-page">
    <div className="page-heading"><div><Link className="back-link" to="/driver-advances"><ArrowLeft size={15} /> Driver advances</Link><p className="eyebrow">Driver settlement</p><h1>Record advance</h1><p className="muted">This advance will later be recovered only through a payroll deduction.</p></div></div>
    {error && <Alert tone="error" title="Unable to save advance">{error}</Alert>}
    <form onSubmit={submit} className="vehicle-form-grid">
      <Card title="Advance details"><div className="form-grid">
        <DriverSelector value={driverId} options={driverOptions} onChange={setDriverId} />
        <NumberInput id="amount" label="Amount" required min={0.01} step="0.01" value={amount || ''} onChange={(event) => setAmount(Number(event.target.value))} />
        <DateInput id="date" label="Date" required value={date} onChange={(event) => setDate(event.target.value)} />
      </div>
      <Textarea id="notes" label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Card>
      <div className="form-actions"><Button type="button" variant="secondary" onClick={() => navigate('/driver-advances')}>Cancel</Button><Button type="submit" loading={saving} icon={<Save size={16} />}>Record advance</Button></div>
    </form>
  </div>;
}

import { ArrowLeft, Save } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card } from '@/components/common';
import { DateInput, NumberInput, Select, TextInput, Textarea } from '@/components/forms';
import { VehicleSelector, FirmSelector } from '@/components/business';
import { expensesApi } from '@/services/expensesApi';
import { vehiclesApi } from '@/services/vehiclesApi';
import { firmsApi } from '@/services/firmsApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { notify } from '@/lib/toast';
import type { ExpenseCategory, ExpensePayload, Firm, Vehicle } from '@/types';

const categoryOptions: Array<{ value: ExpenseCategory; label: string }> = [
  { value: 'fuel', label: 'Fuel' },
  { value: 'toll', label: 'Toll' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'service', label: 'Service' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'loading_unloading', label: 'Loading / unloading' },
  { value: 'other', label: 'Other' },
];

const emptyForm = (): ExpensePayload => ({
  category: 'fuel',
  date: new Date().toISOString().slice(0, 10),
  amount: 0,
  description: '',
  vendor: '',
  vehicleId: '',
  firmId: '',
  notes: '',
});

export function ExpenseFormPage() {
  const { id } = useParams(); const navigate = useNavigate(); const editing = Boolean(id);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]); const [firms, setFirms] = useState<Firm[]>([]);
  const [form, setForm] = useState<ExpensePayload>(emptyForm());
  const [loading, setLoading] = useState(editing); const [saving, setSaving] = useState(false); const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([vehiclesApi.list({ page: 1, limit: 100, isActive: true }), firmsApi.list({ page: 1, limit: 100, isActive: true })])
      .then(([vehiclePage, firmPage]) => { setVehicles(vehiclePage.data); setFirms(firmPage.data); })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!editing || !id) return;
    expensesApi.get(id)
      .then((expense) => setForm({
        category: expense.category,
        date: expense.date.slice(0, 10),
        amount: expense.amount,
        description: expense.description,
        vendor: expense.vendor || '',
        vehicleId: typeof expense.vehicle === 'object' ? expense.vehicle?._id : expense.vehicle,
        firmId: typeof expense.firm === 'object' ? expense.firm?._id : expense.firm,
        notes: expense.notes || '',
        paymentStatus: expense.paymentStatus,
        fuelDetails: expense.fuelDetails,
        tollDetails: expense.tollDetails,
        maintenanceDetails: expense.maintenanceDetails,
        serviceDetails: expense.serviceDetails,
        insuranceDetails: expense.insuranceDetails,
        loadingUnloadingDetails: expense.loadingUnloadingDetails,
      }))
      .catch((caught) => setError(getApiErrorMessage(caught)))
      .finally(() => setLoading(false));
  }, [editing, id]);

  const update = (field: keyof ExpensePayload, value: unknown) => setForm((current) => ({ ...current, [field]: value }));
  const updateDetail = <K extends 'fuelDetails' | 'tollDetails' | 'maintenanceDetails' | 'serviceDetails' | 'insuranceDetails' | 'loadingUnloadingDetails'>(
    group: K, field: string, value: unknown,
  ) => setForm((current) => ({ ...current, [group]: { ...(current[group] as Record<string, unknown> | undefined), [field]: value } }));

  const vehicleOptions = useMemo(() => vehicles.map((vehicle) => ({ value: vehicle._id, label: vehicle.registrationNumber })), [vehicles]);
  const firmOptions = useMemo(() => firms.map((firm) => ({ value: firm._id, label: firm.name })), [firms]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (!form.description.trim() || form.amount <= 0) { setError('Description and a positive amount are required.'); return; }
    setSaving(true);
    try {
      const payload = { ...form, vehicleId: form.vehicleId || undefined, firmId: form.firmId || undefined };
      if (editing && id) await expensesApi.update(id, payload); else await expensesApi.create(payload);
      notify.success(editing ? 'Expense updated.' : 'Expense recorded.');
      navigate('/expenses');
    } catch (caught) { setError(getApiErrorMessage(caught)); notify.error(caught); } finally { setSaving(false); }
  }

  if (loading) return <div className="route-loading">Loading expense...</div>;

  return <div className="vehicle-page">
    <div className="page-heading"><div><Link className="back-link" to="/expenses"><ArrowLeft size={15} /> Expenses</Link><p className="eyebrow">Operations expense</p><h1>{editing ? 'Edit expense' : 'Add expense'}</h1><p className="muted">Actual company costs are tracked separately from factory billing.</p></div></div>
    {error && <Alert tone="error" title="Unable to save expense">{error}</Alert>}
    <form onSubmit={submit} className="vehicle-form-grid">
      <Card title="Expense details"><div className="form-grid">
        <Select id="category" label="Category" options={categoryOptions} value={form.category} onChange={(event) => update('category', event.target.value as ExpenseCategory)} />
        <DateInput id="date" label="Date" required value={form.date} onChange={(event) => update('date', event.target.value)} />
        <NumberInput id="amount" label="Amount" required min={0} step="0.01" value={form.amount} onChange={(event) => update('amount', Number(event.target.value))} />
        <TextInput id="vendor" label="Vendor" value={form.vendor || ''} onChange={(event) => update('vendor', event.target.value)} placeholder="Petrol pump, workshop, contractor..." />
      </div>
      <Textarea id="description" label="Description" required value={form.description} onChange={(event) => update('description', event.target.value)} />
      </Card>
      <Card title="Attribution" description="Optional links to a vehicle or firm for reporting."><div className="form-grid">
        <VehicleSelector value={form.vehicleId || ''} options={vehicleOptions} onChange={(value) => update('vehicleId', value)} />
        <FirmSelector value={form.firmId || ''} options={firmOptions} onChange={(value) => update('firmId', value)} />
      </div></Card>

      {form.category === 'fuel' && <Card title="Fuel details"><div className="form-grid">
        <NumberInput id="litresPurchased" label="Litres purchased" min={0} step="0.01" value={form.fuelDetails?.litresPurchased ?? ''} onChange={(event) => updateDetail('fuelDetails', 'litresPurchased', Number(event.target.value))} />
        <NumberInput id="ratePerLitre" label="Rate per litre" min={0} step="0.01" value={form.fuelDetails?.ratePerLitre ?? ''} onChange={(event) => updateDetail('fuelDetails', 'ratePerLitre', Number(event.target.value))} />
        <TextInput id="pumpName" label="Pump name" value={form.fuelDetails?.pumpName || ''} onChange={(event) => updateDetail('fuelDetails', 'pumpName', event.target.value)} />
      </div></Card>}

      {form.category === 'toll' && <Card title="Toll details"><div className="form-grid">
        <NumberInput id="tollMonth" label="Month" min={1} max={12} value={form.tollDetails?.month ?? ''} onChange={(event) => updateDetail('tollDetails', 'month', Number(event.target.value))} />
        <NumberInput id="tollYear" label="Year" min={2000} value={form.tollDetails?.year ?? ''} onChange={(event) => updateDetail('tollDetails', 'year', Number(event.target.value))} />
        <TextInput id="tollSource" label="Source" value={form.tollDetails?.source || ''} onChange={(event) => updateDetail('tollDetails', 'source', event.target.value)} placeholder="FASTag statement, manual..." />
      </div></Card>}

      {form.category === 'maintenance' && <Card title="Maintenance details"><div className="form-grid">
        <TextInput id="maintenanceType" label="Type" value={form.maintenanceDetails?.maintenanceType || ''} onChange={(event) => updateDetail('maintenanceDetails', 'maintenanceType', event.target.value)} placeholder="Tyre replacement, repair..." />
        <TextInput id="maintenanceWorkshop" label="Workshop" value={form.maintenanceDetails?.workshopName || ''} onChange={(event) => updateDetail('maintenanceDetails', 'workshopName', event.target.value)} />
        <NumberInput id="maintenanceOdometer" label="Odometer" min={0} value={form.maintenanceDetails?.odometer ?? ''} onChange={(event) => updateDetail('maintenanceDetails', 'odometer', Number(event.target.value))} />
      </div></Card>}

      {form.category === 'service' && <Card title="Service details"><div className="form-grid">
        <TextInput id="serviceType" label="Type" value={form.serviceDetails?.serviceType || ''} onChange={(event) => updateDetail('serviceDetails', 'serviceType', event.target.value)} />
        <TextInput id="serviceWorkshop" label="Workshop" value={form.serviceDetails?.workshopName || ''} onChange={(event) => updateDetail('serviceDetails', 'workshopName', event.target.value)} />
        <NumberInput id="serviceOdometer" label="Odometer" min={0} value={form.serviceDetails?.odometer ?? ''} onChange={(event) => updateDetail('serviceDetails', 'odometer', Number(event.target.value))} />
      </div></Card>}

      {form.category === 'insurance' && <Card title="Insurance details"><div className="form-grid">
        <TextInput id="insurerName" label="Insurer" value={form.insuranceDetails?.insurerName || ''} onChange={(event) => updateDetail('insuranceDetails', 'insurerName', event.target.value)} />
        <TextInput id="policyNumber" label="Policy number" value={form.insuranceDetails?.policyNumber || ''} onChange={(event) => updateDetail('insuranceDetails', 'policyNumber', event.target.value)} />
        <TextInput id="coverageType" label="Coverage type" value={form.insuranceDetails?.coverageType || ''} onChange={(event) => updateDetail('insuranceDetails', 'coverageType', event.target.value)} />
      </div></Card>}

      {form.category === 'loading_unloading' && <Card title="Contractor details"><div className="form-grid">
        <TextInput id="contractorName" label="Contractor" value={form.loadingUnloadingDetails?.contractorName || ''} onChange={(event) => updateDetail('loadingUnloadingDetails', 'contractorName', event.target.value)} />
        <NumberInput id="chargeMonth" label="Month" min={1} max={12} value={form.loadingUnloadingDetails?.month ?? ''} onChange={(event) => updateDetail('loadingUnloadingDetails', 'month', Number(event.target.value))} />
        <NumberInput id="chargeYear" label="Year" min={2000} value={form.loadingUnloadingDetails?.year ?? ''} onChange={(event) => updateDetail('loadingUnloadingDetails', 'year', Number(event.target.value))} />
      </div></Card>}

      <Card title="Notes"><Textarea id="notes" label="Internal notes" value={form.notes || ''} onChange={(event) => update('notes', event.target.value)} /></Card>
      <div className="form-actions"><Button type="button" variant="secondary" onClick={() => navigate('/expenses')}>Cancel</Button><Button type="submit" loading={saving} icon={<Save size={16} />}>{editing ? 'Save changes' : 'Add expense'}</Button></div>
    </form>
  </div>;
}

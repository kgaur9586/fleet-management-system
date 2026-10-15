import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, ConfirmationDialog } from '@/components/common';
import { DateInput, NumberInput, Select, Textarea, TextInput } from '@/components/forms';
import { ContractSelector, DriverSelector, FirmSelector, RouteSelector, VehicleSelector } from '@/components/business';
import { contractsApi } from '@/services/contractsApi';
import { driversApi } from '@/services/driversApi';
import { firmsApi } from '@/services/firmsApi';
import { routesApi } from '@/services/routesApi';
import { vehiclesApi } from '@/services/vehiclesApi';
import { tripsApi } from '@/services/tripsApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { notify } from '@/lib/toast';
import type { Contract, ContractVersion, Driver, Firm, Route, Trip, TripPayload, Vehicle } from '@/types';

const decimalText = (value: unknown) =>
  value && typeof value === 'object' && '$numberDecimal' in (value as Record<string, unknown>)
    ? String((value as { $numberDecimal?: string }).$numberDecimal)
    : String(value ?? '');

function useLockedInvoiceTrip(editing: boolean, id?: string) {
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    if (!editing || !id) return;
    let active = true;
    tripsApi.get(id)
      .then((trip) => { if (active) setLocked(Boolean(trip.billingInvoiceStatus && trip.billingInvoiceStatus !== 'draft')); })
      .catch(() => { if (active) setLocked(false); });
    return () => { active = false; };
  }, [editing, id]);
  return locked;
}

export function TripFormPage() { const { id } = useParams(); const navigate = useNavigate(); const editing = Boolean(id); const [vehicles, setVehicles] = useState<Vehicle[]>([]); const [drivers, setDrivers] = useState<Driver[]>([]); const [firms, setFirms] = useState<Firm[]>([]); const [routes, setRoutes] = useState<Route[]>([]); const [contracts, setContracts] = useState<Contract[]>([]); const [contractsLoading, setContractsLoading] = useState(false); const [effectiveVersion, setEffectiveVersion] = useState<ContractVersion | null>(null); const [versionError, setVersionError] = useState(''); const [form, setForm] = useState<TripPayload>({ tripDate: new Date().toISOString().slice(0, 10), vehicleId: '', driverId: '', firmId: '', contractId: '', routeId: null, pickupLocation: '', dropLocation: '', startKm: undefined, endKm: undefined, totalKm: 0, operationalStatus: 'planned', toll: { amount: 0 }, notes: '' }); const [loading, setLoading] = useState(editing); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [confirmingDelete, setConfirmingDelete] = useState(false); const [deleting, setDeleting] = useState(false); const totalKm = useMemo(() => form.startKm !== undefined && form.endKm !== undefined && form.endKm >= form.startKm ? form.endKm - form.startKm : 0, [form.endKm, form.startKm]); const options = useMemo(() => ({ vehicles: vehicles.map((v) => ({ value: v._id, label: v.registrationNumber })), drivers: drivers.map((d) => ({ value: d._id, label: d.name })), firms: firms.map((f) => ({ value: f._id, label: f.name })), routes: routes.map((r) => ({ value: r._id, label: `${r.name}${r.routeCode ? ` (${r.routeCode})` : ''}` })), contracts: contracts.map((c) => ({ value: c._id, label: c.name })) }), [contracts, drivers, firms, routes, vehicles]); const update = (field: keyof TripPayload, value: unknown) => setForm((current) => ({ ...current, [field]: value })); useEffect(() => { Promise.all([vehiclesApi.list({ page: 1, limit: 100, isActive: true }), driversApi.list({ page: 1, limit: 100, isActive: true }), firmsApi.list({ page: 1, limit: 100, isActive: true }), routesApi.list({ page: 1, limit: 100, isActive: true }), editing && id ? tripsApi.get(id) : Promise.resolve(null)]).then(([vehiclePage, driverPage, firmPage, routePage, trip]) => { setVehicles(vehiclePage.data); setDrivers(driverPage.data); setFirms(firmPage.data); setRoutes(routePage.data); if (trip) setForm({ tripDate: trip.tripDate.slice(0, 10), vehicleId: trip.vehicleId, driverId: trip.driverId, firmId: trip.firmId, contractId: trip.contractId, routeId: trip.routeId || null, pickupLocation: trip.pickupLocation, dropLocation: trip.dropLocation, startKm: trip.startKm, endKm: trip.endKm, totalKm: trip.totalKm, operationalStatus: trip.operationalStatus, toll: { amount: Number(typeof trip.toll?.amount === 'object' ? trip.toll.amount.$numberDecimal : trip.toll?.amount || 0), reference: trip.toll?.reference, notes: trip.toll?.notes }, notes: trip.notes }); }).catch((caught) => setError(getApiErrorMessage(caught))).finally(() => setLoading(false)); }, [editing, id]);

  const invoiceLocked = useLockedInvoiceTrip(editing, id);
  useEffect(() => {
    if (invoiceLocked && id) navigate(`/trips/${id}`, { replace: true });
  }, [invoiceLocked, id, navigate]);

  // Contracts are firm-scoped on the backend, so the selectable set must follow the chosen firm.
  useEffect(() => {
    if (!form.firmId) { setContracts([]); return; }
    let cancelled = false;
    setContractsLoading(true);
    contractsApi.list({ page: 1, limit: 100, firmId: form.firmId, isActive: true })
      .then((page) => {
        if (cancelled) return;
        setContracts(page.data);
        setForm((current) => {
          if (current.contractId && page.data.some((contract) => contract._id === current.contractId)) return current;
          return { ...current, contractId: page.data.length === 1 ? page.data[0]._id : '' };
        });
      })
      .catch((caught) => { if (!cancelled) setError(getApiErrorMessage(caught)); })
      .finally(() => { if (!cancelled) setContractsLoading(false); });
    return () => { cancelled = true; };
  }, [form.firmId]);

  // Surface the rate version the backend will actually bill this trip against.
  useEffect(() => {
    if (!form.contractId || !form.tripDate) { setEffectiveVersion(null); setVersionError(''); return; }
    let cancelled = false;
    contractsApi.getEffectiveVersion(form.contractId, new Date(`${form.tripDate}T00:00:00.000Z`).toISOString())
      .then((version) => { if (cancelled) return; setEffectiveVersion(version); setVersionError(''); })
      .catch((caught) => { if (cancelled) return; setEffectiveVersion(null); setVersionError(getApiErrorMessage(caught)); });
    return () => { cancelled = true; };
  }, [form.contractId, form.tripDate]);

  const selectedVehicle = useMemo(() => vehicles.find((vehicle) => vehicle._id === form.vehicleId), [form.vehicleId, vehicles]);
  const selectedRoute = useMemo(() => routes.find((route) => route._id === form.routeId), [form.routeId, routes]);
  const vehicleFirmId = useMemo(() => {
    const firm = selectedVehicle?.firmId;
    return firm ? (typeof firm === 'object' ? firm._id : firm) : '';
  }, [selectedVehicle]);

  // A vehicle assigned to a firm must bill against that firm; derive it instead of asking twice.
  useEffect(() => {
    if (vehicleFirmId) setForm((current) => (current.firmId === vehicleFirmId ? current : { ...current, firmId: vehicleFirmId, contractId: '' }));
  }, [vehicleFirmId]);

  const capacityRate = useMemo(() => {
    if (!effectiveVersion || !selectedVehicle) return null;
    return effectiveVersion.billingRules.capacityRates.find((rate) => rate.capacity === selectedVehicle.capacity) ?? null;
  }, [effectiveVersion, selectedVehicle]);

  async function handleDelete() {
    if (!id) return;
    setDeleting(true);
    try {
      await tripsApi.remove(id);
      notify.success('Trip deleted.');
      navigate('/trips');
    } catch (caught) {
      notify.error(caught);
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(''); if (!form.tripDate || !form.vehicleId || !form.driverId || !form.firmId || !form.contractId || !form.routeId || !form.pickupLocation.trim() || !form.dropLocation.trim()) { setError('Date, vehicle, driver, firm, contract, route, pickup, and drop are required.'); return; } setSaving(true); try { const payload = { ...form, tripDate: new Date(`${form.tripDate}T00:00:00.000Z`).toISOString(), totalKm: undefined, startKm: undefined, endKm: undefined }; if (editing && id) await tripsApi.update(id, payload); else await tripsApi.create(payload); notify.success(editing ? 'Trip updated.' : 'Trip recorded.'); navigate('/trips'); } catch (caught) { setError(getApiErrorMessage(caught)); notify.error(caught); } finally { setSaving(false); } } if (loading) return <div className="route-loading">Loading trip...</div>; return <div className="vehicle-page trip-page"><div className="page-heading"><div><Link className="back-link" to="/trips"><ArrowLeft size={15} /> Trips</Link><p className="eyebrow">Daily operations</p><h1>{editing ? 'Edit trip' : 'Record trip'}</h1><p className="muted">Select a route; its configured distance is authoritative for billing.</p></div></div>{error && <Alert tone="error" title="Unable to save trip">{error}</Alert>}<form onSubmit={submit} className="trip-entry-form"><Card title="Trip entry"><div className="trip-entry-grid"><DateInput id="tripDate" label="Date" required value={form.tripDate} onChange={(event) => update('tripDate', event.target.value)} /><VehicleSelector value={form.vehicleId} options={options.vehicles} onChange={(value) => update('vehicleId', value)} error={!form.vehicleId && error ? 'Vehicle is required' : undefined} /><DriverSelector value={form.driverId} options={options.drivers} onChange={(value) => update('driverId', value)} error={!form.driverId && error ? 'Driver is required' : undefined} /><FirmSelector value={form.firmId} options={options.firms} onChange={(value) => setForm((current) => ({ ...current, firmId: value, contractId: '' }))} disabled={Boolean(vehicleFirmId)} hint={vehicleFirmId ? 'Derived from the selected vehicle.' : undefined} error={!form.firmId && error ? 'Firm is required' : undefined} /><ContractSelector value={form.contractId} options={options.contracts} onChange={(value) => update('contractId', value)} disabled={!form.firmId || contractsLoading} error={form.firmId && !contractsLoading && options.contracts.length === 0 ? 'This firm has no active contract. Create one before recording trips.' : !form.contractId && error ? 'Contract is required' : undefined} />{form.contractId && <div className="km-preview"><span>Billing rates for this date</span>{versionError ? <strong>{versionError}</strong> : effectiveVersion ? <><strong>v{effectiveVersion.version} &middot; fuel {decimalText(effectiveVersion.billingRules.fuelRatePerLitre)}/L{capacityRate ? ` · avg ${decimalText(capacityRate.contractualAverageKmPerLitre)} km/L · hiring ${decimalText(capacityRate.baseHiringRatePerRound)}/round` : ''}</strong><small>{selectedVehicle && !capacityRate ? `No rate configured for capacity ${selectedVehicle.capacity}. Billing will fail for this vehicle.` : 'Rates come from the contract version the backend will bill against.'}</small></> : <strong>Loading...</strong>}</div>}<RouteSelector value={form.routeId || ''} options={options.routes} onChange={(value) => { const selected = routes.find((route) => route._id === value); setForm((current) => ({ ...current, routeId: value || null, pickupLocation: selected ? selected.pickupLocation : current.pickupLocation, dropLocation: selected ? selected.dropLocation : current.dropLocation })); }} hint="Route distance is authoritative; pickup and drop are filled from the route." /><Select id="operationalStatus" label="Status" options={[{ value: 'planned', label: 'Planned' }, { value: 'in_progress', label: 'In progress' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }]} value={form.operationalStatus || 'planned'} onChange={(event) => update('operationalStatus', event.target.value)} hint="Only completed trips are eligible for invoicing." /><div className="form-grid"><Textarea id="pickupLocation" label="Pickup" required value={form.pickupLocation} onChange={(event) => update('pickupLocation', event.target.value)} /><Textarea id="dropLocation" label="Drop" required value={form.dropLocation} onChange={(event) => update('dropLocation', event.target.value)} /></div><div className="km-preview"><span>Route distance</span><strong>{selectedRoute?.expectedDistanceKm ? `${selectedRoute.expectedDistanceKm} km` : '--'}</strong><small>The backend resolves and stores this distance independently of the client.</small></div><div className="form-grid"><NumberInput id="toll" label="Toll amount" min={0} step="0.01" value={form.toll?.amount || ''} onChange={(event) => setForm((current) => ({ ...current, toll: { ...(current.toll || { amount: 0 }), amount: Number(event.target.value) } }))} /><TextInput id="tollReference" label="Toll reference" value={form.toll?.reference || ''} onChange={(event) => setForm((current) => ({ ...current, toll: { ...(current.toll || { amount: 0 }), reference: event.target.value } }))} /></div><Textarea id="notes" label="Notes" value={form.notes || ''} onChange={(event) => update('notes', event.target.value)} /></div></Card><div className="form-actions">{editing && <Button type="button" variant="danger" icon={<Trash2 size={16} />} onClick={() => setConfirmingDelete(true)}>Delete trip</Button>}<Button type="button" variant="secondary" onClick={() => navigate('/trips')}>Cancel</Button><Button type="submit" loading={saving} icon={<Save size={16} />}>{editing ? 'Save changes' : 'Record trip'}</Button></div></form><ConfirmationDialog open={confirmingDelete} title="Delete trip" message={form.operationalStatus === 'completed' ? 'This trip is marked completed. Set its status to Cancelled before it can be deleted.' : 'This will remove the trip. This cannot be undone.'} confirmLabel="Delete trip" loading={deleting} onConfirm={handleDelete} onCancel={() => setConfirmingDelete(false)} /></div>; }
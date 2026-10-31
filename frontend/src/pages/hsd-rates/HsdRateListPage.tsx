import { Fuel, Plus } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card } from '@/components/common';
import { DataTable, type DataTableColumn } from '@/components/tables';
import { DateInput, NumberInput, Textarea } from '@/components/forms';
import { hsdRatesApi } from '@/services/hsdRatesApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { notify } from '@/lib/toast';
import { money } from '@/lib/financial';
import type { HsdRate } from '@/types';

const decimalText = (value: HsdRate['ratePerLitre']) => (typeof value === 'object' && value ? Number(value.$numberDecimal ?? 0) : Number(value ?? 0));

export function HsdRateListPage() {
  const queryClient = useQueryClient();
  const [ratePerLitre, setRatePerLitre] = useState(0);
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const ratesQuery = useQuery({ queryKey: ['hsd-rates'], queryFn: () => hsdRatesApi.list({ page: 1, limit: 50 }) });
  const activeQuery = useQuery({ queryKey: ['hsd-rates-active'], queryFn: () => hsdRatesApi.getEffective() });

  const createMutation = useMutation({
    mutationFn: () => hsdRatesApi.create({ ratePerLitre, effectiveFrom: new Date(`${effectiveFrom}T00:00:00.000Z`).toISOString(), notes: notes || undefined }),
    onSuccess: () => {
      notify.success('HSD rate recorded.');
      setRatePerLitre(0); setNotes('');
      void queryClient.invalidateQueries({ queryKey: ['hsd-rates'] });
      void queryClient.invalidateQueries({ queryKey: ['hsd-rates-active'] });
    },
    onError: (caught) => setError(getApiErrorMessage(caught)),
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (ratePerLitre <= 0) { setError('Rate per litre must be greater than zero.'); return; }
    createMutation.mutate();
  }

  const columns = useMemo<DataTableColumn<HsdRate>[]>(() => [
    { key: 'effectiveFrom', header: 'Effective from', render: (rate) => new Date(rate.effectiveFrom).toLocaleDateString('en-IN') },
    { align: 'right', key: 'rate', header: 'Rate per litre', render: (rate) => money.format(decimalText(rate.ratePerLitre)) },
    { key: 'notes', header: 'Notes', render: (rate) => rate.notes || <span className="muted">Not set</span> },
  ], []);

  return <div className="vehicle-page">
    <div className="page-heading"><div><p className="eyebrow">Billing configuration</p><h1>HSD rate</h1><p className="muted">Global diesel rate applied to every firm and vehicle. New invoices use the rate effective on each trip's date; contracts without a matching global rate fall back to their own configured rate.</p></div></div>
    {error && <Alert tone="error" title="Unable to save rate">{error}</Alert>}
    {activeQuery.data && <div className="km-preview"><span>Currently active rate</span><strong>{money.format(decimalText(activeQuery.data.ratePerLitre))}/L</strong><small>Effective from {new Date(activeQuery.data.effectiveFrom).toLocaleDateString('en-IN')}</small></div>}

    <Card title="Record a rate change" description="A new entry takes effect from its date onward; it does not alter historical invoices already generated.">
      <form onSubmit={submit} className="form-grid">
        <NumberInput id="ratePerLitre" label="Rate per litre" required min={0.01} step="0.01" value={ratePerLitre || ''} onChange={(event) => setRatePerLitre(Number(event.target.value))} />
        <DateInput id="effectiveFrom" label="Effective from" required value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
        <Textarea id="notes" label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
        <div className="form-actions"><Button type="submit" loading={createMutation.isPending} icon={<Plus size={16} />}>Add rate</Button></div>
      </form>
    </Card>

    <Card className="vehicle-list-card" title="Rate history">
      <DataTable rows={ratesQuery.data?.data ?? []} columns={columns} getRowKey={(rate) => rate._id} loading={ratesQuery.isLoading}
        empty={<div className="table-empty"><span className="empty-icon"><Fuel size={20} /></span><strong>No HSD rates recorded yet</strong><p>Add the current diesel rate to start billing trips against the global rate.</p></div>} />
    </Card>
  </div>;
}

import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Badge, Button, Card, LoadingSpinner } from '@/components/common';
import { DateInput, NumberInput, Select, TextInput } from '@/components/forms';
import { salaryApi } from '@/services/salaryApi';
import { driverAdvancesApi } from '@/services/driverAdvancesApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { notify } from '@/lib/toast';
import { money } from '@/lib/financial';
import type { SalaryPaymentMode } from '@/types';

const decimalText = (value: unknown) => (typeof value === 'object' && value ? Number((value as { $numberDecimal?: string }).$numberDecimal ?? 0) : Number(value ?? 0));

export function SalaryDetailsPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deductionAmount, setDeductionAmount] = useState(0);
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMode, setPaymentMode] = useState<SalaryPaymentMode>('cash');
  const [paymentReference, setPaymentReference] = useState('');

  const salaryQuery = useQuery({ queryKey: ['salary', id], queryFn: () => salaryApi.get(id), enabled: Boolean(id) });
  const outstandingDriverId = typeof salaryQuery.data?.record.driverId === 'object' ? salaryQuery.data.record.driverId._id : salaryQuery.data?.record.driverId;
  const outstandingQuery = useQuery({
    queryKey: ['driver-advances-outstanding', outstandingDriverId],
    queryFn: () => driverAdvancesApi.outstandingTotal(outstandingDriverId as string),
    enabled: Boolean(outstandingDriverId),
  });

  const deductionMutation = useMutation({
    mutationFn: () => salaryApi.applyDeduction(id, deductionAmount),
    onSuccess: ({ deduction }) => {
      notify.success(`Applied ${money.format(deduction.applied)}${deduction.carriedForward > 0 ? `; ${money.format(deduction.carriedForward)} carried forward` : ''}.`);
      void queryClient.invalidateQueries({ queryKey: ['salary', id] });
      void queryClient.invalidateQueries({ queryKey: ['driver-advances-outstanding'] });
    },
    onError: (caught) => notify.error(caught),
  });

  const markPaidMutation = useMutation({
    mutationFn: () => salaryApi.markPaid(id, { paidOn: new Date(`${paidOn}T00:00:00.000Z`).toISOString(), paymentMode, paymentReference: paymentReference || undefined }),
    onSuccess: () => {
      notify.success('Marked as paid.');
      void queryClient.invalidateQueries({ queryKey: ['salary', id] });
    },
    onError: (caught) => notify.error(caught),
  });

  async function submitDeduction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (deductionAmount < 0) { notify.error('Deduction amount cannot be negative.'); return; }
    deductionMutation.mutate();
  }

  if (salaryQuery.isLoading) return <div className="route-loading"><LoadingSpinner label="Loading payroll record" /></div>;
  if (salaryQuery.error || !salaryQuery.data) return <div className="vehicle-page"><Alert tone="error" title="Payroll record unavailable">{getApiErrorMessage(salaryQuery.error)}</Alert><Button variant="secondary" onClick={() => navigate('/salary')}>Back to payroll</Button></div>;

  const { record, recoveries } = salaryQuery.data;
  const driver = typeof record.driverId === 'object' ? record.driverId : null;
  const isPaid = record.paymentStatus === 'paid';

  return <div className="vehicle-page">
    <div className="page-heading"><div><Link className="back-link" to="/salary"><ArrowLeft size={15} /> Payroll</Link><p className="eyebrow">Driver settlement</p><h1>{driver?.name ?? 'Driver'} — {record.month}/{record.year}</h1><p className="muted">{record.daysWorked} days worked at {money.format(decimalText(record.dailyWageRate))}/day</p></div><Badge tone={isPaid ? 'success' : 'warning'}>{record.paymentStatus}</Badge></div>

    <div className="detail-grid">
      <Card title="Wage breakdown"><div className="detail-list">
        <div><span>Gross wages</span><strong>{money.format(decimalText(record.grossWages))}</strong></div>
        <div><span>Advance deduction</span><strong>{money.format(decimalText(record.advanceDeduction))}</strong></div>
        <div><span>Other deductions</span><strong>{money.format(decimalText(record.otherDeductions))}</strong></div>
        <div><span>Net payable</span><strong>{money.format(decimalText(record.netPayable))}</strong></div>
      </div></Card>

      <Card title="Outstanding advance balance">
        <div className="km-preview"><span>Driver's total outstanding</span><strong>{outstandingQuery.data ? money.format(outstandingQuery.data.outstandingAmount) : '...'}</strong><small>Across all advances for this driver, not just this payroll cycle.</small></div>
      </Card>
    </div>

    {!isPaid && <Card title="Apply advance deduction" description="Enter the amount to recover. It is capped at the outstanding advance balance and the available net wage; any remainder carries forward.">
      <form onSubmit={submitDeduction} className="form-grid">
        <NumberInput id="deductionAmount" label="Deduction amount" min={0} step="0.01" value={deductionAmount || ''} onChange={(event) => setDeductionAmount(Number(event.target.value))} />
        <div className="form-actions"><Button type="submit" loading={deductionMutation.isPending}>Apply deduction</Button></div>
      </form>
    </Card>}

    {recoveries.length > 0 && <Card title="Recovery ledger for this payroll"><div className="table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Advance</th><th>Amount</th></tr></thead><tbody>
      {recoveries.map((entry) => <tr key={entry._id}><td>{new Date(entry.date).toLocaleDateString('en-IN')}</td><td>{entry.advanceId}</td><td>{money.format(decimalText(entry.amount))}</td></tr>)}
    </tbody></table></div></Card>}

    {!isPaid ? <Card title="Mark as paid"><form onSubmit={(event) => { event.preventDefault(); markPaidMutation.mutate(); }} className="form-grid">
      <DateInput id="paidOn" label="Payment date" required value={paidOn} onChange={(event) => setPaidOn(event.target.value)} />
      <Select id="paymentMode" label="Payment mode" options={[{ value: 'cash', label: 'Cash' }, { value: 'bank_transfer', label: 'Bank transfer' }, { value: 'cheque', label: 'Cheque' }, { value: 'other', label: 'Other' }]} value={paymentMode} onChange={(event) => setPaymentMode(event.target.value as SalaryPaymentMode)} />
      <TextInput id="paymentReference" label="Reference" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} />
      <div className="form-actions"><Button type="submit" loading={markPaidMutation.isPending} icon={<CheckCircle2 size={16} />}>Mark as paid</Button></div>
    </form></Card> : <Alert tone="success" title="Paid">Paid on {record.paidOn ? new Date(record.paidOn).toLocaleDateString('en-IN') : '-'}{record.paymentMode ? ` via ${record.paymentMode}` : ''}{record.paymentReference ? ` (ref ${record.paymentReference})` : ''}.</Alert>}
  </div>;
}

import { ArrowLeft, Save } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Card } from '@/components/common';
import { DateInput, NumberInput, Select, TextInput, Textarea } from '@/components/forms';
import { FirmSelector } from '@/components/business';
import { billingApi, type Invoice, type PaymentMethod } from '@/services/billingApi';
import { paymentsApi } from '@/services/paymentsApi';
import { firmsApi } from '@/services/firmsApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { notify } from '@/lib/toast';
import { money } from '@/lib/financial';
import type { Firm } from '@/types';

const methodOptions: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'other', label: 'Other' },
];

export function PaymentFormPage() {
  const navigate = useNavigate();
  const [firms, setFirms] = useState<Firm[]>([]);
  const [firmId, setFirmId] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { firmsApi.list({ page: 1, limit: 100, isActive: true }).then((page) => setFirms(page.data)).catch(() => undefined); }, []);

  // Only finalized invoices with an outstanding balance can be settled.
  useEffect(() => {
    if (!firmId) { setInvoices([]); return; }
    let cancelled = false;
    setInvoicesLoading(true);
    billingApi.listInvoices({ page: 1, limit: 100, firmId, status: 'finalized' })
      .then((page) => { if (!cancelled) setInvoices(page.data.filter((invoice) => (invoice.outstandingAmount ?? 0) > 0)); })
      .catch((caught) => { if (!cancelled) setError(getApiErrorMessage(caught)); })
      .finally(() => { if (!cancelled) setInvoicesLoading(false); });
    return () => { cancelled = true; };
  }, [firmId]);

  const selectedInvoice = useMemo(() => invoices.find((invoice) => invoice._id === invoiceId), [invoiceId, invoices]);
  const invoiceOptions = useMemo(() => invoices.map((invoice) => ({
    value: invoice._id,
    label: `${invoice.invoiceNumber ?? `${invoice.month}/${invoice.year}`} — outstanding ${money.format(invoice.outstandingAmount ?? 0)}`,
  })), [invoices]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (!firmId || !invoiceId || amount <= 0) { setError('Firm, invoice, and a positive amount are required.'); return; }
    if (selectedInvoice && amount > (selectedInvoice.outstandingAmount ?? 0)) { setError('Amount cannot exceed the outstanding balance for this invoice.'); return; }
    setSaving(true);
    try {
      await paymentsApi.create({
        invoiceId, firmId, amount,
        paymentDate: new Date(`${paymentDate}T00:00:00.000Z`).toISOString(),
        paymentMethod, referenceNumber: referenceNumber || undefined, notes: notes || undefined,
      });
      notify.success('Payment recorded.');
      navigate('/payments');
    } catch (caught) { setError(getApiErrorMessage(caught)); notify.error(caught); } finally { setSaving(false); }
  }

  return <div className="vehicle-page">
    <div className="page-heading"><div><Link className="back-link" to="/payments"><ArrowLeft size={15} /> Payments</Link><p className="eyebrow">Billing management</p><h1>Record payment</h1><p className="muted">Payments can only be recorded against finalized invoices with an outstanding balance.</p></div></div>
    {error && <Alert tone="error" title="Unable to save payment">{error}</Alert>}
    <form onSubmit={submit} className="vehicle-form-grid">
      <Card title="Invoice" description="Select the firm to see its finalized, unsettled invoices."><div className="form-grid">
        <FirmSelector value={firmId} options={firms.map((firm) => ({ value: firm._id, label: firm.name }))} onChange={(value) => { setFirmId(value); setInvoiceId(''); }} />
        <Select id="invoiceId" label="Invoice" options={invoiceOptions} value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)} disabled={!firmId || invoicesLoading} placeholder={!firmId ? 'Select a firm first' : invoicesLoading ? 'Loading invoices...' : invoiceOptions.length === 0 ? 'No outstanding invoices for this firm' : 'Select invoice'} />
      </div>
      {selectedInvoice && <div className="km-preview"><span>Outstanding balance</span><strong>{money.format(selectedInvoice.outstandingAmount ?? 0)}</strong><small>Grand total {money.format(selectedInvoice.summary.totalAmount)} · already paid {money.format(selectedInvoice.totalPaid ?? 0)}</small></div>}
      </Card>
      <Card title="Payment details"><div className="form-grid">
        <NumberInput id="amount" label="Amount received" required min={0.01} step="0.01" value={amount || ''} onChange={(event) => setAmount(Number(event.target.value))} />
        <DateInput id="paymentDate" label="Payment date" required value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
        <Select id="paymentMethod" label="Method" options={methodOptions} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)} />
        <TextInput id="referenceNumber" label="Reference / cheque number" value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} />
      </div>
      <Textarea id="notes" label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Card>
      <div className="form-actions"><Button type="button" variant="secondary" onClick={() => navigate('/payments')}>Cancel</Button><Button type="submit" loading={saving} icon={<Save size={16} />}>Record payment</Button></div>
    </form>
  </div>;
}

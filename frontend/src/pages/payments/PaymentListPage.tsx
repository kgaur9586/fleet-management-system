import { Plus, RefreshCw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Badge, Button, Card } from '@/components/common';
import { DataTable, type DataTableColumn } from '@/components/tables';
import { Select } from '@/components/forms';
import { getApiErrorMessage } from '@/services/apiClient';
import { useActiveFirmsQuery } from '@/services/billingQueries';
import { paymentsApi } from '@/services/paymentsApi';
import { useQuery } from '@tanstack/react-query';
import { money } from '@/lib/financial';
import type { Firm, Payment } from '@/types';

const methodLabel: Record<Payment['paymentMethod'], string> = { cash: 'Cash', bank_transfer: 'Bank transfer', cheque: 'Cheque', upi: 'UPI', other: 'Other' };

export function PaymentListPage() {
  const navigate = useNavigate();
  const [firmId, setFirmId] = useState(''); const [page, setPage] = useState(1);
  const firmsQuery = useActiveFirmsQuery();
  const paymentsQuery = useQuery({
    queryKey: ['payments', { firmId, page }],
    queryFn: () => paymentsApi.list({ page, limit: 10, firmId: firmId || undefined }),
  });
  const result = paymentsQuery.data ?? { data: [], meta: { total: 0, page, limit: 10, totalPages: 0 } };
  const firms = firmsQuery.data?.data ?? [];
  const error = paymentsQuery.error || firmsQuery.error;

  const columns = useMemo<DataTableColumn<Payment>[]>(() => [
    { key: 'date', header: 'Date', render: (payment) => new Date(payment.paymentDate).toLocaleDateString('en-IN') },
    { key: 'invoice', header: 'Invoice', render: (payment) => typeof payment.invoiceId === 'object' ? payment.invoiceId.invoiceNumber ?? `${payment.invoiceId.month}/${payment.invoiceId.year}` : payment.invoiceId },
    { key: 'firm', header: 'Firm', render: (payment) => typeof payment.firmId === 'object' ? payment.firmId.billingName ?? payment.firmId.name : payment.firmId },
    { key: 'amount', header: 'Amount', render: (payment) => money.format(payment.amount) },
    { key: 'method', header: 'Method', render: (payment) => methodLabel[payment.paymentMethod] },
    { key: 'reference', header: 'Reference', render: (payment) => payment.referenceNumber || <span className="muted">Not set</span> },
    { key: 'status', header: 'Status', render: (payment) => <Badge tone={payment.status === 'received' ? 'success' : payment.status === 'cancelled' ? 'danger' : 'warning'}>{payment.status}</Badge> },
  ], []);

  return <div className="vehicle-page billing-page">
    <div className="page-heading"><div><p className="eyebrow">Billing management</p><h1>Payments</h1><p className="muted">Payments received from the factory against finalized invoices.</p></div><Button icon={<Plus size={17} />} onClick={() => navigate('/payments/new')}>Record payment</Button></div>
    {error && <Alert tone="error" title="Could not load payments" onDismiss={() => void paymentsQuery.refetch()}>{getApiErrorMessage(error)}</Alert>}
    <Card className="vehicle-list-card">
      <div className="vehicle-toolbar">
        <div className="search-field"><Search size={16} /><span className="muted" style={{ fontSize: 12 }}>Filter by firm to narrow the payment ledger.</span></div>
        <div className="filter-controls driver-filter-controls">
          <Select label="Firm" hideLabel options={[{ value: '', label: 'All firms' }, ...firms.map((firm: Firm) => ({ value: firm._id, label: firm.billingName ?? firm.name }))]} value={firmId} onChange={(event) => { setFirmId(event.target.value); setPage(1); }} />
          <Button variant="secondary" icon={<RefreshCw size={15} />} onClick={() => void paymentsQuery.refetch()} aria-label="Refresh payments"><span className="button-label">Refresh</span></Button>
        </div>
      </div>
      <DataTable rows={result.data} columns={columns} getRowKey={(payment) => payment._id} loading={paymentsQuery.isLoading}
        empty={<div className="table-empty"><strong>No payments recorded yet</strong><p>Record a payment once the factory settles a finalized invoice.</p><Button variant="secondary" onClick={() => navigate('/payments/new')}>Record payment</Button></div>}
        page={result.meta.page} totalPages={result.meta.totalPages} onPageChange={setPage} />
    </Card>
  </div>;
}

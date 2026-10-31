import { Plus, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Badge, Button, Card, Modal } from '@/components/common';
import { DataTable, type DataTableColumn } from '@/components/tables';
import { NumberInput, Select } from '@/components/forms';
import { DriverSelector } from '@/components/business';
import { salaryApi } from '@/services/salaryApi';
import { driversApi } from '@/services/driversApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { notify } from '@/lib/toast';
import { money } from '@/lib/financial';
import type { Driver, SalaryRecord } from '@/types';

const decimalText = (value: SalaryRecord['grossWages']) => (typeof value === 'object' && value ? Number(value.$numberDecimal ?? 0) : Number(value ?? 0));
const currentYear = new Date().getFullYear();

export function SalaryListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverId, setDriverId] = useState(''); const [month, setMonth] = useState(''); const [year, setYear] = useState(''); const [page, setPage] = useState(1);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generateDriverId, setGenerateDriverId] = useState('');
  const [generateMonth, setGenerateMonth] = useState(new Date().getMonth() + 1);
  const [generateYear, setGenerateYear] = useState(currentYear);
  const [generateError, setGenerateError] = useState('');

  useEffect(() => { driversApi.list({ page: 1, limit: 100, isActive: true }).then((result) => setDrivers(result.data)).catch(() => undefined); }, []);
  const driverOptions = useMemo(() => drivers.map((driver) => ({ value: driver._id, label: driver.name })), [drivers]);

  const salaryQuery = useQuery({
    queryKey: ['salary', { driverId, month, year, page }],
    queryFn: () => salaryApi.list({ page, limit: 10, driverId: driverId || undefined, month: month ? Number(month) : undefined, year: year ? Number(year) : undefined }),
  });
  const result = salaryQuery.data ?? { data: [], meta: { total: 0, page, limit: 10, totalPages: 0 } };

  const generateMutation = useMutation({
    mutationFn: () => salaryApi.generate({ driverId: generateDriverId, month: generateMonth, year: generateYear }),
    onSuccess: (record) => {
      notify.success('Payroll generated.');
      setShowGenerate(false);
      void queryClient.invalidateQueries({ queryKey: ['salary'] });
      navigate(`/salary/${record._id}`);
    },
    onError: (caught) => setGenerateError(getApiErrorMessage(caught)),
  });

  async function submitGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setGenerateError('');
    if (!generateDriverId) { setGenerateError('Select a driver.'); return; }
    generateMutation.mutate();
  }

  const columns = useMemo<DataTableColumn<SalaryRecord>[]>(() => [
    { key: 'period', header: 'Period', render: (record) => `${record.month}/${record.year}` },
    { key: 'driver', header: 'Driver', render: (record) => typeof record.driverId === 'object' ? record.driverId.name : record.driverId },
    { align: 'right', key: 'days', header: 'Days worked', render: (record) => record.daysWorked },
    { align: 'right', key: 'gross', header: 'Gross wages', render: (record) => money.format(decimalText(record.grossWages)) },
    { align: 'right', key: 'deduction', header: 'Advance deducted', render: (record) => money.format(decimalText(record.advanceDeduction)) },
    { align: 'right', key: 'net', header: 'Net payable', render: (record) => <strong>{money.format(decimalText(record.netPayable))}</strong> },
    { key: 'status', header: 'Status', render: (record) => <Badge tone={record.paymentStatus === 'paid' ? 'success' : 'warning'}>{record.paymentStatus}</Badge> },
    { key: 'actions', header: '', render: (record) => <Button variant="ghost" onClick={() => navigate(`/salary/${record._id}`)}>View</Button> },
  ], [navigate]);

  return <div className="vehicle-page">
    <div className="page-heading"><div><p className="eyebrow">Driver settlement</p><h1>Payroll</h1><p className="muted">One wage per worked day, independent of trip count. Advance recoveries are payroll deductions, never a separate expense.</p></div><Button icon={<Plus size={17} />} onClick={() => setShowGenerate(true)}>Generate payroll</Button></div>
    <Card className="vehicle-list-card">
      <div className="vehicle-toolbar">
        <div className="filter-controls driver-filter-controls">
          <DriverSelector value={driverId} options={driverOptions} onChange={(value) => { setDriverId(value); setPage(1); }} />
          <Select label="Month" hideLabel options={[{ value: '', label: 'All months' }, ...Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: new Date(2000, index, 1).toLocaleString(undefined, { month: 'short' }) }))]} value={month} onChange={(event) => { setMonth(event.target.value); setPage(1); }} />
          <NumberInput label="Year" hideLabel value={year} min={2000} max={2200} placeholder={String(currentYear)} onChange={(event) => { setYear(event.target.value); setPage(1); }} />
          <Button variant="secondary" icon={<RefreshCw size={15} />} onClick={() => void salaryQuery.refetch()} aria-label="Refresh payroll"><span className="button-label">Refresh</span></Button>
        </div>
      </div>
      <DataTable rows={result.data} columns={columns} getRowKey={(record) => record._id} loading={salaryQuery.isLoading}
        empty={<div className="table-empty"><strong>No payroll generated yet</strong><p>Generate a driver's monthly payroll from their assigned trips.</p><Button variant="secondary" onClick={() => setShowGenerate(true)}>Generate payroll</Button></div>}
        page={result.meta.page} totalPages={result.meta.totalPages} onPageChange={setPage} />
    </Card>
    <Modal open={showGenerate} title="Generate payroll" onClose={() => setShowGenerate(false)}>
      {generateError && <Alert tone="error" title="Unable to generate payroll">{generateError}</Alert>}
      <form onSubmit={submitGenerate} className="form-grid">
        <DriverSelector value={generateDriverId} options={driverOptions} onChange={setGenerateDriverId} />
        <Select id="generateMonth" label="Month" options={Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: new Date(2000, index, 1).toLocaleString(undefined, { month: 'long' }) }))} value={String(generateMonth)} onChange={(event) => setGenerateMonth(Number(event.target.value))} />
        <NumberInput id="generateYear" label="Year" min={2000} max={2200} value={generateYear} onChange={(event) => setGenerateYear(Number(event.target.value))} />
        <div className="form-actions"><Button type="button" variant="secondary" onClick={() => setShowGenerate(false)}>Cancel</Button><Button type="submit" loading={generateMutation.isPending}>Generate</Button></div>
      </form>
    </Modal>
  </div>;
}

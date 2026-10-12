import { Plus, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Badge, Button, Card } from '@/components/common';
import { DataTable, type DataTableColumn } from '@/components/tables';
import { DriverSelector } from '@/components/business';
import { driverAdvancesApi } from '@/services/driverAdvancesApi';
import { driversApi } from '@/services/driversApi';
import { getApiErrorMessage } from '@/services/apiClient';
import { money } from '@/lib/financial';
import type { Driver, DriverAdvance } from '@/types';

const decimalText = (value: DriverAdvance['amount']) => (typeof value === 'object' && value ? Number(value.$numberDecimal ?? 0) : Number(value ?? 0));

export function DriverAdvanceListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const driverId = searchParams.get('driverId') ?? '';
  const [drivers, setDrivers] = useState<Driver[]>([]);

  useEffect(() => {
    driversApi.list({ page: 1, limit: 100, isActive: true }).then((page) => setDrivers(page.data)).catch(() => undefined);
  }, []);

  const advancesQuery = useQuery({
    queryKey: ['driver-advances', { driverId }],
    queryFn: () => driverAdvancesApi.list({ page: 1, limit: 50, driverId: driverId || undefined }),
  });
  const outstandingQuery = useQuery({
    queryKey: ['driver-advances-outstanding', driverId],
    queryFn: () => driverAdvancesApi.outstandingTotal(driverId),
    enabled: Boolean(driverId),
  });

  const result = advancesQuery.data ?? { data: [], meta: { total: 0, page: 1, limit: 50, totalPages: 0 } };
  const error = advancesQuery.error;
  const driverOptions = useMemo(() => drivers.map((driver) => ({ value: driver._id, label: driver.name })), [drivers]);

  const columns = useMemo<DataTableColumn<DriverAdvance>[]>(() => [
    { key: 'date', header: 'Date', render: (advance) => new Date(advance.date).toLocaleDateString('en-IN') },
    { key: 'driver', header: 'Driver', render: (advance) => typeof advance.driverId === 'object' ? advance.driverId.name : advance.driverId },
    { key: 'amount', header: 'Advance amount', render: (advance) => money.format(decimalText(advance.amount)) },
    { key: 'outstanding', header: 'Outstanding', render: (advance) => {
      const outstanding = decimalText(advance.outstandingAmount);
      return <Badge tone={outstanding === 0 ? 'success' : 'warning'}>{money.format(outstanding)}</Badge>;
    } },
    { key: 'notes', header: 'Notes', render: (advance) => advance.notes || <span className="muted">Not set</span> },
  ], []);

  return <div className="vehicle-page">
    <div className="page-heading"><div><p className="eyebrow">Driver settlement</p><h1>Driver advances</h1><p className="muted">Advances are recovered only through payroll deductions, never as a separate expense.</p></div><Button icon={<Plus size={17} />} onClick={() => navigate(`/driver-advances/new${driverId ? `?driverId=${driverId}` : ''}`)}>Record advance</Button></div>
    {error && <Alert tone="error" title="Could not load advances" onDismiss={() => void advancesQuery.refetch()}>{getApiErrorMessage(error)}</Alert>}
    {driverId && outstandingQuery.data && <div className="km-preview"><span>Outstanding balance for selected driver</span><strong>{money.format(outstandingQuery.data.outstandingAmount)}</strong></div>}
    <Card className="vehicle-list-card">
      <div className="vehicle-toolbar">
        <div className="filter-controls driver-filter-controls">
          <DriverSelector value={driverId} options={driverOptions} onChange={(value) => setSearchParams(value ? { driverId: value } : {})} />
          <Button variant="secondary" icon={<RefreshCw size={15} />} onClick={() => void advancesQuery.refetch()} aria-label="Refresh advances"><span className="button-label">Refresh</span></Button>
        </div>
      </div>
      <DataTable rows={result.data} columns={columns} getRowKey={(advance) => advance._id} loading={advancesQuery.isLoading}
        empty={<div className="table-empty"><strong>No advances recorded yet</strong><p>Record an advance when the owner pays a driver ahead of payroll.</p><Button variant="secondary" onClick={() => navigate('/driver-advances/new')}>Record advance</Button></div>} />
    </Card>
  </div>;
}

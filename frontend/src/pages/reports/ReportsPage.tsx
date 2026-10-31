import { BarChart3, Building2, ClipboardList, Fuel, Gauge, PiggyBank, Receipt, Route as RouteIcon, UsersRound, Wrench } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Badge, Card, Tabs } from '@/components/common';
import { DataTable, type DataTableColumn } from '@/components/tables';
import { Select, NumberInput } from '@/components/forms';
import { VehicleSelector, DriverSelector, DateRangeSelector } from '@/components/business';
import { getApiErrorMessage } from '@/services/apiClient';
import { reportsApi, type BillRegisterRow, type FirmBillingRow, type VehicleRevenueRow, type ExpenseSummaryRow, type TripKmRow, type FuelVsHsdRow, type TollVarianceRow, type MaintenanceHistoryRow, type DocumentExpiryRow, type DriverWageSummaryRow } from '@/services/reportsApi';
import { useActiveFirmsQuery, useActiveVehiclesQuery } from '@/services/billingQueries';
import { driversApi } from '@/services/driversApi';
import { money } from '@/lib/financial';
import type { Firm } from '@/types';

type ReportTab = 'vehicle' | 'firm' | 'expense' | 'register' | 'receivables' | 'trip-km' | 'fuel-hsd' | 'toll' | 'maintenance' | 'documents' | 'wages';

const tabs: Array<{ key: ReportTab; label: string; icon: ReactElement }> = [
  { key: 'vehicle', label: 'Vehicle revenue & margin', icon: <BarChart3 size={16} /> },
  { key: 'firm', label: 'Firm billing & payment', icon: <Building2 size={16} /> },
  { key: 'expense', label: 'Expense summary', icon: <PiggyBank size={16} /> },
  { key: 'register', label: 'Bill register', icon: <ClipboardList size={16} /> },
  { key: 'receivables', label: 'Firm receivables', icon: <Receipt size={16} /> },
  { key: 'trip-km', label: 'Trip count & KM', icon: <RouteIcon size={16} /> },
  { key: 'fuel-hsd', label: 'Fuel vs contractual HSD', icon: <Fuel size={16} /> },
  { key: 'toll', label: 'Toll variance', icon: <Gauge size={16} /> },
  { key: 'maintenance', label: 'Maintenance history', icon: <Wrench size={16} /> },
  { key: 'documents', label: 'Document expiry', icon: <ClipboardList size={16} /> },
  { key: 'wages', label: 'Driver wage summary', icon: <UsersRound size={16} /> },
];

const statusTone = (status: string) => status === 'finalized' ? 'success' : status === 'approved' ? 'info' : status === 'review' ? 'info' : 'warning';

const monthOptions = Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: new Date(2000, index, 1).toLocaleString(undefined, { month: 'long' }) }));

function MonthYearFilter({ month, year, onMonth, onYear }: { month: number; year: number; onMonth: (value: number) => void; onYear: (value: number) => void }) {
  return <div className="form-grid billing-form-grid">
    <Select label="Month" options={monthOptions} value={String(month)} onChange={(event) => onMonth(Number(event.target.value))} />
    <NumberInput label="Year" value={year} onChange={(event) => onYear(Number(event.target.value))} />
  </div>;
}

function VehicleRevenueReport() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const query = useQuery({ queryKey: ['reports', 'vehicle-revenue', month, year], queryFn: () => reportsApi.vehicleRevenue(month, year) });
  const columns: DataTableColumn<VehicleRevenueRow>[] = [
    { key: 'registrationNumber', header: 'Vehicle', render: (row) => <div><strong>{row.registrationNumber}</strong>{row.vehicleType && <small> · {row.vehicleType}</small>}</div> },
    { align: 'right', key: 'tripCount', header: 'Trips', render: (row) => row.tripCount },
    { align: 'right', key: 'revenue', header: 'Revenue (billed)', render: (row) => money.format(row.revenue) },
    { align: 'right', key: 'expenses', header: 'Actual expenses', render: (row) => money.format(row.expenses) },
    { align: 'right', key: 'margin', header: 'Margin', render: (row) => <strong className={row.margin < 0 ? 'text-danger' : undefined}>{money.format(row.margin)}</strong> },
  ];
  return <Card title="Vehicle-wise revenue, expense & contribution" description="Billed revenue comes from finalized invoices; expenses are actual recorded costs for the vehicle in the same month.">
    <MonthYearFilter month={month} year={year} onMonth={setMonth} onYear={setYear} />
    {query.error && <Alert tone="error" title="Could not load report">{getApiErrorMessage(query.error)}</Alert>}
    <DataTable rows={query.data ?? []} columns={columns} getRowKey={(row) => row.vehicleId} loading={query.isLoading} empty={<p className="muted">No billed revenue or expenses recorded for this month.</p>} />
  </Card>;
}

function FirmBillingReport() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const query = useQuery({ queryKey: ['reports', 'firm-billing', month, year], queryFn: () => reportsApi.firmBilling(month, year) });
  const columns: DataTableColumn<FirmBillingRow>[] = [
    { key: 'firmName', header: 'Firm', render: (row) => row.firmName },
    { align: 'right', key: 'invoiceCount', header: 'Bills', render: (row) => row.invoiceCount },
    { align: 'right', key: 'totalBilled', header: 'Total billed', render: (row) => money.format(row.totalBilled) },
    { align: 'right', key: 'totalReceived', header: 'Total received', render: (row) => money.format(row.totalReceived) },
    { align: 'right', key: 'totalOutstanding', header: 'Outstanding', render: (row) => <strong>{money.format(row.totalOutstanding)}</strong> },
  ];
  return <Card title="Firm-wise monthly billing & payment" description="Only finalized invoices are counted as billed for the month.">
    <MonthYearFilter month={month} year={year} onMonth={setMonth} onYear={setYear} />
    {query.error && <Alert tone="error" title="Could not load report">{getApiErrorMessage(query.error)}</Alert>}
    <DataTable rows={query.data ?? []} columns={columns} getRowKey={(row) => row.firmId} loading={query.isLoading} empty={<p className="muted">No finalized bills for this month.</p>} />
  </Card>;
}

function ExpenseSummaryReport() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const query = useQuery({ queryKey: ['reports', 'expense-summary', month, year], queryFn: () => reportsApi.expenseSummary(month, year) });
  const columns: DataTableColumn<ExpenseSummaryRow>[] = [
    { key: 'category', header: 'Category', render: (row) => <span className="capitalize">{row.category.replace(/_/g, ' ')}</span> },
    { align: 'right', key: 'count', header: 'Entries', render: (row) => row.count },
    { align: 'right', key: 'total', header: 'Total', render: (row) => money.format(row.total) },
  ];
  return <Card title="Monthly expense summary by category" description="All recorded expenses for the selected month, grouped by category.">
    <MonthYearFilter month={month} year={year} onMonth={setMonth} onYear={setYear} />
    {query.error && <Alert tone="error" title="Could not load report">{getApiErrorMessage(query.error)}</Alert>}
    <DataTable rows={query.data?.categories ?? []} columns={columns} getRowKey={(row) => row.category} loading={query.isLoading} empty={<p className="muted">No expenses recorded for this month.</p>} />
    {query.data && <div className="km-preview"><span>Grand total</span><strong>{money.format(query.data.grandTotal)}</strong></div>}
  </Card>;
}

function BillRegisterReport() {
  const [firmId, setFirmId] = useState('');
  const [status, setStatus] = useState('');
  const firmsQuery = useActiveFirmsQuery();
  const query = useQuery({ queryKey: ['reports', 'bill-register', firmId, status], queryFn: () => reportsApi.billRegister({ firmId: firmId || undefined, status: status || undefined }) });
  const columns: DataTableColumn<BillRegisterRow>[] = [
    { key: 'invoiceNumber', header: 'Bill number', render: (row) => row.invoiceNumber ?? <em>Not yet issued</em> },
    { key: 'firmName', header: 'Firm', render: (row) => row.firmName },
    { key: 'registrationNumber', header: 'Vehicle', render: (row) => row.registrationNumber },
    { key: 'period', header: 'Period', render: (row) => `${row.month}/${row.year}` },
    { key: 'status', header: 'Status', render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
    { align: 'right', key: 'totalAmount', header: 'Total', render: (row) => money.format(row.totalAmount) },
    { align: 'right', key: 'totalPaid', header: 'Paid', render: (row) => money.format(row.totalPaid) },
    { align: 'right', key: 'outstandingAmount', header: 'Outstanding', render: (row) => money.format(row.outstandingAmount) },
  ];
  return <Card title="Bill register" description="Every bill across all firms and vehicles, filterable by firm and lifecycle status.">
    <div className="form-grid billing-form-grid">
      <Select label="Firm" placeholder="All firms" options={(firmsQuery.data?.data ?? []).map((firm: Firm) => ({ value: firm._id, label: firm.billingName ?? firm.name }))} value={firmId} onChange={(event) => setFirmId(event.target.value)} />
      <Select label="Status" placeholder="All statuses" options={[{ value: 'draft', label: 'Draft' }, { value: 'approved', label: 'Approved' }, { value: 'finalized', label: 'Finalized' }]} value={status} onChange={(event) => setStatus(event.target.value)} />
    </div>
    {query.error && <Alert tone="error" title="Could not load report">{getApiErrorMessage(query.error)}</Alert>}
    <DataTable rows={query.data ?? []} columns={columns} getRowKey={(row) => row.invoiceId} loading={query.isLoading} empty={<p className="muted">No bills match these filters.</p>} />
  </Card>;
}

function FirmReceivablesReport() {
  const [firmId, setFirmId] = useState('');
  const firmsQuery = useActiveFirmsQuery();
  const query = useQuery({ queryKey: ['reports', 'firm-receivables', firmId], queryFn: () => reportsApi.firmReceivables(firmId), enabled: Boolean(firmId) });
  return <Card title="Firm-wise receivables & payment history" description="Pick a firm to see every finalized bill raised to it and its full payment history.">
    <div className="form-grid billing-form-grid">
      <Select label="Firm" placeholder="Select a firm" options={(firmsQuery.data?.data ?? []).map((firm: Firm) => ({ value: firm._id, label: firm.billingName ?? firm.name }))} value={firmId} onChange={(event) => setFirmId(event.target.value)} />
    </div>
    {query.error && <Alert tone="error" title="Could not load report">{getApiErrorMessage(query.error)}</Alert>}
    {!firmId && <p className="muted">Select a firm above to view its receivables.</p>}
    {query.data && <>
      <div className="billing-summary-strip billing-review-summary">
        <div><span>Total billed</span><strong>{money.format(query.data.totals.totalBilled)}</strong></div>
        <div><span>Total received</span><strong>{money.format(query.data.totals.totalReceived)}</strong></div>
        <div><span>Outstanding</span><strong>{money.format(query.data.totals.totalOutstanding)}</strong></div>
      </div>
      <h3 className="report-subheading">Bills</h3>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Bill number</th><th>Vehicle</th><th>Period</th><th className="num">Total</th><th className="num">Paid</th><th className="num">Outstanding</th></tr></thead><tbody>
        {query.data.invoices.map((invoice) => <tr key={invoice.invoiceId}><td>{invoice.invoiceNumber ?? '-'}</td><td>{invoice.registrationNumber}</td><td>{invoice.month}/{invoice.year}</td><td className="num">{money.format(invoice.totalAmount)}</td><td className="num">{money.format(invoice.totalPaid)}</td><td className="num"><strong>{money.format(invoice.outstandingAmount)}</strong></td></tr>)}
      </tbody></table></div>
      <h3 className="report-subheading">Payment history</h3>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Date</th><th className="num">Amount</th><th>Method</th><th>Reference</th></tr></thead><tbody>
        {query.data.payments.map((payment) => <tr key={payment.paymentId}><td>{new Date(payment.paymentDate).toLocaleDateString('en-IN')}</td><td className="num">{money.format(payment.amount)}</td><td>{payment.paymentMethod}</td><td>{payment.referenceNumber ?? '-'}</td></tr>)}
      </tbody></table>{!query.data.payments.length && <p className="muted">No payments recorded yet.</p>}</div>
    </>}
  </Card>;
}

function TripCountKmReport() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const query = useQuery({ queryKey: ['reports', 'trip-km', month, year], queryFn: () => reportsApi.tripCountAndKm(month, year) });
  const columns: DataTableColumn<TripKmRow>[] = [
    { key: 'registrationNumber', header: 'Vehicle', render: (row) => row.registrationNumber },
    { key: 'firmName', header: 'Firm', render: (row) => row.firmName },
    { align: 'right', key: 'tripCount', header: 'Trips', render: (row) => row.tripCount },
    { align: 'right', key: 'totalKm', header: 'Total KM', render: (row) => row.totalKm.toLocaleString(undefined, { maximumFractionDigits: 1 }) },
  ];
  return <Card title="Trip count & KM" description="Operational volume per vehicle and firm for the selected month.">
    <MonthYearFilter month={month} year={year} onMonth={setMonth} onYear={setYear} />
    {query.error && <Alert tone="error" title="Could not load report">{getApiErrorMessage(query.error)}</Alert>}
    <DataTable rows={query.data ?? []} columns={columns} getRowKey={(row) => `${row.vehicleId}-${row.firmId}`} loading={query.isLoading} empty={<p className="muted">No trips recorded for this month.</p>} />
  </Card>;
}

function FuelVsHsdReport() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const query = useQuery({ queryKey: ['reports', 'fuel-vs-hsd', month, year], queryFn: () => reportsApi.fuelVsHsd(month, year) });
  const columns: DataTableColumn<FuelVsHsdRow>[] = [
    { key: 'registrationNumber', header: 'Vehicle', render: (row) => <div><strong>{row.registrationNumber}</strong>{row.vehicleType && <small> · {row.vehicleType}</small>}</div> },
    { align: 'right', key: 'litresPurchased', header: 'Litres purchased', render: (row) => row.litresPurchased.toLocaleString(undefined, { maximumFractionDigits: 1 }) },
    { align: 'right', key: 'actualFuelSpend', header: 'Actual fuel spend', render: (row) => money.format(row.actualFuelSpend) },
    { align: 'right', key: 'billedFuelAmount', header: 'Billed (contractual HSD)', render: (row) => money.format(row.billedFuelAmount) },
    { align: 'right', key: 'variance', header: 'Variance', render: (row) => <strong className={row.variance < 0 ? 'text-danger' : undefined}>{money.format(row.variance)}</strong> },
  ];
  return <Card title="Fuel expense vs contractual HSD" description="Actual fuel purchases recorded as expenses, compared to the fuel reimbursement billed under the contract for the same month. A negative variance means actual spend exceeded what was billed.">
    <MonthYearFilter month={month} year={year} onMonth={setMonth} onYear={setYear} />
    {query.error && <Alert tone="error" title="Could not load report">{getApiErrorMessage(query.error)}</Alert>}
    <DataTable rows={query.data ?? []} columns={columns} getRowKey={(row) => row.vehicleId} loading={query.isLoading} empty={<p className="muted">No fuel expenses or billed fuel amounts for this month.</p>} />
  </Card>;
}

function TollVarianceReport() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const query = useQuery({ queryKey: ['reports', 'toll-variance', month, year], queryFn: () => reportsApi.tollVariance(month, year) });
  const columns: DataTableColumn<TollVarianceRow>[] = [
    { key: 'registrationNumber', header: 'Vehicle', render: (row) => <div><strong>{row.registrationNumber}</strong>{row.vehicleType && <small> · {row.vehicleType}</small>}</div> },
    { align: 'right', key: 'actualToll', header: 'Actual toll paid', render: (row) => money.format(row.actualToll) },
    { align: 'right', key: 'billedToll', header: 'Billed toll', render: (row) => money.format(row.billedToll) },
    { align: 'right', key: 'variance', header: 'Variance', render: (row) => <strong className={row.variance < 0 ? 'text-danger' : undefined}>{money.format(row.variance)}</strong> },
  ];
  return <Card title="Toll expense by vehicle and month" description="Toll amounts recorded on trips compared to the toll amount billed on finalized invoices for the same month.">
    <MonthYearFilter month={month} year={year} onMonth={setMonth} onYear={setYear} />
    {query.error && <Alert tone="error" title="Could not load report">{getApiErrorMessage(query.error)}</Alert>}
    <DataTable rows={query.data ?? []} columns={columns} getRowKey={(row) => row.vehicleId} loading={query.isLoading} empty={<p className="muted">No trip or billed toll amounts for this month.</p>} />
  </Card>;
}

function MaintenanceHistoryReport() {
  const [vehicleId, setVehicleId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const vehiclesQuery = useActiveVehiclesQuery();
  const query = useQuery({ queryKey: ['reports', 'maintenance-history', vehicleId, fromDate, toDate], queryFn: () => reportsApi.maintenanceHistory({ vehicleId: vehicleId || undefined, startDate: fromDate || undefined, endDate: toDate || undefined }) });
  const columns: DataTableColumn<MaintenanceHistoryRow>[] = [
    { key: 'date', header: 'Date', render: (row) => new Date(row.date).toLocaleDateString('en-IN') },
    { key: 'registrationNumber', header: 'Vehicle', render: (row) => row.registrationNumber },
    { key: 'category', header: 'Category', render: (row) => <span className="capitalize">{row.category}</span> },
    { key: 'type', header: 'Type', render: (row) => row.type ?? '-' },
    { key: 'vendor', header: 'Vendor', render: (row) => row.vendor ?? '-' },
    { align: 'right', key: 'amount', header: 'Cost', render: (row) => money.format(row.amount) },
  ];
  return <Card title="Maintenance & repair history" description="Every maintenance and service expense, optionally filtered by vehicle and date range.">
    <div className="form-grid billing-form-grid">
      <VehicleSelector value={vehicleId} options={(vehiclesQuery.data?.data ?? []).map((vehicle) => ({ value: vehicle._id, label: vehicle.registrationNumber }))} onChange={setVehicleId} />
      <DateRangeSelector fromDate={fromDate} toDate={toDate} onFromDateChange={setFromDate} onToDateChange={setToDate} />
    </div>
    {query.error && <Alert tone="error" title="Could not load report">{getApiErrorMessage(query.error)}</Alert>}
    <DataTable rows={query.data ?? []} columns={columns} getRowKey={(row) => row.expenseId} loading={query.isLoading} empty={<p className="muted">No maintenance or service expenses match these filters.</p>} />
  </Card>;
}

const documentStatusTone = (status: DocumentExpiryRow['status']) => status === 'active' ? 'success' : status === 'expiring_soon' ? 'warning' : 'danger';

function DocumentExpiryReport() {
  const [vehicleId, setVehicleId] = useState('');
  const [documentType, setDocumentType] = useState('');
  const vehiclesQuery = useActiveVehiclesQuery();
  const query = useQuery({ queryKey: ['reports', 'document-expiry', vehicleId, documentType], queryFn: () => reportsApi.documentExpiry({ vehicleId: vehicleId || undefined, documentType: documentType || undefined }) });
  const columns: DataTableColumn<DocumentExpiryRow>[] = [
    { key: 'registrationNumber', header: 'Vehicle', render: (row) => row.registrationNumber },
    { key: 'documentType', header: 'Document', render: (row) => <span className="capitalize">{row.documentType}</span> },
    { key: 'documentNumber', header: 'Number', render: (row) => row.documentNumber ?? '-' },
    { key: 'expiryDate', header: 'Expiry date', render: (row) => new Date(row.expiryDate).toLocaleDateString('en-IN') },
    { align: 'right', key: 'daysToExpiry', header: 'Days to expiry', render: (row) => row.isExpired ? `${Math.abs(row.daysToExpiry)} days overdue` : `${row.daysToExpiry} days` },
    { key: 'status', header: 'Status', render: (row) => <Badge tone={documentStatusTone(row.status)}>{row.status.replace('_', ' ')}</Badge> },
  ];
  return <Card title="Vehicle document expiry" description="Every vehicle document with its days-to-expiry and status, optionally filtered by vehicle and document type.">
    <div className="form-grid billing-form-grid">
      <VehicleSelector value={vehicleId} options={(vehiclesQuery.data?.data ?? []).map((vehicle) => ({ value: vehicle._id, label: vehicle.registrationNumber }))} onChange={setVehicleId} />
      <Select label="Document type" placeholder="All types" options={[{ value: 'rc', label: 'RC' }, { value: 'insurance', label: 'Insurance' }, { value: 'permit', label: 'Permit' }, { value: 'fitness', label: 'Fitness' }, { value: 'pollution', label: 'Pollution' }, { value: 'other', label: 'Other' }]} value={documentType} onChange={(event) => setDocumentType(event.target.value)} />
    </div>
    {query.error && <Alert tone="error" title="Could not load report">{getApiErrorMessage(query.error)}</Alert>}
    <DataTable rows={query.data ?? []} columns={columns} getRowKey={(row) => row.documentId} loading={query.isLoading} empty={<p className="muted">No documents match these filters.</p>} />
  </Card>;
}

function DriverWageSummaryReport() {
  const now = new Date();
  const [driverId, setDriverId] = useState('');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const driversQuery = useQuery({ queryKey: ['drivers', { active: true }], queryFn: () => driversApi.list({ page: 1, limit: 100, isActive: true }) });
  const query = useQuery({ queryKey: ['reports', 'driver-wage-summary', driverId, month, year], queryFn: () => reportsApi.driverWageSummary({ driverId: driverId || undefined, month, year }) });
  const columns: DataTableColumn<DriverWageSummaryRow>[] = [
    { key: 'driverName', header: 'Driver', render: (row) => row.driverName },
    { align: 'right', key: 'daysWorked', header: 'Days worked', render: (row) => row.daysWorked },
    { align: 'right', key: 'grossWages', header: 'Gross', render: (row) => money.format(row.grossWages) },
    { align: 'right', key: 'advanceDeduction', header: 'Advance deduction', render: (row) => money.format(row.advanceDeduction) },
    { align: 'right', key: 'otherDeductions', header: 'Other deductions', render: (row) => money.format(row.otherDeductions) },
    { align: 'right', key: 'netPayable', header: 'Net paid', render: (row) => <strong>{money.format(row.netPayable)}</strong> },
    { key: 'paymentStatus', header: 'Status', render: (row) => <Badge tone={row.paymentStatus === 'paid' ? 'success' : 'warning'}>{row.paymentStatus}</Badge> },
  ];
  return <Card title="Driver wage summary" description="Days worked, gross wages, deductions, and net payout per driver for the selected month.">
    <div className="form-grid billing-form-grid">
      <DriverSelector value={driverId} options={(driversQuery.data?.data ?? []).map((driver) => ({ value: driver._id, label: driver.name }))} onChange={setDriverId} />
      <MonthYearFilter month={month} year={year} onMonth={setMonth} onYear={setYear} />
    </div>
    {query.error && <Alert tone="error" title="Could not load report">{getApiErrorMessage(query.error)}</Alert>}
    <DataTable rows={query.data ?? []} columns={columns} getRowKey={(row) => row.salaryRecordId} loading={query.isLoading} empty={<p className="muted">No payroll records for this month.</p>} />
  </Card>;
}

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('vehicle');
  return <div className="vehicle-page billing-page reports-page">
    <div className="page-heading"><div><p className="eyebrow">Intelligence</p><h1>Reports</h1><p className="muted">Owner-facing reports covering revenue, billing, expenses, and receivables.</p></div></div>
    <Tabs label="Reports" tabs={tabs} value={activeTab} onChange={setActiveTab} />
    {activeTab === 'vehicle' && <VehicleRevenueReport />}
    {activeTab === 'firm' && <FirmBillingReport />}
    {activeTab === 'expense' && <ExpenseSummaryReport />}
    {activeTab === 'register' && <BillRegisterReport />}
    {activeTab === 'receivables' && <FirmReceivablesReport />}
    {activeTab === 'trip-km' && <TripCountKmReport />}
    {activeTab === 'fuel-hsd' && <FuelVsHsdReport />}
    {activeTab === 'toll' && <TollVarianceReport />}
    {activeTab === 'maintenance' && <MaintenanceHistoryReport />}
    {activeTab === 'documents' && <DocumentExpiryReport />}
    {activeTab === 'wages' && <DriverWageSummaryReport />}
  </div>;
}

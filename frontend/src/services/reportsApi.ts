import apiClient from './apiClient';
import { toQueryString } from '@/lib/query';

export interface VehicleRevenueRow {
  vehicleId: string;
  registrationNumber: string;
  vehicleType: string | null;
  tripCount: number;
  revenue: number;
  expenses: number;
  margin: number;
}

export interface FirmBillingRow {
  firmId: string;
  firmName: string;
  invoiceCount: number;
  totalBilled: number;
  totalReceived: number;
  totalOutstanding: number;
}

export interface ExpenseSummaryRow {
  category: string;
  total: number;
  count: number;
}

export interface ExpenseSummaryResult {
  categories: ExpenseSummaryRow[];
  grandTotal: number;
}

export interface BillRegisterRow {
  invoiceId: string;
  invoiceNumber: string | null;
  bookNumber: string | null;
  firmName: string;
  registrationNumber: string;
  month: number;
  year: number;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  totalPaid: number;
  outstandingAmount: number;
  generatedAt: string;
  finalizedAt: string | null;
}

export interface FirmReceivablesInvoice {
  invoiceId: string;
  invoiceNumber: string | null;
  bookNumber: string | null;
  registrationNumber: string;
  month: number;
  year: number;
  totalAmount: number;
  totalPaid: number;
  outstandingAmount: number;
  paymentStatus: string;
  finalizedAt: string | null;
}

export interface FirmReceivablesPayment {
  paymentId: string;
  invoiceId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber: string | null;
}

export interface FirmReceivablesResult {
  firm: { _id: string; name: string };
  totals: { totalBilled: number; totalReceived: number; totalOutstanding: number };
  invoices: FirmReceivablesInvoice[];
  payments: FirmReceivablesPayment[];
}

export interface TripKmRow {
  vehicleId: string;
  firmId: string;
  registrationNumber: string;
  firmName: string;
  tripCount: number;
  totalKm: number;
}

export interface FuelVsHsdRow {
  vehicleId: string;
  registrationNumber: string;
  vehicleType: string | null;
  litresPurchased: number;
  actualFuelSpend: number;
  billedFuelAmount: number;
  variance: number;
}

export interface TollVarianceRow {
  vehicleId: string;
  registrationNumber: string;
  vehicleType: string | null;
  actualToll: number;
  billedToll: number;
  variance: number;
}

export interface MaintenanceHistoryRow {
  expenseId: string;
  date: string;
  registrationNumber: string;
  category: string;
  type?: string;
  vendor: string | null;
  amount: number;
  description: string;
}

export interface DocumentExpiryRow {
  documentId: string;
  registrationNumber: string;
  documentType: string;
  documentNumber: string | null;
  expiryDate: string;
  daysToExpiry: number;
  isExpired: boolean;
  status: 'active' | 'expiring_soon' | 'expired';
}

export interface DriverWageSummaryRow {
  salaryRecordId: string;
  driverName: string;
  month: number;
  year: number;
  daysWorked: number;
  grossWages: number;
  advanceDeduction: number;
  otherDeductions: number;
  netPayable: number;
  paymentStatus: string;
  paidOn: string | null;
}

export const reportsApi = {
  vehicleRevenue: (month: number, year: number) =>
    apiClient.get<VehicleRevenueRow[]>(`/reports/vehicle-revenue?${toQueryString({ month, year })}`),
  firmBilling: (month: number, year: number) =>
    apiClient.get<FirmBillingRow[]>(`/reports/firm-billing?${toQueryString({ month, year })}`),
  expenseSummary: (month: number, year: number) =>
    apiClient.get<ExpenseSummaryResult>(`/reports/expense-summary?${toQueryString({ month, year })}`),
  billRegister: (filters: { month?: number; year?: number; firmId?: string; status?: string } = {}) =>
    apiClient.get<BillRegisterRow[]>(`/reports/bill-register?${toQueryString(filters)}`),
  tripCountAndKm: (month: number, year: number) =>
    apiClient.get<TripKmRow[]>(`/reports/trip-km?${toQueryString({ month, year })}`),
  fuelVsHsd: (month: number, year: number) =>
    apiClient.get<FuelVsHsdRow[]>(`/reports/fuel-vs-hsd?${toQueryString({ month, year })}`),
  tollVariance: (month: number, year: number) =>
    apiClient.get<TollVarianceRow[]>(`/reports/toll-variance?${toQueryString({ month, year })}`),
  maintenanceHistory: (filters: { vehicleId?: string; startDate?: string; endDate?: string } = {}) =>
    apiClient.get<MaintenanceHistoryRow[]>(`/reports/maintenance-history?${toQueryString(filters)}`),
  documentExpiry: (filters: { vehicleId?: string; documentType?: string } = {}) =>
    apiClient.get<DocumentExpiryRow[]>(`/reports/document-expiry?${toQueryString(filters)}`),
  driverWageSummary: (filters: { driverId?: string; month?: number; year?: number } = {}) =>
    apiClient.get<DriverWageSummaryRow[]>(`/reports/driver-wage-summary?${toQueryString(filters)}`),
  firmReceivables: (firmId: string) =>
    apiClient.get<FirmReceivablesResult>(`/reports/firm-receivables/${firmId}`),
};

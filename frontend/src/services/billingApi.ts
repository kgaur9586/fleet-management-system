import apiClient from './apiClient';
import { toQueryString } from '@/lib/query';
import type { Page } from '@/types';

export type InvoiceStatus = 'draft' | 'review' | 'approved' | 'finalized';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'cheque' | 'upi' | 'other';

export interface InvoiceSnapshot {
  distanceKm: string;
  contractualAverage: string;
  fuelLitres: string;
  fuelRate: string;
  fuelAmount: string;
  hiringMultiplier: string;
  baseHiringRate: string;
  hiringAmount: string;
  tollAmount: string;
  otherBillableAmount: string;
  totalAmount: string;
}

export interface InvoiceLineItem {
  _id?: string;
  tripId: string;
  tripSnapshot: {
    tripDate: string;
    vehicle: { id: string; registrationNumber: string; vehicleType?: string };
    driver: { id: string; name: string };
    route?: { id: string; name: string; routeCode?: string } | null;
    pickupLocation: string;
    dropLocation: string;
    startKm?: number;
    endKm?: number;
    totalKm: number;
    operationalStatus: string;
    contract: { id: string; name: string };
    contractVersion: { id: string; version?: number };
    distanceKm: string;
    tollAmount: string;
  };
  snapshot: InvoiceSnapshot;
}

export interface InvoiceReopenEntry {
  reopenedAt: string;
  reason: string;
  previousStatus: InvoiceStatus;
  previousInvoiceNumber?: string;
}

export interface InvoiceAuditEntry {
  _id: string;
  action: string;
  reason?: string;
  timestamp: string;
  userId?: { name?: string; email?: string } | string;
}

export interface Invoice {
  _id: string;
  invoiceNumber?: string;
  bookNumber?: string;
  firmId: string | { _id: string; name: string; billingName?: string };
  vehicleId: string | { _id: string; registrationNumber: string; capacity: number };
  month: number;
  year: number;
  status: InvoiceStatus;
  paymentStatus?: 'unpaid' | 'partially_paid' | 'paid';
  totalPaid?: number;
  outstandingAmount?: number;
  reopenHistory?: InvoiceReopenEntry[];
  generatedAt: string;
  approvedAt?: string;
  finalizedAt?: string;
  lineItems: InvoiceLineItem[];
  summary: { vehicleCount: number; tripCount: number; totalDistanceKm: number; fuelAmount: number; hiringAmount: number; tollAmount: number; otherBillableAmount: number; totalAmount: number };
}

export interface PaymentSummary {
  totalInvoiced: number;
  totalReceived: number;
  outstandingAmount: number;
  paymentHistory: Array<{ _id: string; amount: number; paymentDate: string; paymentMethod: PaymentMethod; referenceNumber?: string; invoiceId: { invoiceNumber?: string } }>;
}

export const billingApi = {
  listInvoices: (query: Record<string, unknown> = {}) => apiClient.get<Page<Invoice>>(`/invoices?${toQueryString(query)}`),
  getInvoice: (id: string) => apiClient.get<Invoice>(`/invoices/${id}`),
  generateInvoice: (payload: { firmId: string; vehicleId: string; month: number; year: number; notes?: string; bookNumber?: string }) => apiClient.post<Invoice>('/invoices/generate', payload),
  approveInvoice: (id: string, notes?: string) => apiClient.patch<Invoice>(`/invoices/${id}/approve`, { notes }),
  finalizeInvoice: (id: string, notes?: string) => apiClient.patch<Invoice>(`/invoices/${id}/finalize`, { notes }),
  reopenInvoice: (id: string, reason: string) => apiClient.patch<Invoice>(`/invoices/${id}/reopen`, { reason }),
  getInvoiceHistory: (id: string) => apiClient.get<InvoiceAuditEntry[]>(`/invoices/${id}/history`),
  downloadInvoicePdf: (id: string) => apiClient.download(`/invoices/${id}/pdf`),
  getPaymentSummary: (query: Record<string, unknown> = {}) => apiClient.get<PaymentSummary>(`/payments/summary?${toQueryString(query)}`),
};

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { billingApi, type Invoice } from './billingApi';
import { firmsApi } from './firmsApi';
import { vehiclesApi } from './vehiclesApi';
import { getDashboardSnapshot } from './dashboardApi';

export const billingKeys = {
  all: ['billing'] as const,
  invoices: (filters: Record<string, unknown>) => [...billingKeys.all, 'invoices', filters] as const,
  invoice: (id: string) => [...billingKeys.all, 'invoice', id] as const,
  preview: (id: string) => [...billingKeys.all, 'preview', id] as const,
  paymentSummary: (month: number, year: number) => [...billingKeys.all, 'payments', month, year] as const,
  overview: (month: number, year: number) => [...billingKeys.all, 'overview', month, year] as const,
  auditHistory: (id: string) => [...billingKeys.all, 'history', id] as const,
};

export const useActiveFirmsQuery = () => useQuery({ queryKey: ['firms', { active: true }], queryFn: () => firmsApi.list({ page: 1, limit: 100, isActive: true }) });
export const useActiveVehiclesQuery = () => useQuery({ queryKey: ['vehicles', { active: true }], queryFn: () => vehiclesApi.list({ page: 1, limit: 100, isActive: true }) });

export const useInvoiceHistoryQuery = (filters: Record<string, unknown>) => useQuery({ queryKey: billingKeys.invoices(filters), queryFn: () => billingApi.listInvoices(filters) });
export const useInvoiceDetailsQuery = (id: string) => useQuery({ queryKey: billingKeys.invoice(id), queryFn: () => billingApi.getInvoice(id), enabled: Boolean(id) });
export const useBillingPreviewQuery = (id: string | null) => useQuery({ queryKey: billingKeys.preview(id ?? ''), queryFn: () => billingApi.getInvoice(id as string), enabled: Boolean(id) });
export const useInvoiceAuditHistoryQuery = (id: string) => useQuery({ queryKey: billingKeys.auditHistory(id), queryFn: () => billingApi.getInvoiceHistory(id), enabled: Boolean(id) });

export const useBillingOverviewQueries = (month: number, year: number) => {
  const draft = useQuery({ queryKey: billingKeys.invoices({ page: 1, limit: 1, status: 'draft', month, year }), queryFn: () => billingApi.listInvoices({ page: 1, limit: 1, status: 'draft', month, year }) });
  const review = useQuery({ queryKey: billingKeys.invoices({ page: 1, limit: 1, status: 'review', month, year }), queryFn: () => billingApi.listInvoices({ page: 1, limit: 1, status: 'review', month, year }) });
  const approved = useQuery({ queryKey: billingKeys.invoices({ page: 1, limit: 1, status: 'approved', month, year }), queryFn: () => billingApi.listInvoices({ page: 1, limit: 1, status: 'approved', month, year }) });
  const finalized = useQuery({ queryKey: billingKeys.invoices({ page: 1, limit: 1, status: 'finalized', month, year }), queryFn: () => billingApi.listInvoices({ page: 1, limit: 1, status: 'finalized', month, year }) });
  const statusQueries = { draft, review, approved, finalized };
  const recent = useQuery({ queryKey: billingKeys.invoices({ page: 1, limit: 6, month, year }), queryFn: () => billingApi.listInvoices({ page: 1, limit: 6, month, year }) });
  const payments = useQuery({ queryKey: billingKeys.paymentSummary(month, year), queryFn: () => billingApi.getPaymentSummary({ month, year }) });
  const dashboard = useQuery({ queryKey: billingKeys.overview(month, year), queryFn: () => getDashboardSnapshot(new Date(year, month - 1, 1)) });
  return { statusQueries, recent, payments, dashboard, isLoading: Object.values(statusQueries).some((query) => query.isLoading) || recent.isLoading || payments.isLoading || dashboard.isLoading, error: Object.values(statusQueries).find((query) => query.error)?.error ?? recent.error ?? payments.error ?? dashboard.error };
};

const invalidateBilling = (queryClient: ReturnType<typeof useQueryClient>) => queryClient.invalidateQueries({ queryKey: billingKeys.all });

export const useGenerateBillingMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: billingApi.generateInvoice, onSuccess: (invoice: Invoice) => { queryClient.setQueryData(billingKeys.preview(invoice._id), invoice); void invalidateBilling(queryClient); } });
};
export const useApproveInvoiceMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: ({ id, notes }: { id: string; notes?: string }) => billingApi.approveInvoice(id, notes), onSuccess: (invoice: Invoice) => { queryClient.setQueryData(billingKeys.invoice(invoice._id), invoice); queryClient.setQueryData(billingKeys.preview(invoice._id), invoice); void invalidateBilling(queryClient); } });
};
export const useFinalizeInvoiceMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: ({ id, notes }: { id: string; notes?: string }) => billingApi.finalizeInvoice(id, notes), onSuccess: (invoice: Invoice) => { queryClient.setQueryData(billingKeys.invoice(invoice._id), invoice); queryClient.setQueryData(billingKeys.preview(invoice._id), invoice); void invalidateBilling(queryClient); } });
};
export const useInvoicePdfMutation = () => useMutation({ mutationFn: (id: string) => billingApi.downloadInvoicePdf(id) });
export const useReopenInvoiceMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => billingApi.reopenInvoice(id, reason), onSuccess: (invoice: Invoice) => { queryClient.setQueryData(billingKeys.invoice(invoice._id), invoice); queryClient.setQueryData(billingKeys.preview(invoice._id), invoice); void invalidateBilling(queryClient); } });
};

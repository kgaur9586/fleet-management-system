import apiClient from './apiClient';
import { toQueryString } from '@/lib/query';
import type { Page, Payment, PaymentPayload, PaymentQuery } from '@/types';
import type { PaymentSummary } from './billingApi';

export const paymentsApi = {
  list: (query: PaymentQuery = {}) => apiClient.get<Page<Payment>>(`/payments?${toQueryString(query)}`),
  create: (payload: PaymentPayload) => apiClient.post<Payment>('/payments', payload),
  summary: (query: { firmId?: string; month?: number; year?: number } = {}) =>
    apiClient.get<PaymentSummary>(`/payments/summary?${toQueryString(query)}`),
};

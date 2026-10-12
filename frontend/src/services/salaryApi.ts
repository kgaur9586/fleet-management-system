import apiClient from './apiClient';
import { toQueryString } from '@/lib/query';
import type { DriverAdvanceRecovery, Page, SalaryDeductionResult, SalaryPaymentMode, SalaryPaymentStatus, SalaryRecord } from '@/types';

export const salaryApi = {
  list: (query: { page?: number; limit?: number; driverId?: string; month?: number; year?: number; paymentStatus?: SalaryPaymentStatus } = {}) =>
    apiClient.get<Page<SalaryRecord>>(`/salary?${toQueryString(query)}`),
  generate: (payload: { driverId: string; month: number; year: number }) => apiClient.post<SalaryRecord>('/salary/generate', payload),
  get: (id: string) => apiClient.get<{ record: SalaryRecord; recoveries: DriverAdvanceRecovery[] }>(`/salary/${id}`),
  applyDeduction: (id: string, amount: number) =>
    apiClient.patch<{ record: SalaryRecord; deduction: SalaryDeductionResult }>(`/salary/${id}/deduction`, { amount }),
  markPaid: (id: string, payload: { paidOn?: string; paymentMode?: SalaryPaymentMode; paymentReference?: string; notes?: string }) =>
    apiClient.patch<SalaryRecord>(`/salary/${id}/mark-paid`, payload),
};

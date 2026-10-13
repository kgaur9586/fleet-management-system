import apiClient from './apiClient';
import { toQueryString } from '@/lib/query';
import type { Expense, ExpensePayload, ExpenseQuery, ExpenseSummary, Page } from '@/types';

export const expensesApi = {
  list: (query: ExpenseQuery = {}) => apiClient.get<Page<Expense>>(`/expenses?${toQueryString(query)}`),
  get: (id: string) => apiClient.get<Expense>(`/expenses/${id}`),
  create: (payload: ExpensePayload) => apiClient.post<Expense>('/expenses', payload),
  update: (id: string, payload: Partial<ExpensePayload>) => apiClient.patch<Expense>(`/expenses/${id}`, payload),
  remove: (id: string) => apiClient.delete(`/expenses/${id}`),
  summary: (query: { month?: number; year?: number } = {}) => apiClient.get<ExpenseSummary>(`/expenses/summary?${toQueryString(query)}`),
};

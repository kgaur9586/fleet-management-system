import apiClient from './apiClient';
import { toQueryString } from '@/lib/query';
import type { Company, CompanyPayload, Page } from '@/types';

export const companiesApi = {
  list: (query: Record<string, unknown> = {}) => apiClient.get<Page<Company>>(`/companies?${toQueryString(query)}`),
  get: (id: string) => apiClient.get<Company>(`/companies/${id}`),
  create: (payload: CompanyPayload) => apiClient.post<Company>('/companies', payload),
  update: (id: string, payload: Partial<CompanyPayload>) => apiClient.patch<Company>(`/companies/${id}`, payload),
  remove: (id: string) => apiClient.delete(`/companies/${id}`),
};

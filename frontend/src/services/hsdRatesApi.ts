import apiClient from './apiClient';
import { toQueryString } from '@/lib/query';
import type { HsdRate, HsdRatePayload, Page } from '@/types';

export const hsdRatesApi = {
  list: (query: { page?: number; limit?: number } = {}) => apiClient.get<Page<HsdRate>>(`/hsd-rates?${toQueryString(query)}`),
  create: (payload: HsdRatePayload) => apiClient.post<HsdRate>('/hsd-rates', payload),
  getEffective: (date?: string) => apiClient.get<HsdRate | null>(`/hsd-rates/effective?${toQueryString({ date })}`),
};

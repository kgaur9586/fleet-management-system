import apiClient from './apiClient';
import { toQueryString } from '@/lib/query';
import type { Driver, DriverPayload, Page } from '@/types';

export const driversApi = {
  list: (query: Record<string, unknown> = {}) => apiClient.get<Page<Driver>>(`/drivers?${toQueryString(query)}`),
  get: (id: string) => apiClient.get<Driver>(`/drivers/${id}`),
  create: (payload: DriverPayload) => apiClient.post<Driver>('/drivers', payload),
  update: (id: string, payload: Partial<DriverPayload>) => apiClient.patch<Driver>(`/drivers/${id}`, payload),
  remove: (id: string) => apiClient.delete(`/drivers/${id}`),
};
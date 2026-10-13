import apiClient from './apiClient';
import { toQueryString } from '@/lib/query';
import type { DriverAdvance, DriverAdvancePayload, DriverAdvanceRecovery, Page } from '@/types';

export const driverAdvancesApi = {
  list: (query: { page?: number; limit?: number; driverId?: string; includeSettled?: boolean } = {}) =>
    apiClient.get<Page<DriverAdvance>>(`/driver-advances?${toQueryString(query)}`),
  create: (payload: DriverAdvancePayload) => apiClient.post<DriverAdvance>('/driver-advances', payload),
  get: (id: string) => apiClient.get<{ advance: DriverAdvance; recoveries: DriverAdvanceRecovery[] }>(`/driver-advances/${id}`),
  outstandingTotal: (driverId: string) =>
    apiClient.get<{ driverId: string; outstandingAmount: number }>(`/driver-advances/driver/${driverId}/outstanding`),
};

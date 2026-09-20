import apiClient from './apiClient';
import { toQueryString } from '@/lib/query';
import type { Page, Vehicle, VehiclePayload } from '@/types';

export const vehiclesApi = {
  list: (query: Record<string, unknown> = {}) => apiClient.get<Page<Vehicle>>(`/vehicles?${toQueryString(query)}`),
  get: (id: string) => apiClient.get<Vehicle>(`/vehicles/${id}`),
  create: (payload: VehiclePayload) => apiClient.post<Vehicle>('/vehicles', payload),
  update: (id: string, payload: Partial<VehiclePayload>) => apiClient.patch<Vehicle>(`/vehicles/${id}`, payload),
  remove: (id: string) => apiClient.delete(`/vehicles/${id}`),
};
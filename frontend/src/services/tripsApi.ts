import apiClient from './apiClient';
import { toQueryString } from '@/lib/query';
import type { Page, Trip, TripPayload, TripQuery } from '@/types';

export const tripsApi = {
  list: (query: TripQuery = {}) => apiClient.get<Page<Trip>>(`/trips?${toQueryString(query)}`),
  get: (id: string) => apiClient.get<Trip>(`/trips/${id}`),
  create: (payload: TripPayload) => apiClient.post<Trip>('/trips', payload),
  update: (id: string, payload: Partial<TripPayload>) => apiClient.patch<Trip>(`/trips/${id}`, payload),
  remove: (id: string) => apiClient.delete(`/trips/${id}`),
};
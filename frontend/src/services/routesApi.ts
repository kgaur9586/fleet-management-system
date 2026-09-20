import apiClient from './apiClient';
import { toQueryString } from '@/lib/query';
import type { Page, Route, RoutePayload } from '@/types';

export const routesApi = {
  list: (query: Record<string, unknown> = {}) => apiClient.get<Page<Route>>(`/routes?${toQueryString(query)}`),
  get: (id: string) => apiClient.get<Route>(`/routes/${id}`),
  create: (payload: RoutePayload) => apiClient.post<Route>('/routes', payload),
  update: (id: string, payload: Partial<RoutePayload>) => apiClient.patch<Route>(`/routes/${id}`, payload),
  remove: (id: string) => apiClient.delete(`/routes/${id}`),
};
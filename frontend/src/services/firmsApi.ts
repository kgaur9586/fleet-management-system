import apiClient from './apiClient';
import { toQueryString } from '@/lib/query';
import type { Firm, FirmPayload, Page } from '@/types';

export const firmsApi = {
  list: (query: Record<string, unknown> = {}) => apiClient.get<Page<Firm>>(`/firms?${toQueryString(query)}`),
  get: (id: string) => apiClient.get<Firm>(`/firms/${id}`),
  create: (payload: FirmPayload) => apiClient.post<Firm>('/firms', payload),
  update: (id: string, payload: Partial<FirmPayload>) => apiClient.patch<Firm>(`/firms/${id}`, payload),
  remove: (id: string) => apiClient.delete(`/firms/${id}`),
};
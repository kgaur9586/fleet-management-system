import apiClient from './apiClient';
import { toQueryString } from '@/lib/query';
import type { Contract, ContractPayload, ContractVersion, ContractVersionPayload, Page } from '@/types';

export const contractsApi = {
  list: (query: Record<string, unknown> = {}) => apiClient.get<Page<Contract>>(`/contracts?${toQueryString(query)}`),
  get: (id: string) => apiClient.get<Contract>(`/contracts/${id}`),
  create: (payload: ContractPayload) => apiClient.post<Contract>('/contracts', payload),
  update: (id: string, payload: Partial<ContractPayload>) => apiClient.patch<Contract>(`/contracts/${id}`, payload),
  remove: (id: string) => apiClient.delete(`/contracts/${id}`),
  listVersions: (id: string) => apiClient.get<ContractVersion[]>(`/contracts/${id}/versions`),
  getVersion: (id: string, versionId: string) => apiClient.get<ContractVersion>(`/contracts/${id}/versions/${versionId}`),
  createVersion: (id: string, payload: ContractVersionPayload) => apiClient.post<ContractVersion>(`/contracts/${id}/versions`, payload),
  getEffectiveVersion: (id: string, date?: string) => apiClient.get<ContractVersion>(`/contracts/${id}/versions/effective?${toQueryString({ date })}`),
  getActiveVersion: (id: string) => apiClient.get<ContractVersion>(`/contracts/${id}/versions/active`),
};
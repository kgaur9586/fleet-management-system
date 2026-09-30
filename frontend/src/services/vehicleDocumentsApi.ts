import apiClient from './apiClient';
import { toQueryString } from '@/lib/query';
import type { Page, VehicleDocument, VehicleDocumentQuery } from '@/types';

export interface VehicleDocumentUploadPayload {
  vehicleId: string;
  documentType: VehicleDocument['documentType'];
  documentNumber?: string;
  issueDate?: string;
  expiryDate: string;
  notes?: string;
  file: File;
}

export const vehicleDocumentsApi = {
  list: (query: VehicleDocumentQuery = {}) => apiClient.get<Page<VehicleDocument>>(`/documents?${toQueryString(query)}`),
  get: (id: string) => apiClient.get<VehicleDocument>(`/documents/${id}`),
  upload: ({ file, ...fields }: VehicleDocumentUploadPayload) => {
    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') form.append(key, String(value));
    });
    form.append('file', file);
    return apiClient.upload<VehicleDocument>('/documents/upload', form);
  },
  downloadFile: (id: string) => apiClient.downloadFile(`/documents/${id}/file`),
};

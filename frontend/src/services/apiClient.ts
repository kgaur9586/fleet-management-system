import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import type { ApiErrorShape, ApiSuccess } from '@/types/api';
import { authToken } from './authToken';

// In development, use Vite's same-origin proxy to avoid browser CORS differences
// between localhost, 127.0.0.1, and a LAN hostname.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

client.interceptors.request.use((config) => {
  const token = authToken.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorShape>) => {
    if (error.response?.status === 401) {
      authToken.clear();
      window.dispatchEvent(new CustomEvent('fleet:auth-expired'));
    }
    return Promise.reject(error);
  },
);

export const getApiErrorMessage = (error: unknown) => {
  const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status?: number }).status) : undefined;
  const rawMessage = error instanceof Error ? error.message : '';
  const normalizedMessage = rawMessage.toLowerCase();
  if (status === 401) return 'Your session has expired or you are not signed in. Please sign in again.';
  if (status === 403) return 'You are not authorized to perform this billing operation.';
  if (status === 500) return 'The server could not complete this billing operation. Please try again later.';
  if (normalizedMessage.includes('no completed trips')) return 'No completed trips are available for this firm, vehicle, and billing period.';
  if (normalizedMessage.includes('contract version') || normalizedMessage.includes('no contract version')) return 'The selected trip is missing an applicable contract version. Check the contract setup before billing.';
  if (normalizedMessage.includes('active contract') || normalizedMessage.includes('contract is missing')) return 'The vehicle or firm does not have a valid active contract for this billing period.';
  if (normalizedMessage.includes('invoice already exists') || normalizedMessage.includes('already exists for this firm')) return 'An invoice already exists for this firm, vehicle, and billing period.';
  if (normalizedMessage.includes('finalized invoice') || normalizedMessage.includes('only approved invoices')) return 'This invoice is finalized or is not in the required status for that operation.';
  if (normalizedMessage.includes('validation failed')) return 'Some billing fields are invalid. Check the selected firm, vehicle, month, and year.';
  if (axios.isAxiosError<ApiErrorShape>(error)) {
    const responseStatus = error.response?.status;
    if (responseStatus === 401) return 'Your session has expired or you are not signed in. Please sign in again.';
    if (responseStatus === 403) return 'You are not authorized to perform this billing operation.';
    if (responseStatus === 500) return 'The server could not complete this billing operation. Please try again later.';
    if (!error.response) return 'Unable to reach the server. Check your network connection and try again.';
    return error.response.data?.message || 'The billing request could not be completed.';
  }
  if (rawMessage.includes('Unable to reach')) return 'Unable to reach the server. Check your network connection and try again.';
  if (rawMessage) return status && status >= 400 ? 'The billing request could not be completed. Please review the invoice state and try again.' : rawMessage;
  return 'Something went wrong while processing billing. Please try again.';
};

export class ApiRequestError extends Error {
  constructor(message: string, public readonly status?: number, public readonly details?: ApiErrorShape['errors']) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function request<T>(config: AxiosRequestConfig) {
  try {
    const response = await client.request<ApiSuccess<T>>(config);
    return response.data.data;
  } catch (error) {
    if (axios.isAxiosError<ApiErrorShape>(error)) {
      if (!error.response) throw new ApiRequestError('Unable to reach the backend. Check your connection.');
      throw new ApiRequestError(error.response.data?.message || 'Request failed', error.response.status, error.response.data?.errors);
    }
    throw error;
  }
}

export const apiClient = {
  get: <T>(url: string, config?: AxiosRequestConfig) => request<T>({ ...config, method: 'GET', url }),
  download: async (url: string) => {
    try {
      const response = await client.get<Blob>(url, { responseType: 'blob' });
      const contentType = String(response.headers['content-type'] || '').toLowerCase();
      if (!response.data || response.data.size === 0) {
        throw new ApiRequestError('The backend returned an empty PDF response.', response.status);
      }
      if (!contentType.includes('application/pdf')) {
        const body = await response.data.text();
        let message = 'The backend did not return a PDF.';
        try { message = JSON.parse(body).message || message; } catch { /* Non-JSON error body. */ }
        throw new ApiRequestError(message, response.status);
      }
      return response.data;
    } catch (error) {
      if (axios.isAxiosError<ApiErrorShape>(error)) {
        if (!error.response) throw new ApiRequestError('Unable to reach the backend. Check your connection.');
        const message = error.response.status === 401 ? 'Your session has expired. Please sign in again.' : error.response.status === 404 ? 'The requested PDF was not found.' : error.response.status === 409 ? 'Only finalized invoices can provide a PDF.' : error.response.data?.message || 'PDF download failed';
        throw new ApiRequestError(message, error.response.status);
      }
      throw error;
    }
  },
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => request<T>({ ...config, method: 'POST', url, data }),
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => request<T>({ ...config, method: 'PUT', url, data }),
  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => request<T>({ ...config, method: 'PATCH', url, data }),
  delete: <T = undefined>(url: string, config?: AxiosRequestConfig) => request<T>({ ...config, method: 'DELETE', url }),
  // Overrides the instance-level JSON header so axios can set the multipart boundary itself.
  upload: <T>(url: string, form: FormData) => request<T>({ method: 'POST', url, data: form, headers: { 'Content-Type': 'multipart/form-data' } }),
  downloadFile: async (url: string) => {
    try {
      const response = await client.get<Blob>(url, { responseType: 'blob' });
      if (!response.data || response.data.size === 0) throw new ApiRequestError('The backend returned an empty file.', response.status);
      const disposition = String(response.headers['content-disposition'] || '');
      const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1];
      return { blob: response.data, filename };
    } catch (error) {
      if (axios.isAxiosError<ApiErrorShape>(error)) {
        if (!error.response) throw new ApiRequestError('Unable to reach the backend. Check your connection.');
        const message = error.response.status === 401 ? 'Your session has expired. Please sign in again.' : error.response.status === 404 ? 'The requested file was not found.' : 'File download failed';
        throw new ApiRequestError(message, error.response.status);
      }
      throw error;
    }
  },
};

export default apiClient;
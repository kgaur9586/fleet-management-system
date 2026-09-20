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
  if (axios.isAxiosError<ApiErrorShape>(error)) {
    return error.response?.data?.message || error.message || 'Request failed';
  }
  return error instanceof Error ? error.message : 'Something went wrong';
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
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => request<T>({ ...config, method: 'POST', url, data }),
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => request<T>({ ...config, method: 'PUT', url, data }),
  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => request<T>({ ...config, method: 'PATCH', url, data }),
  delete: <T = undefined>(url: string, config?: AxiosRequestConfig) => request<T>({ ...config, method: 'DELETE', url }),
};

export default apiClient;
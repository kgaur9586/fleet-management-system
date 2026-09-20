import apiClient from './apiClient';
import { authToken } from './authToken';

export { authToken } from './authToken';
import type { ApiSuccess, User } from '@/types/api';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResult {
  token: string;
  user: User;
}

export async function login(payload: LoginPayload) {
  const result = await apiClient.post<LoginResult>('/auth/login', payload);
  authToken.set(result.token);
  return result;
}

export async function logout() {
  try {
    await apiClient.post('/auth/logout');
  } finally {
    authToken.clear();
  }
}

export async function getCurrentUser() {
  const result = await apiClient.get<{ user: User }>('/auth/me');
  return result.user;
}
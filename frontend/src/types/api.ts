export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
}

export interface ApiErrorShape {
  success: false;
  message: string;
  errors?: Array<{ path: string; message: string }>;
}

export interface PaginatedData<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin';
}
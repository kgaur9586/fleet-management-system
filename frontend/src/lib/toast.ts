import { toast } from 'sonner';
import { getApiErrorMessage } from '@/services/apiClient';

export const notify = {
  success: (message: string) => toast.success(message),
  error: (error: unknown) => toast.error(getApiErrorMessage(error)),
  info: (message: string) => toast.info(message),
};
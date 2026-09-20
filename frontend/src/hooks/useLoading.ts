import { useContext } from 'react';
import { LoadingContext } from '@/lib/loading';

export const useLoading = () => useContext(LoadingContext);
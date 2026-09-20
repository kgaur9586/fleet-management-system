import { Toaster } from 'sonner';
import { AppRouter } from '@/router/AppRouter';
import { LoadingProvider } from '@/lib/loading';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export default function App() {
  return <QueryClientProvider client={queryClient}><LoadingProvider><AppRouter /><Toaster position="bottom-right" toastOptions={{ className: 'fleet-toast' }} /></LoadingProvider></QueryClientProvider>;
}
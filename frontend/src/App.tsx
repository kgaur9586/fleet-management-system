import { Toaster } from 'sonner';
import { AppRouter } from '@/router/AppRouter';
import { LoadingProvider } from '@/lib/loading';

export default function App() {
  return <LoadingProvider><AppRouter /><Toaster position="bottom-right" toastOptions={{ className: 'fleet-toast' }} /></LoadingProvider>;
}
import { createContext, useMemo, useState, type PropsWithChildren } from 'react';

interface LoadingContextValue {
  isLoading: boolean;
  startLoading: () => void;
  stopLoading: () => void;
}

export const LoadingContext = createContext<LoadingContextValue>({
  isLoading: false,
  startLoading: () => undefined,
  stopLoading: () => undefined,
});

export function LoadingProvider({ children }: PropsWithChildren) {
  const [requests, setRequests] = useState(0);
  const value = useMemo(() => ({
    isLoading: requests > 0,
    startLoading: () => setRequests((count) => count + 1),
    stopLoading: () => setRequests((count) => Math.max(0, count - 1)),
  }), [requests]);
  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
}
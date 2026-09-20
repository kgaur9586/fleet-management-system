import { useCallback, useState } from 'react';

export function useAsync<T>(operation: () => Promise<T>) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const execute = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      return await operation();
    } catch (caught) {
      setError(caught);
      throw caught;
    } finally {
      setIsLoading(false);
    }
  }, [operation]);

  return { execute, isLoading, error };
}
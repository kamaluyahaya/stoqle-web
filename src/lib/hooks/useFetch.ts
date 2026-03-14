import useSWR, { SWRConfiguration } from 'swr';
import { useAuth } from '@/src/context/authContext';

const fetcher = async ([url, token]: [string, string | null]) => {
  const headers: HeadersInit = {
    'Accept': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const error: any = new Error('An error occurred while fetching the data.');
    error.info = await res.json().catch(() => ({}));
    error.status = res.status;
    throw error;
  }
  return res.json();
};

export function useFetch<T = any>(url: string | null, config?: SWRConfiguration) {
  const { token } = useAuth();
  
  const { data, error, mutate, isValidating } = useSWR<T>(
    url ? [url, token] : null,
    fetcher,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: true,
      errorRetryCount: 3,
      ...config
    }
  );

  return {
    data,
    isLoading: !error && !data,
    isError: error,
    mutate,
    isValidating
  };
}

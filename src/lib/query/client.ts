import { QueryClient } from '@tanstack/react-query';

// gcTime must be >= the persister maxAge so cached queries survive reloads.
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000, // serve cache instantly, revalidate in background
        gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
        retry: 1,
        refetchOnWindowFocus: true,
      },
    },
  });
}

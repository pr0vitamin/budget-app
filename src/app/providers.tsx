'use client';

import { useState } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { makeQueryClient } from '@/lib/query/client';
import { idbStorage } from '@/lib/query/idb-storage';
import { Toaster } from '@/components/ui/Toaster';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  const [persister] = useState(() => createAsyncStoragePersister({ storage: idbStorage, key: 'cat-budget-query-cache' }));

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 7 }}
    >
      {children}
      <Toaster />
    </PersistQueryClientProvider>
  );
}

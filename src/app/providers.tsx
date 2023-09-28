'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createStore, Provider } from 'jotai';

const queryClient = new QueryClient();
const jotaiStore = createStore();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={jotaiStore}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </Provider>
  );
}

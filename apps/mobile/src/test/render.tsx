import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import '../i18n';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      // No retries: a failing request should fail the test immediately.
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
}

export async function renderWithProviders(ui: ReactElement, client = createTestQueryClient()) {
  const result = await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return { ...result, queryClient: client };
}

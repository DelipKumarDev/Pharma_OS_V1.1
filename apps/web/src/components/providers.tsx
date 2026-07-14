'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { ThemeProvider } from 'next-themes';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: (failureCount, error: unknown) => {
          if (error instanceof Error && error.message.includes('401')) return false;
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const [mswReady, setMswReady] = useState(false);

  useEffect(() => {
    async function enableMocking() {
      // Skip MSW when real backend is configured
      if (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_USE_REAL_API === 'true') {
        setMswReady(true);
        return;
      }
      if (process.env.NODE_ENV !== 'development') {
        setMswReady(true);
        return;
      }
      const { worker } = await import('@/mock/browser');
      await worker.start({
        onUnhandledRequest: 'bypass',
        serviceWorker: { url: '/mockServiceWorker.js' },
      });
      setMswReady(true);
    }
    enableMocking();
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        {mswReady ? children : (
          <div className="flex h-screen items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Starting PharmaOS…</p>
            </div>
          </div>
        )}
      </QueryClientProvider>
    </ThemeProvider>
  );
}

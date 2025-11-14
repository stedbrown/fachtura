'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Stale time: data considered fresh for 5 minutes
            staleTime: 5 * 60 * 1000, // 5 minutes
            // Cache time: data kept in cache for 10 minutes after last use
            gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
            // Retry failed requests once
            retry: 1,
            // Refetch on window focus only in production
            refetchOnWindowFocus: process.env.NODE_ENV === 'production',
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}


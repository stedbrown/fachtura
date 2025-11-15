'use client'

import { useState, useCallback, useEffect } from 'react'

export interface UsePaginationOptions<T> {
  fetchFn: (page: number, pageSize: number) => Promise<T[]>
  pageSize?: number
  initialPage?: number
}

export interface UsePaginationReturn<T> {
  data: T[]
  loading: boolean
  error: Error | null
  page: number
  pageSize: number
  hasMore: boolean
  totalCount: number | null
  loadPage: (pageNum: number) => Promise<void>
  loadNextPage: () => Promise<void>
  loadPreviousPage: () => Promise<void>
  goToPage: (pageNum: number) => Promise<void>
  reset: () => void
  refresh: () => Promise<void>
}

export function usePagination<T>({
  fetchFn,
  pageSize = 50,
  initialPage = 1,
}: UsePaginationOptions<T>): UsePaginationReturn<T> {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [page, setPage] = useState(initialPage)
  const [hasMore, setHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [loadedPages, setLoadedPages] = useState<Set<number>>(new Set())

  const loadPage = useCallback(
    async (pageNum: number) => {
      // Skip if already loaded (for client-side caching)
      if (loadedPages.has(pageNum)) {
        setPage(pageNum)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const result = await fetchFn(pageNum, pageSize)

        if (result.length < pageSize) {
          setHasMore(false)
        }

        // Update data based on page
        if (pageNum === 1) {
          setData(result)
        } else {
          // For simplicity, we'll replace data with current page
          // For infinite scroll, you'd append: setData(prev => [...prev, ...result])
          setData(result)
        }

        setLoadedPages(prev => new Set(prev).add(pageNum))
        setPage(pageNum)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load data'))
        setData([])
      } finally {
        setLoading(false)
      }
    },
    [fetchFn, pageSize, loadedPages]
  )

  const loadNextPage = useCallback(async () => {
    if (hasMore && !loading) {
      await loadPage(page + 1)
    }
  }, [hasMore, loading, page, loadPage])

  const loadPreviousPage = useCallback(async () => {
    if (page > 1 && !loading) {
      await loadPage(page - 1)
    }
  }, [page, loading, loadPage])

  const goToPage = useCallback(
    async (pageNum: number) => {
      if (pageNum >= 1 && !loading) {
        await loadPage(pageNum)
      }
    },
    [loadPage, loading]
  )

  const reset = useCallback(() => {
    setData([])
    setPage(initialPage)
    setHasMore(true)
    setError(null)
    setLoadedPages(new Set())
    setTotalCount(null)
  }, [initialPage])

  const refresh = useCallback(async () => {
    setLoadedPages(new Set())
    await loadPage(page)
  }, [loadPage, page])

  // Load initial page
  useEffect(() => {
    loadPage(initialPage)
  }, []) // Only on mount

  return {
    data,
    loading,
    error,
    page,
    pageSize,
    hasMore,
    totalCount,
    loadPage,
    loadNextPage,
    loadPreviousPage,
    goToPage,
    reset,
    refresh,
  }
}


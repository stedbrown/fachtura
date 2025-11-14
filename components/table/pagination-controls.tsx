'use client'

import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface PaginationControlsProps {
  page: number
  pageSize: number
  hasMore: boolean
  totalCount: number | null
  onPageChange: (page: number) => void
  loading?: boolean
}

export function PaginationControls({
  page,
  pageSize,
  hasMore,
  totalCount,
  onPageChange,
  loading = false,
}: PaginationControlsProps) {
  const t = useTranslations('common')
  const startItem = (page - 1) * pageSize + 1
  const endItem = totalCount
    ? Math.min(page * pageSize, totalCount)
    : hasMore
    ? page * pageSize
    : startItem + pageSize - 1
  const totalPages = totalCount ? Math.ceil(totalCount / pageSize) : null

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 sm:px-4 py-3 sm:py-4">
      {/* Results info - hidden on mobile, shown on tablet+ */}
      <div className="hidden sm:block text-sm text-muted-foreground">
        {totalCount !== null ? (
          <>
            {t('showing', { start: startItem, end: endItem, total: totalCount })}
          </>
        ) : (
          <>
            {t('showingRange', { start: startItem, end: endItem })}
            {hasMore && ` ${t('ofMore')}`}
          </>
        )}
      </div>
      
      {/* Mobile: compact info */}
      <div className="sm:hidden text-xs text-muted-foreground">
        {totalCount !== null ? (
          <>{startItem}-{endItem} / {totalCount}</>
        ) : (
          <>{startItem}-{endItem}{hasMore && '...'}</>
        )}
      </div>

      {/* Pagination controls */}
      <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-center">
        {/* First page button - hidden on mobile */}
        <Button
          variant="outline"
          size="sm"
          className="hidden md:flex h-9 w-9 p-0"
          onClick={() => onPageChange(1)}
          disabled={page === 1 || loading}
          aria-label={t('firstPage') || 'First page'}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        
        {/* Previous page button - larger on mobile */}
        <Button
          variant="outline"
          size="sm"
          className="h-10 w-10 sm:h-9 sm:w-9 p-0"
          style={{ touchAction: 'manipulation' }}
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1 || loading}
          aria-label={t('previous') || 'Previous page'}
        >
          <ChevronLeft className="h-4 w-4 sm:h-4 sm:w-4" />
        </Button>
        
        {/* Page indicator - compact on mobile */}
        <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3">
          <span className="hidden sm:inline text-sm font-medium text-foreground">
            {t('page')}
          </span>
          <span className="text-sm sm:text-base font-semibold text-foreground min-w-[2ch] text-center">
            {page}
          </span>
          {totalPages && (
            <span className="hidden sm:inline text-xs text-muted-foreground">
              / {totalPages}
            </span>
          )}
        </div>
        
        {/* Next page button - larger on mobile */}
        <Button
          variant="outline"
          size="sm"
          className="h-10 w-10 sm:h-9 sm:w-9 p-0"
          style={{ touchAction: 'manipulation' }}
          onClick={() => onPageChange(page + 1)}
          disabled={!hasMore || loading}
          aria-label={t('next') || 'Next page'}
        >
          <ChevronRight className="h-4 w-4 sm:h-4 sm:w-4" />
        </Button>
        
        {/* Last page button - hidden on mobile */}
        {totalCount && (
          <Button
            variant="outline"
            size="sm"
            className="hidden md:flex h-9 w-9 p-0"
            onClick={() => onPageChange(Math.ceil(totalCount / pageSize))}
            disabled={!hasMore || loading || page >= Math.ceil(totalCount / pageSize)}
            aria-label={t('lastPage') || 'Last page'}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}


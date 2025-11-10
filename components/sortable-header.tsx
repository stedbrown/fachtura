'use client'

import { useState, useMemo } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type SortDirection = 'asc' | 'desc' | null

interface SortableHeaderProps {
  label: string
  sortKey: string
  currentSortKey: string | null
  currentDirection: SortDirection
  onSort: (key: string) => void
  align?: 'left' | 'center' | 'right'
  className?: string
}

export function SortableHeader({
  label,
  sortKey,
  currentSortKey,
  currentDirection,
  onSort,
  align = 'left',
  className,
}: SortableHeaderProps) {
  const isActive = currentSortKey === sortKey
  const direction = isActive ? currentDirection : null

  return (
    <Button
      variant="ghost"
      onClick={() => onSort(sortKey)}
      className={cn(
        'flex items-center gap-2 hover:bg-muted/50 h-auto p-2 -ml-2 font-semibold',
        align === 'right' && 'justify-end',
        align === 'center' && 'justify-center',
        className
      )}
    >
      {label}
      {direction === 'asc' && (
        <ArrowUp className="h-4 w-4" />
      )}
      {direction === 'desc' && (
        <ArrowDown className="h-4 w-4" />
      )}
      {!direction && (
        <ArrowUpDown className="h-4 w-4 text-muted-foreground opacity-50" />
      )}
    </Button>
  )
}

// Hook per gestire l'ordinamento
export function useSorting<T>(
  data: T[],
  initialSortKey?: string,
  initialDirection: SortDirection = 'asc'
) {
  const [sortKey, setSortKey] = useState<string | null>(initialSortKey || null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialDirection)

  const handleSort = (key: string) => {
    if (sortKey === key) {
      // Cycling through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortKey(null)
        setSortDirection(null)
      }
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDirection) return data

    return [...data].sort((a, b) => {
      const aValue = getNestedValue(a, sortKey)
      const bValue = getNestedValue(b, sortKey)

      // Handle null/undefined
      if (aValue == null && bValue == null) return 0
      if (aValue == null) return sortDirection === 'asc' ? 1 : -1
      if (bValue == null) return sortDirection === 'asc' ? -1 : 1

      // String comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue)
        return sortDirection === 'asc' ? comparison : -comparison
      }

      // Number comparison
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
      }

      // Date comparison
      if (aValue instanceof Date && bValue instanceof Date) {
        return sortDirection === 'asc'
          ? aValue.getTime() - bValue.getTime()
          : bValue.getTime() - aValue.getTime()
      }

      // Fallback to string comparison
      return sortDirection === 'asc'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue))
    })
  }, [data, sortKey, sortDirection])

  return {
    sortedData,
    sortKey,
    sortDirection,
    handleSort,
  }
}

// Helper to get nested object values (e.g., "client.name")
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}


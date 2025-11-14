import { useState, useCallback, useMemo } from 'react'

export function useRowSelection<T extends { id: string }>(items: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const selectedItems = useMemo(() => {
    return items.filter((item) => selectedIds.has(item.id))
  }, [items, selectedIds])

  const isAllSelected = useMemo(() => {
    return items.length > 0 && selectedIds.size === items.length
  }, [items.length, selectedIds.size])

  const isIndeterminate = useMemo(() => {
    return selectedIds.size > 0 && selectedIds.size < items.length
  }, [items.length, selectedIds.size])

  const toggleRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(items.map((item) => item.id)))
    }
  }, [isAllSelected, items])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const selectRows = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids))
  }, [])

  return {
    selectedIds,
    selectedItems,
    isAllSelected,
    isIndeterminate,
    toggleRow,
    toggleAll,
    clearSelection,
    selectRows,
    hasSelection: selectedIds.size > 0,
    selectedCount: selectedIds.size,
  }
}


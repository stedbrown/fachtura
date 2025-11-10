'use client'

import { useState, useEffect } from 'react'
import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type ColumnConfig = {
  key: string
  label: string
  visible?: boolean
  hiddenClass?: string
  alwaysVisible?: boolean
}

interface SimpleColumnToggleProps {
  columns: ColumnConfig[]
  onVisibilityChange: (columnId: string, visible: boolean) => void
  storageKey?: string
  label?: string
}

export function SimpleColumnToggle({
  columns,
  onVisibilityChange,
  storageKey,
  label = 'Mostra/Nascondi colonne',
}: SimpleColumnToggleProps) {
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => {
    // Initialize from storage if available
    if (storageKey && typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        try {
          return JSON.parse(stored)
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
    
    // Default visibility
    return columns.reduce((acc, col) => {
      acc[col.key] = col.visible !== false
      return acc
    }, {} as Record<string, boolean>)
  })

  // Save to localStorage whenever visibility changes
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(visibility))
    }
  }, [visibility, storageKey])

  const handleToggle = (columnId: string, checked: boolean) => {
    setVisibility(prev => ({ ...prev, [columnId]: checked }))
    onVisibilityChange(columnId, checked)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
        >
          <Settings2 className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Colonne</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px]">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns
          .filter(col => !col.alwaysVisible)
          .map((column) => (
            <DropdownMenuCheckboxItem
              key={column.key}
              checked={visibility[column.key]}
              onCheckedChange={(checked) => handleToggle(column.key, checked)}
            >
              {column.label}
            </DropdownMenuCheckboxItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Hook to use in components
export function useColumnVisibility(columns: ColumnConfig[], storageKey?: string) {
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        try {
          const visibility = JSON.parse(stored)
          const hidden = new Set(
            Object.entries(visibility)
              .filter(([, visible]) => !visible)
              .map(([id]) => id)
          )
          setHiddenColumns(hidden)
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }, [storageKey])

  const handleVisibilityChange = (columnId: string, visible: boolean) => {
    setHiddenColumns(prev => {
      const next = new Set(prev)
      if (visible) {
        next.delete(columnId)
      } else {
        next.add(columnId)
      }
      return next
    })
  }

  const getColumnClass = (columnKey: string) => {
    return hiddenColumns.has(columnKey) ? 'hidden' : ''
  }

  const visibleColumns = columns.map(col => ({
    ...col,
    visible: !hiddenColumns.has(col.key)
  }))

  return {
    visibleColumns,
    hiddenColumns,
    handleVisibilityChange,
    getColumnClass,
    isColumnVisible: (columnKey: string) => !hiddenColumns.has(columnKey),
  }
}


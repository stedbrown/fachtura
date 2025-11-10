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

// Hook to use in components - SINGLE SOURCE OF TRUTH
export function useColumnVisibility(initialColumns: ColumnConfig[], storageKey?: string) {
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    // Try to load from localStorage first
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
    
    // Default visibility from column config
    return initialColumns.reduce((acc, col) => {
      acc[col.key] = col.visible !== false
      return acc
    }, {} as Record<string, boolean>)
  })

  // Save to localStorage whenever visibility changes
  useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(columnVisibility))
    }
  }, [columnVisibility, storageKey])

  const handleVisibilityChange = (columnKey: string, visible: boolean) => {
    setColumnVisibility(prev => ({
      ...prev,
      [columnKey]: visible
    }))
  }

  const getColumnClass = (columnKey: string) => {
    // If column is explicitly hidden, return 'hidden'
    // Otherwise return empty string (visible)
    return columnVisibility[columnKey] === false ? 'hidden' : ''
  }

  const isColumnVisible = (columnKey: string) => {
    return columnVisibility[columnKey] !== false
  }

  return {
    columnVisibility,
    handleVisibilityChange,
    getColumnClass,
    isColumnVisible,
  }
}

// Component for the column toggle dropdown
interface SimpleColumnToggleProps {
  columns: ColumnConfig[]
  columnVisibility: Record<string, boolean>
  onVisibilityChange: (columnKey: string, visible: boolean) => void
  label?: string
}

export function SimpleColumnToggle({
  columns,
  columnVisibility,
  onVisibilityChange,
  label = 'Mostra/Nascondi colonne',
}: SimpleColumnToggleProps) {
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
              checked={columnVisibility[column.key] !== false}
              onCheckedChange={(checked) => onVisibilityChange(column.key, checked)}
            >
              {column.label}
            </DropdownMenuCheckboxItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}


'use client'

import { useState, useEffect } from 'react'
import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

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

  const getColumnClass = (columnKey: string, baseClasses: string = '') => {
    // If column is explicitly hidden by toggle, force hidden
    if (columnVisibility[columnKey] === false) {
      return '!hidden'
    }
    // Otherwise return base classes (like responsive classes)
    return baseClasses
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
  className?: string
}

export function SimpleColumnToggle({
  columns,
  columnVisibility,
  onVisibilityChange,
  label = 'Mostra/Nascondi colonne',
  className,
}: SimpleColumnToggleProps) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-9 w-9 sm:w-auto sm:px-3 flex items-center justify-center sm:justify-start gap-0 sm:gap-2',
                className
              )}
            >
              <Settings2 className="h-4 w-4" />
              <span className="sr-only sm:hidden">{label}</span>
              <span className="hidden sm:inline text-sm font-medium truncate">
                {label}
              </span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="hidden md:block">
          {label}
        </TooltipContent>
      </Tooltip>
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


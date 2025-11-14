'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { TableHead, TableCell } from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface TableCheckboxColumnProps {
  checked: boolean
  indeterminate?: boolean
  onCheckedChange: (checked: boolean) => void
  className?: string
}

export function TableCheckboxHeader({ 
  checked, 
  indeterminate, 
  onCheckedChange,
  className 
}: TableCheckboxColumnProps) {
  return (
    <TableHead className={cn('w-12', className)}>
      <Checkbox
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary"
        {...(indeterminate && { 'data-state': 'indeterminate' as const })}
      />
    </TableHead>
  )
}

interface TableCheckboxCellProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  onClick?: (e: React.MouseEvent) => void
  className?: string
}

export function TableCheckboxCell({ 
  checked, 
  onCheckedChange,
  onClick,
  className 
}: TableCheckboxCellProps) {
  return (
    <TableCell 
      className={cn('w-12', className)}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.(e)
      }}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </TableCell>
  )
}


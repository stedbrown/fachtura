'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Filter, X, Download, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { format } from 'date-fns'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

export interface FilterState {
  dateFrom?: Date
  dateTo?: Date
  minAmount?: number
  maxAmount?: number
  status?: string
  clientIds?: string[]
}

interface AdvancedFiltersProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  onExport?: (format: 'csv' | 'excel') => void
  showClientFilter?: boolean
  showStatusFilter?: boolean
  statusOptions?: { value: string; label: string }[]
  clients?: { id: string; name: string }[]
  className?: string
}

export function AdvancedFilters({
  filters,
  onFiltersChange,
  onExport,
  showClientFilter = false,
  showStatusFilter = false,
  statusOptions = [],
  clients = [],
  className,
}: AdvancedFiltersProps) {
  const t = useTranslations('common')
  const [isOpen, setIsOpen] = useState(false)

  const hasActiveFilters = Boolean(
    filters.dateFrom ||
      filters.dateTo ||
      filters.minAmount ||
      filters.maxAmount ||
      filters.status ||
      (filters.clientIds && filters.clientIds.length > 0)
  )

  function clearFilters() {
    onFiltersChange({})
  }

  function updateFilter(key: keyof FilterState, value: any) {
    onFiltersChange({ ...filters, [key]: value })
  }

  return (
    <div className={cn("flex gap-2 flex-wrap items-center", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            {t('filter')}
            {hasActiveFilters && (
              <span className="ml-2 bg-primary text-primary-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center">
                !
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">{t('filter')}</h4>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                >
                  <X className="h-4 w-4 mr-1" />
                  {t('clear')}
                </Button>
              )}
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <Label>{t('date')}</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">{t('from')}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !filters.dateFrom && 'text-muted-foreground'
                        )}
                      >
                        {filters.dateFrom
                          ? format(filters.dateFrom, 'dd/MM/yyyy')
                          : t('select')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filters.dateFrom}
                        onSelect={(date) => updateFilter('dateFrom', date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">{t('to')}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !filters.dateTo && 'text-muted-foreground'
                        )}
                      >
                        {filters.dateTo
                          ? format(filters.dateTo, 'dd/MM/yyyy')
                          : t('select')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filters.dateTo}
                        onSelect={(date) => updateFilter('dateTo', date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* Amount Range */}
            <div className="space-y-2">
              <Label>{t('amount')} (CHF)</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">{t('min')}</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={filters.minAmount || ''}
                    onChange={(e) =>
                      updateFilter(
                        'minAmount',
                        e.target.value ? parseFloat(e.target.value) : undefined
                      )
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">{t('max')}</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={filters.maxAmount || ''}
                    onChange={(e) =>
                      updateFilter(
                        'maxAmount',
                        e.target.value ? parseFloat(e.target.value) : undefined
                      )
                    }
                  />
                </div>
              </div>
            </div>

            {/* Status Filter */}
            {showStatusFilter && statusOptions.length > 0 && (
              <div className="space-y-2">
                <Label>{t('status')}</Label>
                <Select
                  value={filters.status || 'all'}
                  onValueChange={(value) =>
                    updateFilter('status', value === 'all' ? undefined : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('all')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all')}</SelectItem>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Client Filter */}
            {showClientFilter && clients.length > 0 && (
              <div className="space-y-2">
                <Label>{t('client')}</Label>
                <Select
                  value={filters.clientIds?.[0] || 'all'}
                  onValueChange={(value) =>
                    updateFilter('clientIds', value === 'all' ? [] : [value])
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('all')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all')}</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {onExport && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              {t('export')}
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onExport('excel')}>
              Excel (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport('csv')}>
              CSV (.csv)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="h-4 w-4 mr-2" />
          {t('clearFilters')}
        </Button>
      )}
    </div>
  )
}


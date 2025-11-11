'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Filter, X, Download, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export interface ClientFilterState {
  searchName?: string
  searchEmail?: string
  searchCity?: string
  searchCountry?: string
}

interface ClientFiltersProps {
  filters: ClientFilterState
  onFiltersChange: (filters: ClientFilterState) => void
  onExport?: (format: 'csv' | 'excel') => void
  className?: string
}

export function ClientFilters({
  filters,
  onFiltersChange,
  onExport,
  className,
}: ClientFiltersProps) {
  const t = useTranslations('common')
  const tClients = useTranslations('clients')
  const [isOpen, setIsOpen] = useState(false)

  const hasActiveFilters = Boolean(
    filters.searchName ||
      filters.searchEmail ||
      filters.searchCity ||
      filters.searchCountry
  )

  function clearFilters() {
    onFiltersChange({})
  }

  function updateFilter(key: keyof ClientFilterState, value: string) {
    onFiltersChange({ ...filters, [key]: value || undefined })
  }

  return (
    <div className={cn('flex gap-2 flex-wrap items-center', className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9 sm:w-auto sm:px-3 flex items-center justify-center sm:justify-start gap-0 sm:gap-2"
              >
                <Filter className="h-4 w-4" />
                <span className="sr-only sm:hidden">{t('filter')}</span>
                <span className="hidden sm:inline">{t('filter')}</span>
                {hasActiveFilters && (
                  <span className="ml-1 sm:ml-2 bg-primary text-primary-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
                    !
                  </span>
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="hidden md:block">
            {t('filter')}
          </TooltipContent>
        </Tooltip>
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

            {/* Name Filter */}
            <div className="space-y-2">
              <Label>{tClients('fields.name')}</Label>
              <Input
                placeholder={t('search')}
                value={filters.searchName || ''}
                onChange={(e) => updateFilter('searchName', e.target.value)}
              />
            </div>

            {/* Email Filter */}
            <div className="space-y-2">
              <Label>{tClients('fields.email')}</Label>
              <Input
                placeholder={t('search')}
                value={filters.searchEmail || ''}
                onChange={(e) => updateFilter('searchEmail', e.target.value)}
              />
            </div>

            {/* City Filter */}
            <div className="space-y-2">
              <Label>{tClients('fields.city')}</Label>
              <Input
                placeholder={t('search')}
                value={filters.searchCity || ''}
                onChange={(e) => updateFilter('searchCity', e.target.value)}
              />
            </div>

            {/* Country Filter */}
            <div className="space-y-2">
              <Label>{tClients('fields.country')}</Label>
              <Input
                placeholder={t('search')}
                value={filters.searchCountry || ''}
                onChange={(e) => updateFilter('searchCountry', e.target.value)}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {onExport && (
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 sm:w-auto sm:px-3 flex items-center justify-center sm:justify-start gap-0 sm:gap-2"
                >
                  <Download className="h-4 w-4" />
                  <span className="sr-only sm:hidden">{t('export')}</span>
                  <span className="hidden sm:inline">{t('export')}</span>
                  <ChevronDown className="h-4 w-4 hidden sm:block" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="hidden md:block">
              {t('export')}
            </TooltipContent>
          </Tooltip>
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
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-9 w-9 sm:w-auto sm:px-3 flex items-center justify-center sm:justify-start gap-0 sm:gap-2"
            >
              <X className="h-4 w-4" />
              <span className="sr-only sm:hidden">{t('clearFilters')}</span>
              <span className="hidden sm:inline">{t('clearFilters')}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="hidden md:block">
            {t('clearFilters')}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}


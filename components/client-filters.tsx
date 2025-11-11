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


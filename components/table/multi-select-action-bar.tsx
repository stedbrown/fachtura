'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Download, Trash2, FileDown, X, MoreVertical, FileText } from 'lucide-react'
import { useTranslations } from 'next-intl'
import React from 'react'

interface MultiSelectSubAction {
  label: string
  icon: React.ComponentType<{ className?: string }>
  onClick: () => void
}

interface MultiSelectAction {
  label: string
  icon: React.ComponentType<{ className?: string }>
  onClick?: () => void
  variant?: 'default' | 'destructive' | 'outline'
  disabled?: boolean
  subActions?: MultiSelectSubAction[] // For dropdown actions like Export
}

interface MultiSelectActionBarProps {
  selectedCount: number
  onClear: () => void
  actions: MultiSelectAction[]
  primaryAction?: MultiSelectAction // Action to show as button on mobile
}

export function MultiSelectActionBar({
  selectedCount,
  onClear,
  actions,
  primaryAction,
}: MultiSelectActionBarProps) {
  const tCommon = useTranslations('common')
  
  // On mobile, show only primary action + menu, on desktop show all actions
  const mobileActions = primaryAction ? [primaryAction] : []
  const desktopActions = actions

  return (
    <div className="border-b bg-muted/30 px-3 sm:px-4 py-2.5 sm:py-3">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Selection count */}
        <div className="text-xs sm:text-sm text-muted-foreground">
          {selectedCount} {selectedCount === 1 ? tCommon('item') : tCommon('items')} {tCommon('selected')}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Mobile: Primary action + menu */}
          <div className="flex items-center gap-2 sm:hidden flex-1">
            {primaryAction && (
              <Button
                variant={primaryAction.variant || 'outline'}
                size="sm"
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
                className={`flex-1 ${
                  primaryAction.variant === 'destructive'
                    ? 'text-destructive hover:text-destructive'
                    : ''
                }`}
              >
                <primaryAction.icon className="h-4 w-4 mr-2" />
                {primaryAction.label}
              </Button>
            )}
            
            {/* Menu with all other actions */}
            {actions.length > (primaryAction ? 1 : 0) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 w-9 p-0">
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">{tCommon('moreActions') || 'More actions'}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {actions
                    .filter((action) => action !== primaryAction)
                    .map((action, index) => {
                      // If action has subActions, render as expandable items
                      if (action.subActions && action.subActions.length > 0) {
                        return (
                          <React.Fragment key={index}>
                            {index > 0 && <DropdownMenuSeparator />}
                            {action.subActions.map((subAction, subIndex) => (
                              <DropdownMenuItem
                                key={subIndex}
                                onClick={subAction.onClick}
                                disabled={action.disabled}
                              >
                                <subAction.icon className="h-4 w-4 mr-2" />
                                {subAction.label}
                              </DropdownMenuItem>
                            ))}
                          </React.Fragment>
                        )
                      }
                      
                      // Regular action
                      return (
                        <React.Fragment key={index}>
                          {index > 0 && <DropdownMenuSeparator />}
                          <DropdownMenuItem
                            onClick={action.onClick}
                            disabled={action.disabled}
                            className={
                              action.variant === 'destructive'
                                ? 'text-destructive focus:text-destructive'
                                : ''
                            }
                          >
                            <action.icon className="h-4 w-4 mr-2" />
                            {action.label}
                          </DropdownMenuItem>
                        </React.Fragment>
                      )
                    })}
                  {onClear && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onClear}>
                        <X className="h-4 w-4 mr-2" />
                        {tCommon('clear')}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {/* Clear button if no menu */}
            {actions.length === (primaryAction ? 1 : 0) && onClear && (
              <Button variant="ghost" size="sm" onClick={onClear} className="h-9">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Desktop: All actions visible */}
          <div className="hidden sm:flex items-center gap-2">
            {desktopActions.map((action, index) => {
              // If action has subActions, render as dropdown
              if (action.subActions && action.subActions.length > 0) {
                return (
                  <DropdownMenu key={index}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant={action.variant || 'outline'}
                        size="sm"
                        disabled={action.disabled}
                      >
                        <action.icon className="h-4 w-4 mr-2" />
                        {action.label}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {action.subActions.map((subAction, subIndex) => (
                        <DropdownMenuItem key={subIndex} onClick={subAction.onClick}>
                          <subAction.icon className="h-4 w-4 mr-2" />
                          {subAction.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )
              }
              
              // Regular button action
              return (
                <Button
                  key={index}
                  variant={action.variant || 'outline'}
                  size="sm"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className={
                    action.variant === 'destructive'
                      ? 'text-destructive hover:text-destructive'
                      : ''
                  }
                >
                  <action.icon className="h-4 w-4 mr-2" />
                  {action.label}
                </Button>
              )
            })}
            {onClear && (
              <Button variant="ghost" size="sm" onClick={onClear}>
                {tCommon('clear')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


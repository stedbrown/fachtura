'use client'

import * as React from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Client } from '@/lib/types/database'

interface ClientInfoStepProps {
  clients: Client[]
  selectedClientId: string
  onClientChange: (clientId: string) => void
  date: string
  onDateChange: (date: string) => void
  dueDate?: string
  onDueDateChange?: (date: string) => void
  validUntil?: string
  onValidUntilChange?: (date: string) => void
  status: string
  onStatusChange: (status: string) => void
  statusOptions: Array<{ value: string; label: string }>
  type: 'invoice' | 'quote'
  onCreateClient?: () => void
  defaultDays?: number
  t: (key: string) => string
}

export function ClientInfoStep({
  clients,
  selectedClientId,
  onClientChange,
  date,
  onDateChange,
  dueDate,
  onDueDateChange,
  validUntil,
  onValidUntilChange,
  status,
  onStatusChange,
  statusOptions,
  type,
  onCreateClient,
  defaultDays = 30,
  t,
}: ClientInfoStepProps) {
  const [clientSearchOpen, setClientSearchOpen] = React.useState(false)
  const selectedClient = clients.find((c) => c.id === selectedClientId)

  // Auto-set due date for invoices (from company settings or default)
  React.useEffect(() => {
    if (type === 'invoice' && date && !dueDate && onDueDateChange) {
      const dueDateObj = new Date(date)
      dueDateObj.setDate(dueDateObj.getDate() + defaultDays)
      onDueDateChange(dueDateObj.toISOString().split('T')[0])
    }
  }, [date, type, dueDate, onDueDateChange, defaultDays])

  // Auto-set valid until for quotes (from company settings or default)
  React.useEffect(() => {
    if (type === 'quote' && date && !validUntil && onValidUntilChange) {
      const validUntilObj = new Date(date)
      validUntilObj.setDate(validUntilObj.getDate() + defaultDays)
      onValidUntilChange(validUntilObj.toISOString().split('T')[0])
    }
  }, [date, type, validUntil, onValidUntilChange, defaultDays])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Informazioni Cliente</h2>
        <p className="text-sm text-muted-foreground">
          Seleziona il cliente e imposta le date principali del documento
        </p>
      </div>

      {/* Client Selection with Search */}
      <div className="space-y-2">
        <Label htmlFor="client" className="text-sm font-medium">
          {t('fields.client')} <span className="text-destructive">*</span>
        </Label>
        <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={clientSearchOpen}
              className="w-full justify-between h-11"
            >
              {selectedClient ? (
                <span className="truncate">{selectedClient.name}</span>
              ) : (
                <span className="text-muted-foreground">{t('form.selectClient')}</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-[var(--radix-popover-trigger-width)] p-0 max-h-[300px] sm:max-h-[400px]" 
            align="start"
            side="bottom"
            sideOffset={4}
            collisionPadding={8}
          >
            <Command>
              <CommandInput placeholder="Cerca cliente..." className="h-9" />
              <CommandList className="max-h-[250px] sm:max-h-[350px]">
                <CommandEmpty>
                  <div className="py-4 text-center text-sm">
                    <p className="text-muted-foreground mb-2">Nessun cliente trovato</p>
                    {onCreateClient && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onCreateClient()
                          setClientSearchOpen(false)
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Crea nuovo cliente
                      </Button>
                    )}
                  </div>
                </CommandEmpty>
                <CommandGroup>
                  {clients.map((client) => (
                    <CommandItem
                      key={client.id}
                      value={client.name}
                      onSelect={() => {
                        onClientChange(client.id)
                        setClientSearchOpen(false)
                      }}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          selectedClientId === client.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">{client.name}</span>
                        {client.email && (
                          <span className="text-xs text-muted-foreground">{client.email}</span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {onCreateClient && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCreateClient}
            className="w-full text-xs"
          >
            <Plus className="h-3 w-3 mr-1.5" />
            Crea nuovo cliente
          </Button>
        )}
      </div>

      {/* Date Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date" className="text-sm font-medium">
            {t('fields.date')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="h-11"
          />
        </div>

        {type === 'invoice' && dueDate !== undefined && onDueDateChange && (
          <div className="space-y-2">
            <Label htmlFor="due_date" className="text-sm font-medium">
              {t('fields.dueDate')}
            </Label>
            <Input
              id="due_date"
              type="date"
              value={dueDate}
              onChange={(e) => onDueDateChange(e.target.value)}
              className="h-11"
            />
          </div>
        )}

        {type === 'quote' && validUntil !== undefined && onValidUntilChange && (
          <div className="space-y-2">
            <Label htmlFor="valid_until" className="text-sm font-medium">
              {t('fields.validUntil')}
            </Label>
            <Input
              id="valid_until"
              type="date"
              value={validUntil}
              onChange={(e) => onValidUntilChange(e.target.value)}
              className="h-11"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="status" className="text-sm font-medium">
            Stato
          </Label>
          <Select value={status} onValueChange={onStatusChange}>
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Client Info Preview */}
      {selectedClient && (
        <div className="p-4 bg-muted/50 rounded-lg border space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase">Cliente selezionato</p>
          <div className="space-y-1">
            <p className="font-medium">{selectedClient.name}</p>
            {selectedClient.email && (
              <p className="text-sm text-muted-foreground">{selectedClient.email}</p>
            )}
            {selectedClient.phone && (
              <p className="text-sm text-muted-foreground">{selectedClient.phone}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


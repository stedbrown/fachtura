'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Search, Users, FileText, Receipt, Calendar } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import { it, de, fr, enUS, type Locale } from 'date-fns/locale'

const localeMap: Record<string, Locale> = {
  it: it,
  de: de,
  fr: fr,
  en: enUS,
  rm: de,
}

interface SearchResult {
  id: string
  type: 'client' | 'quote' | 'invoice'
  title: string
  subtitle: string
  date?: string
  url: string
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string
  const t = useTranslations('navigation')
  const tCommon = useTranslations('common')

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) {
      // Small delay to avoid interfering with closing animation
      const timer = setTimeout(() => {
        setSearch('')
        setResults([])
        setLoading(false)
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [open])

  // Debounced search
  const performSearch = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setResults([])
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    const searchLower = query.toLowerCase()

    // Search clients
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, email, city')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .or(`name.ilike.%${query}%,email.ilike.%${query}%,city.ilike.%${query}%`)
      .limit(5)

    // Search quotes (by number or client name)
    const { data: quotes } = await supabase
      .from('quotes')
      .select('id, quote_number, date, total, client:clients(name)')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .limit(10)
    
    // Filter quotes locally to include client name search
    const filteredQuotes = quotes?.filter(quote => 
      quote.quote_number.toLowerCase().includes(searchLower) ||
      (quote.client as any)?.name?.toLowerCase().includes(searchLower)
    ).slice(0, 5)

    // Search invoices (by number or client name)
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, invoice_number, date, total, client:clients(name)')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .limit(10)
    
    // Filter invoices locally to include client name search
    const filteredInvoices = invoices?.filter(invoice => 
      invoice.invoice_number.toLowerCase().includes(searchLower) ||
      (invoice.client as any)?.name?.toLowerCase().includes(searchLower)
    ).slice(0, 5)

    const searchResults: SearchResult[] = []

    // Add clients to results
    clients?.forEach((client) => {
      searchResults.push({
        id: client.id,
        type: 'client',
        title: client.name,
        subtitle: client.email || client.city || '',
        url: `/${locale}/dashboard/clients/${client.id}`,
      })
    })

    // Add quotes to results
    filteredQuotes?.forEach((quote: any) => {
      searchResults.push({
        id: quote.id,
        type: 'quote',
        title: quote.quote_number,
        subtitle: quote.client?.name || '',
        date: quote.date,
        url: `/${locale}/dashboard/quotes/${quote.id}`,
      })
    })

    // Add invoices to results
    filteredInvoices?.forEach((invoice: any) => {
      searchResults.push({
        id: invoice.id,
        type: 'invoice',
        title: invoice.invoice_number,
        subtitle: invoice.client?.name || '',
        date: invoice.date,
        url: `/${locale}/dashboard/invoices/${invoice.id}`,
      })
    })

    setResults(searchResults)
    setLoading(false)
  }, [locale])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(search)
    }, 300)

    return () => clearTimeout(timer)
  }, [search, performSearch])

  const handleSelect = (url: string) => {
    setOpen(false)
    setSearch('')
    router.push(url)
  }

  const clientResults = results.filter((r) => r.type === 'client')
  const quoteResults = results.filter((r) => r.type === 'quote')
  const invoiceResults = results.filter((r) => r.type === 'invoice')

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors w-full md:w-64"
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline">{tCommon('search')}...</span>
        <kbd className="pointer-events-none ml-auto hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 md:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
        <CommandInput
          placeholder={`${tCommon('search')} ${t('clients').toLowerCase()}, ${t('quotes').toLowerCase()}, ${t('invoices').toLowerCase()}...`}
          value={search}
          onValueChange={setSearch}
        />
        <CommandList className="max-h-[400px]">
          <CommandEmpty>
            {loading ? tCommon('loading') : tCommon('noResults')}
          </CommandEmpty>

          {clientResults.length > 0 && (
            <>
              <CommandGroup heading={t('clients')}>
                {clientResults.map((result) => (
                  <CommandItem
                    key={result.id}
                    onSelect={() => handleSelect(result.url)}
                    className="cursor-pointer"
                  >
                    <Users className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span className="font-medium">{result.title}</span>
                      {result.subtitle && (
                        <span className="text-xs text-muted-foreground">
                          {result.subtitle}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {quoteResults.length > 0 && (
            <>
              <CommandGroup heading={t('quotes')}>
                {quoteResults.map((result) => (
                  <CommandItem
                    key={result.id}
                    onSelect={() => handleSelect(result.url)}
                    className="cursor-pointer"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    <div className="flex flex-col flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{result.title}</span>
                        {result.date && (
                          <span className="text-xs text-muted-foreground ml-2">
                            <Calendar className="inline h-3 w-3 mr-1" />
                            {format(new Date(result.date), 'dd/MM/yyyy', {
                              locale: localeMap[locale] || enUS,
                            })}
                          </span>
                        )}
                      </div>
                      {result.subtitle && (
                        <span className="text-xs text-muted-foreground">
                          {result.subtitle}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {invoiceResults.length > 0 && (
            <CommandGroup heading={t('invoices')}>
              {invoiceResults.map((result) => (
                <CommandItem
                  key={result.id}
                  onSelect={() => handleSelect(result.url)}
                  className="cursor-pointer"
                >
                  <Receipt className="mr-2 h-4 w-4" />
                  <div className="flex flex-col flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{result.title}</span>
                      {result.date && (
                        <span className="text-xs text-muted-foreground ml-2">
                          <Calendar className="inline h-3 w-3 mr-1" />
                          {format(new Date(result.date), 'dd/MM/yyyy', {
                            locale: localeMap[locale] || enUS,
                          })}
                        </span>
                      )}
                    </div>
                    {result.subtitle && (
                      <span className="text-xs text-muted-foreground">
                        {result.subtitle}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}


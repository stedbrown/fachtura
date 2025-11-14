'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
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
import {
  Search,
  Users,
  FileText,
  Receipt,
  Calendar,
  Package,
  Truck,
  ShoppingCart,
  Wallet,
} from 'lucide-react'
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

type SearchResultType =
  | 'client'
  | 'quote'
  | 'invoice'
  | 'product'
  | 'order'
  | 'supplier'
  | 'expense'

interface SearchResult {
  id: string
  type: SearchResultType
  title: string
  subtitle: string
  date?: string
  meta?: string
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
  const tExpenses = useTranslations('expenses')

  const groupedResults = useMemo(() => {
    const groups: Record<SearchResultType, SearchResult[]> = {
      client: [],
      quote: [],
      invoice: [],
      product: [],
      order: [],
      supplier: [],
      expense: [],
    }

    results.forEach((result) => {
      groups[result.type].push(result)
    })

    return groups
  }, [results])

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

    const [
      { data: clients },
      { data: quotes },
      { data: invoices },
      { data: products },
      { data: orders },
      { data: suppliers },
      { data: expenses },
    ] = await Promise.all([
      supabase
        .from('clients')
        .select('id, name, email, city')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .or(`name.ilike.%${query}%,email.ilike.%${query}%,city.ilike.%${query}%`)
        .limit(5),
      supabase
        .from('quotes')
        .select('id, quote_number, date, total, clients!quotes_client_id_fkey(name)')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .limit(15),
      supabase
        .from('invoices')
        .select('id, invoice_number, date, total, clients!invoices_client_id_fkey(name)')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .limit(15),
      supabase
        .from('products')
        .select('id, name, sku, category, unit_price')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .or(`name.ilike.%${query}%,sku.ilike.%${query}%,category.ilike.%${query}%`)
        .limit(5),
      supabase
        .from('orders')
        .select('id, order_number, date, total, suppliers!orders_supplier_id_fkey(name)')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .limit(15),
      supabase
        .from('suppliers')
        .select('id, name, email, city')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .or(`name.ilike.%${query}%,email.ilike.%${query}%,city.ilike.%${query}%`)
        .limit(5),
      supabase
        .from('expenses')
        .select('id, description, category, amount, expense_date, suppliers!expenses_supplier_id_fkey(name)')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .or(`description.ilike.%${query}%,category.ilike.%${query}%,supplier_name.ilike.%${query}%`)
        .limit(5),
    ])

    const filteredQuotes = quotes
      ?.filter(
        (quote) => {
          const clientName = quote.clients && Array.isArray(quote.clients) && quote.clients[0] 
            ? (quote.clients[0] as { name?: string }).name 
            : (quote.clients as { name?: string })?.name
          return quote.quote_number.toLowerCase().includes(searchLower) ||
            clientName?.toLowerCase().includes(searchLower)
        }
      )
      .slice(0, 5)

    const filteredInvoices = invoices
      ?.filter(
        (invoice) => {
          const clientName = invoice.clients && Array.isArray(invoice.clients) && invoice.clients[0] 
            ? (invoice.clients[0] as { name?: string }).name 
            : (invoice.clients as { name?: string })?.name
          return invoice.invoice_number.toLowerCase().includes(searchLower) ||
            clientName?.toLowerCase().includes(searchLower)
        }
      )
      .slice(0, 5)

    const filteredOrders = orders
      ?.filter(
        (order) => {
          const supplierName = order.suppliers && Array.isArray(order.suppliers) && order.suppliers[0] 
            ? (order.suppliers[0] as { name?: string }).name 
            : (order.suppliers as { name?: string })?.name
          return order.order_number?.toLowerCase().includes(searchLower) ||
            supplierName?.toLowerCase().includes(searchLower)
        }
      )
      .slice(0, 5)

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

    suppliers?.forEach((supplier) => {
      searchResults.push({
        id: supplier.id,
        type: 'supplier',
        title: supplier.name,
        subtitle: supplier.email || supplier.city || '',
        url: `/${locale}/dashboard/suppliers`,
      })
    })

    // Add quotes to results
    filteredQuotes?.forEach((quote) => {
      const clientName = quote.clients && Array.isArray(quote.clients) && quote.clients[0] 
        ? (quote.clients[0] as { name?: string }).name 
        : (quote.clients as { name?: string })?.name
      searchResults.push({
        id: quote.id,
        type: 'quote',
        title: quote.quote_number,
        subtitle: clientName || '',
        date: quote.date,
        meta: quote.total ? `CHF ${quote.total.toFixed(2)}` : undefined,
        url: `/${locale}/dashboard/quotes/${quote.id}`,
      })
    })

    // Add invoices to results
    filteredInvoices?.forEach((invoice) => {
      const clientName = invoice.clients && Array.isArray(invoice.clients) && invoice.clients[0] 
        ? (invoice.clients[0] as { name?: string }).name 
        : (invoice.clients as { name?: string })?.name
      searchResults.push({
        id: invoice.id,
        type: 'invoice',
        title: invoice.invoice_number,
        subtitle: clientName || '',
        date: invoice.date,
        meta: invoice.total ? `CHF ${invoice.total.toFixed(2)}` : undefined,
        url: `/${locale}/dashboard/invoices/${invoice.id}`,
      })
    })

    products?.forEach((product) => {
      searchResults.push({
        id: product.id,
        type: 'product',
        title: product.name,
        subtitle: product.category || product.sku || '',
        meta: product.unit_price ? `CHF ${product.unit_price.toFixed(2)}` : undefined,
        url: `/${locale}/dashboard/products`,
      })
    })

    filteredOrders?.forEach((order) => {
      const supplierName = order.suppliers && Array.isArray(order.suppliers) && order.suppliers[0] 
        ? (order.suppliers[0] as { name?: string }).name 
        : (order.suppliers as { name?: string })?.name
      searchResults.push({
        id: order.id,
        type: 'order',
        title: order.order_number,
        subtitle: supplierName || '',
        date: order.date,
        meta: order.total ? `CHF ${order.total.toFixed(2)}` : undefined,
        url: `/${locale}/dashboard/orders`,
      })
    })

    expenses?.forEach((expense) => {
      const supplierName = expense.suppliers && Array.isArray(expense.suppliers) && expense.suppliers[0] 
        ? (expense.suppliers[0] as { name?: string }).name 
        : (expense.suppliers as { name?: string })?.name
      searchResults.push({
        id: expense.id,
        type: 'expense',
        title: expense.description,
        subtitle: supplierName || tExpenses('categories.' + expense.category) || expense.category,
        date: expense.expense_date,
        meta: expense.amount ? `CHF ${expense.amount.toFixed(2)}` : undefined,
        url: `/${locale}/dashboard/expenses`,
      })
    })

    setResults(searchResults)
    setLoading(false)
  }, [locale, tExpenses])

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

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-2 sm:px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors h-9 w-9 sm:w-auto sm:min-w-[200px] md:min-w-[240px]"
        aria-label={tCommon('search')}
      >
        <Search className="h-4 w-4 flex-shrink-0" />
        <span className="hidden sm:inline truncate">{tCommon('search')}...</span>
        <kbd className="pointer-events-none ml-auto hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 md:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        shouldFilter={false}
        className="w-full max-w-[min(100vw-2rem,640px)]"
      >
        <CommandInput
          placeholder={`${tCommon('search')} ${t('clients').toLowerCase()}, ${t('quotes').toLowerCase()}, ${t('invoices').toLowerCase()}...`}
          value={search}
          onValueChange={setSearch}
        />
        <CommandList className="max-h-[60vh] md:max-h-[480px]">
          <CommandEmpty>
            {loading ? tCommon('loading') : tCommon('noResults')}
          </CommandEmpty>

          {groupedResults.client.length > 0 && (
            <>
              <CommandGroup heading={t('clients')}>
                {groupedResults.client.map((result) => (
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

          {groupedResults.supplier.length > 0 && (
            <>
              <CommandGroup heading={t('suppliers')}>
                {groupedResults.supplier.map((result) => (
                  <CommandItem
                    key={result.id}
                    onSelect={() => handleSelect(result.url)}
                    className="cursor-pointer"
                  >
                    <Truck className="mr-2 h-4 w-4" />
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

          {groupedResults.quote.length > 0 && (
            <>
              <CommandGroup heading={t('quotes')}>
                {groupedResults.quote.map((result) => (
                  <CommandItem
                    key={result.id}
                    onSelect={() => handleSelect(result.url)}
                    className="cursor-pointer"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    <div className="flex flex-col flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{result.title}</span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {result.date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(result.date), 'dd/MM/yyyy', {
                                locale: localeMap[locale] || enUS,
                              })}
                            </span>
                          )}
                          {result.meta && <span>{result.meta}</span>}
                        </div>
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

          {groupedResults.invoice.length > 0 && (
            <>
              <CommandGroup heading={t('invoices')}>
                {groupedResults.invoice.map((result) => (
                  <CommandItem
                    key={result.id}
                    onSelect={() => handleSelect(result.url)}
                    className="cursor-pointer"
                  >
                    <Receipt className="mr-2 h-4 w-4" />
                    <div className="flex flex-col flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{result.title}</span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {result.date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(result.date), 'dd/MM/yyyy', {
                                locale: localeMap[locale] || enUS,
                              })}
                            </span>
                          )}
                          {result.meta && <span>{result.meta}</span>}
                        </div>
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

          {groupedResults.product.length > 0 && (
            <>
              <CommandGroup heading={t('products')}>
                {groupedResults.product.map((result) => (
                  <CommandItem
                    key={result.id}
                    onSelect={() => handleSelect(result.url)}
                    className="cursor-pointer"
                  >
                    <Package className="mr-2 h-4 w-4" />
                    <div className="flex flex-col flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{result.title}</span>
                        {result.meta && (
                          <span className="text-xs text-muted-foreground ml-2">
                            {result.meta}
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

          {groupedResults.order.length > 0 && (
            <CommandGroup heading={t('orders')}>
              {groupedResults.order.map((result) => (
                <CommandItem
                  key={result.id}
                  onSelect={() => handleSelect(result.url)}
                  className="cursor-pointer"
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  <div className="flex flex-col flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{result.title}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {result.date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(result.date), 'dd/MM/yyyy', {
                              locale: localeMap[locale] || enUS,
                            })}
                          </span>
                        )}
                        {result.meta && <span>{result.meta}</span>}
                      </div>
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

          {groupedResults.expense.length > 0 && (
            <CommandGroup heading={t('expenses')}>
              {groupedResults.expense.map((result) => (
                <CommandItem
                  key={result.id}
                  onSelect={() => handleSelect(result.url)}
                  className="cursor-pointer"
                >
                  <Wallet className="mr-2 h-4 w-4" />
                  <div className="flex flex-col flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{result.title}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {result.date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(result.date), 'dd/MM/yyyy', {
                              locale: localeMap[locale] || enUS,
                            })}
                          </span>
                        )}
                        {result.meta && <span className="font-medium">{result.meta}</span>}
                      </div>
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


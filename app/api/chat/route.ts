import { streamText, convertToCoreMessages, tool } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'
import { z } from 'zod'

export const runtime = 'edge'

const systemPrompts = {
  it: `Sei l'assistente AI di Fattura. Rispondi SEMPRE all'utente con testo conversazionale.

QUANDO USI I TOOL:

1. list_clients → Mostra lista numerata con nome, email, città
   Esempio: "Ecco i tuoi 3 clienti:
   1. Mario Rossi (mario@email.com) - Milano
   2. Luigi Verdi (luigi@email.com) - Roma
   ..."

2. get_subscription_status → Riassumi piano e limiti in modo chiaro
   Esempio: "Sei sul piano Free:
   • Clienti: 1/3 utilizzati
   • Fatture: 0/5 questo mese
   • Preventivi: 0/5 questo mese"

3. get_invoice_stats → Mostra statistiche leggibili
   Esempio: "Statistiche fatture (ultimo mese):
   • Totale: 5 fatture per CHF 2,450.00
   • Pagate: 3 • Emesse: 1 • Bozze: 1"

4. create_invoice/create_quote → MOSTRA il campo "message" dal tool
   (contiene già numero, totale e link cliccabile)

IMPORTANTE: Rispondi sempre in italiano, con emoji ✅ ❌ 📊 quando opportuno, e formatta i numeri (es: CHF 1,081.00).`,

  en: `AI for Fattura. 6 tools.

KEY RULE: When tool output has "message" field, SHOW THAT TEXT to user (includes links!).

Respond in English.`,

  de: `KI für Fattura. 6 Tools. Wenn Output "message" hat, ZEIGE ES (mit Links!).`,

  fr: `IA Fattura. 6 outils. Si output a "message", MONTRE-LE (avec liens!).`,

  rm: `AI Fattura. 6 instruments. Sche output ha "message", MUSSA-L (cun links!).`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages = [] } = body
    // Estrai locale dai metadata del messaggio o dal body
    const locale = body.data?.locale || body.locale || 'it'

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY!,
    })

    // Converti i messaggi UI in formato modello (gestisce parts automaticamente)
    const coreMessages = convertToCoreMessages(messages)

    // StreamText di AI SDK con tools (sintassi corretta con 2 parametri)
    const result = await streamText({
      model: openrouter('openai/gpt-4o-mini'),
      system: systemPrompts[locale as keyof typeof systemPrompts] || systemPrompts.it,
      messages: coreMessages,
      toolChoice: 'auto', // AI decide quando usare i tool
      tools: {
        // Tool 1: Lista clienti
        list_clients: tool({
          description: 'Get a list of all active clients for the user',
          inputSchema: z.object({
            limit: z.coerce.number().optional().default(10).describe('Maximum number of clients to return')
          }),
          execute: async (input, options) => {
            const { limit } = input
            const { data: clients } = await supabase
              .from('clients')
              .select('id, name, email, phone, address, city, postal_code, country, created_at')
              .eq('user_id', user.id)
              .is('deleted_at', null)
              .order('created_at', { ascending: false })
              .limit(limit)
            
            return { clients: clients || [], count: clients?.length || 0 }
          }
        }),

        // Tool 2: Cerca cliente
        search_client: tool({
          description: 'Search for a client by name',
          inputSchema: z.object({
            name: z.string().describe('The name of the client to search for')
          }),
          execute: async (input, options) => {
            const { name } = input
            const { data: client } = await supabase
              .from('clients')
              .select('id, name, email, phone, address, city, postal_code, country')
              .eq('user_id', user.id)
              .is('deleted_at', null)
              .ilike('name', `%${name}%`)
              .single()
            
            return client || { error: 'Client not found' }
          }
        }),

        // Tool 3: Stato abbonamento
        get_subscription_status: tool({
          description: 'Get the current subscription plan details, limits and usage',
          inputSchema: z.object({}),
          execute: async (input, options) => {
            const { data: subscription } = await supabase
              .from('user_subscriptions')
              .select(`
                *,
                plan:subscription_plans(*)
              `)
              .eq('user_id', user.id)
              .single()

            if (!subscription) {
              return { error: 'No subscription found' }
            }

            // Conta usage attuale
            const { count: clientCount } = await supabase
              .from('clients')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .is('deleted_at', null)

            const { count: invoiceCount } = await supabase
              .from('invoices')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())

            const { count: quoteCount } = await supabase
              .from('quotes')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())

            return {
              plan_name: subscription.plan?.name,
              status: subscription.status,
              limits: {
                clients: { current: clientCount, max: subscription.plan?.max_clients },
                invoices: { current: invoiceCount, max: subscription.plan?.max_invoices },
                quotes: { current: quoteCount, max: subscription.plan?.max_quotes }
              }
            }
          }
        }),

        // Tool 4: Statistiche fatture
        get_invoice_stats: tool({
          description: 'Get statistics about invoices (total count, by status, by period)',
          inputSchema: z.object({
            period: z.enum(['month', 'year', 'all']).default('month').describe('Time period for statistics')
          }),
          execute: async (input, options) => {
            const { period } = input
            let query = supabase
              .from('invoices')
              .select('id, total, status, date')
              .eq('user_id', user.id)
              .is('deleted_at', null)

            const now = new Date()
            if (period === 'month') {
              const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
              query = query.gte('date', startOfMonth)
            } else if (period === 'year') {
              const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString()
              query = query.gte('date', startOfYear)
            }

            const { data: invoices } = await query

            const stats = {
              total_count: invoices?.length || 0,
              total_amount: invoices?.reduce((sum, inv) => sum + Number(inv.total), 0) || 0,
              by_status: {
                draft: invoices?.filter(i => i.status === 'draft').length || 0,
                issued: invoices?.filter(i => i.status === 'issued').length || 0,
                paid: invoices?.filter(i => i.status === 'paid').length || 0,
                overdue: invoices?.filter(i => i.status === 'overdue').length || 0
              },
              period
            }

            return stats
          }
        }),

        // Tool 5: Crea fattura
        create_invoice: tool({
          description: 'ALWAYS USE THIS TOOL when user asks to create an invoice or fattura. Creates a new invoice for a client with line items and saves it to the database. Returns the invoice ID and confirmation.',
          inputSchema: z.object({
            client_id: z.string().uuid().describe('The UUID of the client'),
            items: z.array(z.object({
              description: z.string().describe('Item description'),
              quantity: z.coerce.number().describe('Quantity'),
              unit_price: z.coerce.number().describe('Unit price in CHF'),
              tax_rate: z.coerce.number().optional().default(8.1).describe('Tax rate percentage (default 8.1)')
            })).describe('List of invoice items'),
            notes: z.string().optional().describe('Optional notes for the invoice')
          }),
          execute: async (input, options) => {
            const { client_id, items, notes } = input

            // Verifica limiti abbonamento
            const { data: subscription } = await supabase
              .from('user_subscriptions')
              .select('*, plan:subscription_plans(*)')
              .eq('user_id', user.id)
              .single()

            if (!subscription) {
              return { error: 'No active subscription found' }
            }

            // Conta fatture questo mese
            const now = new Date()
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
            const { count: invoiceCount } = await supabase
              .from('invoices')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .gte('created_at', startOfMonth)

            if (invoiceCount && invoiceCount >= (subscription.plan?.max_invoices || 0)) {
              return { error: `Limite fatture raggiunto (${subscription.plan?.max_invoices}/mese)` }
            }

            // Genera numero fattura
            const { count: totalInvoices } = await supabase
              .from('invoices')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)

            const invoiceNumber = `INV-${String((totalInvoices || 0) + 1).padStart(4, '0')}`

            // Calcola totali
            const subtotal = items.reduce((sum, item) => 
              sum + (item.quantity * item.unit_price), 0
            )
            const tax_amount = items.reduce((sum, item) => 
              sum + (item.quantity * item.unit_price * (item.tax_rate || 8.1) / 100), 0
            )
            const total = subtotal + tax_amount

            // Crea fattura
            const { data: invoice, error: invoiceError } = await supabase
              .from('invoices')
              .insert({
                user_id: user.id,
                client_id,
                invoice_number: invoiceNumber,
                date: new Date().toISOString().split('T')[0],
                status: 'draft',
                subtotal,
                tax_amount,
                total,
                notes: notes || null
              })
              .select()
              .single()

            if (invoiceError || !invoice) {
              return { error: `Errore creazione fattura: ${invoiceError?.message}` }
            }

            // Aggiungi items
            const invoiceItems = items.map(item => ({
              invoice_id: invoice.id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              tax_rate: item.tax_rate || 8.1,
              line_total: item.quantity * item.unit_price * (1 + (item.tax_rate || 8.1) / 100)
            }))

            const { error: itemsError } = await supabase
              .from('invoice_items')
              .insert(invoiceItems)

            if (itemsError) {
              // Rollback: cancella fattura
              await supabase.from('invoices').delete().eq('id', invoice.id)
              return { error: `Errore aggiunta items: ${itemsError.message}` }
            }

            const invoiceUrl = `https://fachtura.vercel.app/${locale}/dashboard/invoices/${invoice.id}`
            
            return {
              success: true,
              invoice_id: invoice.id,
              invoice_number: invoiceNumber,
              total: total,
              invoice_url: invoiceUrl,
              message: `✅ Fattura ${invoiceNumber} creata con successo!\n\nTotale: CHF ${total.toFixed(2)}\n\nVedi fattura: ${invoiceUrl}`
            }
          }
        }),

        // Tool 6: Crea preventivo
        create_quote: tool({
          description: 'Create a new quote for a client with items. Returns the quote ID and PDF download link.',
          inputSchema: z.object({
            client_id: z.string().uuid().describe('The UUID of the client'),
            items: z.array(z.object({
              description: z.string().describe('Item description'),
              quantity: z.coerce.number().describe('Quantity'),
              unit_price: z.coerce.number().describe('Unit price in CHF'),
              tax_rate: z.coerce.number().optional().default(8.1).describe('Tax rate percentage (default 8.1)')
            })).describe('List of quote items'),
            notes: z.string().optional().describe('Optional notes for the quote'),
            valid_days: z.coerce.number().optional().default(30).describe('Days until quote expires (default 30)')
          }),
          execute: async (input, options) => {
            const { client_id, items, notes, valid_days } = input

            // Verifica limiti abbonamento
            const { data: subscription } = await supabase
              .from('user_subscriptions')
              .select('*, plan:subscription_plans(*)')
              .eq('user_id', user.id)
              .single()

            if (!subscription) {
              return { error: 'No active subscription found' }
            }

            // Conta preventivi questo mese
            const now = new Date()
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
            const { count: quoteCount } = await supabase
              .from('quotes')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .gte('created_at', startOfMonth)

            if (quoteCount && quoteCount >= (subscription.plan?.max_quotes || 0)) {
              return { error: `Limite preventivi raggiunto (${subscription.plan?.max_quotes}/mese)` }
            }

            // Genera numero preventivo
            const { count: totalQuotes } = await supabase
              .from('quotes')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)

            const quoteNumber = `QUO-${String((totalQuotes || 0) + 1).padStart(4, '0')}`

            // Calcola totali
            const subtotal = items.reduce((sum, item) => 
              sum + (item.quantity * item.unit_price), 0
            )
            const tax_amount = items.reduce((sum, item) => 
              sum + (item.quantity * item.unit_price * (item.tax_rate || 8.1) / 100), 0
            )
            const total = subtotal + tax_amount

            // Calcola data scadenza
            const validUntil = new Date()
            validUntil.setDate(validUntil.getDate() + (valid_days || 30))

            // Crea preventivo
            const { data: quote, error: quoteError } = await supabase
              .from('quotes')
              .insert({
                user_id: user.id,
                client_id,
                quote_number: quoteNumber,
                date: new Date().toISOString().split('T')[0],
                valid_until: validUntil.toISOString().split('T')[0],
                status: 'draft',
                subtotal,
                tax_amount,
                total,
                notes: notes || null
              })
              .select()
              .single()

            if (quoteError || !quote) {
              return { error: `Errore creazione preventivo: ${quoteError?.message}` }
            }

            // Aggiungi items
            const quoteItems = items.map(item => ({
              quote_id: quote.id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              tax_rate: item.tax_rate || 8.1,
              line_total: item.quantity * item.unit_price * (1 + (item.tax_rate || 8.1) / 100)
            }))

            const { error: itemsError } = await supabase
              .from('quote_items')
              .insert(quoteItems)

            if (itemsError) {
              // Rollback: cancella preventivo
              await supabase.from('quotes').delete().eq('id', quote.id)
              return { error: `Errore aggiunta items: ${itemsError.message}` }
            }

            const quoteUrl = `https://fachtura.vercel.app/${locale}/dashboard/quotes/${quote.id}`
            
            return {
              success: true,
              quote_id: quote.id,
              quote_number: quoteNumber,
              total: total,
              valid_until: validUntil.toISOString().split('T')[0],
              quote_url: quoteUrl,
              message: `✅ Preventivo ${quoteNumber} creato con successo!\n\nTotale: CHF ${total.toFixed(2)}\nValido fino: ${validUntil.toISOString().split('T')[0]}\n\nVedi preventivo: ${quoteUrl}`
            }
          }
        })
      }
    })

    // Metodo per useChat hook con headers espliciti
    return result.toUIMessageStreamResponse({
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Vercel-AI-Data-Stream': 'v1',
      }
    })

  } catch (error: any) {
    console.error('Chat API error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

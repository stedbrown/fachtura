import { streamText, convertToCoreMessages, tool } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'
import { z } from 'zod'

export const runtime = 'edge'

const systemPrompts = {
  it: `Sei un assistente AI per Fattura, una piattaforma di gestione fatture e preventivi.

Hai accesso ai seguenti strumenti:
- list_clients: Ottieni la lista dei clienti attivi
- search_client: Cerca un cliente per nome
- get_subscription_status: Verifica piano e limiti
- get_invoice_stats: Statistiche fatture
- create_invoice: Crea una nuova fattura per un cliente con righe
- create_quote: Crea un nuovo preventivo per un cliente con righe

ISTRUZIONI FONDAMENTALI:
1. USA SEMPRE gli strumenti disponibili per ottenere dati reali. NON inventare dati.
2. Per creare fatture/preventivi:
   - STEP 1: Usa list_clients o search_client per ottenere il client_id
   - STEP 2: Chiama IMMEDIATAMENTE create_invoice o create_quote con i dati
   - NON chiedere conferma, CREA DIRETTAMENTE il documento
3. Quando un tool restituisce un risultato, MOSTRALO all'utente in modo chiaro
4. Se un tool fallisce, mostra l'errore e suggerisci una soluzione

Rispondi sempre in italiano, in modo conciso e professionale.`,

  en: `You are an AI assistant for Fattura, an invoice and quote management platform.

You have access to the following tools:
- list_clients: Get the list of active clients
- search_client: Search for a client by name
- get_subscription_status: Check plan and limits
- get_invoice_stats: Invoice statistics
- create_invoice: Create a new invoice for a client with line items
- create_quote: Create a new quote for a client with line items

CRITICAL INSTRUCTIONS:
1. ALWAYS USE the tools to get real data. DO NOT make up data.
2. To create invoices/quotes:
   - STEP 1: Use list_clients or search_client to get the client_id
   - STEP 2: IMMEDIATELY call create_invoice or create_quote with the data
   - DO NOT ask for confirmation, CREATE the document DIRECTLY
3. When a tool returns a result, SHOW it to the user clearly
4. If a tool fails, show the error and suggest a solution

Always respond in English, concisely and professionally.`,

  de: `Du bist ein KI-Assistent für Fattura, eine Plattform zur Verwaltung von Rechnungen und Angeboten.

Du hast Zugriff auf folgende Tools:
- list_clients: Kundenliste abrufen
- search_client: Kunden nach Namen suchen
- get_subscription_status: Plan und Limits prüfen
- get_invoice_stats: Rechnungsstatistiken
- create_invoice: Neue Rechnung für Kunden erstellen
- create_quote: Neues Angebot für Kunden erstellen

WICHTIGE ANWEISUNGEN:
1. VERWENDE IMMER die Tools für echte Daten. ERFINDE KEINE Daten.
2. Rechnungen/Angebote erstellen:
   - SCHRITT 1: Hole client_id mit list_clients oder search_client
   - SCHRITT 2: Rufe SOFORT create_invoice oder create_quote auf
   - KEINE Bestätigung fragen, DIREKT erstellen
3. Zeige Tool-Ergebnisse klar an
4. Bei Fehlern: Fehler zeigen und Lösung vorschlagen

Antworte auf Deutsch, prägnant und professionell.`,

  fr: `Tu es un assistant IA pour Fattura, une plateforme de gestion de factures et devis.

Tu as accès aux outils suivants:
- list_clients: Obtenir la liste des clients
- search_client: Rechercher un client par nom
- get_subscription_status: Vérifier plan et limites
- get_invoice_stats: Statistiques de factures
- create_invoice: Créer une nouvelle facture pour un client
- create_quote: Créer un nouveau devis pour un client

INSTRUCTIONS CRITIQUES:
1. UTILISE TOUJOURS les outils pour données réelles. N'INVENTE PAS.
2. Pour créer factures/devis:
   - ÉTAPE 1: Obtiens client_id avec list_clients ou search_client
   - ÉTAPE 2: Appelle IMMÉDIATEMENT create_invoice ou create_quote
   - NE demande PAS confirmation, CRÉE DIRECTEMENT
3. Montre les résultats clairement
4. Si erreur: montre-la et suggère solution

Réponds en français, de manière concise et professionnelle.`,

  rm: `Ti eis in assistent AI per Fattura, ina plattaforma per administrar facturas e preventivs.

Ti has access als suandants instruments:
- list_clients: Survegnir glista da clients
- search_client: Tschertgar client tenor num
- get_subscription_status: Verifitgar plan e limits
- get_invoice_stats: Statisticas da facturas
- create_invoice: Crear nova factura per client
- create_quote: Crear nov preventiv per client

INSTRUCZIUNS IMPURTANTAS:
1. DUVRA ADINA ils instruments per datas realas. NA INVENTESCHA betg.
2. Per crear facturas/preventivs:
   - PASS 1: Surven client_id cun list_clients u search_client
   - PASS 2: Cloma IMMEDIAT create_invoice u create_quote
   - NA dumonda betg conferma, CREA DIRECT
3. Mussa ils resultats clar
4. Sche errur: mussa-l e propona soluziun

Respunda en rumantsch, concis e profesiunal.`
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

    console.log(`[Chat API] User: ${user.id}, Locale: ${locale}, Messages: ${messages.length}`)

    // StreamText di AI SDK con tools (sintassi corretta con 2 parametri)
    const result = await streamText({
      model: openrouter('anthropic/claude-3.5-haiku'),
      system: systemPrompts[locale as keyof typeof systemPrompts] || systemPrompts.it,
      messages: coreMessages,
      toolChoice: 'auto', // Forza l'AI a considerare i tool
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
            console.log('[create_invoice] Tool called with input:', JSON.stringify(input))
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
              total: item.quantity * item.unit_price * (1 + (item.tax_rate || 8.1) / 100)
            }))

            const { error: itemsError } = await supabase
              .from('invoice_items')
              .insert(invoiceItems)

            if (itemsError) {
              // Rollback: cancella fattura
              await supabase.from('invoices').delete().eq('id', invoice.id)
              return { error: `Errore aggiunta items: ${itemsError.message}` }
            }

            const response = {
              success: true,
              invoice_id: invoice.id,
              invoice_number: invoiceNumber,
              total: total,
              message: `Fattura ${invoiceNumber} creata con successo! Totale: CHF ${total.toFixed(2)}`
            }
            console.log('[create_invoice] Success:', JSON.stringify(response))
            return response
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
              total: item.quantity * item.unit_price * (1 + (item.tax_rate || 8.1) / 100)
            }))

            const { error: itemsError } = await supabase
              .from('quote_items')
              .insert(quoteItems)

            if (itemsError) {
              // Rollback: cancella preventivo
              await supabase.from('quotes').delete().eq('id', quote.id)
              return { error: `Errore aggiunta items: ${itemsError.message}` }
            }

            return {
              success: true,
              quote_id: quote.id,
              quote_number: quoteNumber,
              total: total,
              valid_until: validUntil.toISOString().split('T')[0],
              message: `Preventivo ${quoteNumber} creato con successo! Totale: CHF ${total.toFixed(2)}`
            }
          }
        })
      },
      maxSteps: 10
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

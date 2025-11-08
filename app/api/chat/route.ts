import { streamText, generateText, convertToCoreMessages, tool } from 'ai'
import { openai } from '@ai-sdk/openai'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'
import { z } from 'zod'

export const runtime = 'nodejs'

const systemPrompts = {
  it: `Sei l'assistente AI di Fattura. NON SEI UN API. Sei un assistente CONVERSAZIONALE.

⚠️⚠️⚠️ REGOLE ASSOLUTE ⚠️⚠️⚠️
1. DOPO OGNI TOOL CALL, DEVI **SEMPRE** GENERARE UNA RISPOSTA TESTUALE IN ITALIANO.
2. NON FERMARTI DOPO IL TOOL CALL. CONTINUA CON LA RISPOSTA TESTUALE.
3. MAI SOLO JSON. MAI FERMARSI DOPO IL TOOL.
4. **MOSTRA SEMPRE I DATI COMPLETI** ritornati dai tool - NON dire solo "Ecco i tuoi X elementi" senza mostrarli!
5. Se un tool ritorna una lista, DEVI elencare TUTTI gli elementi con i loro dettagli!

FLUSSO OBBLIGATORIO (SEGUI SEMPRE):

User: "Mostrami i miei clienti"
→ 1. Chiami tool: list_clients
→ 2. Tool ritorna: {clients: [{name: "Mario Rossi", email: "mario@email.com", city: "Milano"}, ...], count: 3}
→ 3. ⚠️ DEVI MOSTRARE **TUTTI I DATI** ritornati dal tool! Non dire solo "Ecco i tuoi 3 clienti" e basta!
→ 4. TU SCRIVI esattamente i dati ricevuti:
   "Ecco i tuoi 3 clienti:
   
   1. 📧 Mario Rossi
      • Email: mario@email.com
      • Città: Milano
   
   2. 📧 Luigi Verdi
      • Email: luigi@email.com
      • Città: Roma
   
   3. 📧 Anna Bianchi
      • Città: Lugano"

User: "Fammi vedere le fatture pagate"
→ 1. Chiami tool: list_invoices con status="paid" (valori: draft/issued/paid/overdue/all)
→ 2. Tool ritorna: {invoices: [{invoice_number: "INV-001", total: 1500, clients: {name: "Mario"}}], count: 2}
→ 3. TU SCRIVI: "📄 Hai 2 fatture pagate:
   1. INV-001 - CHF 1,500.00 - Mario - 05/11/2025
   2. INV-002 - CHF 850.00 - Luigi - 03/11/2025"

NOTA: Gli status sono in INGLESE (draft, issued, paid, overdue), non in italiano!

User: "Crea fattura per Emanuele: Design 5 ore a 100 CHF"
→ 1. Chiami tool: list_clients
→ 2. Tool ritorna: {clients: [{id: "abc-123", name: "Emanuele Novara"}]}
→ 3. Chiami tool: create_invoice con client_id="abc-123", items=[{description: "Design", quantity: 5, unit_price: 100}]
→ 4. Tool ritorna: {success: true, message: "✅ Fattura INV-004 creata! Totale: CHF 540.50\nVedi: https://..."}
→ 5. TU SCRIVI ESATTAMENTE IL CAMPO "message": "✅ Fattura INV-004 creata con successo!

Totale: CHF 540.50

Vedi fattura: https://fachtura.vercel.app/it/dashboard/invoices/..."

⚠️ VIETATO RISPONDERE CON SOLO JSON! ⚠️

Dopo OGNI tool call, DEVI scrivere una risposta in italiano per l'utente.

IMPORTANTE:
• NON rispondere solo con JSON o codice
• SEMPRE genera testo conversazionale in italiano
• Usa emoji: ✅❌📊📄💰📧
• Formatta numeri: CHF 1,081.00
• Se tool ha campo "message", COPIALO TESTUALMENTE nella tua risposta
• Sii amichevole, conciso, utile

⚠️⚠️⚠️ ERRORE COMUNE DA EVITARE ⚠️⚠️⚠️
NON dire mai: "Ecco i tuoi 2 clienti registrati" e fermarti lì!
DEVI continuare con: "1. Nome Cliente - email - città\n2. Nome Cliente 2 - email - città"
MOSTRA SEMPRE I DATI COMPLETI!

RICORDA: Sei un ASSISTENTE UMANO, non un'API!`,

  en: `AI for Fattura. 9 tools available.

KEY RULE: Always respond with conversational text, never just JSON.

When using tools, format output nicely:
- list_clients → numbered list with name, email, city
- get_client_details → full client info + history
- list_invoices → formatted invoice list
- get_invoice_stats → statistics with emoji 📊💰
- create_invoice/create_quote → SHOW the "message" field (has link!)

Use emoji for clarity. Format numbers as CHF 1,081.00. Respond in English.`,

  de: `KI für Fattura. 9 Tools verfügbar.

REGEL: Immer mit konversationalem Text antworten, nie nur JSON.

Tools formatieren:
- list_clients → nummerierte Liste
- get_client_details → vollständige Info + Historie
- create_invoice/create_quote → "message" Feld ZEIGEN (hat Link!)

Emoji verwenden 📊💰. Zahlen: CHF 1,081.00. Auf Deutsch antworten.`,

  fr: `IA Fattura. 9 outils disponibles.

RÈGLE: Toujours répondre avec texte conversationnel, jamais JSON seul.

Outils:
- list_clients → liste numérotée
- get_client_details → info complète + historique
- create_invoice/create_quote → MONTRER champ "message" (a le lien!)

Emoji 📊💰. Nombres: CHF 1,081.00. Répondre en français.`,

  rm: `AI Fattura. 9 instruments disponibels.

REGLA: Adina respunder cun text conversaziunal.

create_invoice/create_quote → MUSSA "message" (ha link!).

Emoji 📊💰. Nummers: CHF 1,081.00. Romontsch.`
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

    // Converti i messaggi UI in formato modello (gestisce parts automaticamente)
    const coreMessages = convertToCoreMessages(messages)

    // DUAL-CALL PATTERN - GUARANTEED TEXT RESPONSE AFTER TOOL CALLS
    // Problem: AI SDK v5 doesn't automatically do a second inference round after tool execution
    // Solution: We manually check if tools were called, and if so, make a second call to generate text
    console.log('[Chat API] Using dual-call pattern for guaranteed tool result display...')
    
    // Define tools configuration (reusable)
    const toolsConfig = {
        // Tool 1: Lista clienti
        list_clients: tool({
          description: 'Get a list of all active clients for the user. IMPORTANT: After calling this tool, you MUST display ALL the client data (name, email, phone, city, etc.) in your response. Do NOT just say "Here are your X clients" without showing the actual data!',
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

        // Tool 4: Dettagli cliente completi
        get_client_details: tool({
          description: 'Get complete details of a specific client including their invoices and quotes history',
          inputSchema: z.object({
            client_id: z.string().uuid().describe('The UUID of the client')
          }),
          execute: async (input, options) => {
            const { client_id } = input
            
            // Get client info
            const { data: client } = await supabase
              .from('clients')
              .select('*')
              .eq('id', client_id)
              .eq('user_id', user.id)
              .is('deleted_at', null)
              .single()
            
            if (!client) {
              return { error: 'Cliente non trovato' }
            }
            
            // Get client's invoices
            const { data: invoices } = await supabase
              .from('invoices')
              .select('id, invoice_number, date, status, total')
              .eq('client_id', client_id)
              .is('deleted_at', null)
              .order('date', { ascending: false })
              .limit(10)
            
            // Get client's quotes
            const { data: quotes } = await supabase
              .from('quotes')
              .select('id, quote_number, date, status, total')
              .eq('client_id', client_id)
              .is('deleted_at', null)
              .order('date', { ascending: false })
              .limit(10)
            
            return {
              client,
              invoices: invoices || [],
              quotes: quotes || [],
              total_invoices: invoices?.length || 0,
              total_quotes: quotes?.length || 0
            }
          }
        }),

        // Tool 5: Lista fatture
        list_invoices: tool({
          description: 'Get list of invoices with optional filters by status or date range. IMPORTANT: After calling this tool, you MUST display ALL the invoice data (invoice_number, date, total, client name, status) in your response. Do NOT just say "Here are your X invoices" without showing the actual data!',
          inputSchema: z.object({
            status: z.enum(['draft', 'issued', 'paid', 'overdue', 'all']).optional().default('all').describe('Filter by invoice status'),
            limit: z.coerce.number().optional().default(10).describe('Maximum number of invoices to return')
          }),
          execute: async (input, options) => {
            const { status, limit } = input
            
            let query = supabase
              .from('invoices')
              .select(`
                id,
                invoice_number,
                date,
                due_date,
                status,
                total,
                clients!inner(name)
              `)
              .eq('user_id', user.id)
              .is('deleted_at', null)
              .order('date', { ascending: false })
              .limit(limit)
            
            if (status !== 'all') {
              query = query.eq('status', status)
            }
            
            const { data: invoices } = await query
            
            return {
              invoices: invoices || [],
              count: invoices?.length || 0,
              filter: status
            }
          }
        }),

        // Tool 6: Statistiche fatture
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

        // Tool 7: Impostazioni azienda
        get_company_settings: tool({
          description: 'Get company settings and configuration (company name, address, VAT, IBAN, etc)',
          inputSchema: z.object({}),
          execute: async (input, options) => {
            const { data: settings } = await supabase
              .from('company_settings')
              .select('*')
              .eq('user_id', user.id)
              .single()
            
            if (!settings) {
              return { 
                error: 'Impostazioni azienda non configurate',
                message: 'Le impostazioni azienda non sono ancora configurate. Vai su Impostazioni per completare il profilo aziendale.'
              }
            }
            
            return { settings }
          }
        }),

        // Tool 8: Crea fattura
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

        // Tool 9: Crea preventivo
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
    }; // End of toolsConfig

    // STEP 1: First call - Execute tools (non-streaming to check results)
    // Using GPT-4o-mini for cost-effective tool calling with excellent performance
    console.log('[Chat API] Step 1: Calling OpenAI GPT-4o-mini with tools...')
    const firstCall = await generateText({
      model: openai('gpt-4o-mini'),
      system: systemPrompts[locale as keyof typeof systemPrompts] || systemPrompts.it,
      messages: coreMessages,
      temperature: 0.7,
      toolChoice: 'auto',
      tools: toolsConfig,
    })

    console.log('[Chat API] First call result:', {
      hasText: !!firstCall.text,
      textLength: firstCall.text?.length || 0,
      hasToolCalls: firstCall.toolCalls && firstCall.toolCalls.length > 0,
      toolCallsCount: firstCall.toolCalls?.length || 0,
      finishReason: firstCall.finishReason,
    })

    // STEP 2: Check if we need a second call
    // If finishReason is 'tool-calls', the AI stopped to wait for tool results
    // We MUST make a second call to generate the final text response with tool results
    if (firstCall.finishReason === 'tool-calls') {
      console.log('[Chat API] Step 2: Tool calls detected (finishReason: tool-calls), making second call for final text generation...')
      
      // Build messages with tool results for second call
      // APPROACH: Stringify the entire toolResults to pass as context
      const toolResultsJson = JSON.stringify(firstCall.toolResults, null, 2)
      
      const messagesWithToolResults = [
        ...coreMessages,
        {
          role: 'user' as const,
          content: `I tool hanno eseguito e restituito questi dati:\n\`\`\`json\n${toolResultsJson}\n\`\`\`\n\nOra mostra questi dati all'utente in formato leggibile e conversazionale. DEVI mostrare TUTTI i dati con i dettagli completi (nomi, email, telefoni, indirizzi, ecc.). Non dire solo "Ecco i tuoi X elementi" - elenca TUTTI i dettagli di ogni elemento!`,
        }
      ]

      // STEP 3: Second call - FORCE text generation only (no more tools)
      console.log('[Chat API] Step 3: OpenAI GPT-4o-mini generating final text response...')
      const secondCall = await streamText({
        model: openai('gpt-4o-mini'),
        system: systemPrompts[locale as keyof typeof systemPrompts] || systemPrompts.it,
        messages: messagesWithToolResults,
        temperature: 0.7,
        toolChoice: 'none', // ✅ CRITICAL: Force text-only response, no more tools!
      })

      console.log('[Chat API] Returning second call streaming response...')
      return secondCall.toUIMessageStreamResponse({
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'X-Vercel-AI-Data-Stream': 'v1',
        }
      })
    }

    // If finishReason is NOT 'tool-calls', the AI has already generated a complete response
    // Just stream it normally (this shouldn't happen often with our tool-heavy setup)
    console.log('[Chat API] No tool calls detected or already complete response, streaming normally...')
    console.log('[Chat API] finishReason:', firstCall.finishReason, '- This path should rarely be taken!')
    const result = await streamText({
      model: openai('gpt-4o-mini'),
      system: systemPrompts[locale as keyof typeof systemPrompts] || systemPrompts.it,
      messages: coreMessages,
      temperature: 0.7,
      toolChoice: 'auto',
      tools: toolsConfig,
    })
    
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

import { streamText, generateText, convertToCoreMessages, tool } from 'ai'
import { openai } from '@ai-sdk/openai'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'
import { z } from 'zod'

export const runtime = 'nodejs'

const systemPrompts = {
  it: `Sei l'assistente AI di Fattura. NON SEI UN API. Sei un assistente CONVERSAZIONALE.

⚠️⚠️⚠️ LINGUA: RISPONDI NELLA LINGUA DELL'UTENTE! ⚠️⚠️⚠️
**SE L'UTENTE SCRIVE IN INGLESE → RISPONDI IN INGLESE**
**SE L'UTENTE SCRIVE IN TEDESCO → RISPONDI IN TEDESCO**  
**SE L'UTENTE SCRIVE IN FRANCESE → RISPONDI IN FRANCESE**
**SE L'UTENTE SCRIVE IN ROMANCIO → RISPONDI IN ROMANCIO**
**SE L'UTENTE SCRIVE IN ITALIANO → RISPONDI IN ITALIANO**

LINGUE SUPPORTATE: Italiano (it), English (en), Deutsch (de), Français (fr), Rumantsch (rm)

⚠️⚠️⚠️ REGOLE ASSOLUTE ⚠️⚠️⚠️
1. DOPO OGNI TOOL CALL, DEVI **SEMPRE** GENERARE UNA RISPOSTA TESTUALE.
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
• Usa emoji: ✅❌📊📄💰📧🔗
• Formatta numeri: CHF 1,081.00
• Se tool ha campo "message", COPIALO TESTUALMENTE nella tua risposta
• Sii amichevole, conciso, utile

⚠️⚠️⚠️ LINK OBBLIGATORI ⚠️⚠️⚠️
OGNI VOLTA che mostri clienti/fatture/preventivi, DEVI includere link cliccabili!

FORMATO LINK:
• Cliente: https://fachtura.vercel.app/it/dashboard/clients/{id}
• Fattura: https://fachtura.vercel.app/it/dashboard/invoices/{id}
• Preventivo: https://fachtura.vercel.app/it/dashboard/quotes/{id}

ESEMPIO CORRETTO:
"📄 Fattura INV-002
• Cliente: Emanuele Novara
• Totale: CHF 1,081.00
• 🔗 [Vedi fattura](https://fachtura.vercel.app/it/dashboard/invoices/abc-123-def)"

SEMPRE includi il link con l'emoji 🔗 per OGNI elemento!

⚠️⚠️⚠️ ERRORE COMUNE DA EVITARE ⚠️⚠️⚠️
NON dire mai: "Ecco i tuoi 2 clienti registrati" e fermarti lì!
DEVI continuare con: "1. Nome Cliente - email - città + LINK\n2. Nome Cliente 2 - email - città + LINK"
MOSTRA SEMPRE I DATI COMPLETI + LINK!

RICORDA: Sei un ASSISTENTE UMANO, non un'API!`,

  en: `You are the AI assistant for Fattura. You are a CONVERSATIONAL assistant, NOT an API.

⚠️⚠️⚠️ LANGUAGE: ALWAYS RESPOND IN THE USER'S LANGUAGE! ⚠️⚠️⚠️
**IF USER WRITES IN ITALIAN → RESPOND IN ITALIAN**
**IF USER WRITES IN GERMAN → RESPOND IN GERMAN**
**IF USER WRITES IN FRENCH → RESPOND IN FRENCH**
**IF USER WRITES IN ROMANSH → RESPOND IN ROMANSH**
**IF USER WRITES IN ENGLISH → RESPOND IN ENGLISH**

SUPPORTED LANGUAGES: Italiano (it), English (en), Deutsch (de), Français (fr), Rumantsch (rm)

⚠️⚠️⚠️ ABSOLUTE RULES ⚠️⚠️⚠️
1. AFTER EVERY TOOL CALL, you MUST **ALWAYS** GENERATE A TEXTUAL RESPONSE.
2. DO NOT STOP AFTER THE TOOL CALL. CONTINUE WITH THE TEXTUAL RESPONSE.
3. NEVER JUST JSON. NEVER STOP AFTER THE TOOL.
4. **ALWAYS SHOW COMPLETE DATA** returned by tools - DON'T just say "Here are your X items" without showing them!
5. If a tool returns a list, you MUST list ALL elements with their details!

KEY RULES:
- Always respond with conversational text, never just JSON
- Show "message" field from create_invoice/create_quote (has link!)
- Use emoji for clarity 📊💰📄✅
- Format numbers as CHF 1,081.00
- ALWAYS include clickable links for clients/invoices/quotes with 🔗 emoji`,

  de: `Du bist der KI-Assistent für Fattura. Du bist ein KONVERSATIONSASSISTENT, KEINE API.

⚠️⚠️⚠️ SPRACHE: IMMER IN DER SPRACHE DES BENUTZERS ANTWORTEN! ⚠️⚠️⚠️
**WENN BENUTZER AUF ITALIENISCH SCHREIBT → AUF ITALIENISCH ANTWORTEN**
**WENN BENUTZER AUF ENGLISCH SCHREIBT → AUF ENGLISCH ANTWORTEN**
**WENN BENUTZER AUF FRANZÖSISCH SCHREIBT → AUF FRANZÖSISCH ANTWORTEN**
**WENN BENUTZER AUF ROMANISCH SCHREIBT → AUF ROMANISCH ANTWORTEN**
**WENN BENUTZER AUF DEUTSCH SCHREIBT → AUF DEUTSCH ANTWORTEN**

UNTERSTÜTZTE SPRACHEN: Italiano (it), English (en), Deutsch (de), Français (fr), Rumantsch (rm)

⚠️⚠️⚠️ ABSOLUTE REGELN ⚠️⚠️⚠️
1. NACH JEDEM TOOL-AUFRUF MUSST DU **IMMER** EINE TEXTANTWORT GENERIEREN.
2. HÖRE NICHT NACH DEM TOOL-AUFRUF AUF. FAHRE MIT DER TEXTANTWORT FORT.
3. NIE NUR JSON. NIE NACH DEM TOOL AUFHÖREN.
4. **ZEIGE IMMER VOLLSTÄNDIGE DATEN** die von Tools zurückgegeben werden!
5. Wenn ein Tool eine Liste zurückgibt, MUSST DU ALLE Elemente mit Details auflisten!

WICHTIG:
- Immer mit konversationalem Text antworten, nie nur JSON
- "message" Feld von create_invoice/create_quote ZEIGEN (hat Link!)
- Emoji verwenden 📊💰📄✅
- Zahlen: CHF 1,081.00
- IMMER klickbare Links für Clients/Rechnungen/Angebote mit 🔗 Emoji`,

  fr: `Vous êtes l'assistant IA pour Fattura. Vous êtes un assistant CONVERSATIONNEL, PAS une API.

⚠️⚠️⚠️ LANGUE: TOUJOURS RÉPONDRE DANS LA LANGUE DE L'UTILISATEUR! ⚠️⚠️⚠️
**SI L'UTILISATEUR ÉCRIT EN ITALIEN → RÉPONDRE EN ITALIEN**
**SI L'UTILISATEUR ÉCRIT EN ANGLAIS → RÉPONDRE EN ANGLAIS**
**SI L'UTILISATEUR ÉCRIT EN ALLEMAND → RÉPONDRE EN ALLEMAND**
**SI L'UTILISATEUR ÉCRIT EN ROMANCHE → RÉPONDRE EN ROMANCHE**
**SI L'UTILISATEUR ÉCRIT EN FRANÇAIS → RÉPONDRE EN FRANÇAIS**

LANGUES SUPPORTÉES: Italiano (it), English (en), Deutsch (de), Français (fr), Rumantsch (rm)

⚠️⚠️⚠️ RÈGLES ABSOLUES ⚠️⚠️⚠️
1. APRÈS CHAQUE APPEL D'OUTIL, vous DEVEZ **TOUJOURS** GÉNÉRER UNE RÉPONSE TEXTUELLE.
2. NE VOUS ARRÊTEZ PAS APRÈS L'APPEL D'OUTIL. CONTINUEZ AVEC LA RÉPONSE TEXTUELLE.
3. JAMAIS SEULEMENT JSON. JAMAIS S'ARRÊTER APRÈS L'OUTIL.
4. **MONTREZ TOUJOURS LES DONNÉES COMPLÈTES** renvoyées par les outils!
5. Si un outil renvoie une liste, vous DEVEZ lister TOUS les éléments avec leurs détails!

IMPORTANT:
- Toujours répondre avec texte conversationnel, jamais JSON seul
- MONTRER champ "message" de create_invoice/create_quote (a le lien!)
- Emoji 📊💰📄✅
- Nombres: CHF 1,081.00
- TOUJOURS inclure liens cliquables pour clients/factures/devis avec emoji 🔗`,

  rm: `Ti ests l'assistent da KI per Fattura. Ti ests in assistent CONVERSAZIUNAL, BETG ina API.

⚠️⚠️⚠️ LINGUATG: ADINA RESPUNDER EN IL LINGUATG DA L'UTILISADER! ⚠️⚠️⚠️
**SCH'IL UTILISADER SCRIVA EN TALIAN → RESPUNDA EN TALIAN**
**SCH'IL UTILISADER SCRIVA EN ENGLAIS → RESPUNDA EN ENGLAIS**
**SCH'IL UTILISADER SCRIVA EN TUDESTG → RESPUNDA EN TUDESTG**
**SCH'IL UTILISADER SCRIVA EN FRANZOS → RESPUNDA EN FRANZOS**
**SCH'IL UTILIZADER SCRIVA EN RUMANTSCH → RESPUNDA EN RUMANTSCH**

LINGUATGS SUSTEGNIDS: Italiano (it), English (en), Deutsch (de), Français (fr), Rumantsch (rm)

⚠️⚠️⚠️ REGLAS ABSOLUTAS ⚠️⚠️⚠️
1. SUENTER MINTGA TOOL CALL STOS TI **ADINA** GENERAR INA RESPOSTA TEXTUALA.
2. NA FERMA BETG SUENTER IL TOOL CALL. CUNTINUESCHA CUN LA RESPOSTA TEXTUALA.
3. MAI BE JSON. MAI FERMAR SUENTER IL TOOL.
4. **MUSSA ADINA LAS DATAS CUMPL ETTAS** returnadas dals tools!
5. Sch'in tool returna ina glista, STOS TI enumerar TUTS ils elements cun detagls!

IMPURTANT:
- Adina respunder cun text conversaziunal, mai be JSON
- MUSSA "message" da create_invoice/create_quote (ha link!)
- Emoji 📊💰📄✅
- Nummers: CHF 1,081.00
- ADINA includer links clicabels per clients/facturas/preventivs cun emoji 🔗`
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
        }),

        // ==================== FASE 1: OPERAZIONI CRITICHE ====================

        // Tool 10: Crea cliente
        create_client: tool({
          description: 'Create a new client with name, email, phone, address details',
          inputSchema: z.object({
            name: z.string().describe('Client name (required)'),
            email: z.string().email().optional().describe('Client email'),
            phone: z.string().optional().describe('Client phone number'),
            address: z.string().optional().describe('Street address'),
            city: z.string().optional().describe('City'),
            postal_code: z.string().optional().describe('Postal code'),
            country: z.string().optional().default('Switzerland').describe('Country (default: Switzerland)')
          }),
          execute: async (input, options) => {
            const { name, email, phone, address, city, postal_code, country } = input

            const { data: client, error } = await supabase
              .from('clients')
              .insert({
                user_id: user.id,
                name,
                email: email || null,
                phone: phone || null,
                address: address || null,
                city: city || null,
                postal_code: postal_code || null,
                country: country || 'Switzerland'
              })
              .select()
              .single()

            if (error || !client) {
              return { error: `Errore creazione cliente: ${error?.message}` }
            }

            return {
              success: true,
              client_id: client.id,
              client_name: name,
              message: `✅ Cliente ${name} creato con successo!${email ? `\n📧 Email: ${email}` : ''}${phone ? `\n📞 Telefono: ${phone}` : ''}`
            }
          }
        }),

        // Tool 11: Aggiorna cliente
        update_client: tool({
          description: 'Update existing client information (name, email, phone, address, etc.)',
          inputSchema: z.object({
            client_id: z.string().uuid().describe('Client UUID'),
            name: z.string().optional().describe('Updated name'),
            email: z.string().email().optional().describe('Updated email'),
            phone: z.string().optional().describe('Updated phone'),
            address: z.string().optional().describe('Updated address'),
            city: z.string().optional().describe('Updated city'),
            postal_code: z.string().optional().describe('Updated postal code'),
            country: z.string().optional().describe('Updated country')
          }),
          execute: async (input, options) => {
            const { client_id, ...updates } = input

            // Build update object (only include provided fields)
            const updateData: any = {}
            if (updates.name) updateData.name = updates.name
            if (updates.email) updateData.email = updates.email
            if (updates.phone) updateData.phone = updates.phone
            if (updates.address) updateData.address = updates.address
            if (updates.city) updateData.city = updates.city
            if (updates.postal_code) updateData.postal_code = updates.postal_code
            if (updates.country) updateData.country = updates.country
            updateData.updated_at = new Date().toISOString()

            const { data: client, error } = await supabase
              .from('clients')
              .update(updateData)
              .eq('id', client_id)
              .eq('user_id', user.id)
              .is('deleted_at', null)
              .select()
              .single()

            if (error || !client) {
              return { error: `Errore aggiornamento cliente: ${error?.message}` }
            }

            return {
              success: true,
              client,
              message: `✅ Cliente ${client.name} aggiornato con successo!`
            }
          }
        }),

        // Tool 12: Aggiorna status fattura (singola)
        update_invoice_status: tool({
          description: 'Update SINGLE invoice status: draft → issued → paid → overdue. For MULTIPLE invoices, use batch_update_invoice_status instead!',
          inputSchema: z.object({
            invoice_id: z.string().uuid().describe('Invoice UUID'),
            status: z.enum(['draft', 'issued', 'paid', 'overdue']).describe('New status')
          }),
          execute: async (input, options) => {
            const { invoice_id, status } = input

            const { data: invoice, error } = await supabase
              .from('invoices')
              .update({
                status,
                updated_at: new Date().toISOString()
              })
              .eq('id', invoice_id)
              .eq('user_id', user.id)
              .is('deleted_at', null)
              .select('invoice_number, status')
              .single()

            if (error || !invoice) {
              return { error: `Errore aggiornamento fattura: ${error?.message}` }
            }

            const statusEmoji = {
              draft: '📝',
              issued: '📤',
              paid: '✅',
              overdue: '⚠️'
            }

            return {
              success: true,
              invoice_number: invoice.invoice_number,
              new_status: status,
              message: `${statusEmoji[status]} Fattura ${invoice.invoice_number} marcata come "${status}"!`
            }
          }
        }),

        // Tool 13: Aggiorna status preventivo
        update_quote_status: tool({
          description: 'Update quote status: draft → sent → accepted → rejected. Use when client responds to quote.',
          inputSchema: z.object({
            quote_id: z.string().uuid().describe('Quote UUID'),
            status: z.enum(['draft', 'sent', 'accepted', 'rejected']).describe('New status')
          }),
          execute: async (input, options) => {
            const { quote_id, status } = input

            const { data: quote, error } = await supabase
              .from('quotes')
              .update({
                status,
                updated_at: new Date().toISOString()
              })
              .eq('id', quote_id)
              .eq('user_id', user.id)
              .is('deleted_at', null)
              .select('quote_number, status')
              .single()

            if (error || !quote) {
              return { error: `Errore aggiornamento preventivo: ${error?.message}` }
            }

            const statusEmoji = {
              draft: '📝',
              sent: '📤',
              accepted: '✅',
              rejected: '❌'
            }

            return {
              success: true,
              quote_number: quote.quote_number,
              new_status: status,
              message: `${statusEmoji[status]} Preventivo ${quote.quote_number} marcato come "${status}"!`
            }
          }
        }),

        // Tool 14: Converti preventivo in fattura
        convert_quote_to_invoice: tool({
          description: 'Convert an accepted quote into an invoice. Copies all items and details from quote to new invoice.',
          inputSchema: z.object({
            quote_id: z.string().uuid().describe('Quote UUID to convert')
          }),
          execute: async (input, options) => {
            const { quote_id } = input

            // Get quote with items
            const { data: quote, error: quoteError } = await supabase
              .from('quotes')
              .select('*, quote_items(*)')
              .eq('id', quote_id)
              .eq('user_id', user.id)
              .is('deleted_at', null)
              .single()

            if (quoteError || !quote) {
              return { error: 'Preventivo non trovato' }
            }

            // Check subscription limits
            const { data: subscription } = await supabase
              .from('user_subscriptions')
              .select('*, plan:subscription_plans(*)')
              .eq('user_id', user.id)
              .single()

            if (!subscription) {
              return { error: 'No active subscription found' }
            }

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

            // Generate invoice number
            const { count: totalInvoices } = await supabase
              .from('invoices')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)

            const invoiceNumber = `INV-${String((totalInvoices || 0) + 1).padStart(4, '0')}`

            // Create invoice from quote
            const { data: invoice, error: invoiceError } = await supabase
              .from('invoices')
              .insert({
                user_id: user.id,
                client_id: quote.client_id,
                invoice_number: invoiceNumber,
                date: new Date().toISOString().split('T')[0],
                status: 'draft',
                subtotal: quote.subtotal,
                tax_amount: quote.tax_amount,
                total: quote.total,
                notes: quote.notes
              })
              .select()
              .single()

            if (invoiceError || !invoice) {
              return { error: `Errore creazione fattura: ${invoiceError?.message}` }
            }

            // Copy items from quote to invoice
            const invoiceItems = quote.quote_items.map((item: any) => ({
              invoice_id: invoice.id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              tax_rate: item.tax_rate,
              line_total: item.line_total
            }))

            const { error: itemsError } = await supabase
              .from('invoice_items')
              .insert(invoiceItems)

            if (itemsError) {
              await supabase.from('invoices').delete().eq('id', invoice.id)
              return { error: `Errore aggiunta items: ${itemsError.message}` }
            }

            const invoiceUrl = `https://fachtura.vercel.app/${locale}/dashboard/invoices/${invoice.id}`

            return {
              success: true,
              invoice_id: invoice.id,
              invoice_number: invoiceNumber,
              quote_number: quote.quote_number,
              total: invoice.total,
              invoice_url: invoiceUrl,
              message: `✅ Fattura ${invoiceNumber} creata da preventivo ${quote.quote_number}!\n\nTotale: CHF ${invoice.total}\n\nVedi fattura: ${invoiceUrl}`
            }
          }
        }),

        // Tool 15: Lista preventivi
        list_quotes: tool({
          description: 'Get list of quotes with optional filters by status. IMPORTANT: Display ALL quote data in response!',
          inputSchema: z.object({
            status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'all']).optional().default('all').describe('Filter by quote status'),
            limit: z.coerce.number().optional().default(10).describe('Maximum number of quotes to return')
          }),
          execute: async (input, options) => {
            const { status, limit } = input

            let query = supabase
              .from('quotes')
              .select(`
                id,
                quote_number,
                date,
                valid_until,
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

            const { data: quotes } = await query

            return {
              quotes: quotes || [],
              count: quotes?.length || 0,
              filter: status
            }
          }
        }),

        // Tool 16: Dettagli fattura completa
        get_invoice_details: tool({
          description: 'Get complete invoice details including all line items, client info, and totals',
          inputSchema: z.object({
            invoice_id: z.string().uuid().describe('Invoice UUID')
          }),
          execute: async (input, options) => {
            const { invoice_id } = input

            const { data: invoice, error } = await supabase
              .from('invoices')
              .select(`
                *,
                clients!inner(name, email, phone, address, city, postal_code, country),
                invoice_items(*)
              `)
              .eq('id', invoice_id)
              .eq('user_id', user.id)
              .is('deleted_at', null)
              .single()

            if (error || !invoice) {
              return { error: 'Fattura non trovata' }
            }

            return {
              invoice,
              invoice_url: `https://fachtura.vercel.app/${locale}/dashboard/invoices/${invoice_id}`
            }
          }
        }),

        // Tool 17: Dettagli preventivo completo
        get_quote_details: tool({
          description: 'Get complete quote details including all line items, client info, and totals',
          inputSchema: z.object({
            quote_id: z.string().uuid().describe('Quote UUID')
          }),
          execute: async (input, options) => {
            const { quote_id } = input

            const { data: quote, error } = await supabase
              .from('quotes')
              .select(`
                *,
                clients!inner(name, email, phone, address, city, postal_code, country),
                quote_items(*)
              `)
              .eq('id', quote_id)
              .eq('user_id', user.id)
              .is('deleted_at', null)
              .single()

            if (error || !quote) {
              return { error: 'Preventivo non trovato' }
            }

            return {
              quote,
              quote_url: `https://fachtura.vercel.app/${locale}/dashboard/quotes/${quote_id}`
            }
          }
        }),

        // ==================== FASE 2: OPERAZIONI AVANZATE ====================

        // Tool 18: Elimina cliente (soft delete)
        delete_client: tool({
          description: 'Soft delete a client (sets deleted_at timestamp)',
          inputSchema: z.object({
            client_id: z.string().uuid().describe('Client UUID to delete')
          }),
          execute: async (input, options) => {
            const { client_id } = input

            const { data: client, error } = await supabase
              .from('clients')
              .update({ deleted_at: new Date().toISOString() })
              .eq('id', client_id)
              .eq('user_id', user.id)
              .is('deleted_at', null)
              .select('name')
              .single()

            if (error || !client) {
              return { error: 'Cliente non trovato o già eliminato' }
            }

            return {
              success: true,
              message: `🗑️ Cliente ${client.name} eliminato con successo`
            }
          }
        }),

        // Tool 19: Elimina fattura (soft delete)
        delete_invoice: tool({
          description: 'Soft delete an invoice (sets deleted_at timestamp)',
          inputSchema: z.object({
            invoice_id: z.string().uuid().describe('Invoice UUID to delete')
          }),
          execute: async (input, options) => {
            const { invoice_id } = input

            const { data: invoice, error } = await supabase
              .from('invoices')
              .update({ deleted_at: new Date().toISOString() })
              .eq('id', invoice_id)
              .eq('user_id', user.id)
              .is('deleted_at', null)
              .select('invoice_number')
              .single()

            if (error || !invoice) {
              return { error: 'Fattura non trovata o già eliminata' }
            }

            return {
              success: true,
              message: `🗑️ Fattura ${invoice.invoice_number} eliminata con successo`
            }
          }
        }),

        // Tool 20: Elimina preventivo (soft delete)
        delete_quote: tool({
          description: 'Soft delete a quote (sets deleted_at timestamp)',
          inputSchema: z.object({
            quote_id: z.string().uuid().describe('Quote UUID to delete')
          }),
          execute: async (input, options) => {
            const { quote_id } = input

            const { data: quote, error } = await supabase
              .from('quotes')
              .update({ deleted_at: new Date().toISOString() })
              .eq('id', quote_id)
              .eq('user_id', user.id)
              .is('deleted_at', null)
              .select('quote_number')
              .single()

            if (error || !quote) {
              return { error: 'Preventivo non trovato o già eliminato' }
            }

            return {
              success: true,
              message: `🗑️ Preventivo ${quote.quote_number} eliminato con successo`
            }
          }
        }),

        // Tool 21: Aggiorna status fatture in BATCH
        batch_update_invoice_status: tool({
          description: 'Update MULTIPLE invoices status at once. Use this when user wants to update many invoices (e.g., "mark all draft invoices as paid"). CRITICAL: First call list_invoices to get IDs, then update them!',
          inputSchema: z.object({
            filter: z.object({
              status: z.enum(['draft', 'issued', 'paid', 'overdue', 'all']).optional().describe('Filter invoices by current status'),
              invoice_numbers: z.array(z.string()).optional().describe('Specific invoice numbers to update')
            }).optional().describe('Filter criteria to select invoices'),
            new_status: z.enum(['draft', 'issued', 'paid', 'overdue']).describe('New status to set')
          }),
          execute: async (input, options) => {
            const { filter, new_status } = input

            // Build query
            let query = supabase
              .from('invoices')
              .select('id, invoice_number, status')
              .eq('user_id', user.id)
              .is('deleted_at', null)

            if (filter?.status && filter.status !== 'all') {
              query = query.eq('status', filter.status)
            }

            if (filter?.invoice_numbers && filter.invoice_numbers.length > 0) {
              query = query.in('invoice_number', filter.invoice_numbers)
            }

            // Get invoices to update
            const { data: invoices, error: fetchError } = await query

            if (fetchError) {
              return { error: `Errore ricerca fatture: ${fetchError.message}` }
            }

            if (!invoices || invoices.length === 0) {
              return { 
                error: 'Nessuna fattura trovata con i criteri specificati',
                filter_used: filter,
                message: `❌ Nessuna fattura trovata${filter?.status ? ` con status "${filter.status}"` : ''}${filter?.invoice_numbers ? ` nei numeri specificati` : ''}`
              }
            }

            // Update all invoices
            const invoiceIds = invoices.map(inv => inv.id)
            const { data: updated, error: updateError } = await supabase
              .from('invoices')
              .update({
                status: new_status,
                updated_at: new Date().toISOString()
              })
              .in('id', invoiceIds)
              .select('invoice_number')

            if (updateError) {
              return { error: `Errore aggiornamento: ${updateError.message}` }
            }

            const statusEmoji = {
              draft: '📝',
              issued: '📤',
              paid: '✅',
              overdue: '⚠️'
            }

            return {
              success: true,
              updated_count: updated?.length || 0,
              invoice_numbers: updated?.map(inv => inv.invoice_number) || [],
              new_status,
              message: `${statusEmoji[new_status]} Aggiornate ${updated?.length || 0} fatture come "${new_status}"!\n\nFatture: ${updated?.map(inv => inv.invoice_number).join(', ')}`
            }
          }
        }),

        // Tool 22: Aggiorna status preventivi in BATCH
        batch_update_quote_status: tool({
          description: 'Update MULTIPLE quotes status at once. Use when user wants to update many quotes.',
          inputSchema: z.object({
            filter: z.object({
              status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'all']).optional().describe('Filter quotes by current status'),
              quote_numbers: z.array(z.string()).optional().describe('Specific quote numbers to update')
            }).optional().describe('Filter criteria'),
            new_status: z.enum(['draft', 'sent', 'accepted', 'rejected']).describe('New status to set')
          }),
          execute: async (input, options) => {
            const { filter, new_status } = input

            let query = supabase
              .from('quotes')
              .select('id, quote_number, status')
              .eq('user_id', user.id)
              .is('deleted_at', null)

            if (filter?.status && filter.status !== 'all') {
              query = query.eq('status', filter.status)
            }

            if (filter?.quote_numbers && filter.quote_numbers.length > 0) {
              query = query.in('quote_number', filter.quote_numbers)
            }

            const { data: quotes, error: fetchError } = await query

            if (fetchError) {
              return { error: `Errore ricerca preventivi: ${fetchError.message}` }
            }

            if (!quotes || quotes.length === 0) {
              return { 
                error: 'Nessun preventivo trovato con i criteri specificati',
                message: `❌ Nessun preventivo trovato${filter?.status ? ` con status "${filter.status}"` : ''}`
              }
            }

            const quoteIds = quotes.map(q => q.id)
            const { data: updated, error: updateError } = await supabase
              .from('quotes')
              .update({
                status: new_status,
                updated_at: new Date().toISOString()
              })
              .in('id', quoteIds)
              .select('quote_number')

            if (updateError) {
              return { error: `Errore aggiornamento: ${updateError.message}` }
            }

            const statusEmoji = {
              draft: '📝',
              sent: '📤',
              accepted: '✅',
              rejected: '❌'
            }

            return {
              success: true,
              updated_count: updated?.length || 0,
              quote_numbers: updated?.map(q => q.quote_number) || [],
              new_status,
              message: `${statusEmoji[new_status]} Aggiornati ${updated?.length || 0} preventivi come "${new_status}"!\n\nPreventivi: ${updated?.map(q => q.quote_number).join(', ')}`
            }
          }
        }),

        // Tool 23: Fatture scadute
        get_overdue_invoices: tool({
          description: 'Get all overdue invoices (status = overdue OR due_date < today)',
          inputSchema: z.object({
            limit: z.coerce.number().optional().default(20).describe('Maximum number to return')
          }),
          execute: async (input, options) => {
            const { limit } = input
            const today = new Date().toISOString().split('T')[0]

            const { data: invoices } = await supabase
              .from('invoices')
              .select(`
                id,
                invoice_number,
                date,
                due_date,
                status,
                total,
                clients!inner(name, email)
              `)
              .eq('user_id', user.id)
              .is('deleted_at', null)
              .or(`status.eq.overdue,and(due_date.lt.${today},status.neq.paid)`)
              .order('due_date', { ascending: true })
              .limit(limit)

            const totalOverdue = invoices?.reduce((sum, inv) => sum + Number(inv.total), 0) || 0

            return {
              invoices: invoices || [],
              count: invoices?.length || 0,
              total_overdue: totalOverdue,
              message: invoices?.length ? `⚠️ Hai ${invoices.length} fatture scadute per un totale di CHF ${totalOverdue.toFixed(2)}` : '✅ Nessuna fattura scaduta!'
            }
          }
        }),

        // Tool 24: Duplica fattura
        duplicate_invoice: tool({
          description: 'Duplicate an existing invoice with all items (useful for recurring invoices)',
          inputSchema: z.object({
            invoice_id: z.string().uuid().describe('Invoice UUID to duplicate'),
            new_date: z.string().optional().describe('Date for new invoice (YYYY-MM-DD), defaults to today')
          }),
          execute: async (input, options) => {
            const { invoice_id, new_date } = input

            // Get original invoice with items
            const { data: original, error: fetchError } = await supabase
              .from('invoices')
              .select('*, invoice_items(*)')
              .eq('id', invoice_id)
              .eq('user_id', user.id)
              .is('deleted_at', null)
              .single()

            if (fetchError || !original) {
              return { error: 'Fattura originale non trovata' }
            }

            // Check subscription limits
            const { data: subscription } = await supabase
              .from('user_subscriptions')
              .select('*, plan:subscription_plans(*)')
              .eq('user_id', user.id)
              .single()

            if (!subscription) {
              return { error: 'No active subscription found' }
            }

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

            // Generate new invoice number
            const { count: totalInvoices } = await supabase
              .from('invoices')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)

            const invoiceNumber = `INV-${String((totalInvoices || 0) + 1).padStart(4, '0')}`
            const invoiceDate = new_date || new Date().toISOString().split('T')[0]

            // Create duplicated invoice
            const { data: newInvoice, error: createError } = await supabase
              .from('invoices')
              .insert({
                user_id: user.id,
                client_id: original.client_id,
                invoice_number: invoiceNumber,
                date: invoiceDate,
                status: 'draft',
                subtotal: original.subtotal,
                tax_amount: original.tax_amount,
                total: original.total,
                notes: original.notes
              })
              .select()
              .single()

            if (createError || !newInvoice) {
              return { error: `Errore duplicazione: ${createError?.message}` }
            }

            // Copy items
            const newItems = original.invoice_items.map((item: any) => ({
              invoice_id: newInvoice.id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              tax_rate: item.tax_rate,
              line_total: item.line_total
            }))

            const { error: itemsError } = await supabase
              .from('invoice_items')
              .insert(newItems)

            if (itemsError) {
              await supabase.from('invoices').delete().eq('id', newInvoice.id)
              return { error: `Errore copia items: ${itemsError.message}` }
            }

            const invoiceUrl = `https://fachtura.vercel.app/${locale}/dashboard/invoices/${newInvoice.id}`

            return {
              success: true,
              invoice_id: newInvoice.id,
              invoice_number: invoiceNumber,
              original_number: original.invoice_number,
              total: newInvoice.total,
              invoice_url: invoiceUrl,
              message: `✅ Fattura ${invoiceNumber} creata come copia di ${original.invoice_number}!\n\nTotale: CHF ${newInvoice.total}\n\nVedi fattura: ${invoiceUrl}`
            }
          }
        }),

        // Tool 25: Riepilogo entrate
        get_revenue_summary: tool({
          description: 'Get revenue summary for a specific period (month, year, all time)',
          inputSchema: z.object({
            period: z.enum(['month', 'year', 'all']).default('month').describe('Time period')
          }),
          execute: async (input, options) => {
            const { period } = input

            let query = supabase
              .from('invoices')
              .select('total, status, date')
              .eq('user_id', user.id)
              .is('deleted_at', null)

            const now = new Date()
            if (period === 'month') {
              const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
              query = query.gte('date', startOfMonth)
            } else if (period === 'year') {
              const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]
              query = query.gte('date', startOfYear)
            }

            const { data: invoices } = await query

            const total_revenue = invoices?.reduce((sum, inv) => sum + Number(inv.total), 0) || 0
            const paid_revenue = invoices?.filter(i => i.status === 'paid').reduce((sum, inv) => sum + Number(inv.total), 0) || 0
            const pending_revenue = invoices?.filter(i => i.status === 'issued').reduce((sum, inv) => sum + Number(inv.total), 0) || 0
            const overdue_revenue = invoices?.filter(i => i.status === 'overdue').reduce((sum, inv) => sum + Number(inv.total), 0) || 0

            return {
              period,
              total_invoices: invoices?.length || 0,
              total_revenue,
              paid_revenue,
              pending_revenue,
              overdue_revenue,
              by_status: {
                paid: invoices?.filter(i => i.status === 'paid').length || 0,
                issued: invoices?.filter(i => i.status === 'issued').length || 0,
                overdue: invoices?.filter(i => i.status === 'overdue').length || 0,
                draft: invoices?.filter(i => i.status === 'draft').length || 0
              }
            }
          }
        }),

        // ==================== FASE 3: NOTIFICHE & ANALYTICS ====================

        // Tool 26: Lista notifiche
        list_notifications: tool({
          description: 'Get user notifications with optional filter for unread only',
          inputSchema: z.object({
            unread_only: z.boolean().optional().default(false).describe('Show only unread notifications'),
            limit: z.coerce.number().optional().default(20).describe('Maximum number to return')
          }),
          execute: async (input, options) => {
            const { unread_only, limit } = input

            let query = supabase
              .from('notifications')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(limit)

            if (unread_only) {
              query = query.eq('is_read', false)
            }

            const { data: notifications } = await query

            const unread_count = notifications?.filter(n => !n.is_read).length || 0

            return {
              notifications: notifications || [],
              total_count: notifications?.length || 0,
              unread_count,
              message: unread_count > 0 ? `📬 Hai ${unread_count} notifiche non lette` : '✅ Nessuna notifica non letta'
            }
          }
        }),

        // Tool 27: Segna notifica come letta
        mark_notification_read: tool({
          description: 'Mark a notification as read',
          inputSchema: z.object({
            notification_id: z.string().uuid().describe('Notification UUID')
          }),
          execute: async (input, options) => {
            const { notification_id } = input

            const { data: notification, error } = await supabase
              .from('notifications')
              .update({ is_read: true })
              .eq('id', notification_id)
              .eq('user_id', user.id)
              .select()
              .single()

            if (error || !notification) {
              return { error: 'Notifica non trovata' }
            }

            return {
              success: true,
              message: `✅ Notifica marcata come letta`
            }
          }
        }),

        // Tool 28: Top clienti per fatturato
        get_top_clients: tool({
          description: 'Get top clients by total revenue (paid invoices)',
          inputSchema: z.object({
            limit: z.coerce.number().optional().default(10).describe('Number of top clients to return'),
            period: z.enum(['month', 'year', 'all']).optional().default('all').describe('Time period')
          }),
          execute: async (input, options) => {
            const { limit, period } = input

            let query = supabase
              .from('invoices')
              .select(`
                total,
                status,
                date,
                clients!inner(id, name, email)
              `)
              .eq('user_id', user.id)
              .eq('status', 'paid')
              .is('deleted_at', null)

            const now = new Date()
            if (period === 'month') {
              const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
              query = query.gte('date', startOfMonth)
            } else if (period === 'year') {
              const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]
              query = query.gte('date', startOfYear)
            }

            const { data: invoices } = await query

            // Aggregate by client
            const clientRevenue: any = {}
            invoices?.forEach((inv: any) => {
              const clientId = inv.clients.id
              if (!clientRevenue[clientId]) {
                clientRevenue[clientId] = {
                  client_id: clientId,
                  client_name: inv.clients.name,
                  client_email: inv.clients.email,
                  total_revenue: 0,
                  invoice_count: 0
                }
              }
              clientRevenue[clientId].total_revenue += Number(inv.total)
              clientRevenue[clientId].invoice_count += 1
            })

            const topClients = Object.values(clientRevenue)
              .sort((a: any, b: any) => b.total_revenue - a.total_revenue)
              .slice(0, limit)

            return {
              top_clients: topClients,
              period,
              count: topClients.length
            }
          }
        }),

        // ==================== FASE 4: UTILITY & RICERCA ====================

        // Tool 29: Pagamenti in arrivo
        get_upcoming_payments: tool({
          description: 'Get upcoming invoice payments (issued invoices with due dates in near future)',
          inputSchema: z.object({
            days: z.coerce.number().optional().default(30).describe('Look ahead days (default: 30)')
          }),
          execute: async (input, options) => {
            const { days } = input

            const today = new Date().toISOString().split('T')[0]
            const futureDate = new Date()
            futureDate.setDate(futureDate.getDate() + days)
            const futureDateStr = futureDate.toISOString().split('T')[0]

            const { data: invoices } = await supabase
              .from('invoices')
              .select(`
                id,
                invoice_number,
                date,
                due_date,
                total,
                clients!inner(name, email)
              `)
              .eq('user_id', user.id)
              .eq('status', 'issued')
              .is('deleted_at', null)
              .gte('due_date', today)
              .lte('due_date', futureDateStr)
              .order('due_date', { ascending: true })

            const total_expected = invoices?.reduce((sum, inv) => sum + Number(inv.total), 0) || 0

            return {
              upcoming_payments: invoices || [],
              count: invoices?.length || 0,
              total_expected,
              days_ahead: days,
              message: invoices?.length ? `📅 ${invoices.length} pagamenti attesi nei prossimi ${days} giorni per CHF ${total_expected.toFixed(2)}` : `✅ Nessun pagamento atteso nei prossimi ${days} giorni`
            }
          }
        }),

        // Tool 30: Aggiorna impostazioni azienda
        update_company_settings: tool({
          description: 'Update company settings (name, address, VAT, IBAN, etc.)',
          inputSchema: z.object({
            company_name: z.string().optional(),
            address: z.string().optional(),
            city: z.string().optional(),
            postal_code: z.string().optional(),
            country: z.string().optional(),
            vat_number: z.string().optional(),
            iban: z.string().optional(),
            phone: z.string().optional(),
            email: z.string().email().optional(),
            website: z.string().optional(),
            invoice_default_due_days: z.coerce.number().optional(),
            quote_default_validity_days: z.coerce.number().optional()
          }),
          execute: async (input, options) => {
            // Build update object
            const updateData: any = {}
            Object.keys(input).forEach(key => {
              if (input[key as keyof typeof input] !== undefined) {
                updateData[key] = input[key as keyof typeof input]
              }
            })
            updateData.updated_at = new Date().toISOString()

            const { data: settings, error } = await supabase
              .from('company_settings')
              .update(updateData)
              .eq('user_id', user.id)
              .select()
              .single()

            if (error) {
              return { error: `Errore aggiornamento impostazioni: ${error.message}` }
            }

            return {
              success: true,
              settings,
              message: `✅ Impostazioni azienda aggiornate con successo!`
            }
          }
        }),

        // Tool 31: Cerca fatture per testo
        search_invoices: tool({
          description: 'Search invoices by invoice number, client name, or notes content',
          inputSchema: z.object({
            search_term: z.string().describe('Search term (invoice number, client name, notes)'),
            limit: z.coerce.number().optional().default(10).describe('Maximum results')
          }),
          execute: async (input, options) => {
            const { search_term, limit } = input

            const { data: invoices } = await supabase
              .from('invoices')
              .select(`
                id,
                invoice_number,
                date,
                due_date,
                status,
                total,
                notes,
                clients!inner(name, email)
              `)
              .eq('user_id', user.id)
              .is('deleted_at', null)
              .or(`invoice_number.ilike.%${search_term}%,notes.ilike.%${search_term}%,clients.name.ilike.%${search_term}%`)
              .order('date', { ascending: false })
              .limit(limit)

            return {
              invoices: invoices || [],
              count: invoices?.length || 0,
              search_term,
              message: invoices?.length ? `🔍 Trovate ${invoices.length} fatture corrispondenti a "${search_term}"` : `❌ Nessuna fattura trovata per "${search_term}"`
            }
          }
        }),

        // Tool 32: Cerca preventivi per testo
        search_quotes: tool({
          description: 'Search quotes by quote number, client name, or notes content',
          inputSchema: z.object({
            search_term: z.string().describe('Search term (quote number, client name, notes)'),
            limit: z.coerce.number().optional().default(10).describe('Maximum results')
          }),
          execute: async (input, options) => {
            const { search_term, limit } = input

            const { data: quotes } = await supabase
              .from('quotes')
              .select(`
                id,
                quote_number,
                date,
                valid_until,
                status,
                total,
                notes,
                clients!inner(name, email)
              `)
              .eq('user_id', user.id)
              .is('deleted_at', null)
              .or(`quote_number.ilike.%${search_term}%,notes.ilike.%${search_term}%,clients.name.ilike.%${search_term}%`)
              .order('date', { ascending: false })
              .limit(limit)

            return {
              quotes: quotes || [],
              count: quotes?.length || 0,
              search_term,
              message: quotes?.length ? `🔍 Trovati ${quotes.length} preventivi corrispondenti a "${search_term}"` : `❌ Nessun preventivo trovato per "${search_term}"`
            }
          }
        }),

        // ========================================
        // PRODUCTS MANAGEMENT TOOLS
        // ========================================

        // Tool 33: Lista prodotti
        list_products: tool({
          description: 'Get all active products from the catalog. IMPORTANT: After calling this tool, display ALL product data (name, SKU, price, category, stock) in your response!',
          inputSchema: z.object({
            limit: z.coerce.number().optional().default(20).describe('Maximum number of products to return'),
            active_only: z.boolean().optional().default(true).describe('Only show active products')
          }),
          execute: async (input, options) => {
            const { limit, active_only } = input

            let query = supabase
              .from('products')
              .select('*')
              .eq('user_id', user.id)
              .is('deleted_at', null)
              .order('name')
              .limit(limit)

            if (active_only) {
              query = query.eq('is_active', true)
            }

            const { data: products } = await query

            return {
              products: products || [],
              count: products?.length || 0,
              message: products?.length ? `📦 ${products.length} prodotti nel catalogo` : '📦 Nessun prodotto nel catalogo'
            }
          }
        }),

        // Tool 34: Cerca prodotto
        search_products: tool({
          description: 'Search products by name, SKU, or category',
          inputSchema: z.object({
            search_term: z.string().describe('Search term (name, SKU, or category)'),
            limit: z.coerce.number().optional().default(10).describe('Maximum results')
          }),
          execute: async (input, options) => {
            const { search_term, limit } = input

            const { data: products } = await supabase
              .from('products')
              .select('*')
              .eq('user_id', user.id)
              .is('deleted_at', null)
              .or(`name.ilike.%${search_term}%,sku.ilike.%${search_term}%,category.ilike.%${search_term}%`)
              .limit(limit)

            return {
              products: products || [],
              count: products?.length || 0,
              search_term,
              message: products?.length ? `🔍 Trovati ${products.length} prodotti per "${search_term}"` : `❌ Nessun prodotto trovato per "${search_term}"`
            }
          }
        }),

        // Tool 35: Crea prodotto
        create_product: tool({
          description: 'Create a new product in the catalog',
          inputSchema: z.object({
            name: z.string().describe('Product name'),
            description: z.string().optional().describe('Product description'),
            sku: z.string().optional().describe('SKU/product code'),
            category: z.string().optional().describe('Product category'),
            unit_price: z.coerce.number().describe('Unit price (CHF)'),
            tax_rate: z.coerce.number().optional().default(8.1).describe('Tax rate (%)'),
            track_inventory: z.boolean().optional().default(false).describe('Track inventory'),
            stock_quantity: z.coerce.number().optional().default(0).describe('Initial stock'),
            is_active: z.boolean().optional().default(true).describe('Is active')
          }),
          execute: async (input, options) => {
            const { data: product, error } = await supabase
              .from('products')
              .insert({
                user_id: user.id,
                ...input
              })
              .select()
              .single()

            if (error) {
              return { error: `Errore creazione prodotto: ${error.message}` }
            }

            return {
              success: true,
              product,
              message: `✅ Prodotto "${product.name}" creato con successo!`
            }
          }
        }),

        // Tool 36: Aggiorna prodotto
        update_product: tool({
          description: 'Update an existing product',
          inputSchema: z.object({
            product_id: z.string().describe('Product ID'),
            name: z.string().optional(),
            description: z.string().optional(),
            unit_price: z.coerce.number().optional(),
            tax_rate: z.coerce.number().optional(),
            stock_quantity: z.coerce.number().optional(),
            is_active: z.boolean().optional()
          }),
          execute: async (input, options) => {
            const { product_id, ...updates } = input

            const { data: product, error } = await supabase
              .from('products')
              .update(updates)
              .eq('id', product_id)
              .eq('user_id', user.id)
              .select()
              .single()

            if (error) {
              return { error: `Errore aggiornamento prodotto: ${error.message}` }
            }

            return {
              success: true,
              product,
              message: `✅ Prodotto aggiornato con successo!`
            }
          }
        }),

        // Tool 37: Elimina prodotto
        delete_product: tool({
          description: 'Delete (archive) a product from the catalog',
          inputSchema: z.object({
            product_id: z.string().describe('Product ID to delete')
          }),
          execute: async (input, options) => {
            const { product_id } = input

            const { error } = await supabase
              .from('products')
              .update({ deleted_at: new Date().toISOString() })
              .eq('id', product_id)
              .eq('user_id', user.id)

            if (error) {
              return { error: `Errore eliminazione prodotto: ${error.message}` }
            }

            return {
              success: true,
              message: `✅ Prodotto eliminato (archiviato) con successo!`
            }
          }
        }),

        // ========================================
        // ORDERS MANAGEMENT TOOLS
        // ========================================

        // Tool 38: Lista ordini
        list_orders: tool({
          description: 'Get all orders with client information. IMPORTANT: Display ALL order data including order number, client, date, status, and total!',
          inputSchema: z.object({
            limit: z.coerce.number().optional().default(10).describe('Maximum number of orders'),
            status: z.enum(['draft', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']).optional().describe('Filter by status')
          }),
          execute: async (input, options) => {
            const { limit, status } = input

            let query = supabase
              .from('orders')
              .select(`
                *,
                client:clients(name, email)
              `)
              .eq('user_id', user.id)
              .is('deleted_at', null)
              .order('date', { ascending: false })
              .limit(limit)

            if (status) {
              query = query.eq('status', status)
            }

            const { data: orders } = await query

            return {
              orders: orders || [],
              count: orders?.length || 0,
              message: orders?.length ? `🛒 ${orders.length} ordini trovati` : '🛒 Nessun ordine trovato'
            }
          }
        }),

        // Tool 39: Dettagli ordine
        get_order_details: tool({
          description: 'Get detailed information about a specific order including items',
          inputSchema: z.object({
            order_id: z.string().describe('Order ID')
          }),
          execute: async (input, options) => {
            const { order_id } = input

            const { data: order } = await supabase
              .from('orders')
              .select(`
                *,
                client:clients(*),
                items:order_items(*)
              `)
              .eq('id', order_id)
              .eq('user_id', user.id)
              .single()

            if (!order) {
              return { error: 'Ordine non trovato' }
            }

            return { order }
          }
        }),

        // Tool 40: Crea ordine
        create_order: tool({
          description: 'Create a new customer order with items',
          inputSchema: z.object({
            client_id: z.string().describe('Client ID'),
            order_date: z.string().optional().describe('Order date (YYYY-MM-DD)'),
            delivery_date: z.string().optional().describe('Expected delivery date'),
            status: z.enum(['draft', 'confirmed', 'processing', 'shipped', 'delivered']).optional().default('draft'),
            items: z.array(z.object({
              description: z.string(),
              quantity: z.coerce.number(),
              unit_price: z.coerce.number(),
              tax_rate: z.coerce.number().optional().default(8.1)
            })).describe('Order items'),
            notes: z.string().optional(),
            internal_notes: z.string().optional()
          }),
          execute: async (input, options) => {
            const { client_id, order_date, delivery_date, status, items, notes, internal_notes } = input

            // Calculate totals
            let subtotal = 0
            let tax_amount = 0
            items.forEach(item => {
              const lineSubtotal = item.quantity * item.unit_price
              const lineTax = lineSubtotal * (item.tax_rate / 100)
              subtotal += lineSubtotal
              tax_amount += lineTax
            })
            const total = subtotal + tax_amount

            // Generate order number
            const date = new Date()
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
            const order_number = `ORD-${year}${month}-${random}`

            // Insert order
            const { data: order, error: orderError } = await supabase
              .from('orders')
              .insert({
                user_id: user.id,
                client_id,
                order_number,
                date: order_date || new Date().toISOString().split('T')[0],
                expected_delivery_date: delivery_date || null,
                status: status || 'draft',
                subtotal: Number(subtotal.toFixed(2)),
                tax_amount: Number(tax_amount.toFixed(2)),
                total: Number(total.toFixed(2)),
                notes,
                internal_notes
              })
              .select()
              .single()

            if (orderError) {
              return { error: `Errore creazione ordine: ${orderError.message}` }
            }

            // Insert order items
            const orderItems = items.map(item => ({
              order_id: order.id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              tax_rate: item.tax_rate,
              line_total: item.quantity * item.unit_price * (1 + item.tax_rate / 100)
            }))

            const { error: itemsError } = await supabase
              .from('order_items')
              .insert(orderItems)

            if (itemsError) {
              return { error: `Errore creazione articoli: ${itemsError.message}` }
            }

            return {
              success: true,
              order,
              message: `✅ Ordine ${order_number} creato con successo! Totale: CHF ${total.toFixed(2)}`
            }
          }
        }),

        // Tool 41: Aggiorna stato ordine
        update_order_status: tool({
          description: 'Update the status of an order',
          inputSchema: z.object({
            order_id: z.string().describe('Order ID'),
            status: z.enum(['draft', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']).describe('New status')
          }),
          execute: async (input, options) => {
            const { order_id, status } = input

            const { data: order, error } = await supabase
              .from('orders')
              .update({ status })
              .eq('id', order_id)
              .eq('user_id', user.id)
              .select()
              .single()

            if (error) {
              return { error: `Errore aggiornamento stato: ${error.message}` }
            }

            return {
              success: true,
              order,
              message: `✅ Stato ordine aggiornato a "${status}"!`
            }
          }
        }),

        // Tool 42: Elimina ordine
        delete_order: tool({
          description: 'Delete (archive) an order',
          inputSchema: z.object({
            order_id: z.string().describe('Order ID to delete')
          }),
          execute: async (input, options) => {
            const { order_id } = input

            const { error } = await supabase
              .from('orders')
              .update({ deleted_at: new Date().toISOString() })
              .eq('id', order_id)
              .eq('user_id', user.id)

            if (error) {
              return { error: `Errore eliminazione ordine: ${error.message}` }
            }

            return {
              success: true,
              message: `✅ Ordine eliminato (archiviato) con successo!`
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

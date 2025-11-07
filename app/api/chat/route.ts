import { streamText } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export const runtime = 'edge'

// System prompts per ogni lingua
const systemPrompts = {
  it: `Sei un assistente AI per Fattura, una piattaforma di gestione fatture e preventivi.

Puoi aiutare l'utente a:
- Creare fatture e preventivi per i clienti esistenti
- Visualizzare la lista dei clienti
- Verificare i limiti del piano abbonamento corrente
- Fornire statistiche sulle fatture e preventivi

Rispondi sempre in italiano, in modo conciso, professionale e amichevole.
Quando crei fatture o preventivi, conferma sempre i dettagli prima di procedere.
Se l'utente raggiunge i limiti del piano, suggerisci gentilmente di fare l'upgrade.`,

  en: `You are an AI assistant for Fattura, an invoice and quote management platform.

You can help users to:
- Create invoices and quotes for existing clients
- View the client list
- Check current subscription plan limits
- Provide statistics on invoices and quotes

Always respond in English, concisely, professionally and in a friendly manner.
When creating invoices or quotes, always confirm the details before proceeding.
If the user reaches plan limits, kindly suggest upgrading.`,

  de: `Du bist ein KI-Assistent für Fattura, eine Plattform zur Verwaltung von Rechnungen und Angeboten.

Du kannst Benutzern helfen:
- Rechnungen und Angebote für bestehende Kunden erstellen
- Die Kundenliste anzeigen
- Die Grenzen des aktuellen Abonnementplans überprüfen
- Statistiken über Rechnungen und Angebote bereitstellen

Antworte immer auf Deutsch, prägnant, professionell und freundlich.
Bestätige beim Erstellen von Rechnungen oder Angeboten immer die Details.
Wenn der Benutzer die Plangrenzen erreicht, schlage freundlich ein Upgrade vor.`,

  fr: `Vous êtes un assistant IA pour Fattura, une plateforme de gestion de factures et devis.

Vous pouvez aider les utilisateurs à:
- Créer des factures et devis pour les clients existants
- Afficher la liste des clients
- Vérifier les limites du plan d'abonnement actuel
- Fournir des statistiques sur les factures et devis

Répondez toujours en français, de manière concise, professionnelle et amicale.
Lors de la création de factures ou devis, confirmez toujours les détails.
Si l'utilisateur atteint les limites du plan, suggérez gentiment une mise à niveau.`,

  rm: `Ti ès in assistent da KI per Fattura, ina plattafurma per administrar facturas e preventivs.

Ti pos gidar als utilisaders:
- Crear facturas e preventivs per clients existents
- Mussar la glista da clients
- Verificar ils limits dal plan d'abunament actual
- Furnir statisticas davart facturas e preventivs

Respunda adina en rumantsch, da moda concisa, profesiunala ed amiaivla.
Cura che ti creeschas facturas u preventivs, conferma adina ils detagls.
Sche l'utilisader cuntanscha ils limits dal plan, propona gentilmain in upgrade.`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages = [], locale = 'it' } = body

    // Verifica autenticazione
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // OpenRouter con Gemini 2.0 Flash (GRATUITO)
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY!,
    })

    const result = streamText({
      model: openrouter('google/gemini-2.0-flash-exp:free'),
      system: systemPrompts[locale as keyof typeof systemPrompts] || systemPrompts.it,
      messages,
      tools: {
        // ========================================
        // TOOL 1: Ottieni stato abbonamento
        // ========================================
        get_subscription_status: {
          description: 'Get current subscription plan details, limits and usage',
          parameters: z.object({}),
          execute: async () => {
            try {
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

              // Conta risorse correnti
              const { count: clientsCount } = await supabase
                .from('clients')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .is('deleted_at', null)

              const { count: invoicesCount } = await supabase
                .from('invoices')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())

              const { count: quotesCount } = await supabase
                .from('quotes')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())

              return {
                plan_name: subscription.plan?.name || 'Free',
                plan_price: subscription.plan?.price || 0,
                status: subscription.status,
                clients: {
                  current: clientsCount || 0,
                  max: subscription.plan?.max_clients || null
                },
                invoices: {
                  current: invoicesCount || 0,
                  max: subscription.plan?.max_invoices || null
                },
                quotes: {
                  current: quotesCount || 0,
                  max: subscription.plan?.max_quotes || null
                }
              }
            } catch (error) {
              console.error('Error getting subscription status:', error)
              return { error: 'Failed to get subscription status' }
            }
          }
        },

        // ========================================
        // TOOL 2: Lista clienti
        // ========================================
        list_clients: {
          description: 'List all active clients with their details',
          parameters: z.object({
            limit: z.number().optional().default(20).describe('Maximum number of clients to return')
          }),
          execute: async ({ limit }) => {
            try {
              const { data: clients, error } = await supabase
                .from('clients')
                .select('id, name, email, phone, city, country')
                .eq('user_id', user.id)
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .limit(limit)

              if (error) {
                return { error: 'Failed to fetch clients' }
              }

              return {
                total: clients?.length || 0,
                clients: clients || []
              }
            } catch (error) {
              console.error('Error listing clients:', error)
              return { error: 'Failed to list clients' }
            }
          }
        },

        // ========================================
        // TOOL 3: Cerca cliente
        // ========================================
        search_client: {
          description: 'Search for a client by name (partial match, case insensitive)',
          parameters: z.object({
            name: z.string().describe('Client name or part of it to search for')
          }),
          execute: async ({ name }) => {
            try {
              const { data: clients, error } = await supabase
                .from('clients')
                .select('id, name, email, phone, city, country')
                .eq('user_id', user.id)
                .is('deleted_at', null)
                .ilike('name', `%${name}%`)
                .limit(10)

              if (error) {
                return { error: 'Failed to search clients' }
              }

              if (!clients || clients.length === 0) {
                return { message: `No clients found matching "${name}"`, clients: [] }
              }

              return {
                found: clients.length,
                clients
              }
            } catch (error) {
              console.error('Error searching client:', error)
              return { error: 'Failed to search client' }
            }
          }
        },

        // ========================================
        // TOOL 4: Crea fattura
        // ========================================
        create_invoice: {
          description: 'Create a new invoice for a client. IMPORTANT: Must search for client first to get their ID.',
          parameters: z.object({
            client_id: z.string().describe('Client UUID (must be obtained from search_client first)'),
            amount: z.number().positive().describe('Invoice total amount in CHF'),
            description: z.string().optional().describe('Optional invoice description/notes')
          }),
          execute: async ({ client_id, amount, description }) => {
            try {
              // 1. Verifica limiti
              const { data: limitsCheck } = await supabase.rpc('check_subscription_limits', {
                p_user_id: user.id,
                p_resource_type: 'invoice'
              })

              if (limitsCheck && !limitsCheck.allowed) {
                return {
                  error: `Invoice limit reached: ${limitsCheck.current_count}/${limitsCheck.max_count} for ${limitsCheck.plan_name} plan`,
                  upgrade_needed: true,
                  current_count: limitsCheck.current_count,
                  max_count: limitsCheck.max_count,
                  plan_name: limitsCheck.plan_name
                }
              }

              // 2. Verifica che il cliente esista e appartenga all'utente
              const { data: client, error: clientError } = await supabase
                .from('clients')
                .select('id, name')
                .eq('id', client_id)
                .eq('user_id', user.id)
                .is('deleted_at', null)
                .single()

              if (clientError || !client) {
                return { error: `Client with ID ${client_id} not found or doesn't belong to you` }
              }

              // 3. Genera numero fattura
              const { count } = await supabase
                .from('invoices')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)

              const invoiceNumber = `INV-${String((count || 0) + 1).padStart(4, '0')}`

              // 4. Crea fattura
              const { data: invoice, error: insertError } = await supabase
                .from('invoices')
                .insert({
                  user_id: user.id,
                  client_id: client.id,
                  invoice_number: invoiceNumber,
                  date: new Date().toISOString().split('T')[0],
                  due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                  status: 'draft',
                  total: amount,
                  subtotal: amount / 1.081, // Rimuovi IVA 8.1%
                  tax_amount: amount - (amount / 1.081),
                  notes: description || null
                })
                .select()
                .single()

              if (insertError) {
                console.error('Error creating invoice:', insertError)
                return { error: `Failed to create invoice: ${insertError.message}` }
              }

              return {
                success: true,
                invoice_number: invoice.invoice_number,
                client_name: client.name,
                amount: amount,
                due_date: invoice.due_date,
                status: invoice.status,
                message: `Invoice ${invoice.invoice_number} created successfully for ${client.name}`
              }
            } catch (error) {
              console.error('Error creating invoice:', error)
              return { error: 'Failed to create invoice' }
            }
          }
        },

        // ========================================
        // TOOL 5: Crea preventivo
        // ========================================
        create_quote: {
          description: 'Create a new quote for a client. IMPORTANT: Must search for client first to get their ID.',
          parameters: z.object({
            client_id: z.string().describe('Client UUID (must be obtained from search_client first)'),
            amount: z.number().positive().describe('Quote total amount in CHF'),
            description: z.string().optional().describe('Optional quote description/notes'),
            valid_days: z.number().optional().default(30).describe('Quote validity in days (default: 30)')
          }),
          execute: async ({ client_id, amount, description, valid_days }) => {
            try {
              // 1. Verifica limiti
              const { data: limitsCheck } = await supabase.rpc('check_subscription_limits', {
                p_user_id: user.id,
                p_resource_type: 'quote'
              })

              if (limitsCheck && !limitsCheck.allowed) {
                return {
                  error: `Quote limit reached: ${limitsCheck.current_count}/${limitsCheck.max_count} for ${limitsCheck.plan_name} plan`,
                  upgrade_needed: true,
                  current_count: limitsCheck.current_count,
                  max_count: limitsCheck.max_count,
                  plan_name: limitsCheck.plan_name
                }
              }

              // 2. Verifica cliente
              const { data: client, error: clientError } = await supabase
                .from('clients')
                .select('id, name')
                .eq('id', client_id)
                .eq('user_id', user.id)
                .is('deleted_at', null)
                .single()

              if (clientError || !client) {
                return { error: `Client with ID ${client_id} not found or doesn't belong to you` }
              }

              // 3. Genera numero preventivo
              const { count } = await supabase
                .from('quotes')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)

              const quoteNumber = `QUO-${String((count || 0) + 1).padStart(4, '0')}`

              // 4. Crea preventivo
              const { data: quote, error: insertError } = await supabase
                .from('quotes')
                .insert({
                  user_id: user.id,
                  client_id: client.id,
                  quote_number: quoteNumber,
                  date: new Date().toISOString().split('T')[0],
                  valid_until: new Date(Date.now() + valid_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                  status: 'draft',
                  total: amount,
                  subtotal: amount / 1.081,
                  tax_amount: amount - (amount / 1.081),
                  notes: description || null
                })
                .select()
                .single()

              if (insertError) {
                console.error('Error creating quote:', insertError)
                return { error: `Failed to create quote: ${insertError.message}` }
              }

              return {
                success: true,
                quote_number: quote.quote_number,
                client_name: client.name,
                amount: amount,
                valid_until: quote.valid_until,
                status: quote.status,
                message: `Quote ${quote.quote_number} created successfully for ${client.name}`
              }
            } catch (error) {
              console.error('Error creating quote:', error)
              return { error: 'Failed to create quote' }
            }
          }
        },

        // ========================================
        // TOOL 6: Statistiche fatture
        // ========================================
        get_invoice_stats: {
          description: 'Get invoice statistics (totals, counts by status)',
          parameters: z.object({
            period: z.enum(['month', 'year', 'all']).optional().default('month').describe('Time period for statistics')
          }),
          execute: async ({ period }) => {
            try {
              let query = supabase
                .from('invoices')
                .select('status, total')
                .eq('user_id', user.id)

              // Filtra per periodo
              if (period === 'month') {
                const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
                query = query.gte('created_at', firstDay)
              } else if (period === 'year') {
                const firstDay = new Date(new Date().getFullYear(), 0, 1).toISOString()
                query = query.gte('created_at', firstDay)
              }

              const { data: invoices, error } = await query

              if (error) {
                return { error: 'Failed to get invoice stats' }
              }

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
            } catch (error) {
              console.error('Error getting invoice stats:', error)
              return { error: 'Failed to get invoice stats' }
            }
          }
        }
      },
      maxSteps: 5
    })

    // Nella v5, usa .respond() invece di .toDataStreamResponse()
    return result.respond({ messages })

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


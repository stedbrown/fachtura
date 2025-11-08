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

IMPORTANTE: Quando l'utente chiede informazioni, USA SEMPRE gli strumenti disponibili per ottenere dati reali dal database. NON inventare o ipotizzare dati.

Rispondi sempre in italiano, in modo conciso, professionale e amichevole.
Quando mostri dati, formattali in modo chiaro e leggibile.`,

  en: `You are an AI assistant for Fattura, an invoice and quote management platform.

You have access to the following tools:
- list_clients: Get the list of active clients
- search_client: Search for a client by name
- get_subscription_status: Check plan and limits
- get_invoice_stats: Invoice statistics

IMPORTANT: When users request information, ALWAYS USE the available tools to get real data from the database. DO NOT make up or assume data.

Always respond in English, concisely, professionally, and friendly.
When showing data, format it clearly and readably.`,

  de: `Du bist ein KI-Assistent für Fattura, eine Plattform zur Verwaltung von Rechnungen und Angeboten.

Du hast Zugriff auf folgende Tools:
- list_clients: Kundenliste abrufen
- search_client: Kunden nach Namen suchen
- get_subscription_status: Plan und Limits prüfen
- get_invoice_stats: Rechnungsstatistiken

WICHTIG: Wenn Benutzer nach Informationen fragen, VERWENDE IMMER die verfügbaren Tools, um echte Daten aus der Datenbank zu erhalten. ERFINDE KEINE Daten.

Antworte immer auf Deutsch, prägnant, professionell und freundlich.
Formatiere Daten klar und lesbar.`,

  fr: `Tu es un assistant IA pour Fattura, une plateforme de gestion de factures et devis.

Tu as accès aux outils suivants:
- list_clients: Obtenir la liste des clients
- search_client: Rechercher un client par nom
- get_subscription_status: Vérifier plan et limites
- get_invoice_stats: Statistiques de factures

IMPORTANT: Quand les utilisateurs demandent des informations, UTILISE TOUJOURS les outils disponibles pour obtenir des données réelles de la base de données. N'INVENTE PAS de données.

Réponds toujours en français, de manière concise, professionnelle et amicale.
Formate les données de manière claire et lisible.`,

  rm: `Ti eis in assistent AI per Fattura, ina plattaforma per administrar facturas e preventivs.

Ti has access als suandants instruments:
- list_clients: Survegnir glista da clients
- search_client: Tschertgar client tenor num
- get_subscription_status: Verifitgar plan e limits
- get_invoice_stats: Statisticas da facturas

IMPURTANT: Sche utilisaders dumandan infurmaziuns, DUVRA ADINA ils instruments disponibels per survegnir datas realas da la banca da datas. NA INVENTESCHA NAGINAS datas.

Respunda adina en rumantsch, da moda concisa, profesiunala ed amiaivla.
Formatescha datas cler e legibel.`
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
      model: openrouter('anthropic/claude-3.5-haiku'),
      system: systemPrompts[locale as keyof typeof systemPrompts] || systemPrompts.it,
      messages: coreMessages,
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

import { streamText, convertToCoreMessages } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

const systemPrompts = {
  it: `Sei un assistente AI per Fattura. Rispondi in italiano in modo conciso e amichevole.`,
  en: `You are an AI assistant for Fattura. Respond in English concisely and friendly.`,
  de: `Du bist ein KI-Assistent für Fattura. Antworte auf Deutsch prägnant und freundlich.`,
  fr: `Tu es un assistant IA pour Fattura. Réponds en français de manière concise et amicale.`,
  rm: `Ti eis in assistent AI per Fattura. Respunda en rumantsch da moda concisa ed amiaivla.`
}

export async function POST(req: NextRequest) {
  try {
    const { messages = [], locale = 'it' } = await req.json()

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

    console.log(`Messages: ${messages.length}, Core: ${coreMessages.length}`)

    // StreamText di AI SDK
    const result = await streamText({
      model: openrouter('mistralai/mistral-7b-instruct'),
      system: systemPrompts[locale as keyof typeof systemPrompts] || systemPrompts.it,
      messages: coreMessages,
      maxTokens: 1024,
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

'use client'

import { useChat } from '@ai-sdk/react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Sparkles, Trash2, Lightbulb } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useState, useEffect } from 'react'
import { Message, MessageContent } from '@/components/ai/message'
import { Response } from '@/components/ai/response'
import { Tool } from '@/components/ai/tool'
import { Conversation, ConversationContent } from '@/components/ai/conversation'
import { PromptInput } from '@/components/ai/prompt-input'

export default function ChatPage() {
  const locale = useLocale()
  const t = useTranslations('chat')
  const [inputValue, setInputValue] = useState('')

  const { messages, sendMessage, status, error, setMessages, stop } = useChat()

  const isLoading = status === 'submitted'

  // Load chat history from localStorage on mount
  useEffect(() => {
    const savedMessages = localStorage.getItem('factura-chat-history')
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages)
        setMessages(parsed)
      } catch (e) {
        console.error('Failed to load chat history:', e)
      }
    }
  }, [setMessages])

  // Save chat history to localStorage when messages change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('factura-chat-history', JSON.stringify(messages))
    }
  }, [messages])

  const handleSubmit = async () => {
    const message = inputValue.trim()
    if (!message || isLoading) return
    
    setInputValue('')
    
    try {
      await sendMessage({ 
        text: message,
        metadata: { locale }
      })
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  const handleClearHistory = () => {
    if (confirm(t('confirmClearHistory') || 'Vuoi cancellare tutta la cronologia?')) {
      setMessages([])
      localStorage.removeItem('factura-chat-history')
    }
  }

  const handleExample = (example: string) => {
    setInputValue(example)
  }

  // Example prompts
  const examples = [
    t('example1') || 'Mostrami i miei clienti',
    t('example2') || 'Qual è lo stato del mio abbonamento?',
    t('example3') || 'Crea una fattura per Mario: Consulenza 5 ore a 100 CHF'
  ]

  return (
    <Conversation className="h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">{t('title') || 'Assistente AI'}</h1>
                <p className="text-sm text-muted-foreground">
                  {t('subtitle') || 'Gestisci fatture e clienti con intelligenza artificiale'}
                </p>
              </div>
            </div>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearHistory}
                className="text-muted-foreground hover:text-foreground"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('clearHistory') || 'Cancella'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <ConversationContent>
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="max-w-2xl text-center space-y-8">
              {/* Welcome */}
              <div className="space-y-3">
                <div className="inline-flex p-4 bg-primary/10 rounded-2xl">
                  <Sparkles className="h-10 w-10 text-primary" />
                </div>
                <h2 className="text-3xl font-bold tracking-tight">
                  {t('welcomeTitle') || 'Benvenuto nell\'Assistente AI'}
                </h2>
                <p className="text-lg text-muted-foreground max-w-lg mx-auto">
                  {t('welcomeMessage') || 
                    'Posso aiutarti a gestire clienti, fatture e preventivi. Chiedi qualsiasi cosa!'}
                </p>
              </div>

              {/* Examples */}
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Lightbulb className="h-4 w-4" />
                  <span>{t('examplesTitle') || 'Prova questi esempi'}</span>
                </div>
                <div className="grid gap-3">
                  {examples.map((example, i) => (
                    <button
                      key={i}
                      onClick={() => handleExample(example)}
                      className="px-4 py-3 text-sm text-left bg-muted hover:bg-muted/80 rounded-lg transition-colors"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  {message.parts?.map((part, index) => {
                    // Render text parts
                    if (part.type === 'text' && 'text' in part) {
                      return <Response key={index}>{part.text}</Response>
                    }
                    
                    // Render tool calls - proper type narrowing for AI SDK v2
                    if (part.type && part.type.startsWith('tool-')) {
                      const toolName = part.type.replace('tool-', '')
                      
                      // Type guard for tool parts with result
                      const toolOutput = 'result' in part ? part.result : undefined
                      const toolState = 'state' in part ? part.state : 'output-available'
                      const toolError = toolOutput && typeof toolOutput === 'object' && 'error' in toolOutput 
                        ? (toolOutput as any).error 
                        : undefined
                      
                      return (
                        <Tool
                          key={index}
                          name={toolName}
                          status={toolState as any}
                          result={toolOutput}
                          error={toolError}
                        />
                      )
                    }
                    
                    return null
                  })}
                </MessageContent>
              </Message>
            ))}
          </>
        )}
      </ConversationContent>

      {/* Error Alert */}
      {error && (
        <div className="px-4 pb-4 max-w-4xl mx-auto">
          <Alert variant="destructive">
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Input */}
      <PromptInput
        value={inputValue}
        onChange={setInputValue}
        onSubmit={handleSubmit}
        onStop={stop}
        isLoading={isLoading}
        placeholder={t('inputPlaceholder') || 'Scrivi un messaggio...'}
      />

      {/* Footer */}
      <div className="border-t bg-muted/30 px-4 py-2">
        <p className="text-xs text-center text-muted-foreground max-w-4xl mx-auto">
          {t('footerText') || 
            'L\'AI può commettere errori. Verifica sempre le informazioni importanti.'}
        </p>
      </div>
    </Conversation>
  )
}

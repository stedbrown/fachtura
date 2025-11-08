'use client'

import { useChat } from '@ai-sdk/react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Sparkles, Trash2, Lightbulb, Bot } from 'lucide-react'
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
    <div className="flex h-full w-full flex-col">
      {/* Fixed Header */}
      <div className="flex-none flex items-center justify-between border-b bg-muted/50 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-green-500" />
            <span className="font-medium text-sm">{t('title') || 'Assistente AI'}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <span className="text-muted-foreground text-xs hidden sm:inline">
            GPT-4o-mini · 32 tools disponibili
          </span>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearHistory}
            className="h-8 px-2 text-xs"
          >
            <Trash2 className="size-4" />
            <span className="ml-1 hidden sm:inline">{t('clearHistory') || 'Cancella'}</span>
          </Button>
        )}
      </div>

      {/* Scrollable Conversation Area - GROWS TO FILL SPACE */}
      <div className="flex-1 min-h-0">
        <Conversation className="h-full">
          <ConversationContent>
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center p-4">
                <div className="max-w-2xl w-full text-center space-y-8">
                  {/* Welcome */}
                  <div className="space-y-4">
                    <div className="inline-flex p-4 bg-primary/10 rounded-2xl">
                      <Bot className="h-12 w-12 text-primary" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                        {t('welcomeTitle') || 'Assistente AI Fattura'}
                      </h2>
                      <p className="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto">
                        {t('welcomeMessage') || 
                          'Posso aiutarti a gestire clienti, fatture e preventivi. Chiedi qualsiasi cosa!'}
                      </p>
                    </div>
                  </div>

                  {/* Examples */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-muted-foreground">
                      <Lightbulb className="h-4 w-4" />
                      <span>{t('examplesTitle') || 'Prova questi esempi'}</span>
                    </div>
                    <div className="grid gap-2 sm:gap-3">
                      {examples.map((example, i) => (
                        <button
                          key={i}
                          onClick={() => handleExample(example)}
                          className="px-4 py-3 text-xs sm:text-sm text-left bg-muted hover:bg-muted/80 rounded-lg transition-colors border border-transparent hover:border-border"
                        >
                          <span className="text-muted-foreground mr-2">→</span>
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
                        if (part.type === 'text') {
                          const textContent = 'text' in part ? part.text : ''
                          if (textContent) {
                            return <Response key={index}>{textContent}</Response>
                          }
                        }
                        
                        // Render tool calls
                        if (part.type?.startsWith('tool-')) {
                          const toolName = part.type.replace('tool-', '')
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
        </Conversation>
      </div>

      {/* Error Alert - Fixed above input */}
      {error && (
        <div className="flex-none px-4 py-2 border-t bg-destructive/10">
          <Alert variant="destructive" className="max-w-4xl mx-auto">
            <AlertDescription className="text-sm">{error.message}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Fixed Input at Bottom - ALWAYS VISIBLE */}
      <div className="flex-none border-t bg-background">
        <div className="max-w-4xl mx-auto p-4">
          <PromptInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            onStop={stop}
            isLoading={isLoading}
            placeholder={t('inputPlaceholder') || 'Scrivi un messaggio...'}
          />
        </div>
      </div>

      {/* Fixed Footer - ALWAYS VISIBLE */}
      <div className="flex-none border-t bg-muted/30 px-4 py-2">
        <p className="text-xs text-center text-muted-foreground">
          {t('footerText') || 
            'L\'AI può commettere errori. Verifica sempre le informazioni importanti.'}
        </p>
      </div>
    </div>
  )
}

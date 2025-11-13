'use client'

import { useChat } from '@ai-sdk/react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Sparkles, Trash2, Lightbulb, Bot } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useState, useEffect, useRef } from 'react'
import { Message, MessageContent, ThinkingMessage } from '@/components/ai/message'
import { Response } from '@/components/ai/response'
import { Tool } from '@/components/ai/tool'
import { PromptInput } from '@/components/ai/prompt-input'
import { logger } from '@/lib/logger'

type ToolStatus = 'input-streaming' | 'processing' | 'output-available' | 'error'
type ToolResult = { message?: string; error?: string; [key: string]: unknown }

const isToolStatus = (value: unknown): value is ToolStatus =>
  typeof value === 'string' &&
  ['input-streaming', 'processing', 'output-available', 'error'].includes(
    value as ToolStatus
  )

const isToolResult = (value: unknown): value is ToolResult =>
  typeof value === 'object' && value !== null

export default function ChatPage() {
  const locale = useLocale()
  const t = useTranslations('chat')
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status, error, setMessages, stop } = useChat()

  const isLoading = status === 'submitted'

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load chat history from localStorage on mount
  useEffect(() => {
    const savedMessages = localStorage.getItem('factura-chat-history')
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages)
        setMessages(parsed)
      } catch (e) {
        logger.error('Failed to load chat history', e)
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
      logger.error('Error sending message', error)
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
    <div className="relative h-full w-full flex flex-col bg-background">
      {/* Fixed Header */}
      <div className="shrink-0 flex items-center justify-between border-b bg-muted/50 px-4 py-3 sm:px-6">
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

      {/* Scrollable Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center min-h-[400px]">
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
            <div className="space-y-4">
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
                        const normalizedState = isToolStatus(toolState)
                          ? toolState
                          : 'output-available'
                        const normalizedResult = isToolResult(toolOutput)
                          ? toolOutput
                          : undefined
                        const toolError =
                          typeof normalizedResult?.error === 'string'
                            ? normalizedResult.error
                            : undefined

                        return (
                          <Tool
                            key={index}
                            name={toolName}
                            status={normalizedState}
                            result={normalizedResult}
                            error={toolError}
                          />
                        )
                      }
                      
                      return null
                    })}
                  </MessageContent>
                </Message>
              ))}
              
              {/* Thinking indicator while AI is responding */}
              {isLoading && <ThinkingMessage text={t('thinking') || 'Sto pensando...'} />}
              
              {/* Auto-scroll anchor */}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="shrink-0 px-4 py-2 border-t bg-destructive/10">
          <Alert variant="destructive" className="max-w-7xl mx-auto">
            <AlertDescription className="text-sm">{error.message}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Fixed Input at Bottom */}
      <div className="shrink-0 bg-background px-4 py-3">
        <div className="max-w-7xl mx-auto">
          <PromptInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            onStop={stop}
            isLoading={isLoading}
            placeholder={t('inputPlaceholder') || 'Messaggio AI...'}
          />
        </div>
      </div>
    </div>
  )
}

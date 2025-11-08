'use client'

import { useChat } from '@ai-sdk/react'
import { useLocale, useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Bot, User, Sparkles, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useState, FormEvent } from 'react'

export default function ChatPage() {
  const locale = useLocale()
  const t = useTranslations('chat')
  const [inputValue, setInputValue] = useState('')

  const { messages, sendMessage, status, error } = useChat()

  const isLoading = status === 'submitted'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || isLoading) return
    
    const message = inputValue.trim()
    setInputValue('')
    
    try {
      // In AI SDK v5, usa 'text' e passa locale nei metadata
      await sendMessage({ 
        text: message,
        metadata: { locale }
      })
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{t('title')}</h1>
            <p className="text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>
      </div>

      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bot className="h-5 w-5" />
            {t('chatTitle')}
          </CardTitle>
          <CardDescription>{t('chatDescription')}</CardDescription>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0">
          {/* Messages Area */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300',
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'flex gap-3 max-w-[85%]',
                        message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                      )}
                    >
                      {/* Avatar */}
                      <div
                        className={cn(
                          'h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-1',
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        )}
                      >
                        {message.role === 'user' ? (
                          <User className="h-4 w-4" />
                        ) : (
                          <Bot className="h-4 w-4" />
                        )}
                      </div>

                      {/* Message Content */}
                      <div
                        className={cn(
                          'rounded-lg px-4 py-3 break-words',
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        )}
                      >
                        {/* Message Text */}
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                          {/* Support both content (string) and parts (array) */}
                          {typeof message.content === 'string' ? (
                            message.content
                          ) : (
                            message.parts?.map((part, index) => {
                              // Render text parts
                              if (part.type === 'text') {
                                return <span key={index}>{part.text}</span>
                              }
                              // Show tool errors for debugging
                              if (part.state === 'output-error' && part.errorText) {
                                return (
                                  <div key={index} className="text-xs text-red-500 mt-2 p-2 bg-red-50 dark:bg-red-950/20 rounded">
                                    <strong>Tool Error ({part.type}):</strong> {part.errorText}
                                  </div>
                                )
                              }
                              return null
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex gap-3 animate-in fade-in">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="bg-muted rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="h-2 w-2 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <div className="h-2 w-2 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <div className="h-2 w-2 bg-foreground/40 rounded-full animate-bounce" />
                      </div>
                      <span className="text-xs text-muted-foreground">{t('thinking')}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Error Alert */}
          {error && (
            <div className="px-4 py-2 border-t">
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {t('error')}: {error.message}
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 border-t bg-background">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={t('placeholder')}
                disabled={isLoading}
                className="flex-1"
                autoFocus
              />
              <Button type="submit" disabled={isLoading || !inputValue.trim()} size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </form>

            {/* Examples */}
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground">{t('examples')}:</span>
              {[
                t('example1'),
                t('example2'),
                t('example3')
              ].map((example, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setInputValue(example)}
                  disabled={isLoading}
                  className="text-xs bg-muted hover:bg-muted/80 px-2 py-1 rounded transition-colors disabled:opacity-50"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

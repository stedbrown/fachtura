import * as React from 'react'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Send, StopCircle, Mic, MicOff } from 'lucide-react'

interface PromptInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onStop?: () => void
  isLoading?: boolean
  disabled?: boolean
  placeholder?: string
  maxRows?: number
  className?: string
}

export function PromptInput({
  value,
  onChange,
  onSubmit,
  onStop,
  isLoading = false,
  disabled = false,
  placeholder = 'Scrivi un messaggio...',
  maxRows = 3,
  className
}: PromptInputProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const [isListening, setIsListening] = React.useState(false)
  const recognitionRef = React.useRef<any>(null)

  // Initialize Speech Recognition
  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'it-IT' // Italian

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      const currentValue = textareaRef.current?.value || ''
      const newValue = currentValue ? currentValue + ' ' + transcript : transcript
      onChange(newValue)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error)
      setIsListening(false)
    }

    recognitionRef.current = recognition
  }, [onChange])

  // Auto-resize textarea (più compatto)
  React.useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    const scrollHeight = textarea.scrollHeight
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 24
    const maxHeight = lineHeight * maxRows
    textarea.style.height = Math.min(scrollHeight, maxHeight) + 'px'
  }, [value, maxRows])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isLoading && value.trim()) {
        onSubmit()
      }
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoading && value.trim()) {
      onSubmit()
    }
  }

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition non supportato dal tuo browser. Usa Chrome o Edge.')
      return
    }

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      recognitionRef.current.start()
      setIsListening(true)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cn('w-full', className)}>
      <div className="relative flex items-end gap-2 rounded-3xl border bg-background shadow-sm focus-within:shadow-md transition-shadow">
        {/* Textarea */}
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          className={cn(
            'flex-1 min-h-[48px] max-h-[120px] resize-none border-0 shadow-none',
            'focus-visible:ring-0 focus-visible:ring-offset-0',
            'px-4 py-3 pr-24', // Space for buttons on right
            'rounded-3xl text-sm'
          )}
          rows={1}
        />

        {/* Right buttons group */}
        <div className="absolute right-2 bottom-2 flex items-center gap-1">
          {/* Microphone button */}
          {!isLoading && (
            <Button
              type="button"
              onClick={toggleListening}
              size="icon"
              variant="ghost"
              className={cn(
                "h-8 w-8 rounded-full transition-colors",
                isListening && "bg-red-500 text-white hover:bg-red-600 hover:text-white"
              )}
              title={isListening ? "Stop registrazione" : "Inizia registrazione vocale"}
            >
              {isListening ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
          )}

          {/* Send/Stop button */}
          {isLoading && onStop ? (
            <Button
              type="button"
              onClick={onStop}
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full hover:bg-muted"
              title="Ferma generazione"
            >
              <StopCircle className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!value.trim() || isLoading || disabled}
              className={cn(
                "h-8 w-8 rounded-full transition-all",
                value.trim() ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-muted-foreground"
              )}
              title="Invia messaggio (Enter)"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Helper text */}
      <div className="flex items-center justify-center gap-2 mt-2 text-xs text-muted-foreground">
        <span>Premi <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Invio</kbd> per inviare</span>
        <span>•</span>
        <span><kbd className="px-1 py-0.5 bg-muted rounded text-xs">Shift+Invio</kbd> per andare a capo</span>
      </div>
    </form>
  )
}


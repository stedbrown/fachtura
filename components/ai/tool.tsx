import * as React from 'react'
import { cn } from '@/lib/utils'
import { CheckCircle2, Circle, AlertCircle, Loader2 } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'

interface ToolProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string
  status?: 'input-streaming' | 'processing' | 'output-available' | 'error'
  result?: { message?: string; [key: string]: unknown }
  error?: string
}

export function Tool({ 
  name, 
  status = 'output-available', 
  result, 
  error,
  className,
  children,
  ...props 
}: ToolProps) {
  const [isOpen, setIsOpen] = React.useState(status === 'error')
  
  const isProcessing = status === 'input-streaming' || status === 'processing'
  const isComplete = status === 'output-available'
  const hasError = status === 'error' || error

  const StatusIcon = hasError
    ? AlertCircle
    : isComplete
    ? CheckCircle2
    : isProcessing
    ? Loader2
    : Circle

  const statusColor = hasError
    ? 'text-destructive'
    : isComplete
    ? 'text-green-600 dark:text-green-400'
    : isProcessing
    ? 'text-blue-600 dark:text-blue-400'
    : 'text-muted-foreground'

  const statusBg = hasError
    ? 'bg-destructive/10 border-destructive/20'
    : isComplete
    ? 'bg-green-500/10 border-green-500/20'
    : isProcessing
    ? 'bg-blue-500/10 border-blue-500/20'
    : 'bg-muted/50 border-border'

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn('my-2', className)}
      {...props}
    >
      <div className={cn(
        'border rounded-lg overflow-hidden',
        statusBg
      )}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 h-auto py-2 px-3 font-normal hover:bg-transparent"
          >
            <StatusIcon
              className={cn(
                'h-4 w-4 shrink-0',
                statusColor,
                isProcessing && 'animate-spin'
              )}
            />
            <span className="text-sm font-medium">
              {isProcessing && 'Esecuzione: '}
              {name}
            </span>
          </Button>
        </CollapsibleTrigger>
        
        {(result || error || children) && (
          <CollapsibleContent className="px-3 pb-3">
            {error && (
              <div className="text-sm text-destructive whitespace-pre-wrap">
                {error}
              </div>
            )}
            {result?.message && (
              <div className="text-sm whitespace-pre-wrap">
                {result.message}
              </div>
            )}
            {children}
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  )
}


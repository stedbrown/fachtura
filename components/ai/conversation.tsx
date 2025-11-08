import * as React from 'react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ConversationProps extends React.HTMLAttributes<HTMLDivElement> {
  autoScroll?: boolean
}

export function Conversation({ 
  autoScroll = true, 
  className, 
  children, 
  ...props 
}: ConversationProps) {
  return (
    <div
      className={cn(
        'flex flex-col h-full bg-background',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

interface ConversationContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export function ConversationContent({ 
  className, 
  children, 
  ...props 
}: ConversationContentProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [shouldAutoScroll, setShouldAutoScroll] = React.useState(true)

  // Auto-scroll to bottom when new content arrives
  React.useEffect(() => {
    if (shouldAutoScroll && scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight
      }
    }
  }, [children, shouldAutoScroll])

  // Detect manual scrolling to disable auto-scroll
  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement
    const isAtBottom = 
      Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) < 10
    setShouldAutoScroll(isAtBottom)
  }, [])

  return (
    <ScrollArea 
      ref={scrollRef}
      className={cn('flex-1 px-4', className)}
      onScroll={handleScroll}
      {...props}
    >
      <div className="max-w-4xl mx-auto py-4 space-y-2">
        {children}
      </div>
    </ScrollArea>
  )
}


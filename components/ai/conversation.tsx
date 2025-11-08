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

interface ConversationContentProps {
  children: React.ReactNode
  className?: string
}

export function ConversationContent({ 
  className, 
  children
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

  // Setup scroll listener on viewport
  React.useEffect(() => {
    const scrollElement = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]')
    if (!scrollElement) return

    const handleScroll = () => {
      const isAtBottom = 
        Math.abs(scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight) < 10
      setShouldAutoScroll(isAtBottom)
    }

    scrollElement.addEventListener('scroll', handleScroll)
    return () => scrollElement.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <ScrollArea 
      ref={scrollRef}
      className={cn('flex-1 px-4', className)}
    >
      <div className="max-w-4xl mx-auto py-4 space-y-2">
        {children}
      </div>
    </ScrollArea>
  )
}


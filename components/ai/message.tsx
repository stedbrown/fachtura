import * as React from 'react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Bot, User } from 'lucide-react'

interface MessageProps extends React.HTMLAttributes<HTMLDivElement> {
  from: 'user' | 'assistant' | 'system'
}

export function Message({ from, className, children, ...props }: MessageProps) {
  return (
    <div
      className={cn(
        'group relative flex gap-3 py-4',
        from === 'user' && 'flex-row-reverse',
        className
      )}
      {...props}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={cn(
          from === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}>
          {from === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      <div className={cn(
        'flex-1 space-y-2',
        from === 'user' && 'flex flex-col items-end'
      )}>
        {children}
      </div>
    </div>
  )
}

interface MessageContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export function MessageContent({ className, children, ...props }: MessageContentProps) {
  return (
    <div
      className={cn('space-y-2 text-sm', className)}
      {...props}
    >
      {children}
    </div>
  )
}


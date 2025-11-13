'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

type FieldProps<T extends HTMLElement> = React.HTMLAttributes<T>

const FieldGroup = React.forwardRef<HTMLDivElement, FieldProps<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex flex-col gap-6', className)} {...props} />
))
FieldGroup.displayName = 'FieldGroup'

const Field = React.forwardRef<HTMLDivElement, FieldProps<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex flex-col gap-2', className)} {...props} />
))
Field.displayName = 'Field'

const FieldLabel = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('text-sm font-medium leading-none text-left', className)}
      {...props}
    />
  ),
)
FieldLabel.displayName = 'FieldLabel'

const FieldDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-xs text-muted-foreground', className)} {...props} />
  ),
)
FieldDescription.displayName = 'FieldDescription'

const FieldSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center gap-3 text-xs uppercase text-muted-foreground', className)} {...props}>
      <div className="h-px flex-1 bg-border" />
      {children}
      <div className="h-px flex-1 bg-border" />
    </div>
  ),
)
FieldSeparator.displayName = 'FieldSeparator'

export { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator }


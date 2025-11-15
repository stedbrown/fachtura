'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

interface StepperProps {
  currentStep: number
  steps: Array<{ label: string; description?: string }>
  className?: string
}

export function Stepper({ currentStep, steps, className }: StepperProps) {
  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isActive = index === currentStep
          const isCompleted = index < currentStep
          const isLast = index === steps.length - 1

          return (
            <React.Fragment key={index}>
              <div className="flex flex-col items-center flex-1">
                <div
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all',
                    isCompleted
                      ? 'bg-primary border-primary text-primary-foreground'
                      : isActive
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-muted-foreground/30 bg-background text-muted-foreground'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                  )}
                </div>
                <div className="mt-2 text-center">
                  <p
                    className={cn(
                      'text-xs font-medium',
                      isActive ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-2 transition-colors',
                    isCompleted ? 'bg-primary' : 'bg-muted-foreground/30'
                  )}
                />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

interface StepContentProps {
  children: React.ReactNode
  className?: string
}

export function StepContent({ children, className }: StepContentProps) {
  return (
    <div className={cn('animate-in fade-in-50 slide-in-from-bottom-4 duration-300', className)}>
      {children}
    </div>
  )
}


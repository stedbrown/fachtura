'use client'

import * as React from 'react'
import { Stepper, StepContent } from '@/components/ui/stepper'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight, Check, ChevronDown, Eye, EyeOff, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Step {
  id: string
  label: string
  description?: string
  component: React.ReactNode
  isValid?: boolean
}

interface DocumentWizardProps {
  steps: Step[]
  onComplete: () => void
  onCancel: () => void
  className?: string
  showPreview?: boolean
  previewComponent?: React.ReactNode | ((data: any) => React.ReactNode)
  previewData?: any
}

export function DocumentWizard({
  steps,
  onComplete,
  onCancel,
  className,
  showPreview = false,
  previewComponent,
  previewData,
  isSaving = false,
}: DocumentWizardProps) {
  const [currentStep, setCurrentStep] = React.useState(0)
  const [direction, setDirection] = React.useState<'forward' | 'backward'>('forward')
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false)

  const canGoNext = steps[currentStep]?.isValid !== false
  const canGoBack = currentStep > 0
  const isLastStep = currentStep === steps.length - 1

  const handleNext = () => {
    if (isLastStep) {
      onComplete()
    } else {
      setDirection('forward')
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1))
    }
  }

  const handleBack = () => {
    setDirection('backward')
    setCurrentStep((prev) => Math.max(prev - 1, 0))
  }

  const goToStep = (stepIndex: number) => {
    if (stepIndex < currentStep) {
      setDirection('backward')
    } else {
      setDirection('forward')
    }
    setCurrentStep(stepIndex)
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Stepper Header */}
      <div className="border-b bg-background px-4 sm:px-6 py-4">
        <Stepper
          currentStep={currentStep}
          steps={steps.map((s) => ({ label: s.label, description: s.description }))}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Form Section */}
        <div className="flex-1 overflow-y-auto bg-background">
          <div className="p-4 sm:p-6 max-w-2xl mx-auto w-full">
            <StepContent
              key={currentStep}
              className={cn(
                'transition-all duration-300',
                direction === 'forward' ? 'animate-in slide-in-from-right' : 'animate-in slide-in-from-left'
              )}
            >
              {steps[currentStep]?.component}
            </StepContent>
          </div>
        </div>

        {/* Mobile Preview Toggle - Only show when preview is available */}
        {showPreview && previewComponent && (
          <div className="lg:hidden border-t border-border bg-background/95 backdrop-blur-sm px-4 py-3 flex-shrink-0 shadow-sm">
            <Button
              variant={isPreviewOpen ? "secondary" : "default"}
              size="lg"
              className="w-full justify-between h-12 font-semibold shadow-md hover:shadow-lg transition-all"
              onClick={() => setIsPreviewOpen((prev) => !prev)}
            >
              <div className="flex items-center gap-2">
                {isPreviewOpen ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
                <span className="text-base font-semibold">
                  {isPreviewOpen ? 'Nascondi Anteprima' : 'Mostra Anteprima'}
                </span>
              </div>
              <ChevronDown
                className={cn('h-5 w-5 transition-transform duration-200', isPreviewOpen ? 'rotate-180' : '')}
              />
            </Button>
          </div>
        )}

        {/* Preview Section - Only show when client is selected and has valid data */}
        {showPreview && previewComponent && previewData && (
          <>
            {/* Desktop Preview */}
            <div className="hidden lg:flex lg:w-1/2 border-l border-border/50 bg-muted/20 overflow-hidden flex-col">
              <div className="flex-1 overflow-hidden relative">
                <div className="absolute inset-0 p-4">
                  {typeof previewComponent === 'function' 
                    ? previewComponent(previewData)
                    : previewComponent}
                </div>
              </div>
            </div>
            {/* Mobile Preview */}
            <div
              className={cn(
                'lg:hidden border-t border-border bg-muted/20 flex-shrink-0 overflow-hidden',
                isPreviewOpen ? 'flex flex-col h-[70vh]' : 'hidden'
              )}
            >
              <div className="flex-1 overflow-hidden relative p-4">
                {typeof previewComponent === 'function' 
                  ? previewComponent(previewData)
                  : previewComponent}
              </div>
            </div>
          </>
        )}

        {/* Empty State when preview is not available */}
        {!showPreview && previewComponent && (
          <div className="hidden lg:flex lg:w-1/2 border-l bg-muted/30 items-center justify-center">
            <div className="text-center p-8 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Seleziona un cliente per vedere l'anteprima
              </p>
              <p className="text-xs text-muted-foreground">
                La preview del documento apparirà qui
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="border-t bg-background/95 backdrop-blur-sm px-4 sm:px-6 py-3 sm:py-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:pb-4 shadow-lg lg:shadow-none">
        <div className="flex items-center justify-between gap-3 max-w-2xl mx-auto">
          <Button
            variant="ghost"
            onClick={canGoBack ? handleBack : onCancel}
            disabled={!canGoBack && !onCancel}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {canGoBack ? 'Indietro' : 'Annulla'}
          </Button>

          <div className="flex items-center gap-2">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => goToStep(index)}
                className={cn(
                  'h-2 w-2 rounded-full transition-all',
                  index === currentStep
                    ? 'bg-primary w-6'
                    : index < currentStep
                    ? 'bg-primary/50'
                    : 'bg-muted-foreground/30'
                )}
                aria-label={`Vai allo step ${index + 1}`}
              />
            ))}
          </div>

          <Button onClick={handleNext} disabled={!canGoNext}>
            {isLastStep ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Completa
              </>
            ) : (
              <>
                Avanti
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}


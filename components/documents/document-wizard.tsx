'use client'

import * as React from 'react'
import { Stepper, StepContent } from '@/components/ui/stepper'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight, Check, ChevronDown } from 'lucide-react'
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

        {/* Mobile Preview Toggle */}
        {showPreview && previewComponent && (
          <div className="lg:hidden border-t border-border/60 bg-muted/30 px-4 py-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between"
              onClick={() => setIsPreviewOpen((prev) => !prev)}
            >
              <span className="text-sm font-medium">
                {isPreviewOpen ? 'Nascondi Anteprima' : 'Mostra Anteprima'}
              </span>
              <ChevronDown
                className={cn('h-4 w-4 transition-transform', isPreviewOpen ? 'rotate-180' : '')}
              />
            </Button>
          </div>
        )}

        {/* Preview Section */}
        {showPreview && previewComponent && (
          <>
            {/* Desktop Preview */}
            <div className="hidden lg:block lg:w-1/2 border-l bg-muted/30 overflow-y-auto">
              <div className="sticky top-0 p-4">
                {typeof previewComponent === 'function' 
                  ? previewComponent(previewData)
                  : previewComponent}
              </div>
            </div>
            {/* Mobile Preview */}
            <div
              className={cn(
                'lg:hidden border-t border-border/60 bg-muted/30 flex-shrink-0 overflow-hidden',
                isPreviewOpen ? 'block h-[50vh]' : 'hidden'
              )}
            >
              <div className="h-full overflow-y-auto p-4">
                {typeof previewComponent === 'function' 
                  ? previewComponent(previewData)
                  : previewComponent}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="border-t bg-background px-4 sm:px-6 py-3 sm:py-4">
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


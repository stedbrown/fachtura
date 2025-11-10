'use client'

import { useColorTheme, type ThemeColor, type ThemeRadius } from '@/hooks/use-theme'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const themes: { name: string; value: ThemeColor; color: string }[] = [
  { name: 'Neutral', value: 'neutral', color: 'bg-zinc-900' },
  { name: 'Slate', value: 'slate', color: 'bg-slate-700' },
  { name: 'Zinc', value: 'zinc', color: 'bg-zinc-700' },
  { name: 'Stone', value: 'stone', color: 'bg-stone-700' },
  { name: 'Gray', value: 'gray', color: 'bg-gray-700' },
  { name: 'Blue', value: 'blue', color: 'bg-blue-600' },
  { name: 'Green', value: 'green', color: 'bg-green-600' },
  { name: 'Orange', value: 'orange', color: 'bg-orange-600' },
  { name: 'Rose', value: 'rose', color: 'bg-rose-600' },
  { name: 'Violet', value: 'violet', color: 'bg-violet-600' },
]

const radiusOptions: { name: string; value: ThemeRadius; description: string }[] = [
  { name: 'Nessuno', value: '0', description: 'Angoli retti' },
  { name: 'Piccolo', value: '0.3', description: 'Leggermente arrotondato' },
  { name: 'Medio', value: '0.5', description: 'Arrotondato (default)' },
  { name: 'Grande', value: '0.75', description: 'Molto arrotondato' },
  { name: 'Massimo', value: '1.0', description: 'Completamente arrotondato' },
]

export function ThemeCustomizer() {
  const { colorTheme, radius, mounted, changeColorTheme, changeRadius } = useColorTheme()

  if (!mounted) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="space-y-3">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="grid grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Color Theme Selection */}
      <div className="space-y-3">
        <div>
          <Label className="text-base">Colore del tema</Label>
          <p className="text-sm text-muted-foreground">
            Scegli il colore principale che verrà utilizzato in tutta l'applicazione
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {themes.map((t) => (
            <button
              key={t.value}
              onClick={() => changeColorTheme(t.value)}
              className={cn(
                'group relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all hover:border-primary/50',
                colorTheme === t.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-background hover:bg-accent'
              )}
            >
              <div className={cn('h-10 w-10 rounded-md ring-2 ring-border', t.color)} />
              <span className="text-sm font-medium">{t.name}</span>
              {colorTheme === t.value && (
                <div className="absolute top-2 right-2">
                  <Check className="h-4 w-4 text-primary" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Border Radius Selection */}
      <div className="space-y-3">
        <div>
          <Label className="text-base">Raggio dei bordi</Label>
          <p className="text-sm text-muted-foreground">
            Controlla quanto arrotondati sono gli angoli di bottoni, card e altri elementi
          </p>
        </div>

        <div className="grid gap-3">
          {radiusOptions.map((r) => (
            <Button
              key={r.value}
              variant={radius === r.value ? 'default' : 'outline'}
              className={cn(
                'justify-start h-auto py-3 px-4',
                radius === r.value && 'border-primary'
              )}
              onClick={() => changeRadius(r.value)}
            >
              <div className="flex items-center gap-3 w-full">
                <div
                  className={cn(
                    'h-8 w-8 bg-primary transition-all',
                    r.value === '0' && 'rounded-none',
                    r.value === '0.3' && 'rounded-sm',
                    r.value === '0.5' && 'rounded-md',
                    r.value === '0.75' && 'rounded-lg',
                    r.value === '1.0' && 'rounded-xl'
                  )}
                />
                <div className="flex-1 text-left">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.description}</div>
                </div>
                {radius === r.value && <Check className="h-4 w-4" />}
              </div>
            </Button>
          ))}
        </div>
      </div>

      {/* Preview Section */}
      <div className="space-y-3">
        <Label className="text-base">Anteprima</Label>
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Button size="sm">Primario</Button>
            <Button size="sm" variant="secondary">
              Secondario
            </Button>
            <Button size="sm" variant="outline">
              Outline
            </Button>
            <Button size="sm" variant="destructive">
              Distruttivo
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-20 bg-primary rounded animate-pulse" />
            <div className="h-10 w-20 bg-secondary rounded animate-pulse" />
            <div className="h-10 w-20 bg-muted rounded animate-pulse" />
            <div className="h-10 w-20 bg-accent rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}


import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  FileText, 
  Receipt, 
  Users, 
  BarChart3, 
  Globe, 
  Shield, 
  Download,
  CheckCircle,
  Zap,
  ArrowRight,
  Languages,
  Check
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Se l'utente è loggato, reindirizza alla dashboard
  if (user) {
    redirect(`/${locale}/dashboard`)
  }

  const t = await getTranslations('landing')

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6 max-w-7xl">
          <div className="flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Fatturup</span>
          </div>
          <div className="flex items-center gap-4">
            {/* Language Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Languages className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/it" className="w-full cursor-pointer">
                    🇮🇹 Italiano
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/en" className="w-full cursor-pointer">
                    🇬🇧 English
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/de" className="w-full cursor-pointer">
                    🇩🇪 Deutsch
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/fr" className="w-full cursor-pointer">
                    🇫🇷 Français
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/rm" className="w-full cursor-pointer">
                    🇨🇭 Rumantsch
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Link href={`/${locale}/auth/login`}>
              <Button variant="ghost">{t('login')}</Button>
            </Link>
            <Link href={`/${locale}/auth/register`}>
              <Button>{t('getStarted')}</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="w-full py-24 md:py-32">
        <div className="container px-4 md:px-6 mx-auto max-w-7xl">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl max-w-[900px]">
              {t('hero.title')}
            </h1>
            <p className="max-w-[700px] text-lg text-muted-foreground sm:text-xl">
              {t('hero.subtitle')}
            </p>
            <div className="flex flex-col gap-4 sm:flex-row mt-8 justify-center">
              <Link href={`/${locale}/auth/register`}>
                <Button size="lg" className="gap-2">
                  {t('hero.cta')} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href={`/${locale}/auth/login`}>
                <Button size="lg" variant="outline">
                  {t('hero.secondaryCta')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="w-full py-24 bg-muted/50">
        <div className="container px-4 md:px-6 mx-auto max-w-7xl">
          <div className="flex flex-col items-center justify-center gap-12">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                {t('features.title')}
              </h2>
              <p className="mt-4 text-muted-foreground text-lg max-w-[700px] mx-auto">
                {t('features.subtitle')}
              </p>
            </div>
            
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 w-full">
              <Card>
                <CardHeader>
                  <FileText className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>{t('features.quotes.title')}</CardTitle>
                  <CardDescription>{t('features.quotes.description')}</CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <Receipt className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>{t('features.invoices.title')}</CardTitle>
                  <CardDescription>{t('features.invoices.description')}</CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <Users className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>{t('features.clients.title')}</CardTitle>
                  <CardDescription>{t('features.clients.description')}</CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <BarChart3 className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>{t('features.analytics.title')}</CardTitle>
                  <CardDescription>{t('features.analytics.description')}</CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <Globe className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>{t('features.multilang.title')}</CardTitle>
                  <CardDescription>{t('features.multilang.description')}</CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <Download className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>{t('features.export.title')}</CardTitle>
                  <CardDescription>{t('features.export.description')}</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="w-full py-24 bg-muted/50">
        <div className="container px-4 md:px-6 mx-auto max-w-7xl">
          <div className="flex flex-col items-center justify-center gap-12">
            <div className="text-center">
              <Badge variant="outline" className="mb-4">{t('pricing.badge')}</Badge>
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                {t('pricing.title')}
              </h2>
              <p className="mt-4 text-muted-foreground text-lg max-w-[700px] mx-auto">
                {t('pricing.subtitle')}
              </p>
            </div>
            
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 w-full">
              {/* Free Plan */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">{t('pricing.free.name')}</CardTitle>
                  <CardDescription>{t('pricing.free.description')}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{t('pricing.free.price')}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      <span className="text-sm">{t('pricing.free.feature1')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      <span className="text-sm">{t('pricing.free.feature2')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      <span className="text-sm">{t('pricing.free.feature3')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      <span className="text-sm">{t('pricing.free.feature4')}</span>
                    </li>
                  </ul>
                  <Link href={`/${locale}/auth/register`}>
                    <Button className="w-full" variant="outline">
                      {t('pricing.free.cta')}
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Pro Plan */}
              <Card className="border-primary shadow-lg scale-105 relative">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <Badge className="px-4 py-1">{t('pricing.popular')}</Badge>
                </div>
                <CardHeader>
                  <CardTitle className="text-2xl">{t('pricing.pro.name')}</CardTitle>
                  <CardDescription>{t('pricing.pro.description')}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">CHF 29</span>
                    <span className="text-muted-foreground">/mese</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      <span className="text-sm">{t('pricing.pro.feature1')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      <span className="text-sm">{t('pricing.pro.feature2')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      <span className="text-sm">{t('pricing.pro.feature3')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      <span className="text-sm">{t('pricing.pro.feature4')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      <span className="text-sm">{t('pricing.pro.feature5')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      <span className="text-sm">{t('pricing.pro.feature6')}</span>
                    </li>
                  </ul>
                  <Link href={`/${locale}/auth/register`}>
                    <Button className="w-full">
                      {t('pricing.pro.cta')}
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Business Plan */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">{t('pricing.business.name')}</CardTitle>
                  <CardDescription>{t('pricing.business.description')}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">CHF 79</span>
                    <span className="text-muted-foreground">/mese</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      <span className="text-sm">{t('pricing.business.feature1')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      <span className="text-sm">{t('pricing.business.feature2')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      <span className="text-sm">{t('pricing.business.feature3')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      <span className="text-sm">{t('pricing.business.feature4')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      <span className="text-sm">{t('pricing.business.feature5')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      <span className="text-sm">{t('pricing.business.feature6')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      <span className="text-sm">{t('pricing.business.feature7')}</span>
                    </li>
                  </ul>
                  <Link href={`/${locale}/auth/register`}>
                    <Button className="w-full" variant="outline">
                      {t('pricing.business.cta')}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="w-full py-24">
        <div className="container px-4 md:px-6 mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl mb-6">
                {t('benefits.title')}
              </h2>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold">{t('benefits.free.title')}</h3>
                    <p className="text-muted-foreground">{t('benefits.free.description')}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Zap className="h-6 w-6 text-yellow-500 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold">{t('benefits.fast.title')}</h3>
                    <p className="text-muted-foreground">{t('benefits.fast.description')}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Shield className="h-6 w-6 text-blue-500 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold">{t('benefits.secure.title')}</h3>
                    <p className="text-muted-foreground">{t('benefits.secure.description')}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Globe className="h-6 w-6 text-purple-500 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold">{t('benefits.swiss.title')}</h3>
                    <p className="text-muted-foreground">{t('benefits.swiss.description')}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:pl-12">
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="text-2xl">{t('cta.title')}</CardTitle>
                  <CardDescription>{t('cta.description')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={`/${locale}/auth/register`}>
                    <Button size="lg" className="w-full">
                      {t('cta.button')}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t py-12 mt-auto">
        <div className="container px-4 md:px-6 mx-auto max-w-7xl text-center text-sm text-muted-foreground">
          <p>© 2025 Fatturup. {t('footer.rights')}</p>
        </div>
      </footer>
    </div>
  )
}


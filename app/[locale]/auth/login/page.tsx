'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { GalleryVerticalEnd } from 'lucide-react'
import { LoginForm } from '@/components/login-form'

export default function LoginPage() {
  const params = useParams()
  const locale = params.locale as string
  const loginImage = process.env.NEXT_PUBLIC_LOGIN_IMAGE_URL ?? '/placeholder.svg'

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href={`/${locale}`} className="flex items-center gap-2 font-medium">
            <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
              <GalleryVerticalEnd className="size-4" />
            </div>
            Fatturup
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs sm:max-w-sm">
            <LoginForm locale={locale} />
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block">
        <Image
          src={loginImage}
          alt="Login illustration"
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 0vw"
          className="object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
    </div>
  )
}

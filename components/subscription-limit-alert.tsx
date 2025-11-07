"use client";

import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { UsageLimits } from '@/hooks/use-subscription';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface SubscriptionLimitAlertProps {
  limits: UsageLimits;
  onClose?: () => void;
}

export function SubscriptionLimitAlert({
  limits,
  onClose,
}: SubscriptionLimitAlertProps) {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('subscription.alert');

  if (limits.allowed) return null;

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{t('limitReached')}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>{limits.message}</p>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => router.push(`/${locale}/dashboard/subscription`)}
          >
            {t('upgradePlan')}
          </Button>
          {onClose && (
            <Button size="sm" variant="outline" onClick={onClose}>
              {t('close')}
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

interface SubscriptionWarningProps {
  currentCount: number;
  maxCount: number | null;
  resourceType: 'invoice' | 'quote' | 'client';
}

export function SubscriptionWarning({
  currentCount,
  maxCount,
  resourceType,
}: SubscriptionWarningProps) {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('subscription.alert');
  const tResources = useTranslations('subscription.resources');

  if (maxCount === null) return null;

  const percentage = (currentCount / maxCount) * 100;
  
  // Show warning at 80%
  if (percentage < 80) return null;

  const resourceLabel = tResources(resourceType);

  return (
    <Alert className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{t('warningTitle')}</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <p>
          {t('warningDescription', { current: currentCount, max: maxCount, resource: resourceLabel })}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push(`/${locale}/dashboard/subscription`)}
        >
          {t('viewPlans')}
        </Button>
      </AlertDescription>
    </Alert>
  );
}


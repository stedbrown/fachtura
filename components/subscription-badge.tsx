"use client";

import { useSubscription } from '@/hooks/use-subscription';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

export function SubscriptionBadge() {
  const { subscription, loading } = useSubscription();

  if (loading) {
    return <Loader2 className="h-4 w-4 animate-spin" />;
  }

  const planName = subscription?.plan?.name ?? 'Free';
  
  const variants = {
    Free: 'secondary' as const,
    Pro: 'default' as const,
    Business: 'default' as const,
  };

  const variant = variants[planName as keyof typeof variants] || 'secondary';

  return <Badge variant={variant}>{planName}</Badge>;
}


"use client";

import { useSubscription } from '@/hooks/use-subscription';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

export function SubscriptionBadge() {
  const { subscription, loading } = useSubscription();

  if (loading) {
    return <Loader2 className="h-4 w-4 animate-spin" />;
  }

  const planName = (subscription?.plan as any)?.name || 'Free';
  
  const variants = {
    Free: 'secondary' as const,
    Pro: 'default' as const,
    Business: 'default' as const,
  };

  return (
    <Badge variant={variants[planName as keyof typeof variants] || 'secondary'}>
      {planName}
    </Badge>
  );
}


"use client";

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export interface SubscriptionPlan {
  id: string;
  name: string;
  stripe_price_id: string | null;
  price: number;
  currency: string;
  interval: string;
  max_invoices: number | null;
  max_clients: number | null;
  max_quotes: number | null;
  max_products: number | null;
  max_orders: number | null;
  max_suppliers: number | null;
  max_expenses: number | null;
  features: string[];
  is_active: boolean;
}

export interface UsageTracking {
  expenses_count?: number;
  invoices_count?: number;
  quotes_count?: number;
  clients_count?: number;
  products_count?: number;
  orders_count?: number;
  suppliers_count?: number;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  plan_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  plan?: SubscriptionPlan;
  usage?: UsageTracking;
}

export interface UsageLimits {
  allowed: boolean;
  plan_name: string;
  resource_type: string;
  current_count: number;
  max_count: number | null;
  message?: string;
}

type SupabaseSubscription = Omit<UserSubscription, 'plan'> & {
  plan: SubscriptionPlan | null;
};

const normalizeSubscription = (
  subscription: SupabaseSubscription
): UserSubscription => ({
  ...subscription,
  plan: subscription.plan ?? undefined,
});

export function useSubscription() {
  const queryClient = useQueryClient();

  // Fetch subscription with caching
  const {
    data: subscription,
    isLoading: subscriptionLoading,
  } = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return null;
      }

      // Carica il piano corrente dell'utente
      const { data: subData } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          plan:subscription_plans(*)
        `)
        .eq('user_id', user.id)
        .single();

      if (subData) {
        return normalizeSubscription(subData as SupabaseSubscription);
      } else {
        // Se non c'è abbonamento, crea uno con piano Free
        const { data: freePlan } = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('name', 'Free')
          .single();

        if (freePlan) {
          const { data: newSub } = await supabase
            .from('user_subscriptions')
            .insert({
              user_id: user.id,
              plan_id: freePlan.id,
              status: 'active',
            })
            .select(`
              *,
              plan:subscription_plans(*)
            `)
            .single();

          if (newSub) {
            return normalizeSubscription(newSub as SupabaseSubscription);
          }
        }
      }

      return null;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Fetch plans with caching
  const {
    data: plans = [],
    isLoading: plansLoading,
  } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const supabase = createClient();
      const { data: plansData } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });

      return plansData || [];
    },
    staleTime: 30 * 60 * 1000, // 30 minutes (plans change rarely)
    gcTime: 60 * 60 * 1000, // 1 hour
  });

  const loading = subscriptionLoading || plansLoading;

  const checkLimits = async (resourceType: 'invoice' | 'quote' | 'client' | 'product' | 'order' | 'supplier' | 'expense'): Promise<UsageLimits> => {
    try {
      const response = await fetch('/api/subscription/check-limits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resourceType }),
      });

      if (!response.ok) {
        throw new Error('Failed to check limits');
      }

      const result = await response.json();
      
      // Invalidate subscription cache if limits changed
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      
      return result;
    } catch (error) {
      console.error('Error checking limits:', error);
      return {
        allowed: true,
        plan_name: 'Free',
        resource_type: resourceType,
        current_count: 0,
        max_count: null,
      };
    }
  };

  const createCheckoutSession = async (priceId: string, planId: string) => {
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId, planId }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { url } = await response.json();
      
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  };

  const openCustomerPortal = async () => {
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to open customer portal');
      }

      const { url } = await response.json();
      
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Error opening customer portal:', error);
      throw error;
    }
  };

  // Mutation to refresh subscription after changes
  const refreshSubscription = () => {
    queryClient.invalidateQueries({ queryKey: ['subscription'] });
  };

  return {
    subscription: subscription ?? null,
    plans,
    loading,
    checkLimits,
    createCheckoutSession,
    openCustomerPortal,
    refreshSubscription,
  };
}


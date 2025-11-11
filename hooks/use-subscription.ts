"use client";

import { useEffect, useState } from 'react';
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

export function useSubscription() {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubscription = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
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
        setSubscription(subData as any);
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
            setSubscription(newSub as any);
          }
        }
      }

      // Carica tutti i piani disponibili
      const { data: plansData } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (plansData) {
        setPlans(plansData);
      }

      setLoading(false);
    };

    fetchSubscription();
  }, []);

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

      return await response.json();
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

  return {
    subscription,
    plans,
    loading,
    checkLimits,
    createCheckoutSession,
    openCustomerPortal,
  };
}


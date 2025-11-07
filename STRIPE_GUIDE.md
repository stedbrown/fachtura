# 🎯 Sistema Abbonamenti Stripe - Guida Completa

## 📊 Panoramica

Sistema di abbonamenti completo integrato con Stripe per gestire i piani di fatturazione.

## 🚀 Quick Start

### 1. Configurazione Stripe (5 minuti)

**a) Ottieni le chiavi API:**
- Vai su: https://dashboard.stripe.com/apikeys
- Assicurati di essere in **Test Mode**
- Copia `pk_test_...` e `sk_test_...`

**b) Configura Vercel:**
```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx
NEXT_PUBLIC_APP_URL=https://fachtura.vercel.app
```

**c) Configura Webhook:**
- URL: `https://fachtura.vercel.app/api/stripe/webhook`
- Eventi: checkout.session.completed, customer.subscription.*, invoice.payment_*
- Copia il `whsec_...` e aggiungilo come `STRIPE_WEBHOOK_SECRET`

### 2. Test

```bash
# Carta di test Stripe
Numero: 4242 4242 4242 4242
Data: 12/34
CVC: 123
```

## 📋 Piani Disponibili

| Piano | Prezzo | Clienti | Fatture/mese | Preventivi/mese |
|-------|--------|---------|--------------|-----------------|
| Free | CHF 0 | 3 | 5 | 5 |
| Pro | CHF 29 | 50 | 100 | 100 |
| Business | CHF 79 | ∞ | ∞ | ∞ |

## 💻 Utilizzo nel Codice

### Verificare i Limiti

```tsx
import { useSubscription } from '@/hooks/use-subscription';

const { checkLimits } = useSubscription();

const limits = await checkLimits('invoice'); // 'invoice' | 'quote' | 'client'
if (!limits.allowed) {
  alert(limits.message);
  return;
}
```

### Mostrare il Piano Corrente

```tsx
const { subscription } = useSubscription();
const planName = subscription?.plan?.name || 'Free';
```

### Creare Checkout

```tsx
const { createCheckoutSession } = useSubscription();
await createCheckoutSession(priceId, planId);
```

## 🗄️ Struttura Database

**Tabelle:**
- `subscription_plans` - Piani disponibili
- `user_subscriptions` - Abbonamenti utenti
- `usage_tracking` - Conteggio uso mensile

**Funzioni:**
- `check_subscription_limits(user_id, resource_type)` - Verifica limiti
- `update_usage_tracking()` - Trigger automatico per contare risorse

## 📁 File Importanti

```
app/api/stripe/
  ├── checkout/route.ts    # Crea sessione checkout
  ├── webhook/route.ts     # Gestisce eventi Stripe
  └── portal/route.ts      # Portale gestione abbonamento

app/[locale]/dashboard/
  └── subscription/page.tsx # Pagina abbonamenti

hooks/
  └── use-subscription.ts   # Hook React principale

lib/stripe/
  ├── client.ts            # Client Stripe (browser)
  └── server.ts            # Server Stripe (API)

supabase/
  └── create_subscription_system.sql # Migrazione DB
```

## 🔧 Personalizzazione

### Modificare Prezzi/Limiti

```sql
UPDATE subscription_plans 
SET price = 39, max_invoices = 150 
WHERE name = 'Pro';
```

### Aggiungere Features

```sql
UPDATE subscription_plans 
SET features = features || '["Nuova Feature"]'::jsonb
WHERE name = 'Pro';
```

## 🧪 Testing

### Test Mode (Sviluppo)
- Usa `pk_test_` e `sk_test_`
- Carte di test funzionano
- Nessun addebito reale

### Live Mode (Produzione)
- Usa `pk_live_` e `sk_live_`
- Solo carte reali
- Addebiti reali

## 🆘 Troubleshooting

**Carta rifiutata in test:**
- Verifica di usare chiavi `pk_test_` / `sk_test_`
- Non `pk_live_` / `sk_live_`

**Webhook non funziona:**
- Verifica `STRIPE_WEBHOOK_SECRET` in Vercel
- Controlla logs in Stripe Dashboard → Webhooks

**Limiti non aggiornati:**
- Verifica trigger database attivi
- Controlla tabella `usage_tracking`

## 📚 Risorse

- [Stripe Docs](https://stripe.com/docs)
- [Stripe Testing](https://stripe.com/docs/testing)
- [Dashboard Stripe](https://dashboard.stripe.com)

---

**Sistema creato e configurato il**: 2025-01-06
**Status**: ✅ Production Ready


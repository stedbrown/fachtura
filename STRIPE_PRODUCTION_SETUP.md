# 🚀 Configurazione Stripe Connect per Produzione

## ✅ Checklist Completa

### 1. PULIZIA DATI DI TEST

#### Nel programma (Supabase):
1. Vai su [Supabase Dashboard](https://supabase.com/dashboard)
2. Seleziona il tuo progetto
3. Vai su **SQL Editor**
4. Esegui questo script per pulire i dati di test:

```sql
-- Elimina fatture di test
DELETE FROM public.invoices WHERE stripe_checkout_session_id IS NOT NULL;

-- Elimina account Stripe di test
DELETE FROM public.stripe_accounts;

-- Verifica che tutto sia pulito
SELECT COUNT(*) FROM public.invoices WHERE stripe_checkout_session_id IS NOT NULL;
SELECT COUNT(*) FROM public.stripe_accounts;
```

#### In Stripe Dashboard:
1. Vai su [Stripe Dashboard Test Mode](https://dashboard.stripe.com/test/developers)
2. Clicca **Developers** → **Overview**
3. Sotto **Test data**, clicca **Review test data**
4. Clicca **Delete test data** per eliminare tutti i dati di test

---

### 2. ATTIVAZIONE ACCOUNT STRIPE (IMPORTANTE!)

Prima di passare a Live Mode, devi completare l'attivazione:

1. **Verifica Identità**
   - Vai su: https://dashboard.stripe.com/account/onboarding
   - Completa tutti i passaggi richiesti
   - Fornisci documento d'identità se richiesto

2. **Informazioni Bancarie**
   - Aggiungi conto bancario per ricevere pagamenti
   - Verifica le informazioni bancarie

3. **Verifica Contatti**
   - Conferma email
   - Conferma numero di telefono

⚠️ **IMPORTANTE**: Senza completare questi passaggi, non potrai usare Live Mode!

---

### 3. CONFIGURAZIONE STRIPE CONNECT

#### A. Attiva Stripe Connect
1. Vai su: https://dashboard.stripe.com/connect/overview
2. Se non l'hai già fatto, completa l'onboarding di Connect
3. Seleziona **"Gli utenti riscuoteranno i pagamenti direttamente"**

#### B. Configura Platform Profile
1. Vai su: https://dashboard.stripe.com/settings/connect
2. Compila:
   - **Platform name**: FACTURA (o il nome della tua piattaforma)
   - **Platform description**: Descrivi cosa fa la tua piattaforma
   - **Platform website**: Il tuo dominio (es. https://tuodominio.com)
   - **Support email**: Email di supporto
   - **Support phone**: Numero di supporto (opzionale)

#### C. Branding
1. Vai su: https://dashboard.stripe.com/settings/connect/branding
2. Carica:
   - **Logo**: Logo della tua piattaforma (quadrato, min 128x128px)
   - **Icon**: Icona (quadrata, 128x128px)
   - **Brand color**: Colore principale (#hex)
   - **Accent color**: Colore secondario

#### D. Site Links (IMPORTANTE per produzione)
1. Vai su: https://dashboard.stripe.com/settings/connect/site-links
2. Configura gli URL della tua applicazione:
   - **Account management**: `https://tuodominio.com/it/dashboard/settings`
   - **Payments**: `https://tuodominio.com/it/dashboard/invoices`
   - **Notification banner**: `https://tuodominio.com/it/dashboard`

---

### 4. CHIAVI API LIVE MODE

1. Vai su: https://dashboard.stripe.com/apikeys
2. **IMPORTANTE**: Clicca su **"View live mode"** in alto a destra
3. Copia le chiavi LIVE:
   - **Publishable key**: `pk_live_...`
   - **Secret key**: `sk_live_...` (puoi vederla solo una volta!)

4. Aggiorna `.env.local` (o variabili ambiente su Vercel/altro):
```env
# Rimuovi o commenta le chiavi di test
#NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
#STRIPE_SECRET_KEY=sk_test_...

# Aggiungi le chiavi LIVE
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxx
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
```

⚠️ **IMPORTANTE**: 
- NON committare mai le chiavi live su Git!
- Usa variabili d'ambiente su Vercel/produzione
- La secret key live si può vedere solo UNA VOLTA

---

### 5. WEBHOOK PRODUZIONE

#### A. Crea Endpoint Webhook
1. Vai su: https://dashboard.stripe.com/webhooks
2. Assicurati di essere in **Live Mode** (interruttore in alto)
3. Clicca **"Add endpoint"**
4. Configura:
   - **Endpoint URL**: `https://tuodominio.com/api/stripe/webhook`
   - **Description**: "FACTURA - Webhook produzione"
   - **Events to listen**: Seleziona:
     - ✅ `checkout.session.completed`
     - ✅ `payment_intent.succeeded`
     - ✅ `payment_intent.payment_failed`
   
5. Clicca **"Add endpoint"**
6. Nella pagina del webhook, clicca **"Reveal signing secret"**
7. Copia il **Signing secret** (inizia con `whsec_...`)

#### B. Aggiorna Variabili Ambiente
Aggiungi in `.env.local` o su Vercel:
```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

#### C. Test Webhook (Locale con Stripe CLI)
Per testare localmente prima del deploy:
```bash
# Installa Stripe CLI se non l'hai già
# https://stripe.com/docs/stripe-cli

# Login
stripe login

# Inoltra eventi webhook localmente (LIVE MODE)
stripe listen --forward-to localhost:3000/api/stripe/webhook --live
```

---

### 6. DEPLOY SU VERCEL (o altro hosting)

1. **Deploy del codice**
   ```bash
   git add .
   git commit -m "Configure Stripe Live Mode"
   git push
   ```

2. **Configura Variabili Ambiente su Vercel**
   - Vai su: https://vercel.com/tuoaccount/tuoprogetto/settings/environment-variables
   - Aggiungi:
     ```
     NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
     STRIPE_SECRET_KEY=sk_live_...
     STRIPE_WEBHOOK_SECRET=whsec_...
     NEXT_PUBLIC_APP_URL=https://tuodominio.com
     ```
   - **IMPORTANTE**: Aggiungi queste variabili per "Production" environment

3. **Redeploy**
   - Vai su **Deployments**
   - Clicca sui tre puntini dell'ultimo deployment
   - Seleziona **"Redeploy"**

---

### 7. VERIFICA FINALE

#### A. Verifica Stripe Dashboard
1. Vai su: https://dashboard.stripe.com/connect/overview
2. Verifica che:
   - ✅ Connect Status = "Active"
   - ✅ Platform profile compilato
   - ✅ Branding configurato

2. Vai su: https://dashboard.stripe.com/webhooks
   - ✅ Endpoint attivo in Live Mode
   - ✅ Eventi configurati correttamente

3. Vai su: https://dashboard.stripe.com/apikeys
   - ✅ Stai visualizzando Live Mode
   - ✅ Chiavi live configurate

#### B. Test Completo in Produzione
1. **Crea nuovo utente** nella tua app
2. **Collega Stripe Connect**:
   - Vai in Impostazioni → Pagamenti
   - Clicca "Collega Stripe"
   - Completa l'onboarding (userà dati reali!)
3. **Crea una fattura di test** (con importo minimo, es. 1 CHF)
4. **Genera link di pagamento**
5. **Paga con carta di test** (anche in live mode puoi usare carte di test per verifiche):
   - Numero: `4242 4242 4242 4242`
   - Scadenza: qualsiasi data futura
   - CVC: qualsiasi 3 cifre
6. **Verifica**:
   - La fattura si aggiorna automaticamente a "pagata"
   - Ricevi notifica in-app
   - Vedi il pagamento in Stripe Dashboard

---

## 🔒 SICUREZZA

### Best Practices:
1. ✅ Mai committare chiavi live su Git
2. ✅ Usa sempre variabili d'ambiente per le chiavi
3. ✅ Limita l'accesso alle chiavi live solo a chi necessario
4. ✅ Monitora webhook failures in Stripe Dashboard
5. ✅ Abilita 2FA su Stripe Dashboard
6. ✅ Tieni un backup delle chiavi in un password manager sicuro

### In `.gitignore`:
```gitignore
.env.local
.env.production.local
.env*.local
```

---

## 📊 MONITORING

### Dopo il Go Live:

1. **Stripe Dashboard**
   - Monitora: https://dashboard.stripe.com/dashboard
   - Controlla pagamenti giornalmente
   - Verifica webhook deliveries

2. **Logs**
   - Controlla i log dell'applicazione
   - Monitora errori webhook
   - Verifica aggiornamenti fatture

3. **Email Alerts**
   - Configura notifiche email su Stripe
   - Abilita alert per pagamenti falliti
   - Abilita alert per dispute

---

## ❓ TROUBLESHOOTING

### Problema: "Stripe Connect non abilitato"
**Soluzione**: Completa l'attivazione account Stripe e verifica identità

### Problema: "Webhook non funzionano"
**Soluzione**: 
- Verifica URL webhook corretto
- Controlla che STRIPE_WEBHOOK_SECRET sia configurato
- Verifica webhook delivery in Stripe Dashboard

### Problema: "Fatture non si aggiornano"
**Soluzione**:
- Controlla log webhook in Stripe Dashboard
- Verifica che gli eventi siano configurati
- Controlla log applicazione per errori

---

## 📞 SUPPORTO

- **Stripe Docs**: https://docs.stripe.com/connect
- **Stripe Support**: https://support.stripe.com
- **Status Page**: https://status.stripe.com

---

## 🎉 CHECKLIST FINALE

Prima del lancio, verifica:

- [ ] Account Stripe verificato e attivo
- [ ] Connect configurato e attivo
- [ ] Branding configurato
- [ ] Chiavi API LIVE configurate in produzione
- [ ] Webhook LIVE configurato e funzionante
- [ ] Dati di test eliminati
- [ ] Test completo eseguito con successo
- [ ] Monitoring configurato
- [ ] Backup chiavi in password manager
- [ ] 2FA abilitato su Stripe
- [ ] Documentazione per il team

---

**Data configurazione**: ___________
**Configurato da**: ___________
**Ultimo test**: ___________


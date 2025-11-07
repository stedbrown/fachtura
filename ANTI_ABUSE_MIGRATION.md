# 🔒 Sistema Anti-Abuso Account

## ⚠️ Problema Identificato

**VULNERABILITÀ CRITICA**: Un utente poteva aggirare i limiti del piano FREE eliminando e ricreando il proprio account con la stessa email, ottenendo limiti "freschi" ogni volta.

### Scenario di Abuso:
1. Utente FREE raggiunge i limiti (3 clienti, 5 fatture/mese)
2. Elimina l'account → `ON DELETE CASCADE` cancella tutto
3. Si registra di nuovo con la stessa email
4. Sistema crea automaticamente nuovo abbonamento FREE
5. **Limiti azzerati!** ✅ (per l'abuser)

---

## ✅ Soluzione Implementata

### 1. **Tabella `deleted_accounts`**
Traccia tutti gli account eliminati con:
- Email utente
- Data eliminazione
- Piano abbonamento (Free/Pro/Business)
- Snapshot dei dati (clienti, fatture, preventivi totali)

### 2. **Periodo di Blocco: 90 giorni**
Un'email non può essere riutilizzata per **90 giorni** dopo l'eliminazione dell'account.

### 3. **Verifica alla Registrazione**
Prima di permettere la registrazione, il sistema controlla se l'email è stata usata da un account eliminato di recente.

### 4. **Archiviazione Automatica**
Prima dell'eliminazione, viene salvato uno snapshot con:
- Email e user_id
- Piano abbonamento
- Numero di clienti, fatture, preventivi creati
- Data eliminazione

---

## 📋 Istruzioni per Applicare le Modifiche

### STEP 1: Applicare le SQL Migration

Vai su **Supabase Dashboard** → **SQL Editor** e esegui **IN ORDINE**:

#### 1️⃣ Sistema Anti-Abuso
```sql
-- File: supabase/anti_abuse_system.sql
```
Copia e incolla tutto il contenuto del file `supabase/anti_abuse_system.sql` e esegui.

Questo crea:
- ✅ Tabella `deleted_accounts`
- ✅ Funzione `check_email_abuse_protection()`
- ✅ Funzione `archive_deleted_account()`
- ✅ Trigger `archive_account_on_delete`
- ✅ RLS Policies
- ✅ Funzione di cleanup per GDPR

#### 2️⃣ Funzione Delete User
```sql
-- File: supabase/delete_user_function.sql
```
Copia e incolla tutto il contenuto del file `supabase/delete_user_function.sql` e esegui.

Questo crea:
- ✅ Funzione `delete_user()` che permette a un utente di eliminare il proprio account

### STEP 2: Verificare l'Installazione

Esegui questo query per verificare:

```sql
-- Verifica tabella deleted_accounts
SELECT * FROM deleted_accounts;

-- Testa funzione anti-abuso
SELECT check_email_abuse_protection('test@example.com');

-- Verifica trigger
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgname = 'archive_account_on_delete';
```

---

## 🔧 Come Funziona

### Flusso di Registrazione (NUOVO)

```
Utente inserisce email
      ↓
API: /api/auth/check-email
      ↓
check_email_abuse_protection(email)
      ↓
┌─────────────────┐
│ Email usata     │
│ < 90 giorni fa? │
└─────────────────┘
   ↓ SÌ              ↓ NO
BLOCCA            PERMETTI
+ messaggio       registrazione
con giorni        normale
rimanenti
```

### Flusso di Eliminazione Account (NUOVO)

```
Utente click "Elimina Account"
      ↓
Conferma dialog
      ↓
API: /api/auth/delete-account
      ↓
Trigger: archive_account_on_delete
      ↓
Salva snapshot in deleted_accounts:
- email
- piano abbonamento
- conteggi risorse
- data eliminazione
      ↓
DELETE FROM auth.users
(CASCADE elimina tutto)
      ↓
Logout + Redirect alla home
```

---

## 📊 Dati Tracciati

Per ogni account eliminato salviamo:

| Campo | Descrizione |
|-------|-------------|
| `user_email` | Email dell'account |
| `user_id` | UUID dell'utente |
| `deleted_at` | Data/ora eliminazione |
| `plan_name` | Nome piano (Free/Pro/Business) |
| `was_paid_user` | Era un cliente pagante? |
| `total_clients` | Numero clienti creati |
| `total_invoices` | Numero fatture create |
| `total_quotes` | Numero preventivi creati |

---

## 🛡️ Protezioni Implementate

### 1. **Blocco Temporale**
- ✅ Email bloccata per **90 giorni**
- ✅ Messaggio chiaro con giorni rimanenti
- ✅ Dopo 90 giorni, email riutilizzabile

### 2. **Archiviazione Sicura**
- ✅ Snapshot salvato PRIMA dell'eliminazione
- ✅ Dati conservati per 2 anni (poi cleanup GDPR)
- ✅ Tracciabilità completa

### 3. **RLS Security**
- ✅ Solo `service_role` può vedere `deleted_accounts`
- ✅ Utenti normali non possono vedere storico
- ✅ Funzioni con `SECURITY DEFINER`

### 4. **Compliance GDPR**
- ✅ Funzione `cleanup_old_deleted_accounts()` per rimuovere dati dopo 2 anni
- ✅ Dati minimi necessari per protezione
- ✅ Trasparenza: utente sa che email sarà bloccata

---

## 🧪 Come Testare

### Test 1: Registrazione Normale
```typescript
// Dovrebbe funzionare
POST /api/auth/check-email
{ email: "nuovo@example.com" }

Response: { allowed: true, message: "Email disponibile" }
```

### Test 2: Email di Account Eliminato Recentemente
```typescript
// Dovrebbe essere bloccata
POST /api/auth/check-email
{ email: "eliminato-ieri@example.com" }

Response: { 
  allowed: false, 
  message: "Email utilizzata da account eliminato il 05/11/2024. Non riutilizzabile prima di 90 giorni. Giorni rimanenti: 89",
  days_remaining: 89
}
```

### Test 3: Eliminazione Account
1. Login come utente test
2. Vai su **Dashboard** → **Profilo**
3. Scroll a "Zona Pericolosa"
4. Click "Elimina Account" → Conferma
5. Verifica che:
   - ✅ Snapshot salvato in `deleted_accounts`
   - ✅ Account eliminato
   - ✅ Logout automatico
   - ✅ Redirect alla home

6. Prova a registrarti di nuovo con stessa email
7. Verifica che:
   - ❌ Registrazione bloccata
   - ✅ Messaggio chiaro con giorni rimanenti

---

## 📁 File Modificati

### SQL Migrations (da applicare manualmente)
- ✅ `supabase/anti_abuse_system.sql` - Sistema completo anti-abuso
- ✅ `supabase/delete_user_function.sql` - Funzione per eliminare account

### Backend (API Routes)
- ✅ `app/api/auth/check-email/route.ts` - Verifica email alla registrazione
- ✅ `app/api/auth/delete-account/route.ts` - Elimina account utente

### Frontend
- ✅ `app/[locale]/auth/register/page.tsx` - Aggiunto controllo anti-abuso
- ✅ `app/[locale]/dashboard/profile/page.tsx` - Implementata eliminazione account

---

## ⚙️ Configurazione

### Periodo di Blocco
Il periodo di blocco è configurabile in `anti_abuse_system.sql`:

```sql
v_blocking_period_days INTEGER := 90; -- Cambia qui per modificare
```

Valori consigliati:
- **30 giorni**: Protezione base
- **90 giorni**: Protezione forte (default) ✅
- **180 giorni**: Protezione molto forte
- **365 giorni**: Protezione massima

### Cleanup GDPR
Per rimuovere dati vecchi (dopo 2 anni), esegui periodicamente:

```sql
SELECT cleanup_old_deleted_accounts();
```

Considera di creare un **Cron Job** su Supabase per eseguire questa funzione automaticamente.

---

## 🎯 Benefici

1. ✅ **Previene Abusi**: Impossibile aggirare limiti piano FREE
2. ✅ **Tracciabilità**: Storico completo eliminazioni
3. ✅ **Flessibile**: Periodo blocco configurabile
4. ✅ **GDPR Compliant**: Cleanup automatico dopo 2 anni
5. ✅ **User-Friendly**: Messaggi chiari con giorni rimanenti
6. ✅ **Sicuro**: RLS policies e SECURITY DEFINER

---

## 📞 Supporto

Se un utente legittimo ha bisogno di riutilizzare un'email prima dei 90 giorni:

1. Verifica manualmente nel database `deleted_accounts`
2. Se legittimo, elimina il record:
```sql
DELETE FROM deleted_accounts 
WHERE user_email = 'email@example.com';
```
3. L'utente potrà registrarsi di nuovo

---

## 🔄 Rollback (se necessario)

Per rimuovere il sistema anti-abuso:

```sql
-- Rimuovi trigger
DROP TRIGGER IF EXISTS archive_account_on_delete ON auth.users;

-- Rimuovi funzioni
DROP FUNCTION IF EXISTS check_email_abuse_protection;
DROP FUNCTION IF EXISTS archive_deleted_account;
DROP FUNCTION IF EXISTS cleanup_old_deleted_accounts;
DROP FUNCTION IF EXISTS delete_user;

-- Rimuovi tabella
DROP TABLE IF EXISTS deleted_accounts;
```

⚠️ **Attenzione**: Questo rimuoverà tutte le protezioni anti-abuso!

---

**Creato il**: 2024-11-07
**Versione**: 1.0
**Stato**: ✅ Pronto per produzione


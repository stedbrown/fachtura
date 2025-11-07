# 🔧 Fix Limiti Abbonamenti

## 🚨 Problemi Trovati e Risolti

### Problema 1: Conteggio Clienti in `enforce_subscription_limits`
**File**: `supabase/enforce_subscription_limits_trigger.sql`

**❌ Prima (ERRATO)**:
```sql
-- Contava i clienti creati nel mese corrente
IF v_resource_type = 'client' THEN
  SELECT COUNT(*)
  INTO v_current_count
  FROM clients
  WHERE user_id = v_user_id
    AND deleted_at IS NULL
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW()); -- ❌ Mensile!
```

**✅ Dopo (CORRETTO)**:
```sql
-- Conta TUTTI i clienti (totale, non mensile)
IF v_resource_type = 'client' THEN
  SELECT COUNT(*)
  INTO v_current_count
  FROM clients
  WHERE user_id = v_user_id
    AND deleted_at IS NULL; -- ✅ Totale!
```

---

### Problema 2: Conteggio Clienti in `check_subscription_limits`
**File**: `supabase/create_subscription_system.sql`

**❌ Prima (ERRATO)**:
```sql
-- Usava usage_tracking che conta per periodo mensile
ELSIF p_resource_type = 'client' THEN
  IF v_plan.max_clients IS NOT NULL AND COALESCE(v_usage.clients_count, 0) >= v_plan.max_clients THEN
    -- ❌ v_usage.clients_count è mensile!
```

**✅ Dopo (CORRETTO)**:
```sql
-- Conta direttamente dalla tabella clients (totale)
ELSIF p_resource_type = 'client' THEN
  DECLARE
    v_total_clients INTEGER;
  BEGIN
    SELECT COUNT(*)
    INTO v_total_clients
    FROM clients
    WHERE user_id = p_user_id
      AND deleted_at IS NULL; -- ✅ Totale!
```

---

## 📊 Limiti Corretti per Piano

| Piano | Clienti | Fatture | Preventivi |
|-------|---------|---------|------------|
| **Free** | **3 totali** | 5/mese | 5/mese |
| **Pro** | **50 totali** | 100/mese | 100/mese |
| **Business** | **Illimitati** | Illimitati | Illimitati |

### Periodicità dei Limiti:
- ✅ **Clienti**: Conteggio **TOTALE** (non si resetta ogni mese)
- ✅ **Fatture**: Conteggio **MENSILE** (si resetta ogni mese)
- ✅ **Preventivi**: Conteggio **MENSILE** (si resetta ogni mese)

---

## 🔍 Funzioni SQL Modificate

### 1. `enforce_subscription_limits()`
**Scopo**: Trigger BEFORE INSERT che blocca inserimenti oltre i limiti  
**Fix**: Rimuove il filtro mensile per i clienti (riga 60-68)

### 2. `check_subscription_limits(p_user_id, p_resource_type)`
**Scopo**: Funzione chiamata dal frontend via API per verificare limiti  
**Fix**: Per i clienti, conta direttamente da `clients` invece di `usage_tracking` (riga 187-211)

---

## ✅ Cosa Funziona Correttamente

### Backend (Database Triggers)
- ✅ `enforce_clients_limit`: Blocca inserimento 4° cliente per FREE
- ✅ `enforce_invoices_limit`: Blocca 6a fattura del mese per FREE
- ✅ `enforce_quotes_limit`: Blocca 6° preventivo del mese per FREE

### Frontend (API + useSubscription)
- ✅ `checkLimits('client')`: Verifica conteggio totale clienti
- ✅ `checkLimits('invoice')`: Verifica conteggio mensile fatture
- ✅ `checkLimits('quote')`: Verifica conteggio mensile preventivi

### UI
- ✅ Dialog upgrade mostrato quando si raggiunge il limite
- ✅ Toast di errore con messaggio corretto
- ✅ Toast di warning quando si raggiunge 80% del limite
- ✅ Blocco preventivo nelle pagine lista (invoices/quotes)

---

## 📝 Note Tecniche

### Perché `usage_tracking` non va bene per i clienti?
La tabella `usage_tracking` ha una chiave `(user_id, period_start)` che crea un nuovo record ogni mese.
Questo è perfetto per fatture e preventivi (conteggio mensile), ma NON per i clienti (conteggio totale).

**Soluzione**: Per i clienti, contare sempre direttamente dalla tabella `clients` con `deleted_at IS NULL`.

### La tabella `usage_tracking` è ancora necessaria?
Sì! È fondamentale per:
- ✅ Fatture: conteggio mensile con reset automatico
- ✅ Preventivi: conteggio mensile con reset automatico
- ✅ Analytics e statistiche future
- ⚠️ Clienti: non più usata per il conteggio, ma rimane per compatibilità

---

## 🚀 Come Applicare le Modifiche

### 1. Aggiorna il trigger:
```sql
-- File: supabase/enforce_subscription_limits_trigger.sql
-- Esegui il file completo in Supabase SQL Editor
```

### 2. Aggiorna la funzione check_subscription_limits:
```sql
-- File: supabase/create_subscription_system.sql
-- Trova ed esegui solo la funzione CREATE OR REPLACE FUNCTION check_subscription_limits
-- (righe 120-216)
```

---

## ✅ Verifica Post-Aggiornamento

### Test da fare:
1. **Utente FREE + 3 clienti esistenti**:
   - ❌ Non deve poter creare 4° cliente
   - ✅ Deve vedere dialog upgrade
   
2. **Utente FREE + 5 fatture questo mese**:
   - ❌ Non deve poter creare 6a fattura
   - ✅ Deve vedere dialog upgrade
   
3. **Utente FREE + 5 preventivi questo mese**:
   - ❌ Non deve poter creare 6° preventivo
   - ✅ Deve vedere dialog upgrade

---

**Data Fix**: 2025-11-07  
**Commit**: In preparazione


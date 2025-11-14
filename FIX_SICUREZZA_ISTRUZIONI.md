# 🔒 Fix Sicurezza - Istruzioni

**Data**: 2025-01-14  
**Priorità**: 🔴 **CRITICA**

---

## ✅ Fix 1: Funzioni SQL - Search Path Security

### Problema
3 funzioni SQL hanno `search_path` mutabile, creando una vulnerabilità di sicurezza (SQL injection via schema manipulation).

### Soluzione
Applicare la migration SQL che fixa il `search_path` per:
- ✅ `track_resource_usage`
- ✅ `enforce_subscription_limits`
- ✅ `check_subscription_limits` (verifica che sia già fixato)

### Istruzioni

1. **Apri Supabase Dashboard**
   - Vai su [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Seleziona il progetto **FACTURA**

2. **Apri SQL Editor**
   - Nel menu laterale, clicca su **SQL Editor**
   - Clicca su **New Query**

3. **Copia e Incolla la Migration**
   - Apri il file: `supabase/migrations/20250114_fix_remaining_function_search_path.sql`
   - Copia tutto il contenuto
   - Incolla nel SQL Editor

4. **Esegui la Migration**
   - Clicca su **Run** (o premi `Ctrl+Enter`)
   - Attendi conferma di successo

5. **Verifica il Fix** (Opzionale)
   - Esegui questa query per verificare che tutte le funzioni abbiano il `search_path` fixato:
   ```sql
   SELECT 
     routine_name,
     routine_type,
     security_type,
     CASE 
       WHEN routine_definition LIKE '%SET search_path%' THEN '✅ FIXED'
       ELSE '❌ NEEDS FIX'
     END as search_path_status
   FROM information_schema.routines
   WHERE routine_schema = 'public'
   AND routine_name IN (
     'track_resource_usage',
     'check_subscription_limits',
     'enforce_subscription_limits'
   );
   ```
   - Tutte le funzioni dovrebbero mostrare `✅ FIXED`

### Risultato Atteso
- ✅ 0 security warnings per `function_search_path_mutable`
- ✅ Funzioni protette da SQL injection via schema manipulation

---

## ✅ Fix 2: Leaked Password Protection

### Problema
Supabase Auth non verifica se le password sono state compromesse (HaveIBeenPwned database).

### Soluzione
Abilitare la protezione password compromesse nel dashboard Supabase.

### Istruzioni

1. **Apri Supabase Dashboard**
   - Vai su [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Seleziona il progetto **FACTURA**

2. **Vai in Authentication Settings**
   - Nel menu laterale, clicca su **Authentication**
   - Clicca su **Policies** o **Settings**

3. **Abilita Leaked Password Protection**
   - Cerca la sezione **Password** o **Password Security**
   - Trova l'opzione **"Leaked Password Protection"** o **"HaveIBeenPwned"**
   - **Abilita** l'opzione
   - Salva le modifiche

### Risultato Atteso
- ✅ Password compromesse bloccate automaticamente alla registrazione
- ✅ 0 security warnings per `auth_leaked_password_protection`

---

## 📊 Verifica Finale

Dopo aver applicato entrambi i fix, verifica con Supabase Advisors:

1. **Apri Supabase Dashboard**
   - Vai su **Settings** → **Database** → **Advisors**

2. **Controlla Security Advisors**
   - Dovrebbero essere **0 warnings** per:
     - `function_search_path_mutable` (3 funzioni)
     - `auth_leaked_password_protection`

---

## ⚠️ Note Importanti

- **Backup**: Le migration SQL sono sicure e non modificano dati esistenti
- **Downtime**: Nessun downtime previsto
- **Rollback**: Se necessario, le funzioni possono essere ripristinate dalle migration precedenti
- **Testing**: Dopo il fix, testa che:
  - La creazione di fatture/preventivi funzioni ancora
  - I limiti di abbonamento vengano rispettati
  - Il tracking delle risorse funzioni correttamente

---

## 🎯 Prossimi Passi

Dopo aver completato questi fix di sicurezza, procedere con:
1. ✅ Performance improvements (caching, paginazione)
2. ✅ Funzionalità aggiuntive (export batch, full-text search)

---

**Tempo Stimato**: 15-20 minuti totali  
**Impatto**: 🔴 **CRITICO** - Previene vulnerabilità di sicurezza


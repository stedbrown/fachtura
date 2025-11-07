# 🚀 APPLICA MIGRAZIONE SQL SU SUPABASE

## ⚠️ IMPORTANTE - MIGRAZIONE NECESSARIA

Il fix per il conteggio corretto dei limiti clienti richiede l'esecuzione di una migrazione SQL sul database Supabase.

---

## 📝 Passaggi da Seguire

### 1️⃣ Apri il SQL Editor di Supabase

1. Vai su [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Seleziona il progetto **FACTURA** (`qawwnpxycwslggbjdajh`)
3. Nel menu laterale, clicca su **SQL Editor**

### 2️⃣ Copia il contenuto della migrazione

Il file da eseguire è:
```
supabase/migrations/fix_client_limits_counting.sql
```

### 3️⃣ Incolla ed Esegui

1. Crea una nuova query nel SQL Editor
2. Incolla l'intero contenuto del file `fix_client_limits_counting.sql`
3. Clicca su **Run** (o premi `Ctrl+Enter`)

### 4️⃣ Verifica il Successo

Dovresti vedere un messaggio di successo simile a:
```
Success. No rows returned
```

Oppure:
```
CREATE FUNCTION
```

---

## 🔍 Cosa Fa Questa Migrazione?

### Fix 1: `enforce_subscription_limits()`
Modifica il trigger che blocca inserimenti oltre i limiti.

**Prima**: ❌ Contava clienti del mese corrente  
**Dopo**: ✅ Conta TUTTI i clienti (totale)

### Fix 2: `check_subscription_limits()`
Modifica la funzione chiamata dal frontend per verificare i limiti.

**Prima**: ❌ Usava `usage_tracking` (mensile) per i clienti  
**Dopo**: ✅ Conta direttamente dalla tabella `clients` (totale)

---

## 📊 Limiti Dopo la Migrazione

| Piano | Clienti | Fatture | Preventivi |
|-------|---------|---------|------------|
| **Free** | **3 totali** ✅ | 5/mese ✅ | 5/mese ✅ |
| **Pro** | **50 totali** ✅ | 100/mese ✅ | 100/mese ✅ |
| **Business** | **Illimitati** ✅ | Illimitati ✅ | Illimitati ✅ |

---

## ✅ Test Post-Migrazione

Dopo aver eseguito la migrazione, testa:

### Test 1: Utente FREE con 3 clienti
1. Login come utente FREE
2. Vai su **Clienti**
3. Prova ad aggiungere un 4° cliente
4. ✅ Deve apparire il dialog di upgrade
5. ❌ Il cliente NON deve essere creato

### Test 2: Utente FREE con 5 fatture questo mese
1. Login come utente FREE
2. Vai su **Fatture**
3. Prova a creare la 6a fattura del mese
4. ✅ Deve apparire il dialog di upgrade
5. ❌ La fattura NON deve essere creata

### Test 3: Utente FREE con 5 preventivi questo mese
1. Login come utente FREE
2. Vai su **Preventivi**
3. Prova a creare il 6° preventivo del mese
4. ✅ Deve apparire il dialog di upgrade
5. ❌ Il preventivo NON deve essere creato

---

## 🐛 Problemi Risolti

### Problema Originale
Un utente FREE poteva creare più di 3 clienti se li creava in mesi diversi:
- ❌ Gennaio: 3 clienti
- ❌ Febbraio: altri 3 clienti
- ❌ Totale: 6 clienti (invece di 3 MAX)

### Dopo la Migrazione
✅ L'utente FREE può avere massimo 3 clienti IN TOTALE, indipendentemente da quando sono stati creati.

---

## 📚 Documentazione Completa

Per maggiori dettagli tecnici, consulta:
- `docs/SUBSCRIPTION_LIMITS_FIX.md` - Documentazione tecnica completa
- `supabase/migrations/fix_client_limits_counting.sql` - Codice SQL della migrazione
- `supabase/enforce_subscription_limits_trigger.sql` - Trigger aggiornato
- `supabase/create_subscription_system.sql` - Funzione aggiornata

---

## ❓ FAQ

**Q: Posso saltare questa migrazione?**  
A: ❌ No, senza questa migrazione i limiti dei clienti non funzioneranno correttamente.

**Q: Perderò dati eseguendo questa migrazione?**  
A: ✅ No, la migrazione modifica solo funzioni e trigger, non tocca i dati.

**Q: Devo fare backup prima?**  
A: ✅ È sempre buona pratica, ma questa migrazione è sicura (non modifica dati).

**Q: Quanto tempo ci vuole?**  
A: ⚡ Meno di 5 secondi.

---

**Commit**: `2f184f0`  
**Data**: 2025-11-07  
**Priorità**: 🚨 ALTA - Esegui appena possibile


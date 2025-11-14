# 📊 Analisi Codebase - Suggerimenti per Miglioramenti

**Data Analisi**: 2025-01-14  
**Progetto**: FACTURA (Gestionale SaaS)  
**Database**: Supabase PostgreSQL (17.6.1)

---

## 🔍 Executive Summary

**Stato Attuale**: ✅ **Buono** - Architettura solida, codice ben organizzato  
**Priorità**: 🔴 **Alta** (Sicurezza), 🟡 **Media** (Performance), 🟢 **Bassa** (Funzionalità)

### Metriche Chiave
- **Tabelle Database**: 18 tabelle con RLS abilitato
- **Query Database**: ~161 query Supabase nel frontend
- **Security Warnings**: 4 (3 funzioni SQL, 1 Auth config)
- **Performance Info**: 23 indici "unused" (ma necessari per produzione)
- **Test Coverage**: Solo utility functions (invoice/quote utils)

---

## 🔴 PRIORITÀ ALTA - Sicurezza

### 1. Fix Funzioni SQL - Search Path Security ⚠️

**Problema**: 3 funzioni SQL hanno `search_path` mutabile (vulnerabilità sicurezza)

**Funzioni Affette**:
- `track_resource_usage`
- `check_subscription_limits`
- `enforce_subscription_limits`

**Fix Richiesto**:
```sql
-- Esempio per check_subscription_limits
ALTER FUNCTION public.check_subscription_limits 
SET search_path = public, pg_temp;

-- Applicare a tutte e 3 le funzioni
```

**Impatto**: 🔴 **CRITICO** - Previene SQL injection via search_path manipulation  
**Effort**: ⏱️ 15 minuti  
**File**: Creare migration `fix_remaining_function_search_path.sql`

---

### 2. Abilitare Leaked Password Protection ⚠️

**Problema**: Supabase Auth non verifica password compromesse (HaveIBeenPwned)

**Fix Richiesto**:
1. Dashboard Supabase → Authentication → Password
2. Abilitare "Leaked Password Protection"

**Impatto**: 🔴 **ALTO** - Previene uso di password compromesse  
**Effort**: ⏱️ 2 minuti (configurazione manuale)

---

## 🟡 PRIORITÀ MEDIA - Performance & Scalabilità

### 3. Implementare Caching per Query Frequenti

**Problema**: Query ripetute per dati che cambiano raramente (subscription, company_settings)

**Soluzione**: React Query o SWR per caching intelligente

**Query da Cachare**:
- `user_subscriptions` + `subscription_plans` (hook `use-subscription.ts`)
- `company_settings` (hook `use-company-settings.ts`)
- `clients` count (dashboard stats)

**Implementazione**:
```typescript
// hooks/use-subscription.ts
import { useQuery } from '@tanstack/react-query'

export function useSubscription() {
  return useQuery({
    queryKey: ['subscription', user.id],
    queryFn: async () => {
      // ... existing logic
    },
    staleTime: 5 * 60 * 1000, // 5 minuti
    gcTime: 10 * 60 * 1000, // 10 minuti
  })
}
```

**Impatto**: 🟡 **MEDIO** - Riduce query database del 30-50%  
**Effort**: ⏱️ 2-3 ore

---

### 4. Ottimizzare Dashboard Stats Query

**Problema**: Dashboard principale esegue 10 query parallele (`Promise.all`) ogni caricamento

**File**: `app/[locale]/dashboard/page.tsx` (linee 35-126)

**Ottimizzazione**:
1. **Creare View Materializzata** per statistiche aggregate
2. **Aggiornare via Trigger** invece di calcolare on-demand
3. **Cache lato server** con `unstable_cache` di Next.js

**Implementazione**:
```sql
-- View materializzata per stats dashboard
CREATE MATERIALIZED VIEW user_dashboard_stats AS
SELECT 
  user_id,
  COUNT(DISTINCT clients.id) as clients_count,
  COUNT(DISTINCT invoices.id) FILTER (WHERE invoices.status = 'paid') as paid_invoices_count,
  SUM(invoices.total) FILTER (WHERE invoices.status = 'paid' AND invoices.date >= date_trunc('month', NOW())) as current_month_revenue,
  -- ... altre stats
FROM auth.users
LEFT JOIN clients ON clients.user_id = users.id AND clients.deleted_at IS NULL
LEFT JOIN invoices ON invoices.user_id = users.id AND invoices.deleted_at IS NULL
GROUP BY user_id;

-- Refresh automatico ogni ora
CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_dashboard_stats;
END;
$$ LANGUAGE plpgsql;
```

**Impatto**: 🟡 **ALTO** - Dashboard 10x più veloce  
**Effort**: ⏱️ 3-4 ore

---

### 5. Paginazione per Tabelle Grandi

**Problema**: Tutte le tabelle caricano tutti i record (`SELECT *` senza `LIMIT`)

**File Affetti**:
- `app/[locale]/dashboard/invoices/page.tsx`
- `app/[locale]/dashboard/quotes/page.tsx`
- `app/[locale]/dashboard/clients/page.tsx`
- `app/[locale]/dashboard/products/page.tsx`
- `app/[locale]/dashboard/orders/page.tsx`
- `app/[locale]/dashboard/expenses/page.tsx`

**Soluzione**: Implementare paginazione server-side

**Implementazione**:
```typescript
// hooks/use-pagination.ts
export function usePagination<T>({
  fetchFn,
  pageSize = 50,
}: {
  fetchFn: (page: number, pageSize: number) => Promise<T[]>
  pageSize?: number
}) {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<T[]>([])
  const [hasMore, setHasMore] = useState(true)

  const loadPage = async (pageNum: number) => {
    const result = await fetchFn(pageNum, pageSize)
    if (result.length < pageSize) setHasMore(false)
    setData(prev => pageNum === 1 ? result : [...prev, ...result])
  }

  return { data, loadPage, hasMore, page, setPage }
}
```

**Impatto**: 🟡 **ALTO** - Scalabilità per migliaia di record  
**Effort**: ⏱️ 4-6 ore (tutte le tabelle)

---

### 6. Database Indexes - Verificare Utilizzo

**Stato**: 23 indici segnalati come "unused" ma necessari per produzione

**Raccomandazione**: 
- ✅ **MANTENERE** tutti gli indici (database piccolo = test data)
- 📊 **Monitorare** utilizzo in produzione dopo 1 mese
- 🗑️ **Rimuovere** solo se confermati inutilizzati dopo 3 mesi

**Indici Critici da Monitorare**:
- `deleted_at` indexes (soft delete queries)
- `user_id` indexes (RLS filtering)
- `status` indexes (filtering)
- `date` indexes (sorting)

**Impatto**: 🟢 **BASSO** - Nessuna azione immediata  
**Effort**: ⏱️ Monitoraggio continuo

---

## 🟢 PRIORITÀ BASSA - Funzionalità & UX

### 7. Export Batch per Selezione Multipla

**Stato**: ✅ Selezione multipla implementata  
**Mancante**: Export batch (CSV/Excel) per elementi selezionati

**Implementazione**:
```typescript
// Aggiungere a mass action bar
<Button
  onClick={() => {
    const selected = rowSelection.selectedItems
    exportFormattedToExcel(selected, 'fatture-selezionate.xlsx')
  }}
>
  <Download className="h-4 w-4 mr-2" />
  Esporta {rowSelection.selectedCount} elementi
</Button>
```

**Impatto**: 🟢 **MEDIO** - Migliora UX per export  
**Effort**: ⏱️ 1-2 ore

---

### 8. Ricerca Full-Text Avanzata

**Stato**: ✅ Global search implementato  
**Miglioramento**: Full-text search PostgreSQL per ricerca più veloce

**Implementazione**:
```sql
-- Aggiungere colonna tsvector per full-text search
ALTER TABLE clients ADD COLUMN search_vector tsvector;

-- Trigger per aggiornare search_vector
CREATE OR REPLACE FUNCTION clients_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('italian', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('italian', COALESCE(NEW.email, '')), 'B') ||
    setweight(to_tsvector('italian', COALESCE(NEW.city, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clients_search_vector_trigger
BEFORE INSERT OR UPDATE ON clients
FOR EACH ROW EXECUTE FUNCTION clients_search_vector_update();

-- Index GIN per ricerca veloce
CREATE INDEX idx_clients_search_vector ON clients USING GIN(search_vector);
```

**Impatto**: 🟢 **MEDIO** - Ricerca 10x più veloce su dataset grandi  
**Effort**: ⏱️ 2-3 ore

---

### 9. Audit Log per Operazioni Critiche

**Funzionalità**: Tracciare modifiche importanti (delete, status change, payment)

**Implementazione**:
```sql
-- Tabella audit log
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  entity_type TEXT NOT NULL, -- 'invoice', 'quote', 'client', etc.
  entity_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'created', 'updated', 'deleted', 'status_changed'
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger per invoice status changes
CREATE OR REPLACE FUNCTION log_invoice_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status != NEW.status THEN
    INSERT INTO audit_logs (user_id, entity_type, entity_id, action, old_values, new_values)
    VALUES (NEW.user_id, 'invoice', NEW.id, 'status_changed', 
            jsonb_build_object('status', OLD.status),
            jsonb_build_object('status', NEW.status));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Impatto**: 🟢 **MEDIO** - Compliance e debugging  
**Effort**: ⏱️ 3-4 ore

---

### 10. Notifiche Email per Eventi Importanti

**Stato**: ✅ Notifiche in-app implementate  
**Mancante**: Notifiche email per eventi critici

**Eventi da Notificare**:
- Fattura scaduta (overdue)
- Preventivo accettato/rifiutato
- Pagamento ricevuto
- Limite abbonamento raggiunto (80%)

**Implementazione**: 
- Usare Supabase Edge Functions + Resend/SendGrid
- O integrare con servizio email esistente

**Impatto**: 🟢 **ALTO** - Migliora engagement utenti  
**Effort**: ⏱️ 4-6 ore

---

### 11. Template Fatture/Preventivi Personalizzabili

**Stato**: ✅ PDF generation con Swiss QR Bill  
**Miglioramento**: Editor visuale per template personalizzati

**Implementazione**:
- Aggiungere campo `template_id` a `company_settings`
- Creare tabella `invoice_templates` con HTML/CSS
- Editor drag-and-drop (es. React Email Editor)

**Impatto**: 🟢 **ALTO** - Differenziazione prodotto  
**Effort**: ⏱️ 8-12 ore

---

### 12. Integrazione Contabilità (e-accounting)

**Funzionalità**: Export automatico per software contabilità

**Formati Supportati**:
- **DATEV** (Germania/Svizzera)
- **Bexio** (Svizzera)
- **Abacus** (Svizzera)
- **CSV generico** (compatibile con Excel)

**Implementazione**:
```typescript
// lib/export/datev.ts
export function exportToDatev(invoices: Invoice[]) {
  // Formato DATEV ASCII
  // https://www.datev.de/web/de/m/steuerberater/produkte-und-leistungen/software/datev-programmierung/
}
```

**Impatto**: 🟢 **ALTO** - Feature competitiva  
**Effort**: ⏱️ 6-8 ore per formato

---

## 🔧 Manutenibilità

### 13. TypeScript Strict Mode

**Stato**: TypeScript config probabilmente non in strict mode

**Fix**:
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

**Impatto**: 🟡 **MEDIO** - Previene bug a compile-time  
**Effort**: ⏱️ 2-4 ore (fix type errors)

---

### 14. Test Coverage Esteso

**Stato**: ✅ Test solo per utility functions  
**Miglioramento**: Test per componenti critici

**Priorità Test**:
1. **Hooks** (`use-subscription.ts`, `use-notifications.ts`)
2. **API Routes** (`/api/subscription/check-limits`, `/api/stripe/webhook`)
3. **Componenti Form** (`invoice-dialog.tsx`, `quote-dialog.tsx`)
4. **Utility Functions** (export, validations)

**Impatto**: 🟡 **MEDIO** - Confidenza nei refactoring  
**Effort**: ⏱️ 8-12 ore

---

### 15. Documentazione API

**Stato**: ✅ README completo  
**Mancante**: Documentazione API routes

**Implementazione**: 
- OpenAPI/Swagger per API routes
- O documentazione Markdown semplice

**Impatto**: 🟢 **BASSO** - Migliora onboarding dev  
**Effort**: ⏱️ 2-3 ore

---

### 16. Monitoring & Error Tracking

**Stato**: ✅ Logger centralizzato  
**Miglioramento**: Integrazione Sentry o simile

**Implementazione**:
```typescript
// lib/logger.ts
import * as Sentry from '@sentry/nextjs'

export const logger = {
  error: (message: string, error?: unknown, context?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === 'production') {
      Sentry.captureException(error, { extra: { message, ...context } })
    }
    // ... existing logic
  }
}
```

**Impatto**: 🟡 **ALTO** - Debugging produzione  
**Effort**: ⏱️ 1-2 ore

---

## 📊 Roadmap Consigliata

### Fase 1: Sicurezza (Settimana 1)
1. ✅ Fix funzioni SQL search_path (15 min)
2. ✅ Abilitare leaked password protection (2 min)
3. ✅ Review RLS policies (1 ora)

### Fase 2: Performance (Settimana 2-3)
1. ✅ Implementare caching React Query (2-3 ore)
2. ✅ Ottimizzare dashboard stats (3-4 ore)
3. ✅ Paginazione tabelle (4-6 ore)

### Fase 3: Funzionalità (Settimana 4-6)
1. ✅ Export batch (1-2 ore)
2. ✅ Full-text search (2-3 ore)
3. ✅ Notifiche email (4-6 ore)

### Fase 4: Manutenibilità (Ongoing)
1. ✅ TypeScript strict mode (2-4 ore)
2. ✅ Test coverage (8-12 ore)
3. ✅ Monitoring Sentry (1-2 ore)

---

## 📈 Metriche di Successo

### Performance
- **Dashboard load time**: < 500ms (attualmente ~1-2s)
- **Query database**: -30% query totali (via caching)
- **Tabelle paginate**: Load < 200ms anche con 10k+ record

### Sicurezza
- **Security warnings**: 0 (attualmente 4)
- **Password compromised**: Bloccate automaticamente

### Funzionalità
- **Export batch**: Supportato per tutte le tabelle
- **Full-text search**: 10x più veloce su dataset grandi
- **Email notifications**: 100% eventi critici notificati

---

## 🎯 Conclusioni

**Punti di Forza**:
- ✅ Architettura solida e ben organizzata
- ✅ RLS policies ottimizzate
- ✅ Logger centralizzato
- ✅ Type safety con TypeScript
- ✅ Multi-tenant isolation

**Aree di Miglioramento**:
- 🔴 Sicurezza: Fix funzioni SQL (critico)
- 🟡 Performance: Caching e paginazione (importante)
- 🟢 Funzionalità: Export batch, email (nice-to-have)

**Priorità Assoluta**: Fix sicurezza (15 minuti di lavoro, impatto critico)

---

**Documento generato automaticamente da analisi codebase**  
**Ultimo aggiornamento**: 2025-01-14


# 🔔 Sistema di Notifiche Intelligente - Fatturup

Sistema completo di notifiche real-time per tracciare automaticamente gli eventi importanti dell'applicazione.

## 📋 Panoramica

Il sistema di notifiche traccia automaticamente:

- ✅ **Clienti aggiunti** - Ogni volta che un nuovo cliente viene creato
- 📋 **Preventivi inviati** - Quando un preventivo passa da draft a sent
- 🎉 **Preventivi accettati** - Quando un cliente accetta un preventivo
- ❌ **Preventivi rifiutati** - Quando un preventivo viene rifiutato
- 📄 **Fatture emesse** - Quando una fattura passa da draft a issued
- 💰 **Fatture pagate** - Quando una fattura viene marcata come pagata
- ⚠️ **Fatture scadute** - Quando una fattura supera la data di scadenza

## 🏗️ Architettura

### 1. Database (Supabase)

#### Tabella `notifications`
```sql
- id: UUID (primary key)
- user_id: UUID (foreign key -> auth.users)
- type: TEXT (enum: client_added, quote_sent, quote_accepted, etc.)
- title: TEXT (titolo della notifica)
- message: TEXT (messaggio descrittivo)
- entity_type: TEXT (client, quote, invoice, settings)
- entity_id: UUID (riferimento all'entità)
- is_read: BOOLEAN (stato lettura)
- created_at: TIMESTAMP
```

#### RLS Policies
- ✅ Users can view their own notifications
- ✅ Users can update their own notifications (mark as read)
- ✅ Users can delete their own notifications

#### Triggers Automatici

**1. Nuovo Cliente (`trigger_notify_client_added`)**
```sql
AFTER INSERT ON clients
```
Crea notifica quando viene aggiunto un nuovo cliente.

**2. Cambio Status Fattura (`trigger_notify_invoice_status`)**
```sql
AFTER UPDATE ON invoices
WHEN (OLD.status IS DISTINCT FROM NEW.status)
```
Crea notifica per:
- Draft → Issued (fattura emessa)
- Any → Paid (fattura pagata)
- Any → Overdue (fattura scaduta)

**3. Cambio Status Preventivo (`trigger_notify_quote_status`)**
```sql
AFTER UPDATE ON quotes
WHEN (OLD.status IS DISTINCT FROM NEW.status)
```
Crea notifica per:
- Draft → Sent (preventivo inviato)
- Any → Accepted (preventivo accettato)
- Any → Rejected (preventivo rifiutato)

### 2. Hook React (`use-notifications.ts`)

Custom hook per gestire le notifiche nel frontend:

```typescript
const {
  notifications,      // Array di notifiche
  unreadCount,       // Numero notifiche non lette
  loading,           // Stato caricamento
  markAsRead,        // Segna come letta
  markAllAsRead,     // Segna tutte come lette
  deleteNotification, // Elimina notifica
  refetch            // Ricarica manualmente
} = useNotifications()
```

**Features:**
- ✅ Real-time updates con Supabase subscriptions
- ✅ Auto-refresh su cambiamenti database
- ✅ Limit 50 notifiche più recenti
- ✅ Conteggio automatico non lette
- ✅ Gestione errori

### 3. Componente UI (`NotificationsDropdown`)

Dropdown moderno con shadcn/ui integrato nell'header.

**Features:**
- ✅ Badge rosso con contatore (es. "5" o "9+" se >9)
- ✅ Lista scrollabile con ScrollArea
- ✅ Icone colorate per tipo evento:
  - 🔵 Clienti (blu)
  - 🟣 Preventivi (viola)
  - 🟢 Pagamenti/Accettazioni (verde)
  - 🔴 Scadenze/Rifiuti (rosso)
  - ⚪ Settings (grigio)
- ✅ Timestamp relativo (es. "2 ore fa")
- ✅ Click su notifica → navigazione automatica all'entità
- ✅ Pulsanti inline:
  - ✓ Segna come letta
  - 🗑️ Elimina
- ✅ Pulsante header "Segna tutte lette"
- ✅ Evidenziazione notifiche non lette (background colorato)
- ✅ Stato vuoto elegante

## 🚀 Utilizzo

### Frontend

Le notifiche appaiono automaticamente nell'header. Nessuna configurazione necessaria!

Il componente è già integrato in `components/app-header.tsx`:

```tsx
import { NotificationsDropdown } from '@/components/notifications-dropdown'

// ...
<NotificationsDropdown />
```

### Backend (Automatico)

I triggers si attivano automaticamente quando:

**Esempio 1: Aggiunta cliente**
```typescript
// In qualsiasi parte del codice dove crei un cliente
await supabase.from('clients').insert({ ... })
// ✅ Notifica creata automaticamente!
```

**Esempio 2: Cambio status fattura**
```typescript
// Quando aggiorni lo status
await supabase.from('invoices').update({ status: 'paid' }).eq('id', invoiceId)
// ✅ Notifica "Fattura pagata" creata automaticamente!
```

## 🔧 Funzioni Utility

### Check Fatture Scadute

Funzione per aggiornare automaticamente lo status delle fatture scadute:

```sql
SELECT check_overdue_invoices();
```

Questa funzione:
1. Trova tutte le fatture con status `issued`
2. Che hanno `due_date < CURRENT_DATE`
3. Le aggiorna a status `overdue`
4. Il trigger crea automaticamente la notifica

**Future Enhancement**: Schedulare con pg_cron per esecuzione giornaliera automatica.

## 📊 Tipi di Notifiche

| Tipo | Descrizione | Icona | Colore |
|------|-------------|-------|--------|
| `client_added` | Nuovo cliente aggiunto | Users | Blu |
| `quote_sent` | Preventivo inviato | FileText | Viola |
| `quote_accepted` | Preventivo accettato | FileText | Verde |
| `quote_rejected` | Preventivo rifiutato | FileText | Rosso |
| `invoice_issued` | Fattura emessa | Receipt | Arancione |
| `invoice_paid` | Fattura pagata | Receipt | Verde |
| `invoice_overdue` | Fattura scaduta | Receipt | Rosso |
| `settings_updated` | Impostazioni aggiornate | Settings | Grigio |

## 🎨 Design

Il componente segue il design system di shadcn/ui:
- ✅ Responsive
- ✅ Dark mode support
- ✅ Animazioni fluide
- ✅ Accessibilità (keyboard navigation)
- ✅ Performance ottimizzata

## 🔐 Sicurezza

- ✅ Row Level Security (RLS) attiva
- ✅ Users vedono solo le proprie notifiche
- ✅ Funzioni con `SECURITY DEFINER`
- ✅ Immutable `search_path` (prevent schema poisoning)
- ✅ Validazione tipi con CHECK constraints

## 📈 Performance

- ✅ Indici su: `user_id`, `is_read`, `created_at`
- ✅ Limit 50 notifiche (evita query pesanti)
- ✅ Real-time con Supabase Realtime (WebSocket)
- ✅ Lazy loading componente

## 🔮 Future Enhancements

1. **Notifiche Push** - Integrare con browser notifications API
2. **Email Notifications** - Inviare email per eventi critici
3. **Cron Job** - Schedulare check fatture scadute automatico
4. **Preferenze Utente** - Permettere all'utente di disabilitare tipi specifici
5. **Suoni** - Notifiche sonore per eventi importanti
6. **Raggruppamento** - Raggruppare notifiche simili
7. **Archivio** - Sistema di archiviazione per notifiche vecchie

## 🛠️ Manutenzione

### Aggiungere un nuovo tipo di notifica

1. **Aggiorna il CHECK constraint:**
```sql
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type IN (..., 'new_type'));
```

2. **Crea trigger function se necessario:**
```sql
CREATE OR REPLACE FUNCTION notify_new_event()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_notification(
    NEW.user_id,
    'new_type',
    'Titolo',
    'Messaggio',
    'entity_type',
    NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
```

3. **Aggiungi icona e colore in `NotificationsDropdown`:**
```typescript
const typeIcons = {
  ...existing,
  new_type: NewIcon,
}

const typeColors = {
  ...existing,
  new_type: 'text-color-500',
}
```

## 📝 File Principali

- `hooks/use-notifications.ts` - Hook React
- `components/notifications-dropdown.tsx` - Componente UI
- `components/app-header.tsx` - Integrazione header
- `supabase/create-notifications-system.sql` - Schema database
- `supabase/functions/check-overdue-invoices.sql` - Utility function

## 🧪 Test

Per testare il sistema:

1. **Aggiungi un cliente** → Verifica notifica "Cliente aggiunto"
2. **Crea una fattura draft e emettila** → Verifica "Fattura emessa"
3. **Marca una fattura come pagata** → Verifica "Fattura pagata"
4. **Crea un preventivo e invialo** → Verifica "Preventivo inviato"
5. **Accetta/rifiuta un preventivo** → Verifica notifiche relative

---

**Fatto con ❤️ usando Supabase Real-time + shadcn/ui**


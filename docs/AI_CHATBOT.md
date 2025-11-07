# 🤖 AI Chatbot - Documentazione Completa

## 📋 Indice
- [Panoramica](#panoramica)
- [Modello AI](#modello-ai)
- [Funzionalità](#funzionalità)
- [Architettura](#architettura)
- [Setup](#setup)
- [Tools Disponibili](#tools-disponibili)
- [Multi-lingua](#multi-lingua)
- [Esempi d'Uso](#esempi-duso)
- [Sicurezza](#sicurezza)
- [Costi](#costi)

---

## 📖 Panoramica

Il **Chatbot AI** è un assistente intelligente integrato nella piattaforma Fattura che permette agli utenti di:
- Creare fatture e preventivi conversazionalmente
- Visualizzare e cercare clienti
- Verificare lo stato dell'abbonamento e i limiti
- Ottenere statistiche sulle fatture

**Caratteristiche chiave**:
- ✅ **100% Serverless** - Deploy su Vercel Edge Functions
- ✅ **Completamente Gratuito** - Usa Gemini 2.0 Flash (free tier)
- ✅ **Multi-lingua** - Supporta IT, EN, DE, FR, RM
- ✅ **Sicuro** - RLS Supabase + controllo limiti automatico
- ✅ **Type-safe** - TypeScript end-to-end

---

## 🤖 Modello AI

### Google Gemini 2.0 Flash Experimental (Free)

**ID Modello**: `google/gemini-2.0-flash-exp:free`

**Perché Gemini 2.0 Flash?**
- ✅ **100% Gratuito** su OpenRouter
- ✅ **Multilingua nativo** - Perfetto per IT, EN, DE, FR, RM
- ✅ **Eccellente function calling** - Ideale per operazioni database
- ✅ **Velocissimo** - < 1s di risposta media
- ✅ **Affidabile** - Mantiene il contesto per 5+ step di conversazione

**Alternative gratuite**:
- `meta-llama/llama-3.1-8b-instruct:free` - Buono per inglese
- `deepseek/deepseek-chat:free` - Ottimo per coding tasks

---

## ✨ Funzionalità

### 1. Creazione Documenti
```
User: "Crea una fattura per Mario Rossi di 500 CHF"
AI: 
  1. Cerca cliente "Mario Rossi"
  2. Verifica limiti abbonamento
  3. Crea fattura INV-0042
  4. Conferma creazione con dettagli
```

### 2. Gestione Clienti
```
User: "Mostrami i clienti di Zurigo"
AI:
  1. Query database con filtro città
  2. Ritorna lista clienti formattata
```

### 3. Statistiche
```
User: "Quante fatture ho questo mese?"
AI:
  1. Conta fatture periodo corrente
  2. Mostra breakdown per stato (draft, paid, etc.)
```

### 4. Controllo Limiti
```
User: "Posso ancora creare fatture?"
AI:
  1. Verifica piano corrente
  2. Conta utilizzo risorse
  3. Mostra limiti disponibili
```

---

## 🏗️ Architettura

```
┌─────────────────────────────────────────────────┐
│  User Interface (React + Shadcn)                │
│  app/[locale]/dashboard/chat/page.tsx           │
└────────────────┬────────────────────────────────┘
                 │
                 │ useChat hook (Vercel AI SDK)
                 ▼
┌─────────────────────────────────────────────────┐
│  API Route (Edge Function)                      │
│  app/api/chat/route.ts                          │
│                                                  │
│  ┌─────────────────────────────────────────┐   │
│  │ OpenRouter Client                       │   │
│  │ Model: google/gemini-2.0-flash-exp:free│   │
│  └─────────────────────────────────────────┘   │
│                                                  │
│  ┌─────────────────────────────────────────┐   │
│  │ Tools (Function Calling)                │   │
│  │ • get_subscription_status               │   │
│  │ • list_clients                          │   │
│  │ • search_client                         │   │
│  │ • create_invoice                        │   │
│  │ • create_quote                          │   │
│  │ • get_invoice_stats                     │   │
│  └─────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────┘
                 │
                 │ Supabase Client
                 ▼
┌─────────────────────────────────────────────────┐
│  Supabase Database                              │
│  • Row Level Security (RLS)                     │
│  • check_subscription_limits RPC               │
│  • Tabelle: clients, invoices, quotes, etc.    │
└─────────────────────────────────────────────────┘
```

---

## 🚀 Setup

### 1. Installa Dipendenze

```bash
npm install ai @openrouter/ai-sdk-provider zod
```

### 2. Ottieni API Key OpenRouter

1. Vai su [https://openrouter.ai/](https://openrouter.ai/)
2. Registrati gratuitamente
3. Vai su "Keys" e crea una nuova API key
4. Copia la key (inizia con `sk-or-v1-...`)

### 3. Configura Environment Variables

```bash
# .env.local
OPENROUTER_API_KEY=sk-or-v1-xxx
```

### 4. Deploy su Vercel

```bash
# Aggiungi la variabile nel dashboard Vercel
vercel env add OPENROUTER_API_KEY

# Deploy
vercel --prod
```

### 5. Test in Locale

```bash
npm run dev
# Vai su http://localhost:3000/{locale}/dashboard/chat
```

---

## 🛠️ Tools Disponibili

### 1. `get_subscription_status`

**Descrizione**: Ottiene stato abbonamento, limiti e utilizzo corrente

**Parametri**: Nessuno

**Response**:
```typescript
{
  plan_name: "Pro",
  plan_price: 29,
  status: "active",
  clients: { current: 12, max: 50 },
  invoices: { current: 45, max: 100 },
  quotes: { current: 18, max: 100 }
}
```

---

### 2. `list_clients`

**Descrizione**: Lista tutti i clienti attivi

**Parametri**:
- `limit` (number, optional): Max clienti da ritornare (default: 20)

**Response**:
```typescript
{
  total: 12,
  clients: [
    { id: "uuid", name: "Mario Rossi", email: "mario@example.com", ... },
    ...
  ]
}
```

---

### 3. `search_client`

**Descrizione**: Cerca cliente per nome (case-insensitive, partial match)

**Parametri**:
- `name` (string, required): Nome o parte del nome da cercare

**Response**:
```typescript
{
  found: 2,
  clients: [
    { id: "uuid", name: "Mario Rossi", email: "mario@example.com", ... },
    { id: "uuid", name: "Maria Rossi", email: "maria@example.com", ... }
  ]
}
```

---

### 4. `create_invoice`

**Descrizione**: Crea una nuova fattura

**IMPORTANTE**: Deve prima cercare il cliente con `search_client` per ottenere il `client_id`

**Parametri**:
- `client_id` (string, required): UUID del cliente
- `amount` (number, required): Totale fattura in CHF
- `description` (string, optional): Note/descrizione

**Response**:
```typescript
{
  success: true,
  invoice_number: "INV-0042",
  client_name: "Mario Rossi",
  amount: 500,
  due_date: "2024-12-15",
  status: "draft",
  message: "Invoice INV-0042 created successfully for Mario Rossi"
}
```

**Gestione Limiti**:
Se l'utente ha raggiunto i limiti:
```typescript
{
  error: "Invoice limit reached: 5/5 for Free plan",
  upgrade_needed: true,
  current_count: 5,
  max_count: 5,
  plan_name: "Free"
}
```

---

### 5. `create_quote`

**Descrizione**: Crea un nuovo preventivo

**Parametri**:
- `client_id` (string, required): UUID del cliente
- `amount` (number, required): Totale preventivo in CHF
- `description` (string, optional): Note/descrizione
- `valid_days` (number, optional): Giorni validità (default: 30)

**Response**: Simile a `create_invoice`

---

### 6. `get_invoice_stats`

**Descrizione**: Ottiene statistiche fatture

**Parametri**:
- `period` (enum, optional): "month" | "year" | "all" (default: "month")

**Response**:
```typescript
{
  total_count: 45,
  total_amount: 125000,
  by_status: {
    draft: 5,
    issued: 12,
    paid: 25,
    overdue: 3
  },
  period: "month"
}
```

---

## 🌍 Multi-lingua

Il chatbot risponde automaticamente nella lingua selezionata dall'utente nel portale.

### System Prompts per Lingua

Ogni lingua ha un system prompt dedicato in `app/api/chat/route.ts`:

```typescript
const systemPrompts = {
  it: "Sei un assistente AI per Fattura...",
  en: "You are an AI assistant for Fattura...",
  de: "Du bist ein KI-Assistent für Fattura...",
  fr: "Vous êtes un assistant IA pour Fattura...",
  rm: "Ti ès in assistent da KI per Fattura..."
}
```

### UI Traduzioni

Tutte le stringhe UI sono tradotte in `i18n/messages/{locale}.json`:

```json
{
  "chat": {
    "title": "Assistente AI",
    "placeholder": "Es: Crea una fattura per Mario Rossi di 500 CHF",
    "thinking": "Sto pensando...",
    ...
  }
}
```

---

## 💬 Esempi d'Uso

### Esempio 1: Creare una Fattura

**Input Utente**:
```
"Crea una fattura per Mario Rossi di 1500 franchi"
```

**Flusso AI**:
1. **Tool**: `search_client({ name: "Mario Rossi" })`
   - Trova cliente con ID `abc-123`
2. **Tool**: `create_invoice({ client_id: "abc-123", amount: 1500 })`
   - Verifica limiti: OK (45/100)
   - Crea fattura INV-0046
3. **Response**:
   ```
   ✅ Perfetto! Ho creato la fattura INV-0046 per Mario Rossi di 1500.00 CHF.
   
   Dettagli:
   • Numero: INV-0046
   • Cliente: Mario Rossi
   • Importo: 1500.00 CHF
   • Scadenza: 15/12/2024
   • Stato: Bozza
   
   Vuoi che aggiunga delle note specifiche?
   ```

---

### Esempio 2: Controllo Limiti

**Input Utente**:
```
"Quanti clienti posso ancora aggiungere?"
```

**Flusso AI**:
1. **Tool**: `get_subscription_status()`
2. **Response**:
   ```
   📊 Ecco lo stato del tuo abbonamento Pro:
   
   Clienti: 12/50 (38 disponibili) ✅
   Fatture: 45/100 questo mese (55 disponibili) ✅
   Preventivi: 18/100 questo mese (82 disponibili) ✅
   
   Hai ancora ampio margine! 🎉
   ```

---

### Esempio 3: Ricerca Cliente

**Input Utente**:
```
"Mostrami tutti i clienti di Zurigo"
```

**Flusso AI**:
1. **Tool**: `list_clients({ limit: 50 })`
2. **Filtra** risultati per città "Zurigo"
3. **Response**:
   ```
   🏙️ Ho trovato 3 clienti a Zurigo:
   
   1. Mario Rossi
      📧 mario.rossi@example.com
      📱 +41 79 123 4567
   
   2. ABC Solutions SA
      📧 info@abc.ch
      📱 +41 44 123 4567
   
   3. Tech Startup GmbH
      📧 hello@techstartup.ch
      📱 +41 43 987 6543
   
   Vuoi creare un documento per uno di loro?
   ```

---

## 🔒 Sicurezza

### 1. Autenticazione
```typescript
// app/api/chat/route.ts
const { data: { user }, error } = await supabase.auth.getUser()
if (error || !user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

### 2. Row Level Security (RLS)
Tutte le query Supabase rispettano automaticamente le RLS policies:
- Ogni utente vede solo i propri dati
- Nessun accesso cross-tenant possibile

### 3. Controllo Limiti
Prima di ogni operazione di creazione:
```typescript
const { data: limitsCheck } = await supabase.rpc('check_subscription_limits', {
  p_user_id: user.id,
  p_resource_type: 'invoice'
})

if (limitsCheck && !limitsCheck.allowed) {
  return { error: "Limit reached", upgrade_needed: true }
}
```

### 4. Validazione Input
Tutti i parametri tools sono validati con **Zod**:
```typescript
parameters: z.object({
  client_id: z.string().describe('Client UUID'),
  amount: z.number().positive().describe('Amount in CHF'),
  description: z.string().optional()
})
```

### 5. GDPR Compliance
- Nessun dato sensibile inviato a OpenRouter
- Solo IDs e metadati necessari per function calling
- System prompts non contengono dati utente

---

## 💰 Costi

### OpenRouter (AI)
- **Modello**: `google/gemini-2.0-flash-exp:free`
- **Costo**: **$0.00** ✅
- **Limiti**: Nessun limite di rate (al momento)
- **Rate limit**: 10 requests/second

### Vercel (Hosting)
- **Edge Functions**: Incluse nel piano Hobby
- **Limite Hobby**: 100,000 invocations/giorno
- **Costo**: **$0.00** ✅

### Supabase (Database)
- **Piano Free**: 500MB storage
- **API Calls**: Illimitate
- **Costo**: **$0.00** ✅

### **Totale Mensile: $0.00** 🎉

---

## 🧪 Testing

### Test Manuale

1. **Vai alla pagina chat**:
   ```
   http://localhost:3000/it/dashboard/chat
   ```

2. **Test creazione fattura**:
   ```
   "Crea una fattura per il primo cliente della lista di 250 CHF"
   ```

3. **Test limiti**:
   ```
   "Qual è lo stato del mio abbonamento?"
   ```

4. **Test ricerca**:
   ```
   "Mostrami tutti i clienti"
   ```

### Test Multi-lingua

1. Cambia lingua nel portale (ES: EN)
2. Vai alla chat
3. Verifica che:
   - UI sia tradotta
   - AI risponda in inglese
   - System prompt corretto sia usato

---

## 🐛 Troubleshooting

### Errore: "Unauthorized"
**Causa**: L'utente non è autenticato
**Soluzione**: Verifica che l'utente sia loggato

### Errore: "Tool execution failed"
**Causa**: Errore nella query Supabase
**Soluzione**: Controlla i logs del server e RLS policies

### AI non risponde nella lingua corretta
**Causa**: `locale` non passato correttamente
**Soluzione**: Verifica che `useLocale()` ritorni la lingua corretta

### "Limit reached" anche se ho spazio
**Causa**: Cache della funzione `check_subscription_limits`
**Soluzione**: Refresh della pagina o logout/login

---

## 📚 Riferimenti

- **Vercel AI SDK**: https://sdk.vercel.ai/docs
- **OpenRouter**: https://openrouter.ai/docs
- **Gemini 2.0 Flash**: https://ai.google.dev/gemini-api/docs
- **Shadcn UI**: https://ui.shadcn.com/
- **Next.js**: https://nextjs.org/docs

---

## 🎯 Best Practices

### 1. Prompt Engineering
- System prompt deve essere chiaro e conciso
- Specificare sempre il formato output desiderato
- Limitare il numero di tool calls (max 5 steps)

### 2. Error Handling
- Gestire sempre errori tool gracefully
- Fornire feedback utile all'utente
- Non esporre errori tecnici

### 3. Performance
- Usare Edge Runtime per latenza minima
- Limitare il numero di risultati nelle query
- Cache quando possibile

### 4. UX
- Loading states chiari
- Feedback immediato
- Esempi visibili per guidare l'utente

---

## 🚀 Future Improvements

- [ ] **Streaming tool calls** - Mostrare progress in tempo reale
- [ ] **Context persistente** - Salvare conversazioni nel DB
- [ ] **Suggerimenti intelligenti** - Basati su cronologia utente
- [ ] **Voice input** - Integrazione Web Speech API
- [ ] **PDF preview** - Mostrare preview fatture create
- [ ] **Bulk operations** - Creare più documenti in una volta
- [ ] **Analytics** - Tracking utilizzo chatbot per ottimizzazioni

---

**Versione**: 1.0.0  
**Data**: Novembre 2024  
**Autore**: Factura Team  
**Licenza**: MIT


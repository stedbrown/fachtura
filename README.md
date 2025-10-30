# Fattura - Gestionale SaaS

Un'applicazione SaaS moderna per la gestione di clienti, preventivi e fatture con generazione di PDF con Swiss QR Bill.

## 🚀 Stack Tecnologico

- **Framework**: Next.js 15 (App Router) + Turbopack
- **Linguaggio**: TypeScript
- **Styling**: TailwindCSS + shadcn/ui
- **Database & Auth**: Supabase (PostgreSQL + Row Level Security)
- **Validazione**: Zod + React Hook Form
- **PDF Generation**: pdf-lib + swissqrbill
- **Charts**: Recharts (via shadcn/ui Charts)
- **Date Handling**: date-fns
- **Internationalization**: next-intl (5 lingue)
- **Export Data**: xlsx (Excel) + papaparse (CSV)
- **State Persistence**: js-cookie
- **Icons**: Lucide React

## 📋 Funzionalità

### 🔐 Autenticazione
- Registrazione e login con Supabase Auth
- Multi-tenant con isolamento dati per utente
- Logout sicuro

### 👥 Gestione Clienti
- Lista completa dei clienti
- Aggiungi, modifica ed elimina clienti
- Informazioni complete (nome, email, telefono, indirizzo)
- **Archiviazione (soft delete)** con possibilità di ripristino
- **Filtri avanzati** (nome, email, telefono)
- **Export CSV/Excel** dei clienti

### 📄 Preventivi
- Crea preventivi con righe dinamiche
- Gestione stati (Bozza, Inviato, Accettato, Rifiutato)
- Calcolo automatico di subtotale, IVA e totale
- **Generazione e Download PDF** dei preventivi con design Swiss tradotti in 5 lingue
- **Conversione automatica in fattura** quando accettati
- **Archiviazione (soft delete)** con possibilità di ripristino
- **Filtri avanzati** (date, importi, stato, cliente)
- **Export CSV/Excel** con traduzioni
- Note e termini personalizzabili per PDF
- Visualizzazione dettagliata

### 💰 Fatture
- Crea fatture con righe dinamiche
- Gestione stati (Bozza, Emessa, Pagata, Scaduta)
- **Generazione PDF con Swiss QR Bill** integrato e design Swiss tradotti in 5 lingue
- Download PDF delle fatture
- **Archiviazione (soft delete)** con possibilità di ripristino
- **Filtri avanzati** (date, importi, stato, cliente)
- **Export CSV/Excel** con traduzioni
- Termini di pagamento e footer personalizzabili
- Tracciamento scadenze automatico

### 📊 Dashboard Analytics
- **Grafici interattivi** (ultimi 12 mesi)
- **KPI Cards**: fatturato, clienti, fatture in attesa, fatture scadute
- **Top 5 clienti** per fatturato
- **Distribuzione preventivi** per stato (Pie Chart)
- **Distribuzione fatture** per stato (Pie Chart)
- **Confronto documenti** (Preventivi vs Fatture)
- **Tasso di accettazione** preventivi (Radial Chart)
- **Personalizzazione dashboard** (show/hide charts con persistenza)

### ⚙️ Impostazioni
- Gestione informazioni azienda
- Configurazione IBAN per QR Bill
- **Upload logo aziendale** (visibile su tutti i PDF)
- Indirizzo, partita IVA, contatti
- **Personalizzazione documenti**:
  - Note predefinite per preventivi
  - Note predefinite per fatture
  - Giorni di validità preventivi
  - Giorni di scadenza fatture
  - Termini di pagamento
  - Footer preventivi

### 🌍 Multilingua
- **5 lingue supportate**: Italiano, Inglese, Tedesco, Francese, Romancio
- Interfaccia completamente tradotta
- **PDF tradotti** secondo la lingua selezionata
- Cambio lingua in tempo reale

### 🔍 Ricerca Globale
- **Barra di ricerca intelligente** (Cmd+K / Ctrl+K)
- Cerca preventivi, fatture o clienti
- Navigazione rapida tra documenti

### 🎨 UI/UX
- Design moderno con **shadcn/ui**
- Tema chiaro/scuro
- Sidebar navigazione con persistenza stato
- **Responsive design** (mobile-first)
- Toast notifications
- Loading states e skeleton loaders

## 🛠️ Installazione

### 1. Clona il repository

\`\`\`bash
git clone <repository-url>
cd factura
\`\`\`

### 2. Installa le dipendenze

\`\`\`bash
npm install
\`\`\`

### 3. Configura Supabase

1. Crea un progetto su [Supabase](https://supabase.com)
2. Esegui lo schema SQL da `supabase/schema.sql` nel SQL Editor di Supabase
3. Copia le credenziali del progetto

### 4. Configura le variabili d'ambiente

Crea un file `.env.local` nella root del progetto:

\`\`\`env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
\`\`\`

### 5. Avvia il server di sviluppo

\`\`\`bash
npm run dev
\`\`\`

Apri [http://localhost:3000](http://localhost:3000) nel browser.

## 📦 Struttura del Progetto

\`\`\`
factura/
├── app/
│   ├── api/
│   │   └── invoices/[id]/pdf/    # API per generazione PDF
│   ├── auth/
│   │   ├── login/                # Pagina login
│   │   └── register/             # Pagina registrazione
│   ├── dashboard/
│   │   ├── clients/              # Gestione clienti
│   │   ├── quotes/               # Gestione preventivi
│   │   ├── invoices/             # Gestione fatture
│   │   ├── settings/             # Impostazioni
│   │   └── page.tsx              # Dashboard principale
│   └── layout.tsx
├── components/
│   ├── ui/                       # Componenti shadcn/ui
│   ├── app-sidebar.tsx           # Sidebar navigazione
│   ├── app-header.tsx            # Header con user info
│   ├── theme-provider.tsx        # Provider tema
│   └── theme-toggle.tsx          # Toggle tema
├── lib/
│   ├── supabase/                 # Client Supabase
│   ├── types/                    # TypeScript types
│   ├── validations/              # Schemi Zod
│   └── utils/                    # Utility functions
└── supabase/
    └── schema.sql                # Schema database
\`\`\`

## 🗄️ Database Schema

Il database è organizzato con le seguenti tabelle:

- **company_settings**: Impostazioni azienda (una per utente)
- **clients**: Clienti
- **quotes**: Preventivi
- **quote_items**: Righe preventivo
- **invoices**: Fatture
- **invoice_items**: Righe fattura

Tutte le tabelle hanno Row Level Security (RLS) abilitato per garantire l'isolamento dei dati tra utenti.

## 🔒 Sicurezza

- Row Level Security (RLS) su tutte le tabelle
- Autenticazione gestita da Supabase
- Middleware per protezione route
- Isolamento completo dei dati per tenant

## 📝 Swiss QR Bill

Le fatture vengono generate con il Swiss QR Bill integrato, contenente:
- Dati del creditore (azienda)
- Dati del debitore (cliente)
- Importo e valuta (CHF)
- Riferimento fattura
- Codice QR per pagamento

**Nota**: Per generare correttamente il QR Bill, è necessario configurare un IBAN svizzero valido nelle Impostazioni.

## 🎯 Best Practices Implementate

- **TypeScript**: Type safety completo
- **Zod**: Validazione schema dati
- **Server Components**: Ottimizzazione performance
- **Client Components**: Solo dove necessario
- **Modular Architecture**: Codice organizzato per moduli
- **Error Handling**: Gestione errori robusta
- **Responsive Design**: Mobile-first approach

## 🚀 Quick Start

### 1. Setup Supabase

1. Crea un progetto su [supabase.com](https://supabase.com)
2. Esegui lo schema SQL da `supabase/schema.sql` nel SQL Editor
3. Esegui le migrazioni:
   - `supabase/add-soft-delete.sql`
   - `supabase/add-document-customization.sql`
   - `supabase/trigger-create-company-settings.sql`
4. (Opzionale) Setup Storage per logo: vedi `supabase/setup-storage.md`

### 2. Configura `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Installa e Avvia

```bash
npm install
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000)

### 4. Primo Utilizzo

1. **Registrati**: Crea account con email e password
2. **Configura Azienda**: Vai in Impostazioni e compila i dati aziendali (nome, IBAN, indirizzo, P.IVA)
3. **Aggiungi Clienti**: Crea i tuoi primi clienti
4. **Crea Preventivo**: Genera un preventivo per un cliente
5. **Scarica PDF**: Visualizza e scarica il PDF tradotto
6. **Converti in Fattura**: Accetta il preventivo e convertilo automaticamente

## 📦 Deployment

### Vercel (Raccomandato)

1. Push del codice su GitHub
2. Importa il repository su [vercel.com](https://vercel.com)
3. Configura le variabili d'ambiente:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy automatico! ✅

### Build Produzione

```bash
npm run build
npm start
```

## 📚 Documentazione Aggiuntiva

- **[NEW_FEATURES.md](./NEW_FEATURES.md)** - Changelog dettagliato delle funzionalità implementate
- **Supabase Migrations**: Tutti i file SQL in `supabase/` per setup database
- **Storage Setup**: `supabase/setup-storage.md` per configurazione upload logo

## 🚧 Possibili Sviluppi Futuri

- [ ] Multi-currency support (attualmente solo CHF)
- [ ] API pubblica per integrazioni
- [ ] Integrazione pagamenti online (Stripe, PayPal)
- [ ] Invio email automatico (Resend, SendGrid)
- [ ] Promemoria scadenze automatici
- [ ] Template PDF personalizzabili
- [ ] Mobile app (React Native)
- [ ] Backup automatici programmati

## 📄 Licenza

MIT

## 🤝 Contribuire

Le pull request sono benvenute! Per modifiche importanti, apri prima una issue per discutere i cambiamenti.

## 📧 Contatti

Per domande o supporto, apri una issue su GitHub.

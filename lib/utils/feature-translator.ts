// Mappa le features del database (in italiano) alle chiavi i18n
export function getFeatureTranslationKey(feature: string): string | null {
  const featureMap: Record<string, string> = {
    '3 clienti': '3clients',
    '50 clienti': '50clients',
    'Clienti illimitati': 'unlimitedClients',
    '5 fatture/mese': '5invoices',
    '100 fatture/mese': '100invoices',
    'Fatture illimitate': 'unlimitedInvoices',
    '5 preventivi/mese': '5quotes',
    '100 preventivi/mese': '100quotes',
    'Preventivi illimitati': 'unlimitedQuotes',
    'PDF export': 'pdfExport',
    'Personalizzazione documenti': 'documentCustomization',
    'Supporto prioritario': 'prioritySupport',
    'Personalizzazione completa': 'fullCustomization',
    'Supporto 24/7': 'support24',
    'API access': 'apiAccess',
  }

  return featureMap[feature] || null
}


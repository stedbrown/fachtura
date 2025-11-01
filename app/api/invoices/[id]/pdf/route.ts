import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'
import { format } from 'date-fns'
import { it, de, fr, enUS } from 'date-fns/locale'
import { getPDFTranslations } from '@/lib/pdf-translations'

const localeMap: Record<string, any> = {
  it: it,
  de: de,
  fr: fr,
  en: enUS,
  rm: de,
}

// Helper function to convert country names to ISO codes
function getCountryCode(country: string | null | undefined): string {
  if (!country) return 'CH'
  
  const countryUpper = country.toUpperCase().trim()
  
  // If already a 2-letter code, return it
  if (countryUpper.length === 2) return countryUpper
  
  // Map common country names to ISO codes
  const countryMap: Record<string, string> = {
    'SWITZERLAND': 'CH',
    'SVIZZERA': 'CH',
    'SCHWEIZ': 'CH',
    'SUISSE': 'CH',
    'ITALY': 'IT',
    'ITALIA': 'IT',
    'GERMANY': 'DE',
    'GERMANIA': 'DE',
    'DEUTSCHLAND': 'DE',
    'FRANCE': 'FR',
    'FRANCIA': 'FR',
    'AUSTRIA': 'AT',
    'LIECHTENSTEIN': 'LI',
  }
  
  return countryMap[countryUpper] || 'CH'
}

// Helper function to clean website URL for display
function cleanWebsiteForDisplay(website: string | null | undefined): string {
  if (!website) return ''
  
  let cleaned = website
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '')
  
  return cleaned
}

// Helper function to generate Swiss QR Code data string (ISO 20022)
function generateSwissQRCodeData(data: {
  iban: string
  creditorName: string
  creditorAddress: string
  creditorZip: string | number
  creditorCity: string
  creditorCountry: string
  amount: number
  currency: string
  debtorName?: string
  debtorAddress?: string
  debtorZip?: string | number
  debtorCity?: string
  debtorCountry?: string
  message?: string
}): string {
  const lines: string[] = []
  
  // Header
  lines.push('SPC')  // QRType
  lines.push('0200')  // Version
  lines.push('1')  // Coding Type (1 = UTF-8)
  
  // IBAN
  lines.push(data.iban.replace(/\s/g, ''))
  
  // Creditor (Combined address type)
  lines.push('K')  // Address type: K = combined, S = structured
  lines.push(data.creditorName)
  lines.push(data.creditorAddress)
  lines.push('')  // Building number (empty for combined)
  lines.push(`${data.creditorZip} ${data.creditorCity}`)
  lines.push('')  // Empty line
  lines.push(data.creditorCountry)
  
  // Ultimate Creditor (7 empty lines)
  for (let i = 0; i < 7; i++) lines.push('')
  
  // Amount
  lines.push(data.amount.toFixed(2))
  lines.push(data.currency)
  
  // Debtor
  if (data.debtorName) {
    lines.push('K')  // Address type
    lines.push(data.debtorName)
    lines.push(data.debtorAddress || '')
    lines.push('')  // Building number
    lines.push(data.debtorZip && data.debtorCity ? `${data.debtorZip} ${data.debtorCity}` : '')
    lines.push('')  // Empty line
    lines.push(data.debtorCountry || '')
  } else {
    // 7 empty lines if no debtor
    for (let i = 0; i < 7; i++) lines.push('')
  }
  
  // Reference Type
  lines.push('NON')  // NON = without reference (since we don't have QR-IBAN)
  
  // Reference (empty for NON type)
  lines.push('')
  
  // Unstructured Message
  lines.push(data.message || '')
  
  // EPD (empty - trailer)
  lines.push('EPD')
  
  // Billing Information (empty)
  lines.push('')
  
  // Alternative Procedures (2 empty lines)
  lines.push('')
  lines.push('')
  
  return lines.join('\r\n')
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const locale = searchParams.get('locale') || 'it'
    
    console.log(`Generating PDF for invoice ${id} with locale ${locale}`)

    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        client:clients (
          id,
          name,
          email,
          phone,
          address,
          city,
          postal_code,
          country
        ),
        invoice_items (
          id,
          description,
          quantity,
          unit_price,
          tax_rate,
          line_total
        )
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (invoiceError || !invoice) {
      console.error('Invoice error:', invoiceError)
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const { data: company } = await supabase
      .from('company_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!company) {
      return NextResponse.json({ error: 'Company settings not found' }, { status: 404 })
    }

    const t = getPDFTranslations(locale)
    const dateLocale = localeMap[locale] || it

    console.log('Invoice data loaded successfully')

    // Create PDF with pdf-lib (works perfectly on serverless)
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595, 842]) // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    let yPosition = 792 // Start from top

    // Logo (if exists)
    if (company.logo_url) {
      try {
        console.log('Loading logo from:', company.logo_url)
        const logoResponse = await fetch(company.logo_url)
        const logoBuffer = await logoResponse.arrayBuffer()
        
        let logoImage
        const contentType = logoResponse.headers.get('content-type')
        if (contentType?.includes('png')) {
          logoImage = await pdfDoc.embedPng(logoBuffer)
        } else if (contentType?.includes('jpeg') || contentType?.includes('jpg')) {
          logoImage = await pdfDoc.embedJpg(logoBuffer)
        }

        if (logoImage) {
          // Calculate proportional size (max 100x60)
          const maxWidth = 100
          const maxHeight = 60
          const imgWidth = logoImage.width
          const imgHeight = logoImage.height
          
          let finalWidth = imgWidth
          let finalHeight = imgHeight
          
          // Scale down if too large
          if (imgWidth > maxWidth || imgHeight > maxHeight) {
            const widthRatio = maxWidth / imgWidth
            const heightRatio = maxHeight / imgHeight
            const scale = Math.min(widthRatio, heightRatio)
            finalWidth = imgWidth * scale
            finalHeight = imgHeight * scale
          }
          
          console.log('Logo dimensions:', { original: { w: imgWidth, h: imgHeight }, final: { w: finalWidth, h: finalHeight } })
          
          page.drawImage(logoImage, {
            x: 495 - finalWidth, // Align right
            y: yPosition - finalHeight - 10,
            width: finalWidth,
            height: finalHeight,
          })
        }
      } catch (error) {
        console.error('Error loading logo:', error)
      }
    }

    // Company info
    page.drawText(company.company_name || '', { x: 50, y: yPosition, size: 11, font: fontBold, color: rgb(0, 0, 0) })
    yPosition -= 15
    
    if (company.address) {
      page.drawText(company.address, { x: 50, y: yPosition, size: 9, font, color: rgb(0, 0, 0) })
      yPosition -= 12
    }
    
    const cityLine = [company.postal_code, company.city].filter(Boolean).join(' ')
    if (cityLine) {
      page.drawText(cityLine, { x: 50, y: yPosition, size: 9, font, color: rgb(0, 0, 0) })
      yPosition -= 12
    }
    
    if (company.country) {
      page.drawText(company.country, { x: 50, y: yPosition, size: 9, font, color: rgb(0, 0, 0) })
      yPosition -= 12
    }
    
    yPosition -= 10
    
    if (company.vat_number) {
      page.drawText(`${t.vatNumber}: ${company.vat_number}`, { x: 50, y: yPosition, size: 8, font, color: rgb(0, 0, 0) })
      yPosition -= 12
    }
    
    if (company.email) {
      page.drawText(`${t.email}: ${company.email}`, { x: 50, y: yPosition, size: 8, font, color: rgb(0, 0, 0) })
      yPosition -= 12
    }
    
    if (company.phone) {
      page.drawText(`${t.phone}: ${company.phone}`, { x: 50, y: yPosition, size: 8, font, color: rgb(0, 0, 0) })
      yPosition -= 12
    }
    
    if (company.website) {
      const displayWebsite = cleanWebsiteForDisplay(company.website)
      page.drawText(`${t.website}: ${displayWebsite}`, { x: 50, y: yPosition, size: 8, font, color: rgb(0, 0, 0) })
      yPosition -= 12
    }

    yPosition -= 30

    // Customer info
    page.drawText(t.billTo, { x: 50, y: yPosition, size: 11, font: fontBold, color: rgb(0, 0, 0) })
    yPosition -= 20

    const client = invoice.client || {}
    page.drawText(client.name || '', { x: 50, y: yPosition, size: 10, font, color: rgb(0, 0, 0) })
    yPosition -= 15

    if (client.address) {
      page.drawText(client.address, { x: 50, y: yPosition, size: 9, font, color: rgb(0, 0, 0) })
      yPosition -= 12
    }

    const customerCityLine = [client.postal_code, client.city].filter(Boolean).join(' ')
    if (customerCityLine) {
      page.drawText(customerCityLine, { x: 50, y: yPosition, size: 9, font, color: rgb(0, 0, 0) })
      yPosition -= 12
    }

    if (client.country) {
      page.drawText(client.country, { x: 50, y: yPosition, size: 9, font, color: rgb(0, 0, 0) })
      yPosition -= 12
    }

    yPosition -= 30

    // Invoice title
    page.drawText(t.invoice.toUpperCase(), { x: 50, y: yPosition, size: 20, font: fontBold, color: rgb(0, 0, 0) })
    yPosition -= 30

    // Invoice details
    const details = [
      `${t.invoiceNumber}: ${invoice.invoice_number}`,
      invoice.issue_date ? `${t.date}: ${format(new Date(invoice.issue_date), 'dd MMMM yyyy', { locale: dateLocale })}` : null,
      invoice.due_date ? `${t.dueDate}: ${format(new Date(invoice.due_date), 'dd MMMM yyyy', { locale: dateLocale })}` : null,
    ].filter(Boolean)

    details.forEach(detail => {
      if (detail) {
        page.drawText(detail, { x: 50, y: yPosition, size: 10, font, color: rgb(0, 0, 0) })
        yPosition -= 15
      }
    })

    yPosition -= 20

    // Items table header
    const tableTop = yPosition
    const itemCodeX = 50
    const descriptionX = 120
    const quantityX = 350
    const priceX = 420
    const totalX = 490

    page.drawText(t.itemCode, { x: itemCodeX, y: tableTop, size: 10, font: fontBold, color: rgb(0, 0, 0) })
    page.drawText(t.description, { x: descriptionX, y: tableTop, size: 10, font: fontBold, color: rgb(0, 0, 0) })
    page.drawText(t.quantity, { x: quantityX, y: tableTop, size: 10, font: fontBold, color: rgb(0, 0, 0) })
    page.drawText(t.price, { x: priceX, y: tableTop, size: 10, font: fontBold, color: rgb(0, 0, 0) })
    page.drawText(t.total, { x: totalX, y: tableTop, size: 10, font: fontBold, color: rgb(0, 0, 0) })

    yPosition = tableTop - 20

    // Header line
    page.drawLine({
      start: { x: 50, y: yPosition },
      end: { x: 550, y: yPosition },
      thickness: 1,
      color: rgb(0, 0, 0),
    })
    yPosition -= 15

    // Items
    const items = invoice.invoice_items || []
    console.log('Invoice items count:', items.length)
    
    items.forEach((item: any, index: number) => {
      const itemTotal = (item.quantity || 0) * (item.unit_price || 0)
      
      console.log(`Item ${index + 1}:`, { description: item.description, quantity: item.quantity, unit_price: item.unit_price })
      
      // No "code" field in database, so we show item number
      page.drawText(`${index + 1}`, { x: itemCodeX, y: yPosition, size: 9, font, color: rgb(0, 0, 0) })
      page.drawText(item.description || '', { x: descriptionX, y: yPosition, size: 9, font, color: rgb(0, 0, 0), maxWidth: 220 })
      page.drawText(String(item.quantity || 0), { x: quantityX, y: yPosition, size: 9, font, color: rgb(0, 0, 0) })
      page.drawText(`${(item.unit_price || 0).toFixed(2)}`, { x: priceX, y: yPosition, size: 9, font, color: rgb(0, 0, 0) })
      page.drawText(`${itemTotal.toFixed(2)}`, { x: totalX, y: yPosition, size: 9, font, color: rgb(0, 0, 0) })
      
      yPosition -= 20
    })

    yPosition -= 10
    page.drawLine({
      start: { x: 50, y: yPosition },
      end: { x: 550, y: yPosition },
      thickness: 1,
      color: rgb(0, 0, 0),
    })
    yPosition -= 20

    // Totals
    const subtotal = invoice.subtotal || 0
    const taxAmount = invoice.tax || 0
    const total = invoice.total || 0

    page.drawText(t.subtotal, { x: 400, y: yPosition, size: 10, font: fontBold, color: rgb(0, 0, 0) })
    page.drawText(`${subtotal.toFixed(2)} ${invoice.currency || 'CHF'}`, { x: 490, y: yPosition, size: 10, font, color: rgb(0, 0, 0) })
    yPosition -= 20

    if (invoice.tax_rate) {
      page.drawText(`${t.tax} (${invoice.tax_rate}%)`, { x: 400, y: yPosition, size: 10, font: fontBold, color: rgb(0, 0, 0) })
      page.drawText(`${taxAmount.toFixed(2)} ${invoice.currency || 'CHF'}`, { x: 490, y: yPosition, size: 10, font, color: rgb(0, 0, 0) })
      yPosition -= 20
    }

    page.drawText(t.total, { x: 400, y: yPosition, size: 12, font: fontBold, color: rgb(0, 0, 0) })
    page.drawText(`${total.toFixed(2)} ${invoice.currency || 'CHF'}`, { x: 490, y: yPosition, size: 12, font: fontBold, color: rgb(0, 0, 0) })

    yPosition -= 40

    // Notes
    if (invoice.notes) {
      page.drawText(t.notes, { x: 50, y: yPosition, size: 10, font: fontBold, color: rgb(0, 0, 0) })
      yPosition -= 15
      page.drawText(invoice.notes, { x: 50, y: yPosition, size: 9, font, color: rgb(0, 0, 0), maxWidth: 500 })
    }

    // Swiss QR Bill - Using OFFICIAL swissqrbill library (SVG mode for serverless)
    console.log('=== Starting Swiss QR Bill generation ===')
    console.log('Company IBAN:', company.iban)
    console.log('Invoice total:', invoice.total)
    console.log('Currency:', invoice.currency)

    try {
      // Build QR Bill data
      const creditorData: any = {
        name: company.company_name || '',
        address: company.address || '',
        city: company.city || '',
        account: company.iban || '',
        country: getCountryCode(company.country)
      }
      
      if (company.postal_code) {
        creditorData.zip = typeof company.postal_code === 'number' ? company.postal_code : parseInt(String(company.postal_code))
      }

      const debtorData: any = {
        name: client.name || '',
        address: client.address || '',
        city: client.city || '',
        country: getCountryCode(client.country)
      }
      
      if (client.postal_code) {
        debtorData.zip = typeof client.postal_code === 'number' ? client.postal_code : parseInt(String(client.postal_code))
      }

      const qrBillData: any = {
        currency: invoice.currency || 'CHF',
        amount: invoice.total,
        creditor: creditorData,
        debtor: debtorData,
        message: `${t.invoice} ${invoice.invoice_number}`
      }

      // QR-Reference requires QR-IBAN (not regular IBAN)
      // QR-IBAN typically starts with institution number 30-31
      // For now, we skip reference and use message field instead
      // User can add QR-IBAN later in settings if they want QR-Reference support
      console.log('Skipping QR-Reference (requires QR-IBAN, current IBAN is regular)')

      console.log('QR Bill data prepared:', JSON.stringify(qrBillData, null, 2))

      // Check if we have minimum required data
      if (!company.iban || company.iban.trim() === '') {
        console.error('❌ IBAN mancante! QR Bill non può essere generato senza IBAN.')
        console.error('Vai in Impostazioni → Informazioni Pagamento e inserisci l\'IBAN')
      } else if (!company.postal_code || company.postal_code.toString().trim() === '') {
        console.error('❌ CAP mancante! QR Bill richiede il CAP dell\'azienda.')
        console.error('Vai in Impostazioni → Dati Azienda e inserisci il CAP')
      } else if (!company.company_name || company.company_name.trim() === '') {
        console.error('❌ Nome Azienda mancante! QR Bill richiede il nome dell\'azienda.')
        console.error('Vai in Impostazioni → Dati Azienda e inserisci il Nome Azienda')
      } else {
        console.log('✅ IBAN presente, generazione QR Bill manuale...')
        
        // Generate QR Code data string according to Swiss QR Bill spec (ISO 20022)
        const qrCodeData = generateSwissQRCodeData({
          iban: company.iban || '',
          creditorName: company.company_name || '',
          creditorAddress: company.address || '',
          creditorZip: company.postal_code || '',
          creditorCity: company.city || '',
          creditorCountry: getCountryCode(company.country),
          amount: invoice.total,
          currency: invoice.currency || 'CHF',
          debtorName: client.name,
          debtorAddress: client.address,
          debtorZip: client.postal_code,
          debtorCity: client.city,
          debtorCountry: getCountryCode(client.country),
          message: `${t.invoice} ${invoice.invoice_number}`
        })
        
        console.log('QR Code data generated, length:', qrCodeData.length)
        
        // Generate QR Code image using qrcode library
        const qrCodePngBuffer = await QRCode.toBuffer(qrCodeData, {
          errorCorrectionLevel: 'M',
          type: 'png',
          width: 166, // Swiss Cross QR code size in pixels (46mm at 90 DPI)
          margin: 0
        })
        
        console.log('QR Code image generated')
        
        // Embed QR Code image
        const qrCodeImage = await pdfDoc.embedPng(qrCodePngBuffer)
        
        // Add new page for QR Bill
        const qrPage = pdfDoc.addPage([595, 842]) // A4
        
        // Swiss QR Bill layout dimensions (in points, 1mm = 2.83465 points)
        const mm = 2.83465
        const qrBillHeight = 105 * mm // QR Bill is 105mm high
        const qrBillStartY = 0 // Start at bottom
        
        // Receipt section (left, 62mm wide)
        const receiptX = 5 * mm
        const receiptWidth = 52 * mm
        
        // Payment part section (right, 148mm wide)
        const paymentX = 62 * mm
        const paymentWidth = 148 * mm
        
        // Draw QR Bill sections at the BOTTOM of the page
        let y = qrBillStartY + qrBillHeight - 10 * mm
        
        // === RECEIPT SECTION (LEFT) ===
        qrPage.drawText(t.receipt || 'Receipt', { 
          x: receiptX, 
          y, 
          size: 11, 
          font: fontBold 
        })
        
        y -= 20
        qrPage.drawText(t.accountPayableTo || 'Account / Payable to', { 
          x: receiptX, 
          y, 
          size: 6, 
          font: fontBold 
        })
        
        y -= 10
        qrPage.drawText(company.iban || '', { x: receiptX, y, size: 8, font })
        y -= 10
        qrPage.drawText(company.company_name || '', { x: receiptX, y, size: 8, font })
        y -= 10
        if (company.address) qrPage.drawText(company.address, { x: receiptX, y, size: 8, font })
        y -= 10
        qrPage.drawText(`${company.postal_code || ''} ${company.city || ''}`, { x: receiptX, y, size: 8, font })
        
        y -= 20
        qrPage.drawText(t.payableBy || 'Payable by', { 
          x: receiptX, 
          y, 
          size: 6, 
          font: fontBold 
        })
        
        y -= 10
        if (client.name) {
          qrPage.drawText(client.name, { x: receiptX, y, size: 8, font })
          y -= 10
          if (client.address) qrPage.drawText(client.address, { x: receiptX, y, size: 8, font })
          y -= 10
          qrPage.drawText(`${client.postal_code || ''} ${client.city || ''}`, { x: receiptX, y, size: 8, font })
        }
        
        // === PAYMENT PART SECTION (RIGHT) ===
        y = qrBillStartY + qrBillHeight - 10 * mm
        
        qrPage.drawText(t.paymentPart || 'Payment part', { 
          x: paymentX, 
          y, 
          size: 11, 
          font: fontBold 
        })
        
        // Draw QR Code
        const qrSize = 46 * mm
        const qrX = paymentX + 5 * mm
        const qrY = qrBillStartY + 17 * mm
        
        qrPage.drawImage(qrCodeImage, {
          x: qrX,
          y: qrY,
          width: qrSize,
          height: qrSize
        })
        
        // Draw Swiss Cross in center of QR Code
        const crossSize = 7 * mm
        const crossX = qrX + (qrSize - crossSize) / 2
        const crossY = qrY + (qrSize - crossSize) / 2
        
        // White background for cross
        qrPage.drawRectangle({
          x: crossX,
          y: crossY,
          width: crossSize,
          height: crossSize,
          color: rgb(1, 1, 1)
        })
        
        // Draw cross
        const crossThick = 1.4 * mm
        qrPage.drawRectangle({
          x: crossX + (crossSize - crossThick) / 2,
          y: crossY + crossSize * 0.2,
          width: crossThick,
          height: crossSize * 0.6,
          color: rgb(0, 0, 0)
        })
        qrPage.drawRectangle({
          x: crossX + crossSize * 0.2,
          y: crossY + (crossSize - crossThick) / 2,
          width: crossSize * 0.6,
          height: crossThick,
          color: rgb(0, 0, 0)
        })
        
        // Currency and Amount (right of QR)
        const amountX = qrX + qrSize + 5 * mm
        let amountY = qrY + qrSize - 10 * mm
        
        qrPage.drawText(t.currency || 'Currency', { 
          x: amountX, 
          y: amountY, 
          size: 6, 
          font: fontBold 
        })
        amountY -= 10
        qrPage.drawText(invoice.currency || 'CHF', { 
          x: amountX, 
          y: amountY, 
          size: 8, 
          font 
        })
        
        amountY -= 15
        qrPage.drawText(t.amount || 'Amount', { 
          x: amountX, 
          y: amountY, 
          size: 6, 
          font: fontBold 
        })
        amountY -= 10
        qrPage.drawText(`${invoice.total.toFixed(2)}`, { 
          x: amountX, 
          y: amountY, 
          size: 10, 
          font: fontBold 
        })
        
        // Account / Payable to (below QR)
        y = qrY - 5 * mm
        
        qrPage.drawText(t.accountPayableTo || 'Account / Payable to', { 
          x: amountX, 
          y, 
          size: 6, 
          font: fontBold 
        })
        
        y -= 10
        qrPage.drawText(company.iban || '', { x: amountX, y, size: 8, font })
        y -= 10
        qrPage.drawText(company.company_name || '', { x: amountX, y, size: 8, font })
        y -= 10
        if (company.address) qrPage.drawText(company.address, { x: amountX, y, size: 8, font })
        y -= 10
        qrPage.drawText(`${company.postal_code || ''} ${company.city || ''}`, { x: amountX, y, size: 8, font })
        
        // Payable by
        y = qrBillStartY + 10 * mm
        
        qrPage.drawText(t.payableBy || 'Payable by', { 
          x: amountX, 
          y, 
          size: 6, 
          font: fontBold 
        })
        
        y -= 10
        if (client.name) {
          qrPage.drawText(client.name, { x: amountX, y, size: 8, font })
          y -= 10
          if (client.address) qrPage.drawText(client.address, { x: amountX, y, size: 8, font })
          y -= 10
          qrPage.drawText(`${client.postal_code || ''} ${client.city || ''}`, { x: amountX, y, size: 8, font })
        }
        
        // Separation line
        qrPage.drawLine({
          start: { x: 62 * mm, y: 0 },
          end: { x: 62 * mm, y: qrBillHeight },
          thickness: 0.5,
          color: rgb(0, 0, 0),
          dashArray: [2, 2]
        })
        
        // Horizontal separation line
        qrPage.drawLine({
          start: { x: 0, y: qrBillHeight },
          end: { x: 210 * mm, y: qrBillHeight },
          thickness: 0.5,
          color: rgb(0, 0, 0),
          dashArray: [2, 2]
        })
        
        console.log('=== ✅ Swiss QR Bill drawn manually! ===')
      }
    } catch (error) {
      console.error('=== ❌ ERROR creating Swiss QR Bill ===')
      console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error)
      console.error('Error message:', error instanceof Error ? error.message : String(error))
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
      console.error('Continuing without QR Bill...')
    }

    const pdfBytes = await pdfDoc.save()

    console.log('PDF generated successfully, size:', pdfBytes.length)

    // Convert Uint8Array to Buffer for NextResponse
    const pdfBuffer = Buffer.from(pdfBytes)

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${t.invoice.toLowerCase()}-${invoice.invoice_number}.pdf"`,
        'Content-Length': String(pdfBytes.length)
      },
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    return NextResponse.json(
      { error: 'Error generating PDF', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

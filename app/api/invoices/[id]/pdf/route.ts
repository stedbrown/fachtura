import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { SwissQRBill as SwissQRBillPDF } from 'swissqrbill/pdf'
import PDFKit from 'pdfkit'
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
  
  // Remove common prefixes for cleaner display
  return website
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .trim()
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const locale = searchParams.get('locale') || 'it'
    const t = getPDFTranslations(locale)
    const dateLocale = localeMap[locale] || it
    const supabase = await createClient()

    // Get user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get invoice with relations
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(
        `
        *,
        client:clients(*)
      `
      )
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      )
    }

    // Get invoice items
    const { data: items } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', id)
      .order('created_at')

    // Get company settings
    const { data: company } = await supabase
      .from('company_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!company || !company.iban) {
      return NextResponse.json(
        { error: 'Company settings or IBAN not configured' },
        { status: 400 }
      )
    }

    // Create PDF with pdf-lib
    const pdfDoc = await PDFDocument.create()
    
    // Use standard PDF fonts (always available, no external loading needed)
    const page = pdfDoc.addPage([595, 842]) // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    // Swiss QR Bill height is 297pt, so we have 545pt available for invoice content
    const qrBillHeight = 297
    const availableHeight = 842 - qrBillHeight // 545pt
    
    let yPosition = 842 - 50 // Start from top with margin

    // Logo (if exists) - top right corner
    if (company.logo_url) {
      try {
        const logoResponse = await fetch(company.logo_url)
        const logoBuffer = await logoResponse.arrayBuffer()
        
        let logoImage
        if (company.logo_url.endsWith('.png')) {
          logoImage = await pdfDoc.embedPng(logoBuffer)
        } else if (company.logo_url.endsWith('.jpg') || company.logo_url.endsWith('.jpeg')) {
          logoImage = await pdfDoc.embedJpg(logoBuffer)
        }
        
        if (logoImage) {
          const logoHeight = 60
          const logoWidth = (logoImage.width / logoImage.height) * logoHeight
          
          page.drawImage(logoImage, {
            x: 545 - logoWidth,
            y: yPosition - logoHeight + 20,
            width: logoWidth,
            height: logoHeight,
          })
        }
      } catch (error) {
        console.error('Error loading logo:', error)
      }
    }

    // Header - Swiss Design: minimal and precise
    page.drawText(company.company_name, {
      x: 50,
      y: yPosition,
      size: 18,
      font: fontBold,
    })
    yPosition -= 20

    // Company address block
    const infoX = 50
    if (company.address) {
      page.drawText(company.address, { x: infoX, y: yPosition, size: 8, font })
      yPosition -= 11
    }

    if (company.postal_code && company.city) {
      page.drawText(`${company.postal_code} ${company.city}`, {
        x: infoX,
        y: yPosition,
        size: 8,
        font,
      })
      yPosition -= 16
    }

    // Contact information - compact
    const contactInfo = []
    if (company.phone) contactInfo.push(`${t.phone} ${company.phone}`)
    if (company.email) contactInfo.push(`${t.email} ${company.email}`)
    if (company.website) contactInfo.push(`${t.website} ${cleanWebsiteForDisplay(company.website)}`)
    if (company.vat_number) contactInfo.push(`${t.vatNumber} ${company.vat_number}`)
    
    if (contactInfo.length > 0) {
      page.drawText(contactInfo.join('  ·  '), { x: infoX, y: yPosition, size: 7, font, color: rgb(0.4, 0.4, 0.4) })
      yPosition -= 25
    } else {
      yPosition -= 15
    }

    // Subtle separator line
    page.drawLine({
      start: { x: 50, y: yPosition },
      end: { x: 545, y: yPosition },
      thickness: 0.25,
      color: rgb(0, 0, 0),
    })
    yPosition -= 20

    // Invoice Title - Swiss: uppercase, no color
    page.drawText(t.invoice, {
      x: 50,
      y: yPosition,
      size: 11,
      font: fontBold,
    })
    
    page.drawText(invoice.invoice_number, {
      x: 110,
      y: yPosition,
      size: 11,
      font: font,
    })
    
    // Dates aligned right
    page.drawText(format(new Date(invoice.date), 'dd.MM.yyyy', { locale: dateLocale }), {
      x: 490,
      y: yPosition,
      size: 9,
      font,
    })
    yPosition -= 12

    if (invoice.due_date) {
      // Calculate text width to position correctly
      const dueDateLabel = t.dueDate.toUpperCase()
      const labelWidth = font.widthOfTextAtSize(dueDateLabel, 7)
      page.drawText(dueDateLabel, {
        x: 545 - 55 - labelWidth,
        y: yPosition,
        size: 7,
        font,
        color: rgb(0.5, 0.5, 0.5),
      })
      page.drawText(format(new Date(invoice.due_date), 'dd.MM.yyyy', { locale: dateLocale }), {
        x: 490,
        y: yPosition,
        size: 9,
        font,
      })
      yPosition -= 20
    } else {
      yPosition -= 10
    }

    // Client info - minimal
    page.drawText(invoice.client.name, { x: 50, y: yPosition, size: 10, font: fontBold })
    yPosition -= 13

    if (invoice.client.address) {
      page.drawText(invoice.client.address, { x: 50, y: yPosition, size: 8, font })
      yPosition -= 11
    }
    if (invoice.client.postal_code && invoice.client.city) {
      page.drawText(`${invoice.client.postal_code} ${invoice.client.city}`, {
        x: 50,
        y: yPosition,
        size: 8,
        font,
      })
      yPosition -= 20
    }

    // Table - Swiss Design: minimal, grid-based
    const tableY = yPosition
    
    // Table header - uppercase, no background
    page.drawText(t.description.toUpperCase(), { x: 50, y: tableY, size: 7, font: fontBold })
    page.drawText(t.qtyShort.toUpperCase(), { x: 360, y: tableY, size: 7, font: fontBold })
    page.drawText(t.unitPrice.toUpperCase(), { x: 420, y: tableY, size: 7, font: fontBold })
    page.drawText(t.taxRate.toUpperCase(), { x: 480, y: tableY, size: 7, font: fontBold })
    page.drawText(t.total.toUpperCase(), { x: 515, y: tableY, size: 7, font: fontBold })
    yPosition -= 10

    // Single header line
    page.drawLine({
      start: { x: 50, y: yPosition },
      end: { x: 545, y: yPosition },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    })
    yPosition -= 8

    // Table items - clean, no backgrounds
    items?.forEach((item) => {
      const desc = item.description.length > 45 ? item.description.substring(0, 45) + '...' : item.description
      
      page.drawText(desc, { x: 50, y: yPosition, size: 8, font })
      
      // Right-aligned numbers
      const qtyText = item.quantity.toString()
      const qtyWidth = font.widthOfTextAtSize(qtyText, 8)
      page.drawText(qtyText, { x: 390 - qtyWidth, y: yPosition, size: 8, font })
      
      const priceText = item.unit_price.toFixed(2)
      const priceWidth = font.widthOfTextAtSize(priceText, 8)
      page.drawText(priceText, { x: 465 - priceWidth, y: yPosition, size: 8, font })
      
      const taxText = `${item.tax_rate}%`
      const taxWidth = font.widthOfTextAtSize(taxText, 8)
      page.drawText(taxText, { x: 505 - taxWidth, y: yPosition, size: 8, font })
      
      const totalText = item.line_total.toFixed(2)
      const totalWidth = font.widthOfTextAtSize(totalText, 8)
      page.drawText(totalText, { x: 545 - totalWidth, y: yPosition, size: 8, font })
      
      yPosition -= 12
    })
    
    // Table bottom line
    page.drawLine({
      start: { x: 50, y: yPosition + 8 },
      end: { x: 545, y: yPosition + 8 },
      thickness: 0.25,
      color: rgb(0, 0, 0),
    })

    // Totals - Swiss: minimal, precise alignment
    yPosition -= 10
    
    // Subtotal
    page.drawText(t.subtotal, { x: 420, y: yPosition, size: 8, font, color: rgb(0.4, 0.4, 0.4) })
    const subtotalText = `CHF ${invoice.subtotal.toFixed(2)}`
    const subtotalWidth = font.widthOfTextAtSize(subtotalText, 8)
    page.drawText(subtotalText, { x: 545 - subtotalWidth, y: yPosition, size: 8, font })
    yPosition -= 11
    
    // Tax
    page.drawText(t.tax, { x: 420, y: yPosition, size: 8, font, color: rgb(0.4, 0.4, 0.4) })
    const taxAmountText = `CHF ${invoice.tax_amount.toFixed(2)}`
    const taxAmountWidth = font.widthOfTextAtSize(taxAmountText, 8)
    page.drawText(taxAmountText, { x: 545 - taxAmountWidth, y: yPosition, size: 8, font })
    yPosition -= 15
    
    // Total line separator
    page.drawLine({
      start: { x: 420, y: yPosition },
      end: { x: 545, y: yPosition },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    })
    yPosition -= 10
    
    // Total - emphasis through size only
    page.drawText(t.grandTotal.toUpperCase(), { x: 420, y: yPosition, size: 10, font: fontBold })
    const totalText = `CHF ${invoice.total.toFixed(2)}`
    const totalWidth = fontBold.widthOfTextAtSize(totalText, 12)
    page.drawText(totalText, { x: 545 - totalWidth, y: yPosition, size: 12, font: fontBold })

    // Helper function to split text into lines
    const splitTextIntoLines = (text: string, maxLength: number = 80): string[] => {
      const lines: string[] = []
      let currentLine = ''
      text.split(' ').forEach((word: string) => {
        if ((currentLine + word).length > maxLength) {
          lines.push(currentLine.trim())
          currentLine = word + ' '
        } else {
          currentLine += word + ' '
        }
      })
      if (currentLine) lines.push(currentLine.trim())
      return lines
    }

    // Notes (from invoice, or fallback to company default notes)
    const displayNotes = invoice.notes || company.invoice_default_notes
    if (displayNotes && yPosition > 330) {
      yPosition -= 40
      page.drawText(`${t.notes}:`, { x: 50, y: yPosition, size: 10, font: fontBold })
      yPosition -= 15
      
      const noteLines = splitTextIntoLines(displayNotes)
      noteLines.slice(0, 2).forEach(line => {
        if (yPosition > 330) {
          page.drawText(line, { x: 50, y: yPosition, size: 9, font })
          yPosition -= 12
        }
      })
    }

    // Payment Terms (from company settings)
    if (company.invoice_payment_terms && yPosition > 330) {
      yPosition -= 20
      page.drawText(t.paymentTerms || 'Payment Terms', { x: 50, y: yPosition, size: 9, font: fontBold })
      yPosition -= 12
      
      const termsLines = splitTextIntoLines(company.invoice_payment_terms, 90)
      termsLines.slice(0, 3).forEach(line => {
        if (yPosition > 330) {
          page.drawText(line, { x: 50, y: yPosition, size: 8, font, color: rgb(0.3, 0.3, 0.3) })
          yPosition -= 10
        }
      })
    }

    // Footer Text (from company settings)
    if (company.invoice_footer_text && yPosition > 330) {
      yPosition -= 15
      const footerLines = splitTextIntoLines(company.invoice_footer_text, 90)
      footerLines.slice(0, 2).forEach(line => {
        if (yPosition > 330) {
          page.drawText(line, { x: 50, y: yPosition, size: 8, font, color: rgb(0.4, 0.4, 0.4) })
          yPosition -= 10
        }
      })
    }

    // Generate Swiss QR Bill using official swissqrbill/svg library
    const qrBillData = {
      amount: invoice.total,
      currency: 'CHF' as const,
      creditor: {
        account: company.iban.replace(/\s/g, ''),
        name: company.company_name,
        address: company.address || '',
        zip: parseInt(company.postal_code || '0'),
        city: company.city || '',
        country: getCountryCode(company.country),
      },
      debtor: {
        name: invoice.client.name,
        address: invoice.client.address || '',
        zip: parseInt(invoice.client.postal_code || '0'),
        city: invoice.client.city || '',
        country: getCountryCode(invoice.client.country),
      },
      message: `${t.qrInvoiceMessage} ${invoice.invoice_number}`,
    }

    // Map locale to Swiss QR Bill language codes
    const qrLanguageMap: Record<string, 'DE' | 'FR' | 'IT' | 'EN'> = {
      'it': 'IT',
      'de': 'DE',
      'fr': 'FR',
      'en': 'EN',
      'rm': 'DE', // Romansh uses German labels in Swiss QR bills
    }
    const qrLanguage = qrLanguageMap[locale] || 'IT'

    // Generate Swiss QR Bill using swissqrbill/pdf (PDFKit) which has proper font support
    // Then embed it into our main PDF
    const qrBillPdf = new PDFKit({
      size: [595.28, 841.89], // A4 in points
      margin: 0
    })
    
    const qrBillBufferChunks: Buffer[] = []
    qrBillPdf.on('data', (chunk) => qrBillBufferChunks.push(chunk))
    
    const qrBillPdfGenerated = new Promise<Buffer>((resolve, reject) => {
      qrBillPdf.on('end', () => resolve(Buffer.concat(qrBillBufferChunks)))
      qrBillPdf.on('error', reject)
    })
    
    // Attach Swiss QR Bill to PDFKit document
    const swissQRBill = new SwissQRBillPDF(qrBillData, {
      language: qrLanguage,
      outlines: false,
      scissors: false,
    })
    
    console.log('Generating QR Bill with PDFKit...')
    swissQRBill.attachTo(qrBillPdf)
    qrBillPdf.end()
    
    const qrBillPdfBuffer = await qrBillPdfGenerated
    console.log('QR Bill PDF generated, size:', qrBillPdfBuffer.length)
    
    // Load the QR Bill PDF generated by PDFKit
    const qrBillPdfDoc = await PDFDocument.load(qrBillPdfBuffer)
    const qrBillPages = await pdfDoc.copyPages(qrBillPdfDoc, [0])
    const embeddedQRBillPage = qrBillPages[0]
    
    console.log('QR Bill page copied, drawing at bottom of invoice...')
    
    // Draw the QR Bill page at the bottom of our invoice (last 297pt)
    // Swiss QR Bill occupies bottom 297pt of A4 page
    const qrBillBottom = 0
    const qrBillTop = qrBillHeight // 297pt
    
    // Draw the QR Bill page, cropped to show only bottom 297pt
    page.drawPage(embeddedQRBillPage, {
      x: 0,
      y: qrBillBottom,
      width: 595,
      height: qrBillHeight,
      // Crop to show only the bottom part (QR Bill section)
      xOffset: 0,
      yOffset: 842 - qrBillHeight  // Offset to get bottom 297pt of A4 page
    })
    
    console.log('QR Bill embedded in invoice')
    
    // Add dashed lines manually in correct positions (as per Swiss standard)
    // Horizontal line at top of QR Bill section
    page.drawLine({
      start: { x: 0, y: qrBillTop },
      end: { x: 595, y: qrBillTop },
      thickness: 0.5,
      dashArray: [4, 2],
      color: rgb(0, 0, 0),
    })
    
    // Vertical line between Receipt (62mm) and Payment Part
    // 62mm = 175.75pt from left
    const separatorX = 175.75
    page.drawLine({
      start: { x: separatorX, y: qrBillBottom },
      end: { x: separatorX, y: qrBillTop },
      thickness: 0.5,
      dashArray: [4, 2],
      color: rgb(0, 0, 0),
    })
    
    // Add a note if content is too long (optional warning in console)
    const minYPosition = qrBillTop + 20 // Leave 20pt margin above QR Bill
    if (yPosition < minYPosition) {
      console.warn('Invoice content may overlap with QR Bill. Consider using multiple pages for long invoices.')
    }

    const pdfBytes = await pdfDoc.save()

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${t.invoice.toLowerCase()}-${invoice.invoice_number}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    return NextResponse.json(
      { error: 'Error generating PDF', details: error },
      { status: 500 }
    )
  }
}

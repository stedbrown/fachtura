import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
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

    // Get quote with relations
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select(`
        *,
        client:clients(*)
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (quoteError || !quote) {
      return NextResponse.json(
        { error: 'Quote not found' },
        { status: 404 }
      )
    }

    // Get quote items
    const { data: items } = await supabase
      .from('quote_items')
      .select('*')
      .eq('quote_id', id)
      .order('created_at')

    // Get company settings
    const { data: company } = await supabase
      .from('company_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!company) {
      return NextResponse.json(
        { error: 'Company settings not configured' },
        { status: 400 }
      )
    }

    // Create PDF
    const pdfDoc = await PDFDocument.create()
    
    // Register fontkit to support custom fonts
    pdfDoc.registerFontkit(fontkit)
    
    // Load custom fonts (Roboto supports Italian accented characters)
    // Use fetch instead of fs.readFileSync for Vercel compatibility
    const fontRegularUrl = new URL('/fonts/Roboto-Regular.ttf', request.url).href
    const fontBoldUrl = new URL('/fonts/Roboto-Bold.ttf', request.url).href
    
    const [fontRegularResponse, fontBoldResponse] = await Promise.all([
      fetch(fontRegularUrl),
      fetch(fontBoldUrl)
    ])
    
    const fontRegularBytes = new Uint8Array(await fontRegularResponse.arrayBuffer())
    const fontBoldBytes = new Uint8Array(await fontBoldResponse.arrayBuffer())
    
    const page = pdfDoc.addPage([595, 842]) // A4 size
    const font = await pdfDoc.embedFont(fontRegularBytes)
    const fontBold = await pdfDoc.embedFont(fontBoldBytes)

    const { width, height } = page.getSize()
    let yPosition = height - 50

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
      page.drawText(company.address, { x: infoX, y: yPosition, size: 8, font: font })
      yPosition -= 11
    }

    if (company.postal_code && company.city) {
      page.drawText(`${company.postal_code} ${company.city}`, {
        x: infoX,
        y: yPosition,
        size: 8,
        font: font,
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
      page.drawText(contactInfo.join('  ·  '), { x: infoX, y: yPosition, size: 7, font: font, color: rgb(0.4, 0.4, 0.4) })
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

    // Quote Title - Swiss: uppercase, no color
    page.drawText(t.quote, {
      x: 50,
      y: yPosition,
      size: 11,
      font: fontBold,
    })
    
    page.drawText(quote.quote_number, {
      x: 130,
      y: yPosition,
      size: 11,
      font: font,
    })

    // Dates aligned right
    page.drawText(format(new Date(quote.date), 'dd.MM.yyyy', { locale: dateLocale }), {
      x: 490,
      y: yPosition,
      size: 9,
      font: font,
    })
    yPosition -= 12

    if (quote.valid_until) {
      // Calculate text width to position correctly
      const validUntilLabel = t.validUntil.toUpperCase()
      const labelWidth = font.widthOfTextAtSize(validUntilLabel, 7)
      page.drawText(validUntilLabel, {
        x: 545 - 55 - labelWidth,
        y: yPosition,
        size: 7,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
      })
      page.drawText(format(new Date(quote.valid_until), 'dd.MM.yyyy', { locale: dateLocale }), {
        x: 490,
        y: yPosition,
        size: 9,
        font: font,
      })
      yPosition -= 20
    } else {
      yPosition -= 10
    }

    // Client info - minimal
    page.drawText(quote.client.name, { x: 50, y: yPosition, size: 10, font: fontBold })
    yPosition -= 13

    if (quote.client.address) {
      page.drawText(quote.client.address, { x: 50, y: yPosition, size: 8, font: font })
      yPosition -= 11
    }
    if (quote.client.postal_code && quote.client.city) {
      page.drawText(`${quote.client.postal_code} ${quote.client.city}`, {
        x: 50,
        y: yPosition,
        size: 8,
        font: font,
      })
      yPosition -= 20
    }

    // Table - Swiss Design: minimal, grid-based
    const tableTop = yPosition
    
    // Table header - uppercase, no background
    page.drawText(t.description.toUpperCase(), { x: 50, y: tableTop, size: 7, font: fontBold })
    page.drawText(t.qtyShort.toUpperCase(), { x: 360, y: tableTop, size: 7, font: fontBold })
    page.drawText(t.unitPrice.toUpperCase(), { x: 420, y: tableTop, size: 7, font: fontBold })
    page.drawText(t.taxRate.toUpperCase(), { x: 480, y: tableTop, size: 7, font: fontBold })
    page.drawText(t.total.toUpperCase(), { x: 515, y: tableTop, size: 7, font: fontBold })
    yPosition -= 10

    // Single header line
    page.drawLine({
      start: { x: 50, y: yPosition },
      end: { x: 545, y: yPosition },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    })
    yPosition -= 8

    // Items - clean, no backgrounds
    items?.forEach((item) => {
      const maxLength = 45
      const description = item.description.length > maxLength 
        ? item.description.substring(0, maxLength) + '...'
        : item.description

      page.drawText(description, { x: 50, y: yPosition, size: 8, font: font })
      
      // Right-aligned numbers
      const qtyText = item.quantity.toString()
      const qtyWidth = font.widthOfTextAtSize(qtyText, 8)
      page.drawText(qtyText, { x: 390 - qtyWidth, y: yPosition, size: 8, font: font })
      
      const priceText = item.unit_price.toFixed(2)
      const priceWidth = font.widthOfTextAtSize(priceText, 8)
      page.drawText(priceText, { x: 465 - priceWidth, y: yPosition, size: 8, font: font })
      
      const taxText = `${item.tax_rate}%`
      const taxWidth = font.widthOfTextAtSize(taxText, 8)
      page.drawText(taxText, { x: 505 - taxWidth, y: yPosition, size: 8, font: font })
      
      const totalText = item.line_total.toFixed(2)
      const totalWidth = font.widthOfTextAtSize(totalText, 8)
      page.drawText(totalText, { x: 545 - totalWidth, y: yPosition, size: 8, font: font })
      
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
    page.drawText(t.subtotal, { x: 420, y: yPosition, size: 8, font: font, color: rgb(0.4, 0.4, 0.4) })
    const subtotalText = `CHF ${quote.subtotal.toFixed(2)}`
    const subtotalWidth = font.widthOfTextAtSize(subtotalText, 8)
    page.drawText(subtotalText, { x: 545 - subtotalWidth, y: yPosition, size: 8, font: font })
    yPosition -= 11
    
    // Tax
    page.drawText(t.tax, { x: 420, y: yPosition, size: 8, font: font, color: rgb(0.4, 0.4, 0.4) })
    const taxAmountText = `CHF ${quote.tax_amount.toFixed(2)}`
    const taxAmountWidth = font.widthOfTextAtSize(taxAmountText, 8)
    page.drawText(taxAmountText, { x: 545 - taxAmountWidth, y: yPosition, size: 8, font: font })
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
    const totalText = `CHF ${quote.total.toFixed(2)}`
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

    // Notes (from quote, or fallback to company default notes)
    const displayNotes = quote.notes || company.quote_default_notes
    if (displayNotes && yPosition > 150) {
      yPosition -= 40
      page.drawText(`${t.notes}:`, { x: 50, y: yPosition, size: 10, font: fontBold })
      yPosition -= 15
      
      const noteLines = splitTextIntoLines(displayNotes)
      noteLines.slice(0, 3).forEach(line => {
        page.drawText(line, { x: 50, y: yPosition, size: 9, font: font })
        yPosition -= 12
      })
    }

    // Terms & Conditions (from company settings)
    if (company.quote_terms_conditions && yPosition > 150) {
      yPosition -= 25
      page.drawText(t.termsConditions || 'Terms & Conditions', { x: 50, y: yPosition, size: 9, font: fontBold })
      yPosition -= 12
      
      const termsLines = splitTextIntoLines(company.quote_terms_conditions, 90)
      termsLines.slice(0, 5).forEach(line => {
        if (yPosition > 150) {
          page.drawText(line, { x: 50, y: yPosition, size: 8, font: font, color: rgb(0.3, 0.3, 0.3) })
          yPosition -= 10
        }
      })
    }

    // Footer Text (from company settings)
    if (company.quote_footer_text && yPosition > 150) {
      yPosition -= 20
      const footerLines = splitTextIntoLines(company.quote_footer_text, 90)
      footerLines.slice(0, 2).forEach(line => {
        if (yPosition > 150) {
          page.drawText(line, { x: 50, y: yPosition, size: 8, font: font, color: rgb(0.4, 0.4, 0.4) })
          yPosition -= 10
        }
      })
    }

    // Acceptance Section - check if we need a new page
    const acceptanceSectionHeight = 140
    if (yPosition < acceptanceSectionHeight + 60) {
      // Add new page if not enough space
      const newPage = pdfDoc.addPage([595, 842])
      yPosition = height - 50
      
      // Acceptance Section on new page
      newPage.drawText(t.acceptance.toUpperCase(), { 
        x: 50, 
        y: yPosition, 
        size: 11, 
        font: fontBold 
      })
      yPosition -= 25
      
      // Acceptance checkbox
      newPage.drawRectangle({
        x: 50,
        y: yPosition - 10,
        width: 12,
        height: 12,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      })
      newPage.drawText(t.accept, { 
        x: 70, 
        y: yPosition - 8, 
        size: 9, 
        font: font 
      })
      yPosition -= 25
      
      // Rejection checkbox
      newPage.drawRectangle({
        x: 50,
        y: yPosition - 10,
        width: 12,
        height: 12,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      })
      newPage.drawText(t.reject, { 
        x: 70, 
        y: yPosition - 8, 
        size: 9, 
        font: font 
      })
      yPosition -= 35
      
      // Signature section
      newPage.drawLine({
        start: { x: 50, y: yPosition },
        end: { x: 545, y: yPosition },
        thickness: 0.5,
        color: rgb(0.7, 0.7, 0.7),
      })
      yPosition -= 20
      
      // Signature fields
      newPage.drawText(t.signature, { 
        x: 50, 
        y: yPosition, 
        size: 9, 
        font: fontBold,
        color: rgb(0.3, 0.3, 0.3)
      })
      
      newPage.drawText(t.signaturePlace, { 
        x: 250, 
        y: yPosition, 
        size: 9, 
        font: fontBold,
        color: rgb(0.3, 0.3, 0.3)
      })
      
      newPage.drawText(t.signatureDate, { 
        x: 420, 
        y: yPosition, 
        size: 9, 
        font: fontBold,
        color: rgb(0.3, 0.3, 0.3)
      })
      yPosition -= 5
      
      // Signature lines
      newPage.drawLine({
        start: { x: 50, y: yPosition },
        end: { x: 220, y: yPosition },
        thickness: 0.5,
        color: rgb(0, 0, 0),
      })
      
      newPage.drawLine({
        start: { x: 250, y: yPosition },
        end: { x: 390, y: yPosition },
        thickness: 0.5,
        color: rgb(0, 0, 0),
      })
      
      newPage.drawLine({
        start: { x: 420, y: yPosition },
        end: { x: 545, y: yPosition },
        thickness: 0.5,
        color: rgb(0, 0, 0),
      })
    } else {
      // Acceptance section on same page
      yPosition -= 40
      
      page.drawText(t.acceptance.toUpperCase(), { 
        x: 50, 
        y: yPosition, 
        size: 11, 
        font: fontBold 
      })
      yPosition -= 25
      
      // Acceptance checkbox
      page.drawRectangle({
        x: 50,
        y: yPosition - 10,
        width: 12,
        height: 12,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      })
      page.drawText(t.accept, { 
        x: 70, 
        y: yPosition - 8, 
        size: 9, 
        font: font 
      })
      yPosition -= 25
      
      // Rejection checkbox
      page.drawRectangle({
        x: 50,
        y: yPosition - 10,
        width: 12,
        height: 12,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
      })
      page.drawText(t.reject, { 
        x: 70, 
        y: yPosition - 8, 
        size: 9, 
        font: font 
      })
      yPosition -= 35
      
      // Signature section
      page.drawLine({
        start: { x: 50, y: yPosition },
        end: { x: 545, y: yPosition },
        thickness: 0.5,
        color: rgb(0.7, 0.7, 0.7),
      })
      yPosition -= 20
      
      // Signature fields
      page.drawText(t.signature, { 
        x: 50, 
        y: yPosition, 
        size: 9, 
        font: fontBold,
        color: rgb(0.3, 0.3, 0.3)
      })
      
      page.drawText(t.signaturePlace, { 
        x: 250, 
        y: yPosition, 
        size: 9, 
        font: fontBold,
        color: rgb(0.3, 0.3, 0.3)
      })
      
      page.drawText(t.signatureDate, { 
        x: 420, 
        y: yPosition, 
        size: 9, 
        font: fontBold,
        color: rgb(0.3, 0.3, 0.3)
      })
      yPosition -= 5
      
      // Signature lines
      page.drawLine({
        start: { x: 50, y: yPosition },
        end: { x: 220, y: yPosition },
        thickness: 0.5,
        color: rgb(0, 0, 0),
      })
      
      page.drawLine({
        start: { x: 250, y: yPosition },
        end: { x: 390, y: yPosition },
        thickness: 0.5,
        color: rgb(0, 0, 0),
      })
      
      page.drawLine({
        start: { x: 420, y: yPosition },
        end: { x: 545, y: yPosition },
        thickness: 0.5,
        color: rgb(0, 0, 0),
      })
    }

    const pdfBytes = await pdfDoc.save()

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${t.quote.toLowerCase()}-${quote.quote_number}.pdf"`,
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


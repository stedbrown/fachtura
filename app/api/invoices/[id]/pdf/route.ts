import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { SwissQRBill as SwissQRBillSVG } from 'swissqrbill/svg'
import sharp from 'sharp'
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
      .select('*')
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
          const logoDims = logoImage.scale(0.3)
          page.drawImage(logoImage, {
            x: 450,
            y: yPosition - 60,
            width: logoDims.width,
            height: logoDims.height,
          })
        }
      } catch (error) {
        console.error('Error loading logo:', error)
      }
    }

    // Company info
    page.drawText(company.name || '', { x: 50, y: yPosition, size: 11, font: fontBold, color: rgb(0, 0, 0) })
    yPosition -= 15
    
    if (company.address) {
      page.drawText(company.address, { x: 50, y: yPosition, size: 9, font, color: rgb(0, 0, 0) })
      yPosition -= 12
    }
    
    const cityLine = [company.zip, company.city].filter(Boolean).join(' ')
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

    page.drawText(invoice.customer_name || '', { x: 50, y: yPosition, size: 10, font, color: rgb(0, 0, 0) })
    yPosition -= 15

    if (invoice.customer_address) {
      page.drawText(invoice.customer_address, { x: 50, y: yPosition, size: 9, font, color: rgb(0, 0, 0) })
      yPosition -= 12
    }

    const customerCityLine = [invoice.customer_zip, invoice.customer_city].filter(Boolean).join(' ')
    if (customerCityLine) {
      page.drawText(customerCityLine, { x: 50, y: yPosition, size: 9, font, color: rgb(0, 0, 0) })
      yPosition -= 12
    }

    if (invoice.customer_country) {
      page.drawText(invoice.customer_country, { x: 50, y: yPosition, size: 9, font, color: rgb(0, 0, 0) })
      yPosition -= 12
    }

    yPosition -= 30

    // Invoice title
    page.drawText(t.invoice.toUpperCase(), { x: 50, y: yPosition, size: 20, font: fontBold, color: rgb(0, 0, 0) })
    yPosition -= 30

    // Invoice details
    const details = [
      `${t.invoiceNumber}: ${invoice.invoice_number}`,
      `${t.date}: ${format(new Date(invoice.issue_date), 'dd MMMM yyyy', { locale: dateLocale })}`,
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
    const items = invoice.items || []
    items.forEach((item: any) => {
      const itemTotal = (item.quantity || 0) * (item.unit_price || 0)
      
      page.drawText(item.code || '-', { x: itemCodeX, y: yPosition, size: 9, font, color: rgb(0, 0, 0) })
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
    console.log('Adding Swiss QR Bill with OFFICIAL library (SVG)...')

    try {
      // Build QR Bill data
      const creditorData: any = {
        name: company.name || '',
        address: company.address || '',
        city: company.city || '',
        account: company.iban || '',
        country: getCountryCode(company.country)
      }
      
      if (company.zip) {
        creditorData.zip = typeof company.zip === 'number' ? company.zip : parseInt(String(company.zip))
      }

      const debtorData: any = {
        name: invoice.customer_name || '',
        address: invoice.customer_address || '',
        city: invoice.customer_city || '',
        country: getCountryCode(invoice.customer_country)
      }
      
      if (invoice.customer_zip) {
        debtorData.zip = typeof invoice.customer_zip === 'number' ? invoice.customer_zip : parseInt(String(invoice.customer_zip))
      }

      const qrBillData: any = {
        currency: invoice.currency || 'CHF',
        amount: invoice.total,
        creditor: creditorData,
        debtor: debtorData,
        message: `${t.invoice} ${invoice.invoice_number}`
      }

      if (invoice.invoice_number) {
        const reference = invoice.invoice_number.replace(/[^0-9]/g, '').padStart(27, '0')
        if (reference) {
          qrBillData.reference = reference
        }
      }

      // Generate Swiss QR Bill as SVG with OFFICIAL library
      const swissQRBill = new SwissQRBillSVG(qrBillData, {
        language: locale === 'de' ? 'DE' : locale === 'fr' ? 'FR' : locale === 'it' ? 'IT' : 'EN'
      })

      // Get SVG string
      const svgString = swissQRBill.toString()
      console.log('Swiss QR Bill SVG generated, length:', svgString.length)

      // Convert SVG to PNG using Sharp
      const qrBillPng = await sharp(Buffer.from(svgString))
        .resize(2100, 991) // Swiss QR Bill size in pixels
        .png()
        .toBuffer()

      console.log('Swiss QR Bill converted to PNG, size:', qrBillPng.length)

      // Embed PNG in PDF
      const qrBillImage = await pdfDoc.embedPng(qrBillPng)
      
      // Add new page for QR Bill
      const qrPage = pdfDoc.addPage([595, 842])
      
      // Draw QR Bill at bottom of page (105mm = 297 points)
      const qrBillWidth = 595
      const qrBillHeight = 280
      
      qrPage.drawImage(qrBillImage, {
        x: 0,
        y: 0,
        width: qrBillWidth,
        height: qrBillHeight,
      })

      console.log('Swiss QR Bill added to PDF successfully')
    } catch (error) {
      console.error('Error creating Swiss QR Bill:', error)
      // Continue without QR Bill if it fails
    }

    const pdfBytes = await pdfDoc.save()

    console.log('PDF generated successfully, size:', pdfBytes.length)

    return new NextResponse(pdfBytes.buffer, {
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

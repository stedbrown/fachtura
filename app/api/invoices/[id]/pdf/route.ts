import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import PDFDocument from 'pdfkit'
import { SwissQRBill } from 'swissqrbill/pdf'
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
  let cleaned = website
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '') // Remove trailing slashes
  
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

    // Create PDF with PDFKit
    const pdf = new PDFDocument({ 
      size: 'A4',
      margin: 50,
      bufferPages: true
    })

    const chunks: Buffer[] = []
    
    pdf.on('data', (chunk: Buffer) => chunks.push(chunk))
    
    const pdfPromise = new Promise<Buffer>((resolve, reject) => {
      pdf.on('end', () => resolve(Buffer.concat(chunks)))
      pdf.on('error', reject)
    })

    // Header with logo and company info
    let yPosition = 50

    if (company.logo_url) {
      try {
        const logoResponse = await fetch(company.logo_url)
        const logoBuffer = await logoResponse.arrayBuffer()
        pdf.image(Buffer.from(logoBuffer), 400, yPosition, { 
          width: 150,
          fit: [150, 100]
        })
      } catch (error) {
        console.error('Error loading logo:', error)
      }
    }

    // Company info (left side)
    pdf.fontSize(10)
    pdf.font('Helvetica-Bold').text(company.name || '', 50, yPosition)
    yPosition += 15
    
    if (company.address) {
      pdf.font('Helvetica').text(company.address, 50, yPosition)
      yPosition += 12
    }
    
    const cityLine = [company.zip, company.city].filter(Boolean).join(' ')
    if (cityLine) {
      pdf.text(cityLine, 50, yPosition)
      yPosition += 12
    }
    
    if (company.country) {
      pdf.text(company.country, 50, yPosition)
      yPosition += 12
    }
    
    yPosition += 10
    
    if (company.vat_number) {
      pdf.text(`${t.vatNumber}: ${company.vat_number}`, 50, yPosition)
      yPosition += 12
    }
    
    if (company.email) {
      pdf.text(`${t.email}: ${company.email}`, 50, yPosition)
      yPosition += 12
    }
    
    if (company.phone) {
      pdf.text(`${t.phone}: ${company.phone}`, 50, yPosition)
      yPosition += 12
    }
    
    if (company.website) {
      const displayWebsite = cleanWebsiteForDisplay(company.website)
      pdf.text(`${t.website}: ${displayWebsite}`, 50, yPosition)
      yPosition += 12
    }

    yPosition += 30

    // Customer info
    pdf.fontSize(12)
    pdf.font('Helvetica-Bold').text(t.billTo, 50, yPosition)
    yPosition += 20

    pdf.fontSize(10)
    pdf.font('Helvetica').text(invoice.customer_name || '', 50, yPosition)
    yPosition += 15

    if (invoice.customer_address) {
      pdf.text(invoice.customer_address, 50, yPosition)
      yPosition += 12
    }

    const customerCityLine = [invoice.customer_zip, invoice.customer_city]
      .filter(Boolean)
      .join(' ')
    if (customerCityLine) {
      pdf.text(customerCityLine, 50, yPosition)
      yPosition += 12
    }

    if (invoice.customer_country) {
      pdf.text(invoice.customer_country, 50, yPosition)
      yPosition += 12
    }

    yPosition += 30

    // Invoice title and details
    pdf.fontSize(20)
    pdf.font('Helvetica-Bold').text(t.invoice.toUpperCase(), 50, yPosition)
    yPosition += 30

    pdf.fontSize(10)
    pdf.font('Helvetica')
    
    const details = [
      `${t.invoiceNumber}: ${invoice.invoice_number}`,
      `${t.date}: ${format(new Date(invoice.issue_date), 'dd MMMM yyyy', { locale: dateLocale })}`,
      invoice.due_date ? `${t.dueDate}: ${format(new Date(invoice.due_date), 'dd MMMM yyyy', { locale: dateLocale })}` : null,
    ].filter(Boolean)

    details.forEach(detail => {
      if (detail) {
        pdf.text(detail, 50, yPosition)
        yPosition += 15
      }
    })

    yPosition += 20

    // Items table
    const tableTop = yPosition
    const itemCodeX = 50
    const descriptionX = 120
    const quantityX = 350
    const priceX = 420
    const totalX = 490

    // Table header
    pdf.fontSize(10)
    pdf.font('Helvetica-Bold')
    pdf.text(t.itemCode, itemCodeX, tableTop)
    pdf.text(t.description, descriptionX, tableTop)
    pdf.text(t.quantity, quantityX, tableTop)
    pdf.text(t.price, priceX, tableTop)
    pdf.text(t.total, totalX, tableTop)

    yPosition = tableTop + 20

    // Draw header line
    pdf.moveTo(50, yPosition).lineTo(550, yPosition).stroke()
    yPosition += 10

    // Items
    pdf.font('Helvetica')
    const items = invoice.items || []
    
    items.forEach((item: any) => {
      const itemTotal = (item.quantity || 0) * (item.unit_price || 0)
      
      pdf.text(item.code || '-', itemCodeX, yPosition, { width: 60 })
      pdf.text(item.description || '', descriptionX, yPosition, { width: 220 })
      pdf.text(String(item.quantity || 0), quantityX, yPosition)
      pdf.text(`${(item.unit_price || 0).toFixed(2)}`, priceX, yPosition)
      pdf.text(`${itemTotal.toFixed(2)}`, totalX, yPosition)
      
      yPosition += 20
    })

    yPosition += 10
    pdf.moveTo(50, yPosition).lineTo(550, yPosition).stroke()
    yPosition += 20

    // Totals
    pdf.font('Helvetica-Bold')
    
    const subtotal = invoice.subtotal || 0
    const taxAmount = invoice.tax || 0
    const total = invoice.total || 0

    pdf.text(t.subtotal, 400, yPosition)
    pdf.text(`${subtotal.toFixed(2)} ${invoice.currency || 'CHF'}`, 490, yPosition)
    yPosition += 20

    if (invoice.tax_rate) {
      pdf.text(`${t.tax} (${invoice.tax_rate}%)`, 400, yPosition)
      pdf.text(`${taxAmount.toFixed(2)} ${invoice.currency || 'CHF'}`, 490, yPosition)
      yPosition += 20
    }

    pdf.fontSize(12)
    pdf.text(t.total, 400, yPosition)
    pdf.text(`${total.toFixed(2)} ${invoice.currency || 'CHF'}`, 490, yPosition)

    yPosition += 40

    // Notes
    if (invoice.notes) {
      pdf.fontSize(10)
      pdf.font('Helvetica-Bold').text(t.notes, 50, yPosition)
      yPosition += 15
      pdf.font('Helvetica').text(invoice.notes, 50, yPosition, { width: 500 })
    }

    // Swiss QR Bill - Using official library
    console.log('Adding Swiss QR Bill with official library...')

    // Build QR Bill data with conditional fields
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

    try {
      const swissQRBill = new SwissQRBill(qrBillData, {
        language: locale === 'de' ? 'DE' : locale === 'fr' ? 'FR' : locale === 'it' ? 'IT' : 'EN'
      })

      swissQRBill.attachTo(pdf)
      console.log('Swiss QR Bill attached successfully')
    } catch (error) {
      console.error('Error creating Swiss QR Bill:', error)
      // Continue without QR Bill if it fails
    }

    pdf.end()

    const pdfBuffer = await pdfPromise

    console.log('PDF generated successfully, size:', pdfBuffer.length)

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${t.invoice.toLowerCase()}-${invoice.invoice_number}.pdf"`,
        'Content-Length': String(pdfBuffer.length)
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

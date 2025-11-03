import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import PDFDocument from 'pdfkit'
import { SwissQRBill } from 'swissqrbill/pdf'
import { format } from 'date-fns'
import { it, de, fr, enUS } from 'date-fns/locale'
import { getPDFTranslations } from '@/lib/pdf-translations'
import { Readable } from 'stream'

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

// Helper to convert PDFKit stream to Buffer
function streamToBuffer(stream: InstanceType<typeof PDFDocument>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    stream.on('data', (chunk: Buffer) => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
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

    // Create PDF with PDFKit
    const pdf = new PDFDocument({ 
      size: 'A4',
      margin: 50,
      bufferPages: true
    })

    let yPosition = pdf.page.height - 50 // Start from top (accounting for margin)

    // Logo (if exists)
    if (company.logo_url) {
      try {
        console.log('Loading logo from:', company.logo_url)
        const logoResponse = await fetch(company.logo_url)
        const logoBuffer = await logoResponse.arrayBuffer()
        
        const contentType = logoResponse.headers.get('content-type')
        
        try {
          if (contentType?.includes('png')) {
            pdf.image(Buffer.from(logoBuffer), 445, 50, { 
              fit: [100, 60],
              align: 'right'
            })
          } else if (contentType?.includes('jpeg') || contentType?.includes('jpg')) {
            pdf.image(Buffer.from(logoBuffer), 445, 50, { 
              fit: [100, 60],
              align: 'right'
            })
          }
        } catch (imgError) {
          console.error('Error embedding logo:', imgError)
        }
      } catch (error) {
        console.error('Error loading logo:', error)
      }
    }

    // Company info
    pdf.fontSize(11).font('Helvetica-Bold')
    pdf.text(company.company_name || '', 50, 50)
    
    yPosition = 65
    pdf.fontSize(9).font('Helvetica')
    
    if (company.address) {
      pdf.text(company.address, 50, yPosition)
      yPosition += 12
    }
    
    const cityLine = [company.postal_code, company.city].filter(Boolean).join(' ')
    if (cityLine) {
      pdf.text(cityLine, 50, yPosition)
      yPosition += 12
    }
    
    if (company.country) {
      pdf.text(company.country, 50, yPosition)
      yPosition += 12
    }
    
    yPosition += 10
    
    pdf.fontSize(8)
    
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
    pdf.fontSize(11).font('Helvetica-Bold')
    pdf.text(t.billTo, 50, yPosition)
    yPosition += 20

    const client = invoice.client || {}
    pdf.fontSize(10).font('Helvetica')
    pdf.text(client.name || '', 50, yPosition)
    yPosition += 15

    if (client.address) {
      pdf.fontSize(9)
      pdf.text(client.address, 50, yPosition)
      yPosition += 12
    }

    const customerCityLine = [client.postal_code, client.city].filter(Boolean).join(' ')
    if (customerCityLine) {
      pdf.text(customerCityLine, 50, yPosition)
      yPosition += 12
    }

    if (client.country) {
      pdf.text(client.country, 50, yPosition)
      yPosition += 12
    }

    yPosition += 30

    // Invoice title
    pdf.fontSize(20).font('Helvetica-Bold')
    pdf.text(t.invoice.toUpperCase(), 50, yPosition)
    yPosition += 30

    // Invoice details
    pdf.fontSize(10).font('Helvetica')
    
    const details = [
      `${t.invoiceNumber}: ${invoice.invoice_number}`,
      invoice.issue_date ? `${t.date}: ${format(new Date(invoice.issue_date), 'dd MMMM yyyy', { locale: dateLocale })}` : null,
      invoice.due_date ? `${t.dueDate}: ${format(new Date(invoice.due_date), 'dd MMMM yyyy', { locale: dateLocale })}` : null,
    ].filter(Boolean)

    details.forEach(detail => {
      if (detail) {
        pdf.text(detail, 50, yPosition)
        yPosition += 15
      }
    })

    yPosition += 20

    // Items table header
    const tableTop = yPosition
    const itemCodeX = 50
    const descriptionX = 120
    const quantityX = 350
    const priceX = 420
    const totalX = 490

    pdf.fontSize(10).font('Helvetica-Bold')
    pdf.text(t.itemCode, itemCodeX, tableTop)
    pdf.text(t.description, descriptionX, tableTop)
    pdf.text(t.quantity, quantityX, tableTop)
    pdf.text(t.price, priceX, tableTop)
    pdf.text(t.total, totalX, tableTop)

    yPosition = tableTop + 20

    // Header line
    pdf.moveTo(50, yPosition)
       .lineTo(545, yPosition)
       .stroke()
    yPosition += 15

    // Items
    const items = invoice.invoice_items || []
    pdf.fontSize(9).font('Helvetica')
    
    items.forEach((item: any, index: number) => {
      const itemTotal = (item.quantity || 0) * (item.unit_price || 0)
      
      // Check if we need a new page
      if (yPosition > 700) {
        pdf.addPage()
        yPosition = 50
      }
      
      pdf.text(`${index + 1}`, itemCodeX, yPosition)
      pdf.text(item.description || '', descriptionX, yPosition, { width: 220 })
      pdf.text(String(item.quantity || 0), quantityX, yPosition)
      pdf.text(`${(item.unit_price || 0).toFixed(2)}`, priceX, yPosition)
      pdf.text(`${itemTotal.toFixed(2)}`, totalX, yPosition)
      
      yPosition += 20
    })

    yPosition += 10
    pdf.moveTo(50, yPosition)
       .lineTo(545, yPosition)
       .stroke()
    yPosition += 20

    // Totals
    const subtotal = invoice.subtotal || 0
    const taxAmount = invoice.tax || 0
    const total = invoice.total || 0

    pdf.fontSize(10).font('Helvetica-Bold')
    pdf.text(t.subtotal, 400, yPosition)
    pdf.font('Helvetica')
    pdf.text(`${subtotal.toFixed(2)} ${invoice.currency || 'CHF'}`, 490, yPosition)
    yPosition += 20

    if (invoice.tax_rate) {
      pdf.font('Helvetica-Bold')
      pdf.text(`${t.tax} (${invoice.tax_rate}%)`, 400, yPosition)
      pdf.font('Helvetica')
      pdf.text(`${taxAmount.toFixed(2)} ${invoice.currency || 'CHF'}`, 490, yPosition)
      yPosition += 20
    }

    pdf.fontSize(12).font('Helvetica-Bold')
    pdf.text(t.total, 400, yPosition)
    pdf.text(`${total.toFixed(2)} ${invoice.currency || 'CHF'}`, 490, yPosition)

    yPosition += 40

    // Notes
    if (invoice.notes && yPosition < 650) {
      pdf.fontSize(10).font('Helvetica-Bold')
      pdf.text(t.notes, 50, yPosition)
      yPosition += 15
      pdf.fontSize(9).font('Helvetica')
      pdf.text(invoice.notes, 50, yPosition, { width: 500 })
    }

    // Swiss QR Bill - Using OFFICIAL swissqrbill library
    console.log('=== Starting Swiss QR Bill generation with official library ===')
    console.log('Company IBAN:', company.iban)
    console.log('Invoice total:', invoice.total)
    console.log('Currency:', invoice.currency)

    try {
      // Check if we have minimum required data
      if (!company.iban || company.iban.trim() === '') {
        console.error('❌ IBAN missing! QR Bill cannot be generated without IBAN.')
        console.error('Go to Settings → Payment Information and enter the IBAN')
      } else if (!company.postal_code || company.postal_code.toString().trim() === '') {
        console.error('❌ Postal code missing! QR Bill requires company postal code.')
        console.error('Go to Settings → Company Data and enter the postal code')
      } else if (!company.company_name || company.company_name.trim() === '') {
        console.error('❌ Company name missing! QR Bill requires company name.')
        console.error('Go to Settings → Company Data and enter the company name')
      } else {
        console.log('✅ IBAN present, generating Swiss QR Bill with official library...')
        
        // Prepare data for SwissQRBill (official library format)
        const qrBillData: any = {
          currency: (invoice.currency || 'CHF') as 'CHF' | 'EUR',
          amount: invoice.total || 0,
          creditor: {
            name: company.company_name || '',
            address: company.address || '',
            zip: parseInt(String(company.postal_code || '0')),
            city: company.city || '',
            country: getCountryCode(company.country),
            account: company.iban.replace(/\s/g, ''), // Remove spaces from IBAN
          },
          message: `${t.invoice} ${invoice.invoice_number}`,
        }

        // Add debtor info if available
        if (client.name) {
          qrBillData.debtor = {
            name: client.name,
            address: client.address || '',
            zip: parseInt(String(client.postal_code || '0')),
            city: client.city || '',
            country: getCountryCode(client.country),
          }
        }

        // Add language option based on locale
        const qrLanguageMap: Record<string, 'DE' | 'EN' | 'IT' | 'FR'> = {
          de: 'DE',
          en: 'EN',
          it: 'IT',
          fr: 'FR',
          rm: 'IT', // Romansh defaults to Italian
        }

        console.log('Creating SwissQRBill with data:', JSON.stringify(qrBillData, null, 2))

        // Create SwissQRBill instance with official library
        const swissQRBill = new SwissQRBill(qrBillData, {
          language: qrLanguageMap[locale] || 'IT',
          scissors: true,
        })

        console.log('SwissQRBill instance created successfully')

        // Attach QR Bill to PDF (creates new page automatically)
        swissQRBill.attachTo(pdf)

        console.log('=== ✅ Swiss QR Bill OFFICIAL (swissqrbill library) attached successfully! ===')
      }
    } catch (error) {
      console.error('=== ❌ ERROR creating Swiss QR Bill ===')
      console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error)
      console.error('Error message:', error instanceof Error ? error.message : String(error))
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
      console.error('Continuing without QR Bill...')
    }

    // Finalize PDF
    pdf.end()

    // Convert stream to buffer
    const pdfBuffer = await streamToBuffer(pdf)

    console.log('PDF generated successfully, size:', pdfBuffer.length)

    // Convert Buffer to Uint8Array for NextResponse compatibility
    const pdfUint8Array = new Uint8Array(pdfBuffer)

    return new NextResponse(pdfUint8Array, {
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

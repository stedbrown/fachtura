import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import PDFDocument from 'pdfkit'
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
    
    console.log(`Generating PDF for quote ${id} with locale ${locale}`)

    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
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
        quote_items (
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

    if (quoteError || !quote) {
      console.error('Quote error:', quoteError)
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
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

    console.log('Quote data loaded successfully')

    // Create PDF with PDFKit
    const pdf = new PDFDocument({ 
      size: 'A4',
      margin: 50,
      bufferPages: true
    })

    let yPosition = 50 // Start from top

    // Logo (if exists) - Top right
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

    // Company info - Top left
    pdf.fontSize(11).font('Helvetica-Bold')
    pdf.text(company.company_name || '', 50, yPosition)
    yPosition += 15
    
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
    
    yPosition += 5
    
    pdf.fontSize(8)
    
    if (company.vat_number) {
      pdf.text(`${t.vatNumber}: ${company.vat_number}`, 50, yPosition)
      yPosition += 10
    }
    
    if (company.email) {
      pdf.text(`${t.email}: ${company.email}`, 50, yPosition)
      yPosition += 10
    }
    
    if (company.phone) {
      pdf.text(`${t.phone}: ${company.phone}`, 50, yPosition)
      yPosition += 10
    }
    
    if (company.website) {
      const displayWebsite = cleanWebsiteForDisplay(company.website)
      pdf.text(`${t.website}: ${displayWebsite}`, 50, yPosition)
      yPosition += 10
    }

    // Customer address - Positioned for Swiss envelope window (right side)
    // Swiss C5/C6 envelope: window at ~100mm from left, ~45mm from top
    // A4: 210mm width, window starts at ~100mm, content safe area starts at ~105mm
    const windowX = 320 // ~113mm from left
    const windowY = 127 // ~45mm from top (842pt - 715pt = 127pt from top in PDFKit coords)
    
    const client = quote.client || {}
    let clientY = windowY
    
    // Client name
    pdf.fontSize(11).font('Helvetica-Bold')
    pdf.text(client.name || '', windowX, clientY)
    clientY += 15

    // Client address
    if (client.address) {
      pdf.fontSize(10).font('Helvetica')
      pdf.text(client.address, windowX, clientY)
      clientY += 13
    }

    // Client postal code and city
    const customerCityLine = [client.postal_code, client.city].filter(Boolean).join(' ')
    if (customerCityLine) {
      pdf.text(customerCityLine, windowX, clientY)
      clientY += 13
    }

    // Client country
    if (client.country) {
      pdf.text(client.country, windowX, clientY)
      clientY += 13
    }

    // Continue with quote content below both company and client info
    // Ensure we start below the longest column
    yPosition = Math.max(yPosition, clientY) + 40

    // Quote title
    pdf.fontSize(20).font('Helvetica-Bold')
    pdf.text(t.quote.toUpperCase(), 50, yPosition)
    yPosition += 30

    // Quote details
    pdf.fontSize(10).font('Helvetica')
    
    const details = [
      `${t.quoteNumber}: ${quote.quote_number}`,
      quote.date ? `${t.date}: ${format(new Date(quote.date), 'dd MMMM yyyy', { locale: dateLocale })}` : null,
      quote.valid_until ? `${t.validUntil}: ${format(new Date(quote.valid_until), 'dd MMMM yyyy', { locale: dateLocale })}` : null,
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
    const items = quote.quote_items || []
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
    const subtotal = quote.subtotal || 0
    const taxAmount = quote.tax || 0
    const total = quote.total || 0

    // Calculate average tax rate from items for display
    let avgTaxRate = 0
    if (items.length > 0) {
      const totalTaxRate = items.reduce((sum: number, item: any) => sum + (item.tax_rate || 0), 0)
      avgTaxRate = totalTaxRate / items.length
    }

    pdf.fontSize(10).font('Helvetica-Bold')
    pdf.text(t.subtotal, 400, yPosition)
    pdf.font('Helvetica')
    pdf.text(`${subtotal.toFixed(2)} ${quote.currency || 'CHF'}`, 490, yPosition)
    yPosition += 20

    // Show tax if there is any tax amount or if items have tax rate
    if (taxAmount > 0 || avgTaxRate > 0) {
      const displayTaxRate = avgTaxRate > 0 ? avgTaxRate.toFixed(2) : '0'
      pdf.font('Helvetica-Bold')
      pdf.text(`${t.tax} (${displayTaxRate}%)`, 400, yPosition)
      pdf.font('Helvetica')
      pdf.text(`${taxAmount.toFixed(2)} ${quote.currency || 'CHF'}`, 490, yPosition)
      yPosition += 20
    }

    pdf.fontSize(12).font('Helvetica-Bold')
    pdf.text(t.total, 400, yPosition)
    pdf.text(`${total.toFixed(2)} ${quote.currency || 'CHF'}`, 490, yPosition)

    yPosition += 40

    // Notes
    if (quote.notes && yPosition < 700) {
      pdf.fontSize(10).font('Helvetica-Bold')
      pdf.text(t.notes, 50, yPosition)
      yPosition += 15
      pdf.fontSize(9).font('Helvetica')
      pdf.text(quote.notes, 50, yPosition, { width: 500 })
      yPosition += 25
    }

    // Terms and Conditions (from company settings)
    if (company.quote_terms_conditions && yPosition < 700) {
      pdf.fontSize(10).font('Helvetica-Bold')
      pdf.text(t.termsConditions, 50, yPosition)
      yPosition += 15
      pdf.fontSize(9).font('Helvetica')
      pdf.text(company.quote_terms_conditions, 50, yPosition, { width: 500 })
      yPosition += 25
    }

    // Payment Methods (from company settings)
    if (company.payment_methods && yPosition < 700) {
      pdf.fontSize(10).font('Helvetica-Bold')
      pdf.text('Metodi di Pagamento', 50, yPosition)
      yPosition += 15
      pdf.fontSize(9).font('Helvetica')
      pdf.text(company.payment_methods, 50, yPosition, { width: 500 })
      yPosition += 20
    }

    // Footer Text (from company settings)
    if (company.quote_footer_text && yPosition < 700) {
      pdf.fontSize(8).font('Helvetica')
      pdf.text(company.quote_footer_text, 50, yPosition, { 
        width: 495, 
        align: 'center' 
      })
      yPosition += 20
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
        'Content-Disposition': `attachment; filename="${t.quote.toLowerCase()}-${quote.quote_number}.pdf"`,
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

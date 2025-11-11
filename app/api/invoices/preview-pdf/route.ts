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

function getCountryCode(country: string | null | undefined): string {
  if (!country) return 'CH'
  const countryUpper = country.toUpperCase().trim()
  if (countryUpper.length === 2) return countryUpper
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

function cleanWebsiteForDisplay(website: string | null | undefined): string {
  if (!website) return ''
  return website
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '')
}

function streamToBuffer(stream: InstanceType<typeof PDFDocument>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    stream.on('data', (chunk: Buffer) => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

interface InvoicePreviewData {
  invoice_number: string
  date: string
  due_date?: string
  status: string
  notes?: string
  client: {
    id: string
    name: string
    email?: string
    phone?: string
    address?: string
    city?: string
    postal_code?: string
    country?: string
  }
  items: Array<{
    description: string
    quantity: number
    unit_price: number
    tax_rate: number
  }>
  subtotal: number
  tax_amount: number
  total: number
  locale: string
}

export async function POST(request: NextRequest) {
  try {
    const body: InvoicePreviewData = await request.json()
    const { locale = 'it', client, items, invoice_number, date, due_date, notes, subtotal, tax_amount, total } = body

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    // Create PDF with PDFKit
    const pdf = new PDFDocument({ 
      size: 'A4',
      margin: 50,
      bufferPages: true
    })

    let yPosition = 50

    // Logo
    if (company.logo_url) {
      try {
        const logoResponse = await fetch(company.logo_url)
        const logoBuffer = await logoResponse.arrayBuffer()
        const contentType = logoResponse.headers.get('content-type')
        if (contentType?.includes('png') || contentType?.includes('jpeg') || contentType?.includes('jpg')) {
          pdf.image(Buffer.from(logoBuffer), 445, 50, { 
            fit: [100, 60],
            align: 'right'
          })
        }
      } catch (error) {
        console.error('Error loading logo:', error)
      }
    }

    // Company info
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

    // Client address
    const windowX = 320
    const windowY = 127
    let clientY = windowY
    pdf.fontSize(11).font('Helvetica-Bold')
    pdf.text(client.name || '', windowX, clientY)
    clientY += 15
    if (client.address) {
      pdf.fontSize(10).font('Helvetica')
      pdf.text(client.address, windowX, clientY)
      clientY += 13
    }
    const customerCityLine = [client.postal_code, client.city].filter(Boolean).join(' ')
    if (customerCityLine) {
      pdf.text(customerCityLine, windowX, clientY)
      clientY += 13
    }
    if (client.country) {
      pdf.text(client.country, windowX, clientY)
      clientY += 13
    }
    yPosition = Math.max(yPosition, clientY) + 40

    // Invoice title
    pdf.fontSize(20).font('Helvetica-Bold')
    pdf.text(t.invoice.toUpperCase(), 50, yPosition)
    yPosition += 30

    // Invoice details
    pdf.fontSize(10).font('Helvetica')
    const details = [
      `${t.invoiceNumber}: ${invoice_number}`,
      date ? `${t.date}: ${format(new Date(date), 'dd MMMM yyyy', { locale: dateLocale })}` : null,
      due_date ? `${t.dueDate}: ${format(new Date(due_date), 'dd MMMM yyyy', { locale: dateLocale })}` : null,
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

    pdf.fontSize(10).font('Helvetica-Bold')
    pdf.text(t.itemCode, itemCodeX, tableTop)
    pdf.text(t.description, descriptionX, tableTop)
    pdf.text(t.quantity, quantityX, tableTop)
    pdf.text(t.price, priceX, tableTop)
    pdf.text(t.total, totalX, tableTop)
    yPosition = tableTop + 20

    pdf.moveTo(50, yPosition).lineTo(545, yPosition).stroke()
    yPosition += 15

    pdf.fontSize(9).font('Helvetica')
    items.forEach((item, index) => {
      const itemSubtotal = item.quantity * item.unit_price
      const itemTax = itemSubtotal * (item.tax_rate / 100)
      const itemTotal = itemSubtotal + itemTax

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
    pdf.moveTo(50, yPosition).lineTo(545, yPosition).stroke()
    yPosition += 20

    // Totals
    const avgTaxRate = items.length > 0
      ? items.reduce((sum, item) => sum + (item.tax_rate || 0), 0) / items.length
      : 0

    pdf.fontSize(10).font('Helvetica-Bold')
    pdf.text(t.subtotal, 400, yPosition)
    pdf.font('Helvetica')
    pdf.text(`${subtotal.toFixed(2)} CHF`, 490, yPosition)
    yPosition += 20

    if (tax_amount > 0 || avgTaxRate > 0) {
      const displayTaxRate = avgTaxRate > 0 ? avgTaxRate.toFixed(2) : '0'
      pdf.font('Helvetica-Bold')
      pdf.text(`${t.tax} (${displayTaxRate}%)`, 400, yPosition)
      pdf.font('Helvetica')
      pdf.text(`${tax_amount.toFixed(2)} CHF`, 490, yPosition)
      yPosition += 20
    }

    pdf.fontSize(12).font('Helvetica-Bold')
    pdf.text(t.total, 400, yPosition)
    pdf.text(`${total.toFixed(2)} CHF`, 490, yPosition)
    yPosition += 40

    // Notes
    if (notes && yPosition < 650) {
      pdf.fontSize(10).font('Helvetica-Bold')
      pdf.text(t.notes, 50, yPosition)
      yPosition += 15
      pdf.fontSize(9).font('Helvetica')
      pdf.text(notes, 50, yPosition, { width: 500 })
      yPosition += 25
    }

    // Payment Terms
    if (company.invoice_payment_terms && yPosition < 650) {
      pdf.fontSize(10).font('Helvetica-Bold')
      pdf.text(t.paymentTerms, 50, yPosition)
      yPosition += 15
      pdf.fontSize(9).font('Helvetica')
      pdf.text(company.invoice_payment_terms, 50, yPosition, { width: 500 })
      yPosition += 25
    }

    // Payment Methods
    if (company.payment_methods && yPosition < 650) {
      pdf.fontSize(10).font('Helvetica-Bold')
      pdf.text('Metodi di Pagamento', 50, yPosition)
      yPosition += 15
      pdf.fontSize(9).font('Helvetica')
      pdf.text(company.payment_methods, 50, yPosition, { width: 500 })
      yPosition += 20
    }

    // Late Payment Fee
    if (company.late_payment_fee && yPosition < 650) {
      pdf.fontSize(9).font('Helvetica-Bold')
      pdf.text('Penale per ritardo: ', 50, yPosition, { continued: true })
      pdf.font('Helvetica')
      pdf.text(company.late_payment_fee)
      yPosition += 20
    }

    // Footer Text
    if (company.invoice_footer_text && yPosition < 650) {
      pdf.fontSize(8).font('Helvetica')
      pdf.text(company.invoice_footer_text, 50, yPosition, { 
        width: 495, 
        align: 'center' 
      })
    }

    // Swiss QR Bill
    if (company.iban && company.postal_code && company.company_name && total > 0) {
      try {
        const qrBillData: any = {
          currency: 'CHF' as 'CHF' | 'EUR',
          amount: total,
          creditor: {
            name: company.company_name,
            address: company.address || '',
            zip: parseInt(String(company.postal_code || '0')),
            city: company.city || '',
            country: getCountryCode(company.country),
            account: company.iban.replace(/\s/g, ''),
          },
          message: `${t.invoice} ${invoice_number}`,
        }

        if (client.name) {
          qrBillData.debtor = {
            name: client.name,
            address: client.address || '',
            zip: parseInt(String(client.postal_code || '0')),
            city: client.city || '',
            country: getCountryCode(client.country),
          }
        }

        const qrLanguageMap: Record<string, 'DE' | 'EN' | 'IT' | 'FR'> = {
          de: 'DE',
          en: 'EN',
          it: 'IT',
          fr: 'FR',
          rm: 'IT',
        }

        const swissQRBill = new SwissQRBill(qrBillData, {
          language: qrLanguageMap[locale] || 'IT',
          scissors: true,
        })

        swissQRBill.attachTo(pdf)
      } catch (error) {
        console.error('Error creating QR Bill:', error)
      }
    }

    pdf.end()
    const pdfBuffer = await streamToBuffer(pdf)
    const pdfUint8Array = new Uint8Array(pdfBuffer)

    return new NextResponse(pdfUint8Array, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="preview.pdf"',
        'Content-Length': String(pdfBuffer.length)
      },
    })
  } catch (error) {
    console.error('Error generating preview PDF:', error)
    return NextResponse.json(
      { error: 'Error generating PDF', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}


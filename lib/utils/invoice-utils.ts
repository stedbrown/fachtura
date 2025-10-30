import type { InvoiceItemInput } from '@/lib/validations/invoice'

export function calculateInvoiceTotals(items: InvoiceItemInput[]) {
  let subtotal = 0
  let taxAmount = 0

  items.forEach((item) => {
    const lineSubtotal = item.quantity * item.unit_price
    const lineTax = lineSubtotal * (item.tax_rate / 100)
    subtotal += lineSubtotal
    taxAmount += lineTax
  })

  const total = subtotal + taxAmount

  return {
    subtotal: Number(subtotal.toFixed(2)),
    taxAmount: Number(taxAmount.toFixed(2)),
    total: Number(total.toFixed(2)),
  }
}

export function generateInvoiceNumber(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0')
  return `INV-${year}${month}-${random}`
}


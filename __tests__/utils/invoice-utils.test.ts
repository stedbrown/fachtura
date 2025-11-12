import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateInvoiceTotals, generateInvoiceNumber } from '@/lib/utils/invoice-utils'
import type { InvoiceItemInput } from '@/lib/validations/invoice'

describe('invoice-utils', () => {
  describe('calculateInvoiceTotals', () => {
    it('should calculate totals correctly for single item', () => {
      const items: InvoiceItemInput[] = [
        {
          description: 'Test item',
          quantity: 2,
          unit_price: 100,
          tax_rate: 8.1,
        },
      ]

      const result = calculateInvoiceTotals(items)

      expect(result.subtotal).toBe(200) // 2 * 100
      expect(result.totalTax).toBe(16.2) // 200 * 0.081
      expect(result.total).toBe(216.2) // 200 + 16.2
    })

    it('should calculate totals correctly for multiple items', () => {
      const items: InvoiceItemInput[] = [
        {
          description: 'Item 1',
          quantity: 1,
          unit_price: 100,
          tax_rate: 8.1,
        },
        {
          description: 'Item 2',
          quantity: 2,
          unit_price: 50,
          tax_rate: 8.1,
        },
      ]

      const result = calculateInvoiceTotals(items)

      expect(result.subtotal).toBe(200) // (1 * 100) + (2 * 50)
      expect(result.totalTax).toBe(16.2) // 200 * 0.081
      expect(result.total).toBe(216.2)
    })

    it('should handle zero tax rate', () => {
      const items: InvoiceItemInput[] = [
        {
          description: 'Tax-free item',
          quantity: 1,
          unit_price: 100,
          tax_rate: 0,
        },
      ]

      const result = calculateInvoiceTotals(items)

      expect(result.subtotal).toBe(100)
      expect(result.totalTax).toBe(0)
      expect(result.total).toBe(100)
    })

    it('should handle empty items array', () => {
      const items: InvoiceItemInput[] = []

      const result = calculateInvoiceTotals(items)

      expect(result.subtotal).toBe(0)
      expect(result.totalTax).toBe(0)
      expect(result.total).toBe(0)
    })

    it('should round to 2 decimal places', () => {
      const items: InvoiceItemInput[] = [
        {
          description: 'Item with decimals',
          quantity: 3,
          unit_price: 33.33,
          tax_rate: 8.1,
        },
      ]

      const result = calculateInvoiceTotals(items)

      // 3 * 33.33 = 99.99
      // 99.99 * 0.081 = 8.09919
      // Total = 108.08919
      expect(result.subtotal).toBe(99.99)
      expect(result.totalTax).toBe(8.1) // Rounded
      expect(result.total).toBe(108.09) // Rounded
    })
  })

  describe('generateInvoiceNumber', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should generate invoice number with correct format', () => {
      vi.setSystemTime(new Date('2024-03-15'))
      const number = generateInvoiceNumber()

      expect(number).toMatch(/^INV-202403-\d{3}$/)
    })

    it('should include current year and month', () => {
      vi.setSystemTime(new Date('2025-12-25'))
      const number = generateInvoiceNumber()

      expect(number).toContain('202512')
    })

    it('should pad month with zero', () => {
      vi.setSystemTime(new Date('2024-01-01'))
      const number = generateInvoiceNumber()

      expect(number).toContain('202401')
    })

    it('should generate unique numbers', () => {
      vi.setSystemTime(new Date('2024-03-15'))
      const numbers = Array.from({ length: 10 }, () => generateInvoiceNumber())
      const uniqueNumbers = new Set(numbers)

      // Should have at least some unique numbers (random component)
      expect(uniqueNumbers.size).toBeGreaterThan(1)
    })
  })
})


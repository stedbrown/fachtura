import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { calculateQuoteTotals, generateQuoteNumber, calculateLineTotal } from '@/lib/utils/quote-utils'
import type { QuoteItemInput } from '@/lib/validations/quote'

describe('quote-utils', () => {
  describe('calculateLineTotal', () => {
    it('should calculate line total correctly', () => {
      const total = calculateLineTotal(2, 100, 8.1)

      expect(total).toBe(216.2) // (2 * 100) + (200 * 0.081)
    })

    it('should handle zero tax rate', () => {
      const total = calculateLineTotal(1, 100, 0)

      expect(total).toBe(100)
    })

    it('should handle zero quantity', () => {
      const total = calculateLineTotal(0, 100, 8.1)

      expect(total).toBe(0)
    })
  })

  describe('calculateQuoteTotals', () => {
    it('should calculate totals correctly for single item', () => {
      const items: QuoteItemInput[] = [
        {
          description: 'Test item',
          quantity: 2,
          unit_price: 100,
          tax_rate: 8.1,
        },
      ]

      const result = calculateQuoteTotals(items)

      expect(result.subtotal).toBe(200)
      expect(result.totalTax).toBe(16.2)
      expect(result.total).toBe(216.2)
    })

    it('should calculate totals correctly for multiple items', () => {
      const items: QuoteItemInput[] = [
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

      const result = calculateQuoteTotals(items)

      expect(result.subtotal).toBe(200)
      expect(result.totalTax).toBe(16.2)
      expect(result.total).toBe(216.2)
    })

    it('should handle empty items array', () => {
      const items: QuoteItemInput[] = []

      const result = calculateQuoteTotals(items)

      expect(result.subtotal).toBe(0)
      expect(result.totalTax).toBe(0)
      expect(result.total).toBe(0)
    })
  })

  describe('generateQuoteNumber', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should generate quote number with correct format', () => {
      vi.setSystemTime(new Date('2024-03-15'))
      const number = generateQuoteNumber()

      expect(number).toMatch(/^QT-202403-\d{3}$/)
    })

    it('should include current year and month', () => {
      vi.setSystemTime(new Date('2025-12-25'))
      const number = generateQuoteNumber()

      expect(number).toContain('202512')
    })
  })
})


import * as XLSX from 'xlsx'

export interface ExportColumn {
  key: string
  label: string
  formatter?: (value: any) => string
}

export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn[],
  filename: string
) {
  // Create CSV header
  const header = columns.map((col) => col.label).join(',')

  // Create CSV rows
  const rows = data.map((row) => {
    return columns
      .map((col) => {
        const value = row[col.key]
        const formatted = col.formatter ? col.formatter(value) : value
        // Escape commas and quotes in CSV
        const escaped = String(formatted || '')
          .replace(/"/g, '""')
        return `"${escaped}"`
      })
      .join(',')
  })

  // Combine header and rows
  const csv = [header, ...rows].join('\n')

  // Create blob and download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function exportToExcel<T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn[],
  filename: string,
  sheetName: string = 'Sheet1'
) {
  // Prepare data for Excel
  const excelData = data.map((row) => {
    const formatted: Record<string, any> = {}
    columns.forEach((col) => {
      const value = row[col.key]
      formatted[col.label] = col.formatter ? col.formatter(value) : value
    })
    return formatted
  })

  // Create workbook and worksheet
  const worksheet = XLSX.utils.json_to_sheet(excelData)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

  // Generate Excel file and download
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}

// Helper function to format date for export
export function formatDateForExport(date: string | Date): string {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleDateString('it-CH')
}

// Helper function to format currency for export
export function formatCurrencyForExport(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return `CHF ${num.toFixed(2)}`
}

// Simplified export functions that accept already-formatted data
export function exportFormattedToCSV(
  data: Record<string, any>[],
  filename: string
) {
  if (data.length === 0) return

  // Extract headers from first row
  const headers = Object.keys(data[0])
  const header = headers.join(',')

  // Create CSV rows
  const rows = data.map((row) => {
    return headers
      .map((key) => {
        const value = row[key]
        const escaped = String(value || '').replace(/"/g, '""')
        return `"${escaped}"`
      })
      .join(',')
  })

  // Combine header and rows
  const csv = [header, ...rows].join('\n')

  // Create blob and download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function exportFormattedToExcel(
  data: Record<string, any>[],
  filename: string,
  sheetName: string = 'Sheet1'
) {
  if (data.length === 0) return

  // Create workbook and worksheet
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

  // Generate Excel file and download
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}


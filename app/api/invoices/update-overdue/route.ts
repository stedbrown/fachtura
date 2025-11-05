import { NextResponse } from 'next/server'
import { updateOverdueInvoices } from '@/lib/utils/update-overdue-invoices'

export async function POST() {
  try {
    const result = await updateOverdueInvoices()
    
    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      updated: result.updated,
      invoices: result.invoices
    })
  } catch (error) {
    console.error('Error in update-overdue API:', error)
    return NextResponse.json(
      { error: 'Failed to update overdue invoices' },
      { status: 500 }
    )
  }
}


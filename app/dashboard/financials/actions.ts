// app/dashboard/financials/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'

export async function addTransaction(formData: FormData) {
  const supabase = await createClient()
  const { agencyId, role } = await getUserAgencyContext()

  // Security Gate: Only Agency Owners can record ledger transactions
  if (role !== 'agency_owner') {
    redirect('/dashboard/financials?message=Unauthorized: Only agency owners can record transactions')
  }

  const transaction_type = formData.get('transaction_type') as string // 'income' or 'expense'
  const rawAmount = formData.get('amount') as string
  const transaction_date = formData.get('transaction_date') as string
  const description = formData.get('description') as string
  const rawPropertyId = formData.get('property_id') as string

  const amount = parseFloat(rawAmount)

  if (!transaction_type || isNaN(amount) || !transaction_date || !description?.trim()) {
    redirect('/dashboard/financials?message=Please fill in all required fields')
  }

  const property_id = rawPropertyId && rawPropertyId.trim() ? rawPropertyId.trim() : null

  const { error } = await supabase
    .from('transactions')
    .insert([
      {
        agency_id: agencyId,
        property_id,
        transaction_type,
        amount,
        transaction_date,
        description: description.trim(),
      },
    ])

  if (error) {
    console.error('Error adding transaction:', error)
    redirect('/dashboard/financials?message=Failed to add transaction')
  }

  revalidatePath('/dashboard/financials')
  redirect('/dashboard/financials?message=Transaction added successfully')
}

export async function deleteTransaction(formData: FormData) {
  const supabase = await createClient()
  const { agencyId, role } = await getUserAgencyContext()

  // Security Gate: Only Agency Owners can delete ledger transactions
  if (role !== 'agency_owner') {
    redirect('/dashboard/financials?message=Unauthorized: Only agency owners can delete transactions')
  }

  const id = formData.get('id') as string

  if (!id) {
    redirect('/dashboard/financials?message=Transaction ID missing')
  }

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('agency_id', agencyId)

  if (error) {
    console.error('Error deleting transaction:', error)
    redirect('/dashboard/financials?message=Failed to delete transaction')
  }

  revalidatePath('/dashboard/financials')
  redirect('/dashboard/financials?message=Transaction deleted successfully')
}


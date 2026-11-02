'use server'

import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'
import { type ColumnFiltersState } from '@tanstack/react-table'

export interface IncomeScheduleRow {
  id: string
  receipt_id: string | null
  property_id: string | null
  unit_id: string | null
  tenant_id: string | null
  transaction_type: string
  amount: number
  transaction_date: string | null
  description: string | null
  status: string | null
  payment_method: string | null
  external_reference: string | null
  created_at: string | null
  property_name: string | null
  unit_number: string | null
  tenant_name: string | null
}

export interface IncomeScheduleResult {
  rows: IncomeScheduleRow[]
  totalCount: number
}

type SortItem = { id: string; desc: boolean }

const TOP_LEVEL_FILTERABLE = new Set([
  'description',
  'transaction_type',
  'status',
  'transaction_date',
  'receipt_id',
  'payment_method',
])

const DB_COLUMN: Record<string, string> = {
  date: 'transaction_date',
  description: 'description',
  type: 'transaction_type',
  amount: 'amount',
  status: 'status',
  receipt: 'receipt_id',
  method: 'payment_method',
}

function buildFilters(
  query: any,
  { globalFilter, columnFilters }: { globalFilter: string; columnFilters: ColumnFiltersState }
) {
  if (globalFilter) {
    const f = `%${globalFilter}%`
    query = query.or(
      `description.ilike.${f},receipt_id.ilike.${f},external_reference.ilike.${f},payment_method.ilike.${f},transaction_type.ilike.${f}`
    )
  }

  for (const filter of columnFilters) {
    if (!filter.value) continue
    const f = `%${String(filter.value)}%`
    if (filter.id === 'transaction_date') {
      query = query.ilike('transaction_date', f)
    } else {
      query = query.ilike(filter.id, f)
    }
  }

  return query
}

export async function getIncomeSchedule({
  pageIndex,
  pageSize,
  sorting,
  columnFilters,
  globalFilter,
}: {
  pageIndex: number
  pageSize: number
  sorting: SortItem[]
  columnFilters: ColumnFiltersState
  globalFilter: string
}): Promise<IncomeScheduleResult> {
  const { agencyId } = await getUserAgencyContext()

  const from = pageIndex * pageSize
  const to = from + pageSize - 1

  const sort = sorting[0]
  const orderColumn = sort ? DB_COLUMN[sort.id] : null

  const supabase = await createClient()

  let query = supabase
    .from('transactions')
    .select(
      `
      id,
      receipt_id,
      property_id,
      unit_id,
      tenant_id,
      transaction_type,
      amount,
      transaction_date,
      description,
      status,
      payment_method,
      external_reference,
      created_at,
      properties ( name ),
      units ( unit_number ),
      tenants ( first_name, last_name )
    `,
      { count: 'exact' }
    )
    .eq('agency_id', agencyId)
    .in('transaction_type', ['income', 'payment'])

  query = buildFilters(query, { globalFilter, columnFilters })

  if (orderColumn) {
    query = query.order(orderColumn, { ascending: !sort.desc })
  } else {
    query = query.order('transaction_date', { ascending: false })
  }

  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    console.error('getIncomeSchedule error:', error)
    return { rows: [], totalCount: 0 }
  }

  const rows: IncomeScheduleRow[] = (data || []).map((t: any) => {
    const tenant = t.tenants
    const unit = t.units
    const property = t.properties
    return {
      id: t.id,
      receipt_id: t.receipt_id,
      property_id: t.property_id,
      unit_id: t.unit_id,
      tenant_id: t.tenant_id,
      transaction_type: t.transaction_type,
      amount: Number(t.amount || 0),
      transaction_date: t.transaction_date,
      description: t.description,
      status: t.status,
      payment_method: t.payment_method,
      external_reference: t.external_reference,
      created_at: t.created_at,
      property_name: property?.name ?? null,
      unit_number: unit?.unit_number ?? null,
      tenant_name: tenant
        ? `${tenant.first_name || ''} ${tenant.last_name || ''}`.trim() || null
        : null,
    }
  })

  return { rows, totalCount: count ?? 0 }
}

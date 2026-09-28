'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getUserAgencyContext } from '@/utils/supabase/get-context'

export interface MeterReadingInputRow {
  unitNumber: string
  currentReading: string | number
  readingDate?: string
  [key: string]: unknown
}

export interface ProcessedReadingResult {
  unitNumber: string
  unitId?: string
  success: boolean
  previousReading?: number
  currentReading?: number
  consumption?: number
  ratePerUnit?: number
  totalCharge?: number
  error?: string
}

export interface BulkMeterReadingsResponse {
  success: boolean
  totalProcessed: number
  savedCount: number
  failedCount: number
  results: ProcessedReadingResult[]
  error?: string
}

export interface UtilityReadingItem {
  id: string
  property_id: string
  unit_id: string
  utility_type: string
  previous_reading: number
  current_reading: number
  consumption: number
  rate_per_unit: number
  total_charge: number
  status: 'draft' | 'invoiced' | 'bundled'
  reading_date: string
  created_at: string
  unit_number?: string
  property_name?: string
}

/**
 * Enterprise Bulk Meter Readings Processor
 * - Resolves previous readings from historical records
 * - Calculates consumption and charges server-side
 * - Applies Error Isolation (Promise.allSettled) so valid readings persist even if some fail
 */
export async function processBulkMeterReadings(
  propertyId: string,
  readingsArray: MeterReadingInputRow[],
  overrideReadingDate?: string
): Promise<BulkMeterReadingsResponse> {
  try {
    const supabase = await createServerClient()
    const { userId, agencyId, role } = await getUserAgencyContext()
    const isOwner = role === 'agency_owner' || role === 'super_admin'

    if (!propertyId) {
      return {
        success: false,
        totalProcessed: 0,
        savedCount: 0,
        failedCount: 0,
        results: [],
        error: 'Target property ID is required.',
      }
    }

    if (!readingsArray || !Array.isArray(readingsArray) || readingsArray.length === 0) {
      return {
        success: false,
        totalProcessed: 0,
        savedCount: 0,
        failedCount: 0,
        results: [],
        error: 'No meter readings provided for processing.',
      }
    }

    // 1. Verify property access & fetch water rate
    const { data: property, error: propErr } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .maybeSingle()

    if (propErr || !property) {
      console.error('Target property lookup error:', propErr?.message || propErr)
      return {
        success: false,
        totalProcessed: 0,
        savedCount: 0,
        failedCount: 0,
        results: [],
        error: 'Target property not found.',
      }
    }

    if (property.agency_id !== agencyId && !isOwner) {
      return {
        success: false,
        totalProcessed: 0,
        savedCount: 0,
        failedCount: 0,
        results: [],
        error: 'Unauthorized property access across agency boundaries.',
      }
    }

    if (!isOwner && property.manager_id !== userId) {
      return {
        success: false,
        totalProcessed: 0,
        savedCount: 0,
        failedCount: 0,
        results: [],
        error: 'You are not assigned as manager for this property site.',
      }
    }

    const ratePerUnit =
      property.standard_water_rate != null && !isNaN(Number(property.standard_water_rate))
        ? Number(property.standard_water_rate)
        : 150.0

    // 2. Fetch all existing units for this property to map unit numbers to IDs
    const { data: existingUnits, error: unitsErr } = await supabase
      .from('units')
      .select('id, unit_number')
      .eq('property_id', propertyId)

    if (unitsErr) {
      return {
        success: false,
        totalProcessed: 0,
        savedCount: 0,
        failedCount: 0,
        results: [],
        error: `Failed to fetch property units: ${unitsErr.message}`,
      }
    }

    const unitMap = new Map<string, string>() // normalized unit_number -> unit_id
    existingUnits?.forEach((u) => {
      unitMap.set(u.unit_number.trim().toLowerCase(), u.id)
    })

    // 3. Use admin client or server client for resilient historical lookup
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const admin =
      supabaseUrl && serviceRoleKey
        ? createAdminClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : supabase

    // 4. Fetch the most recent reading for each unit in this property
    const { data: recentReadings } = await admin
      .from('utility_readings')
      .select('unit_id, current_reading, reading_date, created_at')
      .eq('property_id', propertyId)
      .eq('utility_type', 'WATER')
      .order('reading_date', { ascending: false })
      .order('created_at', { ascending: false })

    const latestPreviousReadingMap = new Map<string, number>()
    if (recentReadings) {
      for (const r of recentReadings) {
        if (!latestPreviousReadingMap.has(r.unit_id)) {
          latestPreviousReadingMap.set(r.unit_id, Number(r.current_reading || 0))
        }
      }
    }

    const todayDate = new Date().toISOString().slice(0, 10)
    const effectiveReadingDate = overrideReadingDate || todayDate

    // 5. Process each row with Error Isolation using Promise.allSettled
    const rowPromises = readingsArray.map(async (row): Promise<ProcessedReadingResult> => {
      const rawUnitNum = String(
        row.unitNumber ?? row['Unit Number'] ?? row['unit'] ?? row['Unit'] ?? ''
      ).trim()
      const rawReading =
        row.currentReading ?? row['Current Reading'] ?? row['reading'] ?? row['Reading']

      if (!rawUnitNum) {
        return {
          unitNumber: 'Unknown',
          success: false,
          error: 'Unit number is missing in row.',
        }
      }

      const unitId = unitMap.get(rawUnitNum.toLowerCase())
      if (!unitId) {
        return {
          unitNumber: rawUnitNum,
          success: false,
          error: `Unit "${rawUnitNum}" does not exist in ${property.name}.`,
        }
      }

      const parsedCurrent = parseFloat(String(rawReading).replace(/[^0-9.]/g, ''))
      if (isNaN(parsedCurrent) || parsedCurrent < 0) {
        return {
          unitNumber: rawUnitNum,
          unitId,
          success: false,
          error: `Invalid current meter reading: "${rawReading}". Must be a non-negative number.`,
        }
      }

      // Fetch latest previous reading (default 0.00 if first time)
      const previousReading = latestPreviousReadingMap.get(unitId) ?? 0.0

      // Anomaly check: Current reading cannot be less than previous reading
      if (parsedCurrent < previousReading) {
        return {
          unitNumber: rawUnitNum,
          unitId,
          success: false,
          previousReading,
          currentReading: parsedCurrent,
          error: `Current reading (${parsedCurrent}) is lower than previous reading (${previousReading}). Meter reversal anomaly detected.`,
        }
      }

      // Calculate server-side metrics
      const consumption = Math.round((parsedCurrent - previousReading) * 100) / 100
      const totalCharge = Math.round(consumption * ratePerUnit * 100) / 100

      return {
        unitNumber: rawUnitNum,
        unitId,
        success: true,
        previousReading,
        currentReading: parsedCurrent,
        consumption,
        ratePerUnit,
        totalCharge,
      }
    })

    const settledResults = await Promise.allSettled(rowPromises)

    const processedResults: ProcessedReadingResult[] = settledResults.map((s, idx) => {
      if (s.status === 'fulfilled') {
        return s.value
      }
      return {
        unitNumber: String(readingsArray[idx]?.unitNumber || `Row #${idx + 1}`),
        success: false,
        error: s.reason instanceof Error ? s.reason.message : 'Unexpected row processing error.',
      }
    })

    const validReadings = processedResults.filter((r) => r.success && r.unitId)
    const failedReadings = processedResults.filter((r) => !r.success)

    // 6. Batch insert all valid readings into utility_readings with status = 'draft'
    if (validReadings.length > 0) {
      const rowsToInsert = validReadings.map((r) => ({
        property_id: propertyId,
        unit_id: r.unitId!,
        agency_id: agencyId,
        utility_type: 'WATER',
        previous_reading: r.previousReading ?? 0.0,
        current_reading: r.currentReading!,
        consumption: r.consumption ?? 0.0,
        rate_per_unit: ratePerUnit,
        total_charge: r.totalCharge ?? 0.0,
        status: 'draft',
        reading_date: effectiveReadingDate,
        created_by: userId,
      }))

      const { error: insertErr } = await admin.from('utility_readings').insert(rowsToInsert)

      if (insertErr) {
        console.error('Batch insert error in utility_readings:', insertErr)
        return {
          success: false,
          totalProcessed: readingsArray.length,
          savedCount: 0,
          failedCount: readingsArray.length,
          results: processedResults.map((r) => ({
            ...r,
            success: false,
            error: insertErr.message,
          })),
          error: `Database insertion error: ${insertErr.message}`,
        }
      }
    }

    revalidatePath('/dashboard/utilities')
    revalidatePath('/dashboard/clearance')
    revalidatePath(`/dashboard/property/${propertyId}`)

    return {
      success: true,
      totalProcessed: readingsArray.length,
      savedCount: validReadings.length,
      failedCount: failedReadings.length,
      results: processedResults,
    }
  } catch (err: unknown) {
    console.error('Unhandled error in processBulkMeterReadings:', err)
    return {
      success: false,
      totalProcessed: readingsArray?.length || 0,
      savedCount: 0,
      failedCount: readingsArray?.length || 0,
      results: [],
      error: err instanceof Error ? err.message : 'An error occurred while saving meter readings.',
    }
  }
}

/**
 * Fetches recent utility readings scoped to the caller's agency and permissions.
 */
export async function getUtilityReadings(
  propertyId?: string,
  limit = 100
): Promise<UtilityReadingItem[]> {
  try {
    const supabase = await createServerClient()
    const { userId, agencyId, role } = await getUserAgencyContext()
    const isOwner = role === 'agency_owner' || role === 'super_admin'

    let query = supabase
      .from('utility_readings')
      .select(`
        id,
        property_id,
        unit_id,
        utility_type,
        previous_reading,
        current_reading,
        consumption,
        rate_per_unit,
        total_charge,
        status,
        reading_date,
        created_at,
        units (
          unit_number
        ),
        properties (
          name,
          manager_id
        )
      `)
      .order('reading_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (propertyId) {
      query = query.eq('property_id', propertyId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching utility readings:', error.message || error.details || JSON.stringify(error))
      return []
    }

    // Filter coordinator scope if not owner
    let filteredData = data || []
    if (!isOwner) {
      filteredData = filteredData.filter((r: any) => r.properties?.manager_id === userId)
    }

    return filteredData.map((r: any) => ({
      id: r.id,
      property_id: r.property_id,
      unit_id: r.unit_id,
      utility_type: r.utility_type,
      previous_reading: Number(r.previous_reading || 0),
      current_reading: Number(r.current_reading || 0),
      consumption: Number(r.consumption || 0),
      rate_per_unit: Number(r.rate_per_unit || 0),
      total_charge: Number(r.total_charge || 0),
      status: r.status,
      reading_date: r.reading_date,
      created_at: r.created_at,
      unit_number: r.units?.unit_number || 'N/A',
      property_name: r.properties?.name || 'Property Site',
    }))
  } catch (err) {
    console.error('Error in getUtilityReadings:', err)
    return []
  }
}

/**
 * Fetches properties available for utility metering.
 */
export async function getPropertiesForUtilities(): Promise<
  Array<{ id: string; name: string; standard_water_rate: number; unitsCount: number }>
> {
  try {
    const supabase = await createServerClient()
    const { userId, agencyId, role } = await getUserAgencyContext()
    const isOwner = role === 'agency_owner' || role === 'super_admin'

    let query = supabase
      .from('properties')
      .select('*')
      .eq('agency_id', agencyId)
      .order('name', { ascending: true })

    if (!isOwner) {
      query = query.eq('manager_id', userId)
    }

    const { data: properties, error } = await query

    if (error) {
      console.error('Error fetching properties for utilities:', error.message || error.details || JSON.stringify(error))
      return []
    }

    if (!properties || properties.length === 0) {
      return []
    }

    // Safely query units count per property
    const propertyIds = properties.map((p: any) => p.id)
    const { data: units, error: unitsError } = await supabase
      .from('units')
      .select('id, property_id')
      .in('property_id', propertyIds)

    if (unitsError) {
      console.warn('Could not fetch units count for properties:', unitsError.message || unitsError)
    }

    const unitsCountMap = new Map<string, number>()
    units?.forEach((u: any) => {
      if (u.property_id) {
        unitsCountMap.set(u.property_id, (unitsCountMap.get(u.property_id) || 0) + 1)
      }
    })

    return properties.map((p: any) => ({
      id: p.id,
      name: p.name,
      standard_water_rate: Number((p as any).standard_water_rate || 150),
      unitsCount: unitsCountMap.get(p.id) || 0,
    }))
  } catch (err: any) {
    console.error('Error in getPropertiesForUtilities:', err?.message || err)
    return []
  }
}

/**
 * Fetches units for a property alongside their latest previous reading for template generation.
 */
export async function getPropertyUnitsForTemplate(propertyId: string): Promise<
  Array<{
    id: string
    unit_number: string
    latest_reading: number
  }>
> {
  try {
    const supabase = await createServerClient()

    const { data: units, error: unitsErr } = await supabase
      .from('units')
      .select('id, unit_number')
      .eq('property_id', propertyId)
      .order('unit_number', { ascending: true })

    if (unitsErr || !units) return []

    // Fetch latest reading for each unit
    const { data: readings } = await supabase
      .from('utility_readings')
      .select('unit_id, current_reading')
      .eq('property_id', propertyId)
      .eq('utility_type', 'WATER')
      .order('reading_date', { ascending: false })
      .order('created_at', { ascending: false })

    const latestMap = new Map<string, number>()
    readings?.forEach((r) => {
      if (!latestMap.has(r.unit_id)) {
        latestMap.set(r.unit_id, Number(r.current_reading || 0))
      }
    })

    return units.map((u) => ({
      id: u.id,
      unit_number: u.unit_number,
      latest_reading: latestMap.get(u.id) ?? 0.0,
    }))
  } catch (err) {
    console.error('Error in getPropertyUnitsForTemplate:', err)
    return []
  }
}

/**
 * Approves and transitions utility pre-bills from 'draft' to either:
 * - 'bill_now': Generates a standalone ledger transaction/invoice for each reading immediately
 * - 'bundle': Marks status as 'bundled' so the monthly rent cron attaches it to the next rent invoice
 */
export async function approveUtilityPreBills(
  readingIds: string[],
  billingStrategy: 'bill_now' | 'bundle'
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const supabase = await createServerClient()
    const { userId, agencyId, role } = await getUserAgencyContext()
    const isOwner = role === 'agency_owner' || role === 'super_admin'

    if (!readingIds || !Array.isArray(readingIds) || readingIds.length === 0) {
      return { success: false, count: 0, error: 'No readings selected for approval.' }
    }

    if (billingStrategy !== 'bill_now' && billingStrategy !== 'bundle') {
      return { success: false, count: 0, error: 'Invalid billing strategy.' }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const admin =
      supabaseUrl && serviceRoleKey
        ? createAdminClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : supabase

    // 1. Fetch draft readings with unit and property metadata
    const { data: readings, error: fetchErr } = await admin
      .from('utility_readings')
      .select(`
        id,
        property_id,
        unit_id,
        consumption,
        rate_per_unit,
        total_charge,
        reading_date,
        status,
        units (
          id,
          unit_number,
          property_id
        ),
        properties (
          id,
          name,
          agency_id,
          manager_id
        )
      `)
      .in('id', readingIds)
      .eq('status', 'draft')

    if (fetchErr) {
      return {
        success: false,
        count: 0,
        error: `Failed to fetch draft readings: ${fetchErr.message}`,
      }
    }

    if (!readings || readings.length === 0) {
      return {
        success: false,
        count: 0,
        error: 'No matching draft readings found to process.',
      }
    }

    // 2. Validate permissions
    for (const r of readings) {
      const prop = r.properties as any
      if (prop && prop.agency_id !== agencyId && !isOwner) {
        return { success: false, count: 0, error: 'Unauthorized across agency boundaries.' }
      }
      if (!isOwner && prop?.manager_id !== userId) {
        return {
          success: false,
          count: 0,
          error: 'Unauthorized for one or more target properties.',
        }
      }
    }

    const validReadingIds = readings.map((r) => r.id)
    const today = new Date().toISOString().slice(0, 10)

    if (billingStrategy === 'bill_now') {
      // Fetch active leases for these units to map tenant IDs
      const unitIds = Array.from(new Set(readings.map((r) => r.unit_id)))
      const { data: activeLeases } = await admin
        .from('leases')
        .select('unit_id, tenant_id')
        .in('unit_id', unitIds)
        .eq('is_active', true)

      const unitTenantMap = new Map<string, string>()
      activeLeases?.forEach((l) => {
        if (l.unit_id && l.tenant_id) {
          unitTenantMap.set(l.unit_id, l.tenant_id)
        }
      })

      // Generate standalone transaction for each reading
      const transactionsToInsert = readings.map((r) => {
        const unitNumber = (r.units as any)?.unit_number || 'Unit'
        const propName = (r.properties as any)?.name || 'Property'
        const tenantId = unitTenantMap.get(r.unit_id) || null
        const monthYear = new Date(r.reading_date || today).toLocaleString('en-US', {
          month: 'short',
          year: 'numeric',
        })

        return {
          agency_id: agencyId,
          property_id: r.property_id,
          unit_id: r.unit_id,
          tenant_id: tenantId,
          transaction_type: 'expense',
          amount: Number(r.total_charge || 0),
          transaction_date: today,
          description: `Water Utility Invoice (${monthYear}): Unit ${unitNumber} at ${propName} [${r.consumption} m³ @ KES ${r.rate_per_unit}]`,
        }
      })

      if (transactionsToInsert.length > 0) {
        const { error: txErr } = await admin.from('transactions').insert(transactionsToInsert)
        if (txErr) {
          console.error('Error creating standalone utility transactions:', txErr)
          return {
            success: false,
            count: 0,
            error: `Failed to generate invoices: ${txErr.message}`,
          }
        }
      }

      // Update status to 'invoiced'
      const { error: updateErr } = await admin
        .from('utility_readings')
        .update({ status: 'invoiced' })
        .in('id', validReadingIds)

      if (updateErr) {
        return {
          success: false,
          count: 0,
          error: `Failed to update status: ${updateErr.message}`,
        }
      }
    } else if (billingStrategy === 'bundle') {
      // Update status to 'bundled'
      const { error: updateErr } = await admin
        .from('utility_readings')
        .update({ status: 'bundled' })
        .in('id', validReadingIds)

      if (updateErr) {
        return {
          success: false,
          count: 0,
          error: `Failed to bundle readings: ${updateErr.message}`,
        }
      }
    }

    revalidatePath('/dashboard/utilities')
    revalidatePath('/dashboard/clearance')
    revalidatePath('/dashboard/financials')

    return {
      success: true,
      count: validReadingIds.length,
    }
  } catch (err: unknown) {
    console.error('Error in approveUtilityPreBills:', err)
    return {
      success: false,
      count: 0,
      error: err instanceof Error ? err.message : 'Failed to approve utility pre-bills.',
    }
  }
}



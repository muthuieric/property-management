'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import LeadCard, { LeadItem } from './LeadCard'
import CreateLeadDrawer from './CreateLeadDrawer'
import UnitMatchModal from './UnitMatchModal'
import CreateLeaseDrawer, { UnitOption, TenantOption } from '@/app/dashboard/components/CreateLeaseDrawer'
import { updateLeadStage, convertLeadToTenant, UnitMatch } from '../actions'

interface PropertyOption {
  id: string
  name: string
}

interface CoordinatorOption {
  id: string
  first_name: string
  last_name: string
}

interface LeasingKanbanBoardProps {
  initialLeads: LeadItem[]
  properties: PropertyOption[]
  coordinators: CoordinatorOption[]
  vacantUnits: UnitOption[]
  tenants: TenantOption[]
}

interface ColumnConfig {
  id: string
  title: string
  subtitle: string
  step: number
  headerBadgeBg: string
  headerBadgeText: string
  borderColor: string
}

const COLUMNS: ColumnConfig[] = [
  {
    id: 'lead_entry',
    title: 'Lead Entry',
    subtitle: 'Baseline intake, contact details, source tag',
    step: 1,
    headerBadgeBg: 'bg-blue-50 text-blue-800 border-blue-200',
    headerBadgeText: 'Intake',
    borderColor: 'border-blue-300',
  },
  {
    id: 'negotiating',
    title: 'Negotiation',
    subtitle: 'Follow-up notes, site visit scheduling',
    step: 2,
    headerBadgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
    headerBadgeText: 'Engaged',
    borderColor: 'border-amber-300',
  },
  {
    id: 'pre_qualification',
    title: 'Pre-Qualification',
    subtitle: 'Budget match indicators, bedroom preferences',
    step: 3,
    headerBadgeBg: 'bg-purple-50 text-purple-800 border-purple-200',
    headerBadgeText: 'Qualified',
    borderColor: 'border-purple-300',
  },
  {
    id: 'converted',
    title: 'Converted / Closed',
    subtitle: 'Completed tenant onboarding & lease allocations',
    step: 4,
    headerBadgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    headerBadgeText: 'Closed',
    borderColor: 'border-emerald-300',
  },
]

export default function LeasingKanbanBoard({
  initialLeads,
  properties,
  coordinators,
  vacantUnits,
  tenants,
}: LeasingKanbanBoardProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  // State
  const [leads, setLeads] = useState<LeadItem[]>(initialLeads)
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all')
  const [selectedCoordinatorId, setSelectedCoordinatorId] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [showLostLeads, setShowLostLeads] = useState<boolean>(false)

  // Drawer / Modal states
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false)
  const [matchLead, setMatchLead] = useState<LeadItem | null>(null)
  const [convertingLeadId, setConvertingLeadId] = useState<string | null>(null)

  // CreateLeaseDrawer handoff state
  const [isLeaseDrawerOpen, setIsLeaseDrawerOpen] = useState(false)
  const [leasePreselectedTenant, setLeasePreselectedTenant] = useState<TenantOption | null>(null)
  const [leasePreselectedUnit, setLeasePreselectedUnit] = useState<UnitOption | null>(null)

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Property filter
      if (selectedPropertyId !== 'all') {
        if (lead.property_id !== selectedPropertyId) return false
      }

      // Coordinator filter
      if (selectedCoordinatorId !== 'all') {
        if (lead.assigned_coordinator_id !== selectedCoordinatorId) return false
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchName = lead.full_name.toLowerCase().includes(q)
        const matchPhone = lead.phone_number.toLowerCase().includes(q)
        const matchEmail = (lead.email || '').toLowerCase().includes(q)
        const matchNotes = (lead.notes || '').toLowerCase().includes(q)
        if (!matchName && !matchPhone && !matchEmail && !matchNotes) return false
      }

      return true
    })
  }, [leads, selectedPropertyId, selectedCoordinatorId, searchQuery])

  // Summary Metrics
  const metrics = useMemo(() => {
    const active = leads.filter((l) => l.stage !== 'lost')
    const totalPipelineValue = active.reduce((sum, l) => sum + Number(l.budget_max || 0), 0)
    const preQualifiedCount = leads.filter((l) => l.stage === 'pre_qualification').length
    const convertedCount = leads.filter((l) => l.stage === 'converted').length
    const conversionRate = active.length > 0 ? Math.round((convertedCount / active.length) * 100) : 0

    return {
      activeCount: active.length,
      totalPipelineValue,
      preQualifiedCount,
      convertedCount,
      conversionRate,
    }
  }, [leads])

  // Handlers
  const handleStageChange = (leadId: string, newStage: string) => {
    // Optimistic update
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, stage: newStage } : l))
    )

    startTransition(async () => {
      try {
        const res = await updateLeadStage(leadId, newStage)
        if (!res.success) {
          // Revert on error
          setLeads(initialLeads)
          alert(res.error || 'Failed to update lead stage.')
        } else {
          router.refresh()
        }
      } catch (err: any) {
        setLeads(initialLeads)
        alert(err?.message || 'Error communicating with server.')
      }
    })
  }

  const handleConvert = (lead: LeadItem) => {
    setConvertingLeadId(lead.id)

    startTransition(async () => {
      try {
        const res = await convertLeadToTenant(lead.id)
        if (res.success && res.tenant) {
          // Optimistically update lead state
          setLeads((prev) =>
            prev.map((l) =>
              l.id === lead.id
                ? { ...l, stage: 'converted', converted_tenant_id: res.tenantId }
                : l
            )
          )

          // Pre-populate tenant in CreateLeaseDrawer
          const convertedTenantOpt: TenantOption = {
            id: res.tenant.id,
            first_name: res.tenant.first_name,
            last_name: res.tenant.last_name,
            email: res.tenant.email,
            phone_number: res.tenant.phone_number,
          }

          setLeasePreselectedTenant(convertedTenantOpt)

          // Find candidate vacant unit matching lead property if available
          if (lead.property_id) {
            const propVacant = vacantUnits.find((u: any) => u.property_id === lead.property_id)
            if (propVacant) {
              setLeasePreselectedUnit(propVacant)
            }
          }

          // Open CreateLeaseDrawer
          setIsLeaseDrawerOpen(true)
          router.refresh()
        } else {
          alert(res.error || 'Could not convert prospect to tenant.')
        }
      } catch (err: any) {
        alert(err?.message || 'An unexpected error occurred during conversion.')
      } finally {
        setConvertingLeadId(null)
      }
    })
  }

  const handleUnitMatchAllocate = (unitMatch: UnitMatch) => {
    const matchedUnit = vacantUnits.find((u) => u.id === unitMatch.id) || {
      id: unitMatch.id,
      unit_number: unitMatch.unit_number,
      base_rent: unitMatch.base_rent,
      property_name: unitMatch.property_name,
    }

    setLeasePreselectedUnit(matchedUnit)

    if (matchLead) {
      // If the lead is not yet converted, convert them first
      if (matchLead.stage !== 'converted') {
        handleConvert(matchLead)
      } else if (matchLead.converted_tenant_id) {
        const existingTenant = tenants.find((t) => t.id === matchLead.converted_tenant_id)
        if (existingTenant) {
          setLeasePreselectedTenant(existingTenant)
          setIsLeaseDrawerOpen(true)
        }
      }
    }
  }

  const lostLeads = useMemo(
    () => filteredLeads.filter((l) => l.stage === 'lost'),
    [filteredLeads]
  )

  return (
    <div className="space-y-6">
      {/* Top Header & Overview Bento Metrics */}
      <header className="flex flex-col md:flex-row md:items-end justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-900 text-white shadow-xs">
              4-Stage CRM Pipeline
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {metrics.activeCount} Active Inquiries &bull; {metrics.convertedCount} Converted
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 font-sans">
            Pre-Leasing Pipeline
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Visual pipeline tracking prospective tenants through intake, negotiations, and automated lease conversion.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsCreateDrawerOpen(true)}
            className="bg-slate-900 hover:bg-slate-800 hover:shadow-md text-white px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ease-in-out text-xs font-semibold shadow-xs flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            <span>+ Add New Lead</span>
          </button>
        </div>
      </header>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Active Pipeline Prospects
          </span>
          <p className="text-2xl font-bold text-slate-900 mt-2 tabular-nums">
            {metrics.activeCount}
          </p>
          <span className="text-[11px] text-slate-400 mt-1">Across all inquiry channels</span>
        </div>

        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Pipeline Volume / Capacity
          </span>
          <p className="text-2xl font-bold text-slate-900 mt-2 font-mono tabular-nums">
            KES {metrics.totalPipelineValue.toLocaleString()}
          </p>
          <span className="text-[11px] text-slate-400 mt-1">Aggregate prospect monthly budget</span>
        </div>

        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Pre-Qualified Leads
          </span>
          <p className="text-2xl font-bold text-purple-700 mt-2 tabular-nums">
            {metrics.preQualifiedCount}
          </p>
          <span className="text-[11px] text-slate-400 mt-1">Ready for contract & lease issuance</span>
        </div>

        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Conversion Rate
          </span>
          <p className="text-2xl font-bold text-emerald-700 mt-2 tabular-nums">
            {metrics.conversionRate}%
          </p>
          <span className="text-[11px] text-slate-400 mt-1">Prospects converted to active tenants</span>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col md:flex-row items-center justify-between gap-3 shadow-2xs">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <svg
            className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search prospect by name, phone, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
          {/* Property Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Property:</span>
            <select
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 transition"
            >
              <option value="all">All Properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Coordinator Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Coordinator:</span>
            <select
              value={selectedCoordinatorId}
              onChange={(e) => setSelectedCoordinatorId(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 transition"
            >
              <option value="all">All Coordinators</option>
              {coordinators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name}
                </option>
              ))}
            </select>
          </div>

          {/* Toggle Lost Leads */}
          {lostLeads.length > 0 && (
            <button
              type="button"
              onClick={() => setShowLostLeads(!showLostLeads)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border transition font-medium cursor-pointer ${
                showLostLeads
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {showLostLeads ? `Hide Lost (${lostLeads.length})` : `Show Lost (${lostLeads.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Kanban Pipeline Board - 4 Dedicated Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {COLUMNS.map((col) => {
          const columnLeads = filteredLeads.filter((l) => l.stage === col.id)

          return (
            <div
              key={col.id}
              className="bg-slate-100/70 rounded-2xl p-3.5 border border-slate-200/80 flex flex-col gap-3 min-h-[500px]"
            >
              {/* Column Header */}
              <div className="flex items-start justify-between pb-2 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center">
                      {col.step}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">{col.title}</h3>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{col.subtitle}</p>
                </div>

                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 ${col.headerBadgeBg}`}
                >
                  {columnLeads.length}
                </span>
              </div>

              {/* Column Cards Container */}
              <div className="flex flex-col gap-3 flex-1">
                {columnLeads.length === 0 ? (
                  <div className="h-40 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center p-4 text-center">
                    <p className="text-xs text-slate-400 font-medium">No leads in this stage</p>
                    {col.id === 'lead_entry' && (
                      <button
                        type="button"
                        onClick={() => setIsCreateDrawerOpen(true)}
                        className="mt-2 text-[11px] font-semibold text-slate-900 hover:underline cursor-pointer"
                      >
                        + Register First Lead
                      </button>
                    )}
                  </div>
                ) : (
                  columnLeads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      isConverting={convertingLeadId === lead.id}
                      onStageChange={handleStageChange}
                      onConvert={handleConvert}
                      onViewMatches={(l) => setMatchLead(l)}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Optional Lost Leads Drawer/Row */}
      {showLostLeads && lostLeads.length > 0 && (
        <div className="bg-rose-50/50 rounded-2xl p-4 border border-rose-200 mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-900 flex items-center gap-2">
              <span>Lost / Withdrawn Leads ({lostLeads.length})</span>
            </h3>
            <span className="text-[11px] text-rose-700">Archived prospects that declined or fell through</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {lostLeads.map((lead) => (
              <div key={lead.id} className="bg-white rounded-xl p-3 border border-rose-200 text-xs space-y-1 opacity-75">
                <p className="font-bold text-slate-900">{lead.full_name}</p>
                <p className="text-[11px] text-slate-500">{lead.phone_number}</p>
                <div className="pt-2 flex justify-between items-center">
                  <span className="text-[10px] text-rose-700 font-semibold">Status: Lost</span>
                  <button
                    type="button"
                    onClick={() => handleStageChange(lead.id, 'lead_entry')}
                    className="text-[10px] text-slate-700 hover:underline font-semibold cursor-pointer"
                  >
                    Reopen
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Intake Drawer */}
      <CreateLeadDrawer
        isOpen={isCreateDrawerOpen}
        onClose={() => setIsCreateDrawerOpen(false)}
        properties={properties}
        coordinators={coordinators}
        defaultPropertyId={selectedPropertyId !== 'all' ? selectedPropertyId : undefined}
      />

      {/* AI Recommendation Match Modal */}
      <UnitMatchModal
        isOpen={Boolean(matchLead)}
        onClose={() => setMatchLead(null)}
        leadId={matchLead?.id || null}
        leadName={matchLead?.full_name}
        leadBudget={matchLead?.budget_max}
        onSelectUnit={handleUnitMatchAllocate}
      />

      {/* Integrated CreateLeaseDrawer pre-filled upon conversion */}
      <CreateLeaseDrawer
        isOpen={isLeaseDrawerOpen}
        onClose={() => {
          setIsLeaseDrawerOpen(false)
          setLeasePreselectedTenant(null)
          setLeasePreselectedUnit(null)
        }}
        selectedTenant={leasePreselectedTenant}
        selectedUnit={leasePreselectedUnit}
        tenants={tenants}
        vacantUnits={vacantUnits}
        onSuccess={() => {
          setIsLeaseDrawerOpen(false)
          router.refresh()
        }}
      />
    </div>
  )
}


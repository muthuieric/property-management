'use client'

import { useState, useMemo } from 'react'
import SlideOverDrawer from '../components/SlideOverDrawer'

export interface PropertyItem {
  id: string
  name: string
  location: string
  manager_id: string | null
  openTicketsCount: number
  occupiedUnits: number
}

interface PortfolioAssignmentDrawerProps {
  managerId: string
  managerName: string
  properties: PropertyItem[]
  managerNameMap: Record<string, string>
  formAction: (formData: FormData) => void
}

export default function PortfolioAssignmentDrawer({
  managerId,
  managerName,
  properties,
  managerNameMap,
  formAction,
}: PortfolioAssignmentDrawerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    properties.filter((p) => p.manager_id === managerId).map((p) => p.id)
  )
  const [showClearModal, setShowClearModal] = useState(false)

  // Filter properties based on search
  const filteredProperties = useMemo(() => {
    if (!searchQuery.trim()) return properties
    const q = searchQuery.toLowerCase()
    return properties.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.location && p.location.toLowerCase().includes(q))
    )
  }, [properties, searchQuery])

  // Toggle individual property checkbox
  const handleToggle = (propertyId: string) => {
    setSelectedIds((prev) =>
      prev.includes(propertyId)
        ? prev.filter((id) => id !== propertyId)
        : [...prev, propertyId]
    )
  }

  // Batch Select All
  const handleSelectAll = () => {
    setSelectedIds(properties.map((p) => p.id))
  }

  // Batch Clear All with check for critical tickets
  const handleClearAllClick = () => {
    const affectedPropertiesWithTickets = properties.filter(
      (p) => selectedIds.includes(p.id) && p.openTicketsCount > 0
    )

    if (affectedPropertiesWithTickets.length > 0) {
      setShowClearModal(true)
    } else {
      setSelectedIds([])
    }
  }

  const confirmClearAll = () => {
    setSelectedIds([])
    setShowClearModal(false)
  }

  // Calculate statistics for confirmation warning
  const currentlySelectedProps = properties.filter((p) => selectedIds.includes(p.id))
  const totalOpenTicketsAtRisk = currentlySelectedProps.reduce(
    (sum, p) => sum + (p.openTicketsCount || 0),
    0
  )
  const totalOccupiedUnitsAtRisk = currentlySelectedProps.reduce(
    (sum, p) => sum + (p.occupiedUnits || 0),
    0
  )

  const drawerFooter = (
    <div className="flex items-center justify-between w-full">
      <div className="text-xs text-slate-500">
        <span className="font-bold text-slate-900 tabular-nums">{selectedIds.length}</span> of{' '}
        <span className="tabular-nums">{properties.length}</span> sites selected
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-all duration-200 ease-in-out"
        >
          Cancel
        </button>
        <button
          type="submit"
          form={`portfolio-form-${managerId}`}
          className="bg-slate-900 hover:bg-slate-800 hover:shadow-md text-white px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 ease-in-out flex items-center gap-1.5 shadow-xs"
        >
          <span>Save Portfolio Assignment</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 hover:shadow-md text-white cursor-pointer transition-all duration-200 ease-in-out shadow-xs"
      >
        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <span>Manage Portfolio</span>
      </button>

      <SlideOverDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={`Portfolio Assignment: ${managerName}`}
        subtitle="Select properties to delegate operational management. Unselected properties will be released."
        footer={drawerFooter}
        maxWidth="max-w-xl"
      >
        <form
          id={`portfolio-form-${managerId}`}
          action={formAction}
          className="space-y-4"
        >
          <input type="hidden" name="manager_id" value={managerId} />

          {/* Hidden inputs to guarantee array submission with Next.js Server Actions */}
          {selectedIds.map((id) => (
            <input key={`hidden-${id}`} type="hidden" name="property_ids" value={id} />
          ))}

          {/* Search and Batch Actions Bar */}
          <div className="space-y-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search properties by name or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pl-9 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-[11px] text-slate-500 font-medium">
                {filteredProperties.length} sites shown
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 px-2.5 py-1 rounded-lg cursor-pointer transition-all duration-200 ease-in-out shadow-xs"
                >
                  Select All ({properties.length})
                </button>
                <button
                  type="button"
                  onClick={handleClearAllClick}
                  className="text-[11px] font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100/80 border border-rose-200 px-2.5 py-1 rounded-lg cursor-pointer transition-all duration-200 ease-in-out shadow-xs"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>

          {/* Property Selection Cards List */}
          {filteredProperties.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 italic bg-white rounded-xl border border-slate-200">
              No matching properties found.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[calc(100vh-290px)] overflow-y-auto pr-1">
              {filteredProperties.map((property) => {
                const isSelected = selectedIds.includes(property.id)
                const isAssignedToOther =
                  property.manager_id && property.manager_id !== managerId
                const otherManagerName = isAssignedToOther
                  ? managerNameMap[property.manager_id!] || 'Another Manager'
                  : null

                return (
                  <label
                    key={`prop-${managerId}-${property.id}`}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer text-xs transition-all duration-200 ${
                      isSelected
                        ? 'bg-emerald-50/40 border-emerald-300 shadow-xs'
                        : 'bg-white hover:bg-slate-50/80 border-slate-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggle(property.id)}
                      className="mt-1 rounded text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-slate-900 text-sm">
                          {property.name}
                        </p>
                        {property.openTicketsCount > 0 ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 shrink-0">
                            {property.openTicketsCount} tickets
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                            0 tickets
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                        <span>{property.location || 'Location unlisted'}</span>
                        <span>&bull;</span>
                        <span className="tabular-nums">{property.occupiedUnits} occupied units</span>
                      </div>

                      {isAssignedToOther && !isSelected && (
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-[10px] text-amber-800 font-medium">
                          <span>Currently assigned to:</span>
                          <strong className="font-semibold">{otherManagerName}</strong>
                        </div>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </form>

        {/* Clear All Critical Warning Modal */}
        {showClearModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-3 text-rose-600">
                <div className="p-2.5 bg-rose-100 rounded-xl">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Critical Operational Risk
                  </h3>
                  <p className="text-xs text-rose-600 font-semibold">
                    Active Tickets Will Become Orphaned
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Clearing all assignments for <strong className="text-slate-900">{managerName}</strong> will unassign{' '}
                <strong className="text-slate-900">{selectedIds.length} properties</strong> containing{' '}
                <strong className="text-rose-700 font-bold">{totalOpenTicketsAtRisk} open maintenance tickets</strong> and{' '}
                <strong className="text-slate-900">{totalOccupiedUnitsAtRisk} occupied units</strong>.
              </p>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900">
                ⚠️ <strong>Warning:</strong> No property coordinator will receive SLA countdown or breach notifications for these tickets until they are reassigned.
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowClearModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-all duration-200 ease-in-out"
                >
                  Cancel & Keep
                </button>
                <button
                  type="button"
                  onClick={confirmClearAll}
                  className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 hover:shadow-md text-white rounded-lg cursor-pointer transition-all duration-200 ease-in-out shadow-xs"
                >
                  Yes, Unassign All Sites
                </button>
              </div>
            </div>
          </div>
        )}
      </SlideOverDrawer>
    </>
  )
}

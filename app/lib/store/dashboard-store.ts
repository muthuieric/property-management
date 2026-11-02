import { create } from "zustand"
import { persist } from "zustand/middleware"

export type TableDensity = "compact" | "standard" | "spacious"

interface DashboardContext {
  selectedPropertyId: string | null
  selectedPropertyName: string | null
  selectedTenantId: string | null
  selectedTenantName: string | null
  setPropertyContext: (propertyId: string | null, propertyName: string | null) => void
  setTenantContext: (tenantId: string | null, tenantName: string | null) => void
  clearContext: () => void
}

interface TablePreferences {
  density: TableDensity
  pageSize: number
  columnVisibility: Record<string, boolean>
  setDensity: (density: TableDensity) => void
  setPageSize: (pageSize: number) => void
  toggleColumn: (columnId: string, visible: boolean) => void
}

interface Notifications {
  items: Array<{ id: string; kind: "success" | "error"; message: string; ts: number }>
  addNotification: (kind: "success" | "error", message: string) => string
  removeNotification: (id: string) => void
}

export const useDashboardStore = create<DashboardContext & TablePreferences & Notifications>()(
  persist(
    (set) => ({
      // Cross-page context (tenant / property selection persists across nav)
      selectedPropertyId: null,
      selectedPropertyName: null,
      selectedTenantId: null,
      selectedTenantName: null,
      setPropertyContext: (propertyId, propertyName) =>
        set({ selectedPropertyId: propertyId, selectedPropertyName: propertyName }),
      setTenantContext: (tenantId, tenantName) =>
        set({ selectedTenantId: tenantId, selectedTenantName: tenantName }),
      clearContext: () =>
        set({
          selectedPropertyId: null,
          selectedPropertyName: null,
          selectedTenantId: null,
          selectedTenantName: null,
        }),

      // Table view preferences (persisted so filters/density survive navigation)
      density: "compact",
      pageSize: 25,
      columnVisibility: {},
      setDensity: (density) => set({ density }),
      setPageSize: (pageSize) => set({ pageSize }),
      toggleColumn: (columnId, visible) =>
        set((state) => ({
          columnVisibility: { ...state.columnVisibility, [columnId]: visible },
        })),

      // In-app notification queue (cross-page toasts)
      items: [],
      addNotification: (kind, message) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        set((state) => ({
          items: [...state.items, { id, kind, message, ts: Date.now() }],
        }))
        return id
      },
      removeNotification: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
    }),
    {
      name: "pm-dashboard-storage",
      partialize: (state) => ({
        density: state.density,
        pageSize: state.pageSize,
        columnVisibility: state.columnVisibility,
      }),
    }
  )
)

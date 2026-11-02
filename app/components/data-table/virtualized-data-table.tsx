'use client'

import * as React from 'react'
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type Row,
  type RowData,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '@/lib/utils'

export type TableDensity = 'compact' | 'standard' | 'spacious'

export interface VirtualizedDataTableProps<TData extends RowData> {
  columns: readonly ColumnDef<TData, unknown>[]
  data: TData[]
  totalCount: number
  pageIndex: number
  pageSize: number
  density?: TableDensity
  sorting?: SortingState
  columnFilters?: ColumnFiltersState
  columnVisibility?: Record<string, boolean>
  loading?: boolean
  rowHeight?: number
  headerHeight?: number
  className?: string
  emptyState?: React.ReactNode
  toolbar?: React.ReactNode
  onPaginationChange: (pagination: PaginationState) => void
  onSortingChange?: (sorting: SortingState) => void
  onColumnFiltersChange?: (filters: ColumnFiltersState) => void
  onColumnVisibilityChange?: (visibility: Record<string, boolean>) => void
  renderCell?: (props: {
    columnId: string
    value: unknown
    row: TData
    rowIndex: number
  }) => React.ReactNode
}

const DENSITY_ROW_HEIGHT: Record<TableDensity, number> = {
  compact: 36,
  standard: 44,
  spacious: 56,
}

const DENSITY_HEADER_HEIGHT: Record<TableDensity, number> = {
  compact: 32,
  standard: 40,
  spacious: 48,
}

function getColumnWidth<TD extends RowData>(column: Column<TD, unknown>): string {
  return ((column.columnDef.meta as { width?: string } | undefined)?.width) ?? '1fr'
}

export function VirtualizedDataTable<TData extends RowData>({
  columns,
  data,
  totalCount,
  pageIndex,
  pageSize,
  density = 'standard',
  sorting = [],
  columnFilters = [],
  columnVisibility = {},
  loading = false,
  rowHeight: rowHeightProp,
  headerHeight: headerHeightProp,
  className,
  emptyState,
  toolbar,
  onPaginationChange,
  onSortingChange,
  onColumnFiltersChange,
  onColumnVisibilityChange,
  renderCell,
}: VirtualizedDataTableProps<TData>) {
  const rowHeight = rowHeightProp ?? DENSITY_ROW_HEIGHT[density]
  const headerHeight = headerHeightProp ?? DENSITY_HEADER_HEIGHT[density]

  const scrollElementRef = React.useRef<HTMLDivElement | null>(null)

  const table = useReactTable<TData>({
    columns: [...columns],
    data,
    pageCount: Math.max(1, Math.ceil(totalCount / pageSize)),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    state: {
      pagination: { pageIndex, pageSize },
      sorting,
      columnFilters,
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const virtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  })

  const visibleColumns = React.useMemo(
    () => table.getAllColumns().filter((c) => columnVisibility[c.id] !== false),
    [table, columnVisibility]
  )

  const pageRows = table.getRowModel().rows
  const virtualItems = virtualizer.getVirtualItems()
  const totalHeight = virtualizer.getTotalSize()

  const handleSort = (columnId: string) => {
    const column = table.getColumn(columnId)
    if (!column?.getCanSort()) return
    const currentSort = table.getState().sorting.find((s) => s.id === columnId)
    const next: SortingState =
      currentSort?.desc
        ? [{ id: columnId, desc: false }]
        : currentSort
          ? [{ id: columnId, desc: true }]
          : [{ id: columnId, desc: false }]
    onSortingChange?.(next)
  }

  const handleFilter = (columnId: string, value: string) => {
    const next = table.getState().columnFilters.filter((f) => f.id !== columnId)
    if (value) next.push({ id: columnId, value })
    onColumnFiltersChange?.(next)
  }

  const handlePage = (delta: number) => {
    const pagination = table.getState().pagination
    const next = Math.max(
      0,
      Math.min(pagination.pageIndex + delta, table.getPageCount() - 1)
    )
    onPaginationChange({ ...pagination, pageIndex: next })
  }

  const handlePageSize = (nextSize: number) => {
    onPaginationChange({ pageIndex: 0, pageSize: nextSize })
  }

  const handleToggleColumn = (columnId: string, visible: boolean) => {
    onColumnVisibilityChange?.({ ...columnVisibility, [columnId]: visible })
  }

  const densityClass = cn(
    density === 'compact' ? 'text-xs' : density === 'standard' ? 'text-sm' : 'text-base'
  )

  const renderHeaderCell = (column: Column<TData, unknown>) => {
    const canSort = column.getCanSort()
    const isSorted = column.getIsSorted()
    const width = getColumnWidth(column)
    const filterable = Boolean((column.columnDef.meta as { filterable?: boolean } | undefined)?.filterable)

    return (
      <div
        key={column.id}
        className={cn(
          'flex items-center gap-1 border-b bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider select-none',
          density === 'compact' ? 'px-3 py-1.5' : density === 'standard' ? 'px-4 py-2' : 'px-5 py-2.5',
          canSort ? 'cursor-pointer hover:bg-slate-100 transition-colors' : ''
        )}
        style={{
          flex: `0 0 ${width}`,
          minWidth: width,
          position: 'sticky',
          top: 0,
          zIndex: 2,
          background: 'inherit',
        }}
        onClick={() => canSort && handleSort(column.id)}
      >
        <span className="truncate">
          {flexRender(column.columnDef.header as React.ReactNode, { column })}
        </span>
        {canSort && (
          <span className={cn('ml-1 text-[10px]', isSorted === 'asc' ? 'text-emerald-600' : 'text-slate-400')}>
            {isSorted === 'asc' ? '▲' : isSorted === 'desc' ? '▼' : '↕'}
          </span>
        )}
        {filterable && (
          <input
            type="text"
            placeholder="Filter"
            className={cn(
              'mt-1 w-full text-[10px] border border-slate-300 rounded px-1.5 py-0.5 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500',
              density === 'compact' ? 'text-[9px] py-0' : ''
            )}
            defaultValue={
              String(
                table.getState().columnFilters.find((f) => f.id === column.id)?.value ?? ''
              )
            }
            onChange={(e) => handleFilter(column.id, e.target.value)}
          />
        )}
      </div>
    )
  }

  const renderRow = (row: Row<TData>, virtualIndex: number) => {
    const cells = row.getVisibleCells()
    const offset = virtualItems[virtualIndex]?.start ?? 0
    return (
      <div
        key={row.id}
        className={cn(
          'flex border-b border-slate-100/60 items-center',
          density === 'compact' ? 'px-3 py-1.5' : density === 'standard' ? 'px-4 py-2' : 'px-5 py-2.5',
          'hover:bg-slate-50 transition-colors'
        )}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          transform: `translateY(${offset}px)`,
          height: rowHeight,
        }}
      >
        {cells.map((cell) => {
          const column = cell.column
          const width = getColumnWidth(column)
          const value = renderCell
            ? renderCell({
                columnId: column.id,
                value: cell.getValue(),
                row: row.original,
                rowIndex: row.index,
              })
            : cell.renderValue()
          return (
            <div
              key={column.id}
              className={cn(
                'truncate min-w-0',
                densityClass,
                (column.columnDef.meta as { alignRight?: boolean } | undefined)?.alignRight
                  ? 'text-right'
                  : 'text-left'
              )}
              style={{ flex: `0 0 ${width}`, minWidth: width }}
              title={typeof value === 'string' ? value : undefined}
            >
              {value}
            </div>
          )
        })}
      </div>
    )
  }

  if (loading) {
    return (
      <div className={cn('w-full', className)}>
        <div className="p-8 text-center text-slate-500 text-xs">Loading…</div>
      </div>
    )
  }

  if (totalCount === 0 || data.length === 0) {
    return (
      <div className={cn('w-full', className)}>
        {emptyState ?? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-xs font-medium text-slate-900">No records found</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Adjust your filters or try a different date range.
            </p>
          </div>
        )}
      </div>
    )
  }

  const pageCount = table.getPageCount()
  const pagination = table.getState().pagination
  const isFirstPage = pagination.pageIndex === 0
  const isLastPage = pagination.pageIndex === pageCount - 1
  const from = Math.min(pagination.pageIndex * pageSize + 1, totalCount)
  const to = Math.min((pagination.pageIndex + 1) * pageSize, totalCount)

  return (
    <div className={cn('w-full flex flex-col', className)}>
      {toolbar && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          {toolbar}
        </div>
      )}

      <div
        ref={scrollElementRef}
        className={cn(
          'overflow-auto relative border border-slate-200 rounded-xl bg-white shadow-sm min-h-[300px]'
        )}
        style={{ position: 'relative' }}
      >
        {/* Header row (sticky) */}
        <div
          className="flex z-10 bg-white border-b border-slate-200 shadow-sm"
          style={{ position: 'sticky', top: 0, zIndex: 10, height: headerHeight }}
        >
          {visibleColumns.map((column) => renderHeaderCell(column))}
        </div>

        {/* Virtualized body */}
        <div
          className="relative"
          style={{ height: totalHeight, position: 'relative', minHeight: 1 }}
        >
          {virtualItems.map((_virtualItem, virtualIndex) => {
            const row = pageRows[virtualIndex]
            if (!row) return null
            return renderRow(row, virtualIndex)
          })}
        </div>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <span className={cn('text-[11px] font-medium text-slate-500', densityClass)}>
            Showing {from} to {to} of {totalCount} records
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handlePage(-1)}
              disabled={isFirstPage}
              className={cn(
                'px-2.5 py-1 rounded border text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                isFirstPage
                  ? 'border-slate-200 text-slate-400'
                  : 'border-slate-300 text-slate-900 hover:bg-slate-50'
              )}
            >
              Prev
            </button>
            <button
              onClick={() => handlePage(1)}
              disabled={isLastPage}
              className={cn(
                'px-2.5 py-1 rounded border text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                isLastPage
                  ? 'border-slate-200 text-slate-400'
                  : 'border-slate-300 text-slate-900 hover:bg-slate-50'
              )}
            >
              Next
            </button>
            <select
              value={pageSize}
              onChange={(e) => handlePageSize(Number(e.target.value))}
              className="text-[11px] border border-slate-200 rounded px-1.5 py-0.5 bg-white focus:border-emerald-500 focus:outline-none"
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}/page
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-slate-500">
          Page {pagination.pageIndex + 1} of {pageCount}
        </div>
        {Object.keys(columnVisibility).length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-500">Columns</span>
            <div className="flex gap-1">
              {Object.keys(columnVisibility).map((id) => {
                const visible = columnVisibility[id]
                return (
                  <button
                    key={id}
                    onClick={() => handleToggleColumn(id, !visible)}
                    className={cn(
                      'px-1.5 py-0.5 rounded border text-[10px] font-medium transition-colors',
                      visible
                        ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    )}
                  >
                    {id}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

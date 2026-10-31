import * as React from 'react'

export type SortDirection = 'asc' | 'desc' | false

export interface ColumnSort {
  id: string
  desc: boolean
}

export type SortingState = ColumnSort[]

export interface ColumnFilter {
  id: string
  value: unknown
}

export type ColumnFiltersState = ColumnFilter[]

export type VisibilityState = Record<string, boolean>

export interface PaginationState {
  pageIndex: number
  pageSize: number
}

export interface HeaderContext<TData, TValue = unknown> {
  column: Column<TData, TValue>
  table: Table<TData>
}

export interface CellContext<TData, TValue = unknown> {
  column: Column<TData, TValue>
  row: Row<TData>
  table: Table<TData>
  getValue: () => TValue
}

export type ColumnDef<TData, TValue = unknown> = {
  id?: string
  accessorKey?: keyof TData | string
  header?:
    | React.ReactNode
    | ((context: HeaderContext<TData, TValue>) => React.ReactNode)
  cell?:
    | React.ReactNode
    | ((context: CellContext<TData, TValue>) => React.ReactNode)
  sortingFn?: (rowA: Row<TData>, rowB: Row<TData>) => number
  enableSorting?: boolean
  enableHiding?: boolean
}

export interface Column<TData, TValue = unknown> {
  id: string
  columnDef: ColumnDef<TData, TValue>
  getIsSorted: () => SortDirection
  toggleSorting: (desc?: boolean) => void
  getCanSort: () => boolean
}

export interface Header<TData, TValue = unknown> {
  id: string
  column: Column<TData, TValue>
  isPlaceholder: boolean
  getContext: () => HeaderContext<TData, TValue>
}

export interface HeaderGroup<TData> {
  id: string
  headers: Header<TData>[]
}

export interface Cell<TData, TValue = unknown> {
  id: string
  column: Column<TData, TValue>
  row: Row<TData>
  getContext: () => CellContext<TData, TValue>
  getValue: () => TValue
}

export interface Row<TData> {
  id: string
  index: number
  original: TData
  getVisibleCells: () => Cell<TData>[]
  getIsSelected: () => boolean
}

export interface RowModel<TData> {
  rows: Row<TData>[]
  flatRows: Row<TData>[]
  rowsById: Record<string, Row<TData>>
}

export interface TableState {
  sorting: SortingState
  columnFilters: ColumnFiltersState
  columnVisibility: VisibilityState
  globalFilter: string
  pagination: PaginationState
}

export interface TableOptions<TData> {
  data: TData[]
  columns: ColumnDef<TData>[]
  state?: Partial<Omit<TableState, 'pagination'>> & { pagination?: Partial<PaginationState> }
  onSortingChange?: React.Dispatch<React.SetStateAction<SortingState>>
  onColumnFiltersChange?: React.Dispatch<React.SetStateAction<ColumnFiltersState>>
  onColumnVisibilityChange?: React.Dispatch<React.SetStateAction<VisibilityState>>
  onGlobalFilterChange?: React.Dispatch<React.SetStateAction<string>>
  onPaginationChange?: React.Dispatch<React.SetStateAction<PaginationState>>
  getCoreRowModel?: (table: Table<TData>) => () => RowModel<TData>
  getPaginationRowModel?: (table: Table<TData>) => () => RowModel<TData>
  getSortedRowModel?: (table: Table<TData>) => () => RowModel<TData>
  getFilteredRowModel?: (table: Table<TData>) => () => RowModel<TData>
  initialState?: Partial<Omit<TableState, 'pagination'>> & { pagination?: Partial<PaginationState> }
}

export interface Table<TData> {
  getHeaderGroups: () => HeaderGroup<TData>[]
  getRowModel: () => RowModel<TData>
  getCoreRowModel: () => RowModel<TData>
  getState: () => TableState
  setGlobalFilter: (updater: string | ((old: string) => string)) => void
  setSorting: (updater: SortingState | ((old: SortingState) => SortingState)) => void
  setPageIndex: (updater: number | ((old: number) => number)) => void
  setPageSize: (updater: number | ((old: number) => number)) => void
  previousPage: () => void
  nextPage: () => void
  getCanPreviousPage: () => boolean
  getCanNextPage: () => boolean
  getPageCount: () => number
}

export function flexRender<TProps extends object>(
  Comp: unknown,
  props: TProps
): React.ReactNode {
  if (typeof Comp === 'function') {
    return (Comp as (props: TProps) => React.ReactNode)(props)
  }
  return Comp as React.ReactNode
}

export function getCoreRowModel<TData>(): (table: Table<TData>) => () => RowModel<TData> {
  return (table: Table<TData>) => () => {
    return table.getCoreRowModel()
  }
}

export function getPaginationRowModel<TData>(): (table: Table<TData>) => () => RowModel<TData> {
  return () => () => {
    return { rows: [], flatRows: [], rowsById: {} }
  }
}

export function getSortedRowModel<TData>(): (table: Table<TData>) => () => RowModel<TData> {
  return () => () => {
    return { rows: [], flatRows: [], rowsById: {} }
  }
}

export function getFilteredRowModel<TData>(): (table: Table<TData>) => () => RowModel<TData> {
  return () => () => {
    return { rows: [], flatRows: [], rowsById: {} }
  }
}

export function useReactTable<TData>(options: TableOptions<TData>): Table<TData> {
  const { data, columns } = options

  // Internal fallback states
  const [internalSorting, setInternalSorting] = React.useState<SortingState>(
    () => options.initialState?.sorting || []
  )
  const [internalGlobalFilter, setInternalGlobalFilter] = React.useState<string>(
    () => options.initialState?.globalFilter || ''
  )
  const [internalPagination, setInternalPagination] = React.useState<PaginationState>(() => ({
    pageIndex: options.initialState?.pagination?.pageIndex ?? 0,
    pageSize: options.initialState?.pagination?.pageSize ?? 10,
  }))

  const sorting = options.state?.sorting ?? internalSorting
  const setSortingState = options.onSortingChange ?? setInternalSorting

  const globalFilter = options.state?.globalFilter ?? internalGlobalFilter
  const setGlobalFilterState = options.onGlobalFilterChange ?? setInternalGlobalFilter

  const pagination = options.state?.pagination ?? internalPagination
  const setPaginationState = options.onPaginationChange ?? setInternalPagination

  const columnVisibility = React.useMemo<VisibilityState>(() => {
    return options.state?.columnVisibility ?? {}
  }, [options.state?.columnVisibility])

  // Filter pipeline
  const filteredData = React.useMemo(() => {
    if (!globalFilter || !globalFilter.trim()) return data
    const query = globalFilter.toLowerCase()

    return data.filter((rowItem) => {
      const record = rowItem as Record<string, unknown>
      return Object.values(record).some((val) => {
        if (val == null) return false
        if (typeof val === 'string' || typeof val === 'number') {
          return String(val).toLowerCase().includes(query)
        }
        if (typeof val === 'object') {
          return JSON.stringify(val).toLowerCase().includes(query)
        }
        return false
      })
    })
  }, [data, globalFilter])

  // Sorting pipeline
  const sortedData = React.useMemo(() => {
    if (!sorting.length) return filteredData
    const copy = [...filteredData]

    copy.sort((a, b) => {
      const recA = a as Record<string, unknown>
      const recB = b as Record<string, unknown>

      for (const sort of sorting) {
        const colDef = columns.find(
          (c) => (c.id || c.accessorKey) === sort.id
        )

        let result = 0
        if (colDef?.sortingFn) {
          const rowA: Row<TData> = {
            id: String(recA.id || ''),
            index: 0,
            original: a,
            getVisibleCells: () => [],
            getIsSelected: () => false,
          }
          const rowB: Row<TData> = {
            id: String(recB.id || ''),
            index: 0,
            original: b,
            getVisibleCells: () => [],
            getIsSelected: () => false,
          }
          result = colDef.sortingFn(rowA, rowB)
        } else {
          const valA = recA[sort.id]
          const valB = recB[sort.id]

          if (valA === valB) result = 0
          else if (valA == null) result = -1
          else if (valB == null) result = 1
          else if (typeof valA === 'number' && typeof valB === 'number') {
            result = valA - valB
          } else {
            result = String(valA).localeCompare(String(valB))
          }
        }

        if (result !== 0) {
          return sort.desc ? -result : result
        }
      }
      return 0
    })

    return copy
  }, [filteredData, sorting, columns])

  // Pagination pipeline
  const pageSize = pagination?.pageSize ?? 10
  const rawPageIndex = pagination?.pageIndex ?? 0
  const pageCount = Math.max(1, Math.ceil(sortedData.length / pageSize))
  const safePageIndex = Math.min(Math.max(0, rawPageIndex), pageCount - 1)

  const paginatedData = React.useMemo(() => {
    const start = safePageIndex * pageSize
    return sortedData.slice(start, start + pageSize)
  }, [sortedData, safePageIndex, pageSize])

  const toggleSort = React.useCallback(
    (columnId: string, desc?: boolean) => {
      setSortingState((prev: SortingState) => {
        const current = prev.find((s) => s.id === columnId)
        if (!current) {
          return [{ id: columnId, desc: desc ?? false }]
        }
        if (!current.desc) {
          return [{ id: columnId, desc: true }]
        }
        return []
      })
    },
    [setSortingState]
  )

  const columnsInstances = React.useMemo<Column<TData>[]>(() => {
    return columns.map((colDef, i) => {
      const colId = (colDef.id || colDef.accessorKey || `col_${i}`) as string
      return {
        id: colId,
        columnDef: colDef,
        getIsSorted: () => {
          const s = sorting.find((item) => item.id === colId)
          if (!s) return false
          return s.desc ? 'desc' : 'asc'
        },
        toggleSorting: (desc?: boolean) => toggleSort(colId, desc),
        getCanSort: () => colDef.enableSorting !== false,
      }
    })
  }, [columns, sorting, toggleSort])

  const buildRowModel = React.useCallback(
    (rowsData: TData[], tableProxy: Table<TData>): RowModel<TData> => {
      const rows = rowsData.map((item, rowIndex) => {
        const rec = item as Record<string, unknown>
        const rowId = String(rec.id || rowIndex)
        const rowInstance: Row<TData> = {
          id: rowId,
          index: rowIndex,
          original: item,
          getIsSelected: () => false,
          getVisibleCells: () => {
            return columnsInstances
              .filter((c) => columnVisibility[c.id] !== false)
              .map((column) => {
                return {
                  id: `${rowId}_${column.id}`,
                  column,
                  row: rowInstance,
                  getContext: () => ({
                    column,
                    row: rowInstance,
                    table: tableProxy,
                    getValue: () => rec[column.id],
                  }),
                  getValue: () => rec[column.id],
                }
              })
          },
        }
        return rowInstance
      })

      const rowsById = rows.reduce(
        (acc, r) => ({ ...acc, [r.id]: r }),
        {} as Record<string, Row<TData>>
      )

      return {
        rows,
        flatRows: rows,
        rowsById,
      }
    },
    [columnsInstances, columnVisibility]
  )

  const tableInstance: Table<TData> = React.useMemo(() => {
    const instance: Table<TData> = {
      getHeaderGroups: () => [
        {
          id: 'header_group_0',
          headers: columnsInstances.map((column) => ({
            id: column.id,
            column,
            isPlaceholder: false,
            getContext: () => ({
              column,
              table: instance,
            }),
          })),
        },
      ],
      getRowModel: () => buildRowModel(paginatedData, instance),
      getCoreRowModel: () => buildRowModel(sortedData, instance),
      getState: () => ({
        sorting,
        columnFilters: options.state?.columnFilters ?? [],
        columnVisibility,
        globalFilter,
        pagination: {
          pageIndex: safePageIndex,
          pageSize,
        },
      }),
      setGlobalFilter: (updater) => {
        if (typeof updater === 'function') {
          setGlobalFilterState((prev) => updater(prev))
        } else {
          setGlobalFilterState(updater)
        }
      },
      setSorting: (updater) => {
        if (typeof updater === 'function') {
          setSortingState((prev) => updater(prev))
        } else {
          setSortingState(updater)
        }
      },
      setPageIndex: (updater) => {
        setPaginationState((prev) => {
          const currentIndex = prev?.pageIndex ?? 0
          const nextIndex = typeof updater === 'function' ? updater(currentIndex) : updater
          return {
            pageIndex: Math.max(0, Math.min(nextIndex, pageCount - 1)),
            pageSize: prev?.pageSize ?? 10,
          }
        })
      },
      setPageSize: (updater) => {
        setPaginationState((prev) => {
          const currentSize = prev?.pageSize ?? 10
          const nextSize = typeof updater === 'function' ? updater(currentSize) : updater
          return { pageSize: nextSize, pageIndex: 0 }
        })
      },
      previousPage: () => {
        setPaginationState((prev) => ({
          pageSize: prev?.pageSize ?? 10,
          pageIndex: Math.max(0, (prev?.pageIndex ?? 0) - 1),
        }))
      },
      nextPage: () => {
        setPaginationState((prev) => ({
          pageSize: prev?.pageSize ?? 10,
          pageIndex: Math.min(pageCount - 1, (prev?.pageIndex ?? 0) + 1),
        }))
      },
      getCanPreviousPage: () => safePageIndex > 0,
      getCanNextPage: () => safePageIndex < pageCount - 1,
      getPageCount: () => pageCount,
    }
    return instance
  }, [
    columnsInstances,
    buildRowModel,
    paginatedData,
    sortedData,
    sorting,
    options.state?.columnFilters,
    columnVisibility,
    globalFilter,
    safePageIndex,
    pageSize,
    setGlobalFilterState,
    setSortingState,
    setPaginationState,
    pageCount,
  ])

  return tableInstance
}

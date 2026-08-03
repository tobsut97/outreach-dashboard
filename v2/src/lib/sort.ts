import { useState } from 'react'

export type SortDirection = 'asc' | 'desc'

export interface SortState<K extends string> {
  key: K
  direction: SortDirection
}

/** Cycles a column through none -> ascending -> descending -> none on repeated clicks, the
 * common table-sort convention. */
export function useSort<K extends string>() {
  const [sort, setSort] = useState<SortState<K> | null>(null)
  const toggleSort = (key: K) => {
    setSort((current) => {
      if (current?.key !== key) return { key, direction: 'asc' }
      return current.direction === 'asc' ? { key, direction: 'desc' } : null
    })
  }
  return [sort, toggleSort] as const
}

/** Sorts a copy of `rows` by `sort`, blank/missing values last regardless of direction. Numbers
 * compare numerically, everything else compares as a case-insensitive string. Returns `rows`
 * itself (same reference) when `sort` is null. */
export function sortRows<T, K extends string>(
  rows: T[],
  sort: SortState<K> | null,
  accessor: (row: T, key: K) => string | number | null | undefined,
): T[] {
  if (!sort) return rows
  const value = (row: T) => accessor(row, sort.key)
  const sorted = [...rows].sort((a, b) => {
    const av = value(a)
    const bv = value(b)
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === 'number' && typeof bv === 'number') return av - bv
    return String(av).localeCompare(String(bv))
  })
  return sort.direction === 'asc' ? sorted : sorted.reverse()
}

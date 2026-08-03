import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { TableHead } from '@/components/ui/table'
import type { SortState } from '@/lib/sort'

export function SortableTableHead<K extends string>({
  label,
  sortKey,
  sort,
  onToggle,
  className,
}: {
  label: string
  sortKey: K
  sort: SortState<K> | null
  onToggle: (key: K) => void
  className?: string
}) {
  const active = sort?.key === sortKey
  const Icon = active && sort ? (sort.direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
  return (
    <TableHead className={className}>
      <button type="button" onClick={() => onToggle(sortKey)} className="group inline-flex items-center gap-1">
        {label}
        <Icon
          className={`size-3.5 ${active ? 'text-foreground' : 'text-muted-foreground/50 group-hover:text-foreground'}`}
        />
      </button>
    </TableHead>
  )
}

export interface TreemapItem {
  id: string
  value: number
}

export interface TreemapLeaf {
  id: string
  value: number
  x: number
  y: number
  width: number
  height: number
}

interface ScaledItem {
  id: string
  value: number
  area: number
}

function worst(areas: number[], side: number): number {
  const sum = areas.reduce((total, area) => total + area, 0)
  const max = Math.max(...areas)
  const min = Math.min(...areas)
  return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min))
}

function layoutRow(row: ScaledItem[], x: number, y: number, width: number, height: number): TreemapLeaf[] {
  const rowAreaSum = row.reduce((total, item) => total + item.area, 0)
  const leaves: TreemapLeaf[] = []
  if (width >= height) {
    const columnWidth = rowAreaSum / height
    let cy = y
    for (const item of row) {
      const itemHeight = item.area / columnWidth
      leaves.push({ id: item.id, value: item.value, x, y: cy, width: columnWidth, height: itemHeight })
      cy += itemHeight
    }
  } else {
    const rowHeight = rowAreaSum / width
    let cx = x
    for (const item of row) {
      const itemWidth = item.area / rowHeight
      leaves.push({ id: item.id, value: item.value, x: cx, y, width: itemWidth, height: rowHeight })
      cx += itemWidth
    }
  }
  return leaves
}

/** Squarified treemap layout (Bruls/Huizing/van Wijk) — lays out `items` as non-overlapping
 * rectangles sized proportionally to `value`, favoring near-square rectangles over long slivers. */
export function squarify(items: TreemapItem[], width: number, height: number): TreemapLeaf[] {
  const positive = items.filter((item) => item.value > 0)
  if (positive.length === 0 || width <= 0 || height <= 0) return []

  const total = positive.reduce((sum, item) => sum + item.value, 0)
  const scale = (width * height) / total
  const remaining: ScaledItem[] = positive
    .slice()
    .sort((a, b) => b.value - a.value)
    .map((item) => ({ id: item.id, value: item.value, area: item.value * scale }))

  const leaves: TreemapLeaf[] = []
  let rx = 0
  let ry = 0
  let rw = width
  let rh = height

  while (remaining.length > 0) {
    const side = Math.min(rw, rh)
    let row = [remaining[0]]
    let i = 1
    while (i < remaining.length) {
      const candidate = [...row, remaining[i]]
      const currentWorst = worst(row.map((item) => item.area), side)
      const candidateWorst = worst(candidate.map((item) => item.area), side)
      if (candidateWorst <= currentWorst) {
        row = candidate
        i += 1
      } else {
        break
      }
    }
    remaining.splice(0, row.length)

    const rowAreaSum = row.reduce((sum, item) => sum + item.area, 0)
    leaves.push(...layoutRow(row, rx, ry, rw, rh))

    if (rw >= rh) {
      const columnWidth = rowAreaSum / rh
      rx += columnWidth
      rw -= columnWidth
    } else {
      const rowHeight = rowAreaSum / rw
      ry += rowHeight
      rh -= rowHeight
    }
  }

  return leaves
}

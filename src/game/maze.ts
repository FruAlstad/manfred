export const CELL = 5.6

export type Cell = { x: number; z: number }

export class Maze {
  readonly width: number
  readonly height: number
  readonly open: boolean[][]
  readonly start: Cell
  readonly exit: Cell
  readonly entityStart: Cell

  constructor(width = 21, height = 21, seed = Date.now()) {
    this.width = width
    this.height = height
    const random = mulberry32(seed)
    this.open = Array.from({ length: height }, () => Array(width).fill(false))
    this.carve(random)
    this.openRooms(random)
    this.start = this.firstOpen()
    this.exit = this.farthestFrom(this.start)
    this.entityStart = this.farthestFrom(this.start, this.exit)
  }

  isOpen(x: number, z: number) {
    if (x < 0 || z < 0 || x >= this.width || z >= this.height) return false
    return this.open[z][x]
  }

  cellCenter(cell: Cell) {
    return {
      x: (cell.x + 0.5) * CELL,
      z: (cell.z + 0.5) * CELL,
    }
  }

  worldToCell(x: number, z: number): Cell {
    return {
      x: Math.floor(x / CELL),
      z: Math.floor(z / CELL),
    }
  }

  hasLineOfSight(a: Cell, b: Cell) {
    let x0 = a.x
    let z0 = a.z
    const x1 = b.x
    const z1 = b.z
    const dx = Math.abs(x1 - x0)
    const dz = Math.abs(z1 - z0)
    const sx = x0 < x1 ? 1 : -1
    const sz = z0 < z1 ? 1 : -1
    let err = dx - dz

    while (true) {
      if (!this.isOpen(x0, z0)) return false
      if (x0 === x1 && z0 === z1) return true
      const e2 = 2 * err
      if (e2 > -dz) {
        err -= dz
        x0 += sx
      }
      if (e2 < dx) {
        err += dx
        z0 += sz
      }
    }
  }

  path(from: Cell, to: Cell): Cell[] {
    const key = (c: Cell) => `${c.x},${c.z}`
    const queue: Cell[] = [from]
    const came = new Map<string, Cell | null>([[key(from), null]])

    while (queue.length > 0) {
      const current = queue.shift()
      if (!current) break
      if (current.x === to.x && current.z === to.z) {
        const trail: Cell[] = []
        let node: Cell | null = current
        while (node) {
          trail.push(node)
          node = came.get(key(node)) ?? null
        }
        return trail.reverse()
      }

      for (const next of this.neighbors(current)) {
        if (came.has(key(next))) continue
        came.set(key(next), current)
        queue.push(next)
      }
    }

    return []
  }

  neighbors(cell: Cell): Cell[] {
    const dirs = [
      { x: 1, z: 0 },
      { x: -1, z: 0 },
      { x: 0, z: 1 },
      { x: 0, z: -1 },
    ]
    return dirs
      .map((dir) => ({ x: cell.x + dir.x, z: cell.z + dir.z }))
      .filter((next) => this.isOpen(next.x, next.z))
  }

  private carve(random: () => number) {
    const stack: Cell[] = [{ x: 1, z: 1 }]
    this.open[1][1] = true
    const dirs = [
      { x: 0, z: 2 },
      { x: 0, z: -2 },
      { x: 2, z: 0 },
      { x: -2, z: 0 },
    ]

    while (stack.length > 0) {
      const current = stack[stack.length - 1]
      const options = dirs
        .map((dir) => ({
          x: current.x + dir.x,
          z: current.z + dir.z,
          mx: current.x + dir.x / 2,
          mz: current.z + dir.z / 2,
        }))
        .filter(
          (cell) =>
            cell.x > 0 &&
            cell.z > 0 &&
            cell.x < this.width - 1 &&
            cell.z < this.height - 1 &&
            !this.open[cell.z][cell.x],
        )
        .sort(() => random() - 0.5)

      if (options.length === 0) {
        stack.pop()
        continue
      }

      const next = options[0]
      this.open[next.z][next.x] = true
      this.open[next.mz][next.mx] = true
      stack.push({ x: next.x, z: next.z })
    }
  }

  private openRooms(random: () => number) {
    const rooms = 28
    for (let i = 0; i < rooms; i += 1) {
      const x = 1 + Math.floor(random() * (this.width - 2))
      const z = 1 + Math.floor(random() * (this.height - 2))
      const span = random() > 0.6 ? 2 : 1
      for (let dz = -span; dz <= span; dz += 1) {
        for (let dx = -span; dx <= span; dx += 1) {
          const nx = x + dx
          const nz = z + dz
          if (nx <= 0 || nz <= 0 || nx >= this.width - 1 || nz >= this.height - 1) {
            continue
          }
          if (random() > 0.18) this.open[nz][nx] = true
        }
      }
    }
  }

  private firstOpen(): Cell {
    for (let z = 1; z < this.height; z += 1) {
      for (let x = 1; x < this.width; x += 1) {
        if (this.open[z][x]) return { x, z }
      }
    }
    return { x: 1, z: 1 }
  }

  private farthestFrom(from: Cell, avoid?: Cell): Cell {
    const key = (c: Cell) => `${c.x},${c.z}`
    const queue: Array<Cell & { dist: number }> = [{ ...from, dist: 0 }]
    const seen = new Set([key(from)])
    let best = { ...from, dist: 0 }

    while (queue.length > 0) {
      const current = queue.shift()
      if (!current) break
      if (
        current.dist > best.dist &&
        (!avoid || Math.abs(current.x - avoid.x) + Math.abs(current.z - avoid.z) > 4)
      ) {
        best = current
      }
      for (const next of this.neighbors(current)) {
        if (seen.has(key(next))) continue
        seen.add(key(next))
        queue.push({ ...next, dist: current.dist + 1 })
      }
    }

    return { x: best.x, z: best.z }
  }

  spawnCells(count: number, minDistFromStart = 8): Cell[] {
    const open: Cell[] = []
    for (let z = 1; z < this.height - 1; z += 1) {
      for (let x = 1; x < this.width - 1; x += 1) {
        if (!this.open[z][x]) continue
        const dist =
          Math.abs(x - this.start.x) + Math.abs(z - this.start.z)
        if (dist < minDistFromStart) continue
        open.push({ x, z })
      }
    }

    for (let i = open.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[open[i], open[j]] = [open[j], open[i]]
    }

    const picked: Cell[] = []
    for (const cell of open) {
      if (picked.length >= count) break
      const crowded = picked.some(
        (other) => Math.abs(other.x - cell.x) + Math.abs(other.z - cell.z) < 3,
      )
      if (!crowded) picked.push(cell)
    }

    while (picked.length < count && open.length > 0) {
      picked.push(open[picked.length % open.length])
    }

    return picked
  }
}

function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

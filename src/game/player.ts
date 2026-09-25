import { Euler, MathUtils, Vector3 } from 'three'
import { CELL, Maze } from './maze'

const EYE = 1.64
const RADIUS = 0.32
const WALK = 7.2
const SPRINT = 14.4

export class Player {
  readonly position = new Vector3()
  yaw = 0
  pitch = 0
  stamina = 1
  private velocity = new Vector3()
  private regenDelay = 0
  private readonly _forward = new Vector3()
  private readonly _right = new Vector3()
  private readonly _wish = new Vector3()
  private readonly _euler = new Euler(0, 0, 0, 'YXZ')

  constructor(maze: Maze) {
    const start = maze.cellCenter(maze.start)
    this.position.set(start.x, EYE, start.z)
    this.faceOpen(maze)
  }

  private faceOpen(maze: Maze) {
    const options = maze.neighbors(maze.start)
    let best = options[0]
    let bestLen = -1
    for (const next of options) {
      const dx = Math.sign(next.x - maze.start.x)
      const dz = Math.sign(next.z - maze.start.z)
      let len = 0
      let x = maze.start.x
      let z = maze.start.z
      while (len < 12 && maze.isOpen(x + dx, z + dz)) {
        x += dx
        z += dz
        len += 1
      }
      if (len > bestLen) {
        bestLen = len
        best = next
      }
    }
    if (!best) return
    const to = maze.cellCenter(best)
    const from = maze.cellCenter(maze.start)
    this.yaw = Math.atan2(-(to.x - from.x), -(to.z - from.z))
  }

  look(dx: number, dy: number) {
    this.yaw -= dx * 0.0022
    this.pitch = MathUtils.clamp(this.pitch - dy * 0.0022, -1.2, 1.2)
  }

  euler() {
    this._euler.set(this.pitch, this.yaw, 0, 'YXZ')
    return this._euler
  }

  update(
    dt: number,
    input: { x: number; z: number; sprint: boolean },
    maze: Maze,
  ) {
    const sprinting = input.sprint && this.stamina > 0.05 && (input.x !== 0 || input.z !== 0)
    if (sprinting) {
      this.stamina = Math.max(0, this.stamina - dt * 0.28)
      this.regenDelay = 0.7
    } else {
      this.regenDelay = Math.max(0, this.regenDelay - dt)
      if (this.regenDelay === 0) {
        this.stamina = Math.min(1, this.stamina + dt * 0.22)
      }
    }

    const speed = sprinting ? SPRINT : WALK
    this._forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
    this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw))
    this._wish.set(0, 0, 0)
    this._wish.addScaledVector(this._forward, input.z)
    this._wish.addScaledVector(this._right, input.x)
    if (this._wish.lengthSq() > 0) this._wish.normalize().multiplyScalar(speed)

    this.velocity.lerp(this._wish, 1 - Math.pow(0.0008, dt))
    this.position.x += this.velocity.x * dt
    this.position.z += this.velocity.z * dt
    this.collide(maze)
    this.position.y =
      EYE +
      Math.sin(performance.now() * 0.009 * (sprinting ? 1.6 : 1)) *
        (this.speed() > 0.4 ? 0.018 : 0.004)
  }

  speed() {
    return Math.hypot(this.velocity.x, this.velocity.z)
  }

  private collide(maze: Maze) {
    const cell = maze.worldToCell(this.position.x, this.position.z)
    for (let z = cell.z - 1; z <= cell.z + 1; z += 1) {
      for (let x = cell.x - 1; x <= cell.x + 1; x += 1) {
        if (maze.isOpen(x, z)) continue
        const minX = x * CELL
        const maxX = (x + 1) * CELL
        const minZ = z * CELL
        const maxZ = (z + 1) * CELL
        const nearestX = MathUtils.clamp(this.position.x, minX, maxX)
        const nearestZ = MathUtils.clamp(this.position.z, minZ, maxZ)
        const dx = this.position.x - nearestX
        const dz = this.position.z - nearestZ
        const dist = Math.hypot(dx, dz)
        if (dist >= RADIUS) continue
        if (dist === 0) {
          const left = this.position.x - minX
          const right = maxX - this.position.x
          const up = this.position.z - minZ
          const down = maxZ - this.position.z
          const smallest = Math.min(left, right, up, down)
          if (smallest === left) this.position.x = minX - RADIUS
          else if (smallest === right) this.position.x = maxX + RADIUS
          else if (smallest === up) this.position.z = minZ - RADIUS
          else this.position.z = maxZ + RADIUS
          continue
        }
        const push = (RADIUS - dist) / dist
        this.position.x += dx * push
        this.position.z += dz * push
      }
    }
  }
}

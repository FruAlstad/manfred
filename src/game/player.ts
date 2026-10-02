import { Euler, MathUtils, Vector3 } from 'three'
import { CELL, Maze } from './maze'
import type { Box2 } from './street'

const EYE = 1.58
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
  private stepPhase = 0
  private bobPitch = 0
  private bobRoll = 0
  private bobYaw = 0
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
    this._euler.set(
      this.pitch + this.bobPitch,
      this.yaw + this.bobYaw,
      this.bobRoll,
      'YXZ',
    )
    return this._euler
  }

  place(x: number, z: number, yaw: number) {
    this.position.set(x, EYE, z)
    this.yaw = yaw
    this.pitch = 0
    this.velocity.set(0, 0, 0)
    this.stepPhase = 0
    this.bobPitch = 0
    this.bobRoll = 0
    this.bobYaw = 0
  }

  update(
    dt: number,
    input: { x: number; z: number; sprint: boolean },
    maze: Maze | null,
    solids?: Box2[],
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

    // snappier accel so movement feels planted, not icy/flying
    const accel = this._wish.lengthSq() > 0 ? 0.00005 : 0.0002
    this.velocity.lerp(this._wish, 1 - Math.pow(accel, dt))
    this.position.x += this.velocity.x * dt
    this.position.z += this.velocity.z * dt
    if (maze) this.collide(maze)
    if (solids) this.collideBoxes(solids)

    const spd = this.speed()
    const moving = spd > 0.35
    if (moving) {
      // step cycle based on distance traveled
      const stepRate = sprinting ? 2.35 : 1.55
      this.stepPhase += spd * dt * stepRate

      const bobAmp = sprinting ? 0.042 : 0.028
      const foot = Math.abs(Math.sin(this.stepPhase))
      const side = Math.sin(this.stepPhase)

      this.position.y = EYE + foot * bobAmp - bobAmp * 0.12
      this.bobPitch = -foot * (sprinting ? 0.018 : 0.012)
      this.bobRoll = side * (sprinting ? 0.012 : 0.008)
      this.bobYaw = 0
    } else {
      this.stepPhase *= 0.9
      this.position.y = MathUtils.lerp(this.position.y, EYE, 1 - Math.pow(0.001, dt))
      this.bobPitch = MathUtils.lerp(this.bobPitch, 0, 1 - Math.pow(0.001, dt))
      this.bobRoll = MathUtils.lerp(this.bobRoll, 0, 1 - Math.pow(0.001, dt))
      this.bobYaw = MathUtils.lerp(this.bobYaw, 0, 1 - Math.pow(0.001, dt))
    }
  }

  speed() {
    return Math.hypot(this.velocity.x, this.velocity.z)
  }

  private collide(maze: Maze) {
    const cell = maze.worldToCell(this.position.x, this.position.z)
    for (let z = cell.z - 1; z <= cell.z + 1; z += 1) {
      for (let x = cell.x - 1; x <= cell.x + 1; x += 1) {
        if (maze.isOpen(x, z)) continue
        this.resolveBox(x * CELL, (x + 1) * CELL, z * CELL, (z + 1) * CELL)
      }
    }
  }

  private collideBoxes(solids: Box2[]) {
    for (const box of solids) {
      this.resolveBox(box.minX, box.maxX, box.minZ, box.maxZ)
    }
  }

  private resolveBox(minX: number, maxX: number, minZ: number, maxZ: number) {
    const nearestX = MathUtils.clamp(this.position.x, minX, maxX)
    const nearestZ = MathUtils.clamp(this.position.z, minZ, maxZ)
    const dx = this.position.x - nearestX
    const dz = this.position.z - nearestZ
    const dist = Math.hypot(dx, dz)
    if (dist >= RADIUS) return
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
      return
    }
    const push = (RADIUS - dist) / dist
    this.position.x += dx * push
    this.position.z += dz * push
  }
}

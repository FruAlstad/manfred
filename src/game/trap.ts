import {
  BoxGeometry,
  Color,
  ConeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
} from 'three'
import { Cell, Maze } from './maze'

const TRIGGER = 1.15

export class Trap {
  readonly group = new Group()
  readonly cell: Cell
  triggered = false
  private readonly x: number
  private readonly z: number
  private spikes: Mesh[] = []
  private armed = true

  constructor(maze: Maze, cell: Cell) {
    this.cell = { ...cell }
    const center = maze.cellCenter(cell)
    this.x = center.x
    this.z = center.z
    this.group.position.set(center.x, 0, center.z)
    this.build()
  }

  get armedStill() {
    return this.armed && !this.triggered
  }

  get worldX() {
    return this.x
  }

  get worldZ() {
    return this.z
  }

  distanceTo(px: number, pz: number) {
    return Math.hypot(px - this.x, pz - this.z)
  }

  /** Returns true if something stepped on an armed trap. */
  check(px: number, pz: number) {
    if (!this.armed || this.triggered) return false
    if (this.distanceTo(px, pz) > TRIGGER) return false
    this.trigger()
    return true
  }

  update(dt: number) {
    if (!this.triggered) return
    for (const spike of this.spikes) {
      if (spike.position.y < 0.55) {
        spike.position.y = Math.min(0.55, spike.position.y + dt * 8)
      }
    }
  }

  private trigger() {
    this.triggered = true
    this.armed = false
  }

  private build() {
    const plate = new MeshStandardMaterial({
      color: new Color('#3a2a18'),
      roughness: 0.85,
      metalness: 0.15,
    })
    const rust = new MeshStandardMaterial({
      color: new Color('#4a3020'),
      roughness: 0.7,
      metalness: 0.35,
    })
    const steel = new MeshStandardMaterial({
      color: new Color('#6a7078'),
      roughness: 0.4,
      metalness: 0.7,
    })
    const blood = new MeshStandardMaterial({
      color: new Color('#5a0808'),
      roughness: 0.5,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    })

    const base = new Mesh(new PlaneGeometry(1.8, 1.8), plate)
    base.rotation.x = -Math.PI / 2
    base.position.y = 0.02
    this.group.add(base)

    const stain = new Mesh(new PlaneGeometry(1.4, 1.1), blood)
    stain.rotation.x = -Math.PI / 2
    stain.rotation.z = Math.random() * Math.PI
    stain.position.y = 0.025
    this.group.add(stain)

    const rim = new Mesh(new BoxGeometry(1.7, 0.06, 1.7), rust)
    rim.position.y = 0.04
    this.group.add(rim)

    // spikes start flush / slightly below, pop up when triggered
    for (let i = 0; i < 7; i += 1) {
      const spike = new Mesh(new ConeGeometry(0.06, 0.7, 5), steel)
      const angle = (i / 7) * Math.PI * 2
      const r = 0.25 + (i % 2) * 0.28
      spike.position.set(Math.cos(angle) * r, 0.02, Math.sin(angle) * r)
      this.spikes.push(spike)
      this.group.add(spike)
    }
    const centerSpike = new Mesh(new ConeGeometry(0.07, 0.85, 5), steel)
    centerSpike.position.y = 0.02
    this.spikes.push(centerSpike)
    this.group.add(centerSpike)
  }
}

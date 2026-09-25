import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three'
import { Cell, Maze } from './maze'

export class Axe {
  readonly group = new Group()
  readonly held = new Group()
  pickedUp = false
  private worldPos = new Vector3()

  constructor(maze: Maze, cell: Cell) {
    const center = maze.cellCenter(cell)
    this.worldPos.set(center.x, 0, center.z)
    this.group.add(this.buildMesh())
    this.group.position.set(center.x, 0.15, center.z)
    this.group.rotation.z = Math.PI / 2
    this.group.rotation.y = Math.random() * Math.PI

    this.held.add(this.buildMesh())
    this.held.visible = false
    this.held.scale.setScalar(0.55)
    this.held.position.set(0.35, -0.28, -0.45)
    this.held.rotation.set(0.15, -0.4, 0.85)
  }

  get position() {
    return this.worldPos
  }

  distanceTo(x: number, z: number) {
    return Math.hypot(this.worldPos.x - x, this.worldPos.z - z)
  }

  canPickup(x: number, z: number) {
    return !this.pickedUp && this.distanceTo(x, z) < 2.2
  }

  pickup() {
    if (this.pickedUp) return false
    this.pickedUp = true
    this.group.visible = false
    this.held.visible = true
    return true
  }

  swing(amount: number) {
    // amount 0..1 for attack animation
    this.held.rotation.set(
      0.15 + amount * 1.1,
      -0.4 - amount * 0.5,
      0.85 - amount * 1.4,
    )
    this.held.position.set(
      0.35 - amount * 0.1,
      -0.28 + amount * 0.15,
      -0.45 - amount * 0.2,
    )
  }

  resetPose() {
    this.held.rotation.set(0.15, -0.4, 0.85)
    this.held.position.set(0.35, -0.28, -0.45)
  }

  private buildMesh() {
    const root = new Group()
    const wood = new MeshStandardMaterial({
      color: new Color('#5a3a1a'),
      roughness: 0.9,
      metalness: 0,
    })
    const steel = new MeshStandardMaterial({
      color: new Color('#8a9098'),
      roughness: 0.35,
      metalness: 0.75,
    })
    const blood = new MeshStandardMaterial({
      color: new Color('#4a0808'),
      roughness: 0.55,
      metalness: 0,
      emissive: new Color('#2a0000'),
      emissiveIntensity: 0.2,
    })

    const handle = new Mesh(new CylinderGeometry(0.035, 0.04, 1.15, 8), wood)
    handle.position.y = 0.35

    const head = new Mesh(new BoxGeometry(0.12, 0.22, 0.35), steel)
    head.position.set(0.08, 0.95, 0)

    const blade = new Mesh(new BoxGeometry(0.04, 0.28, 0.42), steel)
    blade.position.set(0.2, 0.95, 0)
    blade.rotation.z = -0.15

    const stain = new Mesh(new BoxGeometry(0.05, 0.12, 0.2), blood)
    stain.position.set(0.22, 0.9, 0.05)

    root.add(handle, head, blade, stain)
    return root
  }
}

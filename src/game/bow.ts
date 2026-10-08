import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three'

export const BOW_DAMAGE = 100
export const ARROW_SPEED = 48

export class Bow {
  readonly held = new Group()

  constructor() {
    this.held.add(this.buildMesh())
    this.held.scale.setScalar(0.7)
    this.held.position.set(0.28, -0.22, -0.42)
    this.held.rotation.set(0.05, 0.15, 0.1)
  }

  /** drawAmount 0..1 while aiming/firing */
  setDraw(amount: number) {
    this.held.rotation.set(
      0.05 - amount * 0.25,
      0.15,
      0.1 + amount * 0.15,
    )
    this.held.position.set(
      0.28,
      -0.22 + amount * 0.04,
      -0.42 - amount * 0.08,
    )
  }

  resetPose() {
    this.setDraw(0)
  }

  private buildMesh() {
    const wood = new MeshStandardMaterial({
      color: new Color('#5a3a1c'),
      roughness: 0.88,
    })
    const cordMat = new MeshStandardMaterial({
      color: new Color('#d8d0c0'),
      roughness: 0.5,
    })
    const root = new Group()
    const limb = new Mesh(new CylinderGeometry(0.03, 0.025, 1.15, 8), wood)
    limb.rotation.z = 0.35
    const limb2 = limb.clone()
    limb2.rotation.z = -0.35
    limb2.position.x = 0.02
    const grip = new Mesh(new CylinderGeometry(0.035, 0.035, 0.22, 8), wood)
    grip.position.set(0.02, 0, 0)
    const cord = new Mesh(new CylinderGeometry(0.008, 0.008, 1.05, 5), cordMat)
    cord.position.set(-0.18, 0, 0)
    root.add(limb, limb2, grip, cord)
    return root
  }
}

const ARROW_UP = new Vector3(0, 1, 0)

export class Arrow {
  readonly group = new Group()
  alive = true
  private readonly vel = new Vector3()
  private readonly _dir = new Vector3()
  private life = 2.5

  constructor(origin: Vector3, direction: Vector3) {
    this.group.add(this.buildMesh())
    this.group.position.copy(origin)
    this.vel.copy(direction).normalize().multiplyScalar(ARROW_SPEED)
    this.orient()
  }

  update(dt: number) {
    if (!this.alive) return
    this.group.position.addScaledVector(this.vel, dt)
    this.life -= dt
    if (this.life <= 0) this.alive = false
    this.orient()
  }

  private orient() {
    if (this.vel.lengthSq() < 0.001) return
    this._dir.copy(this.vel).normalize()
    this.group.quaternion.setFromUnitVectors(ARROW_UP, this._dir)
  }

  private buildMesh() {
    const wood = new MeshStandardMaterial({
      color: new Color('#6a4a28'),
      roughness: 0.85,
    })
    const tip = new MeshStandardMaterial({
      color: new Color('#9aa0a8'),
      roughness: 0.35,
      metalness: 0.8,
    })
    const root = new Group()
    const shaft = new Mesh(new CylinderGeometry(0.018, 0.018, 0.85, 6), wood)
    const head = new Mesh(new BoxGeometry(0.04, 0.12, 0.04), tip)
    head.position.y = 0.45
    const fletch = new Mesh(new BoxGeometry(0.08, 0.1, 0.01), tip)
    fletch.position.y = -0.35
    root.add(shaft, head, fletch)
    return root
  }
}

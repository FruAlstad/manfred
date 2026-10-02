import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three'
import { Player } from './player'
import type { Box2 } from './street'

const WALK = 2.4
const HUNT = 4.2
const CATCH = 1.2
const RADIUS = 0.38
const SEE = 42

export class Zombie {
  readonly group = new Group()
  hunting = false
  dead = false
  private phase = Math.random() * Math.PI * 2
  private limp = 0.75 + Math.random() * 0.35
  private readonly _to = new Vector3()
  private readonly _tmp = new Vector3()
  private torso!: Group
  private head!: Group
  private armL!: Group
  private armR!: Group
  private legL!: Group
  private legR!: Group
  private skin!: MeshStandardMaterial
  private cloth!: MeshStandardMaterial
  private pants!: MeshStandardMaterial
  private blood!: MeshStandardMaterial

  constructor(x: number, z: number, yaw = Math.PI) {
    this.group.position.set(x, 0, z)
    this.group.rotation.y = yaw
    this.build()
  }

  get position() {
    return this.group.position
  }

  update(dt: number, player: Player, solids: Box2[], playerHidden = false) {
    if (this.dead) return false

    this._to.set(player.position.x, 0, player.position.z)
    const dist = this.position.distanceTo(this._to)

    // can't see / won't chase into houses — player can hide
    if (playerHidden) {
      this.hunting = false
      this.animate(dt, 0.1, false)
      return false
    }

    this.hunting = dist < SEE

    let moving = 0
    if (this.hunting) {
      const speed = dist < 12 ? HUNT : WALK
      moving = this.chase(this._to, speed * dt, solids)
    } else {
      this.phase += dt * 1.2
      moving = 0.15
    }

    this.animate(dt, moving, this.hunting && dist < 18)
    return dist < CATCH
  }

  kill() {
    if (this.dead) return
    this.dead = true
    this.hunting = false
    this.group.visible = false
  }

  private chase(dest: Vector3, step: number, solids: Box2[]) {
    this._tmp.copy(dest).sub(this.position)
    this._tmp.y = 0
    const len = this._tmp.length()
    if (len < 0.001) return 0
    this._tmp.multiplyScalar(Math.min(step, len) / len)

    const nextX = this.position.x + this._tmp.x
    const nextZ = this.position.z + this._tmp.z
    if (this.free(nextX, this.position.z, solids)) this.position.x = nextX
    if (this.free(this.position.x, nextZ, solids)) this.position.z = nextZ

    this._tmp.copy(dest).sub(this.position)
    this._tmp.y = 0
    if (this._tmp.lengthSq() > 0.0001) {
      this.group.lookAt(
        this.position.x + this._tmp.x,
        0,
        this.position.z + this._tmp.z,
      )
    }
    return 1
  }

  private free(x: number, z: number, solids: Box2[]) {
    for (const box of solids) {
      const nx = MathUtils.clamp(x, box.minX, box.maxX)
      const nz = MathUtils.clamp(z, box.minZ, box.maxZ)
      if (Math.hypot(x - nx, z - nz) < RADIUS) return false
    }
    return true
  }

  private animate(dt: number, moving: number, hunting: boolean) {
    const rate = hunting ? 9.5 : 5.5
    this.phase += dt * rate * this.limp * Math.max(moving, 0.08)
    const swing = Math.sin(this.phase) * (hunting ? 0.85 : 0.4) * Math.max(moving, 0.1)
    const bob = Math.abs(Math.sin(this.phase)) * 0.035 * moving

    this.group.position.y = bob
    this.torso.rotation.x = hunting ? -0.18 : -0.08
    this.torso.rotation.z = Math.sin(this.phase * 0.4) * 0.04
    this.head.rotation.x = hunting ? 0.2 : 0.05
    this.head.rotation.y = Math.sin(this.phase * 0.3) * 0.1
    // arms forward reach when hunting
    this.armL.rotation.x = hunting ? -1.1 + swing * 0.25 : swing
    this.armR.rotation.x = hunting ? -1.0 - swing * 0.25 : -swing
    this.armL.rotation.z = hunting ? 0.35 : 0.08
    this.armR.rotation.z = hunting ? -0.35 : -0.08
    this.legL.rotation.x = -swing * 0.9
    this.legR.rotation.x = swing * 0.9
  }

  private build() {
    const tall = 0.94 + Math.random() * 0.14
    this.group.scale.set(1, tall, 1)

    this.skin = new MeshStandardMaterial({
      color: new Color().setHSL(0.28 + Math.random() * 0.08, 0.25, 0.28 + Math.random() * 0.1),
      roughness: 0.88,
    })
    this.cloth = new MeshStandardMaterial({
      color: new Color().setHSL(0.05 + Math.random() * 0.1, 0.15, 0.18 + Math.random() * 0.12),
      roughness: 0.92,
    })
    this.pants = new MeshStandardMaterial({
      color: new Color().setHSL(0.6, 0.08, 0.14 + Math.random() * 0.08),
      roughness: 0.94,
    })
    this.blood = new MeshStandardMaterial({
      color: '#4a0808',
      roughness: 0.5,
      emissive: '#3a0505',
      emissiveIntensity: 0.25,
    })
    const eye = new MeshStandardMaterial({
      color: '#101008',
      emissive: '#304010',
      emissiveIntensity: 0.4,
      roughness: 0.4,
    })
    const mouth = new MeshStandardMaterial({
      color: '#2a0808',
      roughness: 0.6,
    })

    this.torso = new Group()
    this.torso.position.y = 1.1
    const shirt = new Mesh(new CylinderGeometry(0.22, 0.26, 0.55, 12), this.cloth)
    shirt.position.y = 0.05
    const chest = new Mesh(new CylinderGeometry(0.18, 0.22, 0.35, 12), this.skin)
    chest.position.y = 0.2
    this.torso.add(shirt, chest)
    this.stain(this.torso, 0.1, 0.05, 0.24, 0.09)
    this.stain(this.torso, -0.08, -0.1, 0.24, 0.07)

    this.head = new Group()
    this.head.position.y = 0.52
    const skull = new Mesh(new SphereGeometry(0.175, 14, 12), this.skin)
    skull.scale.set(0.9, 1.05, 0.95)
    const jaw = new Mesh(new SphereGeometry(0.09, 10, 8), this.skin)
    jaw.scale.set(1.1, 0.5, 0.9)
    jaw.position.set(0, -0.1, 0.02)
    const nose = new Mesh(new ConeGeometry(0.025, 0.06, 5), this.skin)
    nose.rotation.x = Math.PI / 2
    nose.position.set(0, 0, 0.16)
    const eyeL = new Mesh(new SphereGeometry(0.028, 8, 6), eye)
    eyeL.position.set(-0.05, 0.03, 0.14)
    const eyeR = eyeL.clone()
    eyeR.position.x = 0.05
    const maw = new Mesh(new SphereGeometry(0.04, 8, 6), mouth)
    maw.scale.set(1.5, 0.55, 0.8)
    maw.position.set(0, -0.1, 0.14)
    this.head.add(skull, jaw, nose, eyeL, eyeR, maw)
    this.stain(this.head, 0.06, 0.02, 0.14, 0.04)
    this.torso.add(this.head)

    this.armL = this.limb(this.cloth, this.skin, true)
    this.armR = this.limb(this.cloth, this.skin, true)
    this.armL.position.set(-0.28, 0.25, 0)
    this.armR.position.set(0.28, 0.25, 0)
    this.torso.add(this.armL, this.armR)

    this.legL = this.limb(this.pants, this.skin, false)
    this.legR = this.limb(this.pants, this.skin, false)
    this.legL.position.set(-0.1, 0.58, 0)
    this.legR.position.set(0.1, 0.58, 0)
    this.stain(this.legL, 0.04, -0.3, 0.08, 0.05)
    this.stain(this.legR, -0.03, -0.45, 0.08, 0.06)

    this.group.add(this.torso, this.legL, this.legR)
  }

  private limb(cloth: MeshStandardMaterial, skin: MeshStandardMaterial, arm: boolean) {
    const g = new Group()
    const upper = new Mesh(
      new CylinderGeometry(arm ? 0.06 : 0.085, arm ? 0.05 : 0.07, arm ? 0.38 : 0.48, 8),
      cloth,
    )
    upper.geometry.translate(0, arm ? -0.19 : -0.24, 0)
    const lower = new Mesh(
      new CylinderGeometry(arm ? 0.045 : 0.06, arm ? 0.04 : 0.05, arm ? 0.34 : 0.44, 8),
      skin,
    )
    lower.geometry.translate(0, arm ? -0.17 : -0.22, 0)
    lower.position.y = arm ? -0.38 : -0.48
    const hand = new Mesh(new SphereGeometry(arm ? 0.045 : 0.07, 8, 6), skin)
    hand.position.y = arm ? -0.62 : -0.95
    if (!arm) hand.scale.set(0.85, 0.45, 1.4)
    g.add(upper, lower, hand)
    return g
  }

  private stain(parent: Group, x: number, y: number, z: number, size: number) {
    const stain = new Mesh(new SphereGeometry(size, 6, 6), this.blood)
    stain.scale.set(1.3, 0.3, 1)
    stain.position.set(x, y, z)
    parent.add(stain)
  }
}

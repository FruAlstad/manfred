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

export const BOSS_MAX_HP = 2000
const SPEED = 5.2
const CATCH = 1.8
const RADIUS = 0.7

export class Boss {
  readonly group = new Group()
  hp = BOSS_MAX_HP
  dead = false
  private phase = 0
  private readonly _to = new Vector3()
  private readonly _tmp = new Vector3()
  private torso!: Group
  private head!: Group
  private armL!: Group
  private armR!: Group
  private legL!: Group
  private legR!: Group

  constructor(x: number, z: number) {
    this.group.position.set(x, 0, z)
    this.group.scale.setScalar(2.35)
    this.build()
  }

  get position() {
    return this.group.position
  }

  get hpRatio() {
    return Math.max(0, this.hp / BOSS_MAX_HP)
  }

  hurt(amount: number) {
    if (this.dead) return false
    this.hp = Math.max(0, this.hp - amount)
    if (this.hp <= 0) {
      this.dead = true
      this.group.visible = false
      return true
    }
    // flinch tint via scale pulse
    this.group.scale.setScalar(2.45)
    return false
  }

  update(dt: number, player: Player, solids: Box2[]) {
    if (this.dead) return false
    this.group.scale.lerp(
      this._tmp.set(2.35, 2.35, 2.35),
      1 - Math.pow(0.001, dt),
    )

    this._to.set(player.position.x, 0, player.position.z)
    const dist = this.position.distanceTo(this._to)
    this.chase(this._to, SPEED * dt, solids)
    this.animate(dt, 1)
    return dist < CATCH
  }

  private chase(dest: Vector3, step: number, solids: Box2[]) {
    this._tmp.copy(dest).sub(this.position)
    this._tmp.y = 0
    const len = this._tmp.length()
    if (len < 0.001) return
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
  }

  private free(x: number, z: number, solids: Box2[]) {
    for (const box of solids) {
      const nx = MathUtils.clamp(x, box.minX, box.maxX)
      const nz = MathUtils.clamp(z, box.minZ, box.maxZ)
      if (Math.hypot(x - nx, z - nz) < RADIUS) return false
    }
    return true
  }

  private animate(dt: number, moving: number) {
    this.phase += dt * 8.5 * moving
    const swing = Math.sin(this.phase) * 0.75
    this.group.position.y = Math.abs(Math.sin(this.phase)) * 0.06
    this.torso.rotation.x = -0.12
    this.armL.rotation.x = -1.2 + swing * 0.2
    this.armR.rotation.x = -1.15 - swing * 0.2
    this.armL.rotation.z = 0.4
    this.armR.rotation.z = -0.4
    this.legL.rotation.x = -swing
    this.legR.rotation.x = swing
    this.head.rotation.y = Math.sin(this.phase * 0.4) * 0.15
  }

  private build() {
    const skin = new MeshStandardMaterial({
      color: new Color('#2a3a28'),
      roughness: 0.9,
      emissive: '#102010',
      emissiveIntensity: 0.25,
    })
    const cloth = new MeshStandardMaterial({
      color: '#1a0c10',
      roughness: 0.95,
    })
    const blood = new MeshStandardMaterial({
      color: '#5a0808',
      roughness: 0.5,
      emissive: '#3a0000',
      emissiveIntensity: 0.35,
    })
    const eye = new MeshStandardMaterial({
      color: '#100000',
      emissive: '#ff2200',
      emissiveIntensity: 1.2,
      roughness: 0.3,
    })

    this.torso = new Group()
    this.torso.position.y = 1.15
    const chest = new Mesh(new CylinderGeometry(0.28, 0.34, 0.7, 12), cloth)
    chest.position.y = 0.05
    const stain = new Mesh(new SphereGeometry(0.12, 8, 6), blood)
    stain.scale.set(1.4, 0.4, 1)
    stain.position.set(0.08, 0.1, 0.3)
    this.torso.add(chest, stain)

    this.head = new Group()
    this.head.position.y = 0.58
    const skull = new Mesh(new SphereGeometry(0.22, 14, 12), skin)
    skull.scale.set(0.95, 1.15, 1)
    const hornL = new Mesh(new ConeGeometry(0.05, 0.28, 6), skin)
    hornL.position.set(-0.12, 0.28, -0.02)
    hornL.rotation.z = 0.35
    const hornR = hornL.clone()
    hornR.position.x = 0.12
    hornR.rotation.z = -0.35
    const eyeL = new Mesh(new SphereGeometry(0.04, 8, 6), eye)
    eyeL.position.set(-0.07, 0.04, 0.18)
    const eyeR = eyeL.clone()
    eyeR.position.x = 0.07
    const maw = new Mesh(new SphereGeometry(0.08, 8, 6), blood)
    maw.scale.set(1.4, 0.5, 0.9)
    maw.position.set(0, -0.12, 0.16)
    this.head.add(skull, hornL, hornR, eyeL, eyeR, maw)
    this.torso.add(this.head)

    this.armL = this.limb(cloth, skin)
    this.armR = this.limb(cloth, skin)
    this.armL.position.set(-0.38, 0.28, 0)
    this.armR.position.set(0.38, 0.28, 0)
    this.torso.add(this.armL, this.armR)

    this.legL = this.limb(cloth, skin, true)
    this.legR = this.limb(cloth, skin, true)
    this.legL.position.set(-0.14, 0.55, 0)
    this.legR.position.set(0.14, 0.55, 0)

    this.group.add(this.torso, this.legL, this.legR)
  }

  private limb(
    cloth: MeshStandardMaterial,
    skin: MeshStandardMaterial,
    leg = false,
  ) {
    const g = new Group()
    const upper = new Mesh(
      new CylinderGeometry(leg ? 0.11 : 0.08, leg ? 0.09 : 0.07, leg ? 0.55 : 0.45, 8),
      cloth,
    )
    upper.geometry.translate(0, leg ? -0.27 : -0.22, 0)
    const lower = new Mesh(
      new CylinderGeometry(leg ? 0.08 : 0.06, leg ? 0.07 : 0.05, leg ? 0.5 : 0.4, 8),
      skin,
    )
    lower.geometry.translate(0, leg ? -0.25 : -0.2, 0)
    lower.position.y = leg ? -0.55 : -0.45
    const tip = new Mesh(new SphereGeometry(leg ? 0.09 : 0.06, 8, 6), skin)
    tip.position.y = leg ? -1.05 : -0.72
    g.add(upper, lower, tip)
    return g
  }
}

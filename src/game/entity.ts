import {
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three'
import { Cell, Maze } from './maze'
import { Player } from './player'

const WALK_SPEED = 5.5
const HUNT_SPEED = 9.5
const CATCH = 1.25

export class Entity {
  readonly group = new Group()
  hunting = false
  private pathIndex = 0
  private path: Cell[] = []
  private retarget = 0
  private lastSeen: Cell | null = null
  private chaseMemory = 0
  private wander = 0
  private phase = Math.random() * Math.PI * 2
  private limp = 0.75 + Math.random() * 0.4
  private torso!: Group
  private head!: Group
  private armL!: Group
  private armR!: Group
  private legL!: Group
  private legR!: Group
  private cloth!: MeshStandardMaterial
  private pants!: MeshStandardMaterial
  private skin!: MeshStandardMaterial
  private wound!: MeshStandardMaterial
  private raw!: MeshStandardMaterial

  constructor(
    private maze: Maze,
    spawn: Cell,
  ) {
    const start = maze.cellCenter(spawn)
    this.group.position.set(start.x, 0, start.z)
    this.group.rotation.y = Math.random() * Math.PI * 2
    this.build()
  }

  get position() {
    return this.group.position
  }

  update(dt: number, player: Player) {
    const here = this.maze.worldToCell(this.position.x, this.position.z)
    const target = this.maze.worldToCell(player.position.x, player.position.z)
    const dist = this.position.distanceTo(
      new Vector3(player.position.x, 0, player.position.z),
    )
    const sees = dist < 36 && this.maze.hasLineOfSight(here, target)
    const hears = player.speed() > 10 && dist < 22

    if (sees || hears) {
      this.lastSeen = { ...target }
      this.chaseMemory = 8
      this.hunting = true
    } else if (this.chaseMemory > 0) {
      this.chaseMemory -= dt
      this.hunting = true
    } else {
      this.hunting = false
      this.lastSeen = null
    }

    this.retarget -= dt
    if (this.retarget <= 0 || (this.hunting && this.pathIndex >= this.path.length)) {
      const goal = this.hunting
        ? sees || hears
          ? target
          : (this.lastSeen ?? target)
        : this.wanderCell()
      this.path = this.maze.path(here, goal)
      this.pathIndex = 1
      this.retarget = this.hunting ? 0.18 : 1.2
    }

    let moving = 0
    const goal = this.path[this.pathIndex]
    if (goal) {
      const world = this.maze.cellCenter(goal)
      const dest = new Vector3(world.x, 0, world.z)
      const offset = dest.clone().sub(this.position)
      offset.y = 0
      const speed = this.hunting ? HUNT_SPEED : WALK_SPEED
      const step = speed * dt
      if (offset.length() <= step) {
        this.position.copy(dest)
        this.pathIndex += 1
        moving = 1
      } else {
        offset.normalize().multiplyScalar(step)
        this.position.add(offset)
        this.group.lookAt(
          this.position.x + offset.x,
          0,
          this.position.z + offset.z,
        )
        moving = 1
      }
    }

    this.animate(dt, moving, this.hunting)
    return dist < CATCH
  }

  private animate(dt: number, moving: number, hunting: boolean) {
    const rate = hunting ? 9.5 : 5.2
    this.phase += dt * rate * this.limp * (moving || 0.2)
    const swing = Math.sin(this.phase) * (hunting ? 0.55 : 0.35) * Math.max(moving, 0.25)
    const bob = Math.abs(Math.sin(this.phase)) * 0.04 * moving

    this.group.position.y = bob
    this.torso.rotation.z = Math.sin(this.phase * 0.45) * 0.06
    this.torso.rotation.x = hunting ? -0.16 : -0.08
    this.head.rotation.y = Math.sin(this.phase * 0.3) * 0.18
    this.head.rotation.x = hunting ? 0.22 : 0.1
    // zombie arm reach
    this.armL.rotation.x = hunting ? -1.1 + swing * 0.25 : -0.55 + swing
    this.armL.rotation.z = 0.35
    this.armR.rotation.x = hunting ? -1.05 - swing * 0.2 : -0.5 - swing
    this.armR.rotation.z = -0.3
    this.legL.rotation.x = -swing * 0.85
    this.legR.rotation.x = swing * 0.85
  }

  private wanderCell(): Cell {
    this.wander -= 1
    if (this.wander <= 0) {
      this.wander = 4 + Math.floor(Math.random() * 8)
    }
    const open: Cell[] = []
    for (let z = 1; z < this.maze.height - 1; z += 1) {
      for (let x = 1; x < this.maze.width - 1; x += 1) {
        if (this.maze.isOpen(x, z)) open.push({ x, z })
      }
    }
    return open[Math.floor(Math.random() * open.length)] ?? this.maze.entityStart
  }

  private build() {
    const tall = 0.96 + Math.random() * 0.12
    const wide = 0.92 + Math.random() * 0.12
    this.group.scale.set(wide, tall, wide)

    // sickly zombie skin
    this.skin = new MeshStandardMaterial({
      color: new Color().setHSL(0.22 + Math.random() * 0.06, 0.22, 0.28 + Math.random() * 0.08),
      roughness: 0.95,
      metalness: 0,
      emissive: new Color('#1a1a10'),
      emissiveIntensity: 0.05,
    })
    this.wound = new MeshStandardMaterial({
      color: new Color('#5a0808'),
      roughness: 0.4,
      metalness: 0,
      emissive: new Color('#7a1010'),
      emissiveIntensity: 0.55,
    })
    this.raw = new MeshStandardMaterial({
      color: new Color('#8a2a2a'),
      roughness: 0.65,
      metalness: 0,
      emissive: new Color('#4a0808'),
      emissiveIntensity: 0.25,
    })
    // torn shirt colors
    const shirtHue = Math.random()
    this.cloth = new MeshStandardMaterial({
      color: new Color().setHSL(shirtHue * 0.15 + 0.55, 0.18, 0.22 + Math.random() * 0.1),
      roughness: 0.92,
      metalness: 0,
    })
    this.pants = new MeshStandardMaterial({
      color: new Color().setHSL(0.6, 0.12, 0.14 + Math.random() * 0.08),
      roughness: 0.94,
      metalness: 0,
    })
    const eyeMat = new MeshStandardMaterial({
      color: new Color('#c8c090'),
      emissive: new Color('#6a6020'),
      emissiveIntensity: 0.45,
      roughness: 0.35,
      metalness: 0,
    })
    const mouth = new MeshStandardMaterial({
      color: new Color('#2a0606'),
      roughness: 0.55,
      metalness: 0,
      emissive: new Color('#3a0000'),
      emissiveIntensity: 0.3,
    })
    const tooth = new MeshStandardMaterial({
      color: new Color('#cfc6a8'),
      roughness: 0.5,
      metalness: 0,
    })

    this.torso = new Group()
    this.torso.position.y = 1.15

    // body under clothes
    const chest = new Mesh(new CylinderGeometry(0.22, 0.26, 0.55, 12), this.skin)
    chest.position.y = 0.12
    const belly = new Mesh(new SphereGeometry(0.24, 12, 10), this.skin)
    belly.scale.set(1, 0.85, 0.75)
    belly.position.y = -0.18
    const hips = new Mesh(new CylinderGeometry(0.2, 0.18, 0.22, 10), this.skin)
    hips.position.y = -0.42
    this.torso.add(chest, belly, hips)

    // torn shirt
    const shirt = new Mesh(new CylinderGeometry(0.245, 0.285, 0.62, 12), this.cloth)
    shirt.position.y = 0.02
    const collar = new Mesh(new CylinderGeometry(0.12, 0.16, 0.08, 10), this.cloth)
    collar.position.y = 0.38
    // ripped flaps / holes showing flesh
    const ripA = new Mesh(new SphereGeometry(0.1, 8, 8), this.skin)
    ripA.scale.set(1.1, 1.4, 0.35)
    ripA.position.set(0.14, 0.05, 0.24)
    const ripB = new Mesh(new SphereGeometry(0.09, 8, 8), this.skin)
    ripB.scale.set(1.2, 1.1, 0.3)
    ripB.position.set(-0.12, -0.15, 0.23)
    const sleeveL = new Mesh(new CylinderGeometry(0.08, 0.07, 0.28, 8), this.cloth)
    sleeveL.rotation.z = 0.85
    sleeveL.position.set(-0.28, 0.28, 0)
    const sleeveR = new Mesh(new CylinderGeometry(0.08, 0.07, 0.18, 8), this.cloth)
    sleeveR.rotation.z = -0.7
    sleeveR.position.set(0.26, 0.3, 0)
    this.torso.add(shirt, collar, ripA, ripB, sleeveL, sleeveR)

    // zombie head
    this.head = new Group()
    this.head.position.y = 0.58
    const neck = new Mesh(new CylinderGeometry(0.07, 0.09, 0.14, 8), this.skin)
    neck.position.y = -0.2
    const skull = new Mesh(new SphereGeometry(0.2, 14, 12), this.skin)
    skull.scale.set(0.95, 1.05, 1)
    const jaw = new Mesh(new SphereGeometry(0.13, 10, 8), this.skin)
    jaw.scale.set(1.05, 0.5, 0.95)
    jaw.position.set(0, -0.14, 0.05)
    jaw.rotation.x = 0.25
    const mouthHole = new Mesh(new SphereGeometry(0.08, 8, 6), mouth)
    mouthHole.scale.set(1.3, 0.7, 0.85)
    mouthHole.position.set(0, -0.14, 0.15)
    const toothL = new Mesh(new CylinderGeometry(0.012, 0.008, 0.05, 5), tooth)
    toothL.position.set(-0.04, -0.1, 0.2)
    const toothR = new Mesh(new CylinderGeometry(0.012, 0.008, 0.045, 5), tooth)
    toothR.position.set(0.05, -0.11, 0.2)
    toothR.rotation.z = 0.3
    const eyeL = new Mesh(new SphereGeometry(0.038, 8, 8), eyeMat)
    eyeL.position.set(-0.07, 0.04, 0.16)
    eyeL.scale.set(1.1, 0.75, 0.8)
    const eyeR = new Mesh(new SphereGeometry(0.038, 8, 8), eyeMat)
    eyeR.position.set(0.07, 0.03, 0.16)
    eyeR.scale.set(1, 0.9, 0.8)
    // sunken cheek / missing chunk
    const chunk = new Mesh(new SphereGeometry(0.07, 8, 8), this.wound)
    chunk.scale.set(0.8, 1, 0.45)
    chunk.position.set(0.12, -0.02, 0.1)
    this.head.add(neck, skull, jaw, mouthHole, toothL, toothR, eyeL, eyeR, chunk)
    this.addWound(this.head, -0.1, 0.06, 0.12, 0.045)
    this.torso.add(this.head)

    this.armL = this.makeArm(-1)
    this.armR = this.makeArm(1)
    this.armL.position.set(-0.3, 0.28, 0)
    this.armR.position.set(0.3, 0.28, 0)
    this.torso.add(this.armL, this.armR)

    this.legL = this.makeLeg()
    this.legR = this.makeLeg()
    this.legL.position.set(-0.11, 0.62, 0)
    this.legR.position.set(0.11, 0.62, 0)

    // blood on shirt + more wounds through rips
    this.addWound(this.torso, 0.14, 0.05, 0.26, 0.06)
    this.addWound(this.torso, -0.12, -0.12, 0.25, 0.07)
    this.addRawMeat(this.torso, 0.08, -0.05, 0.24)
    this.addWound(this.armL, 0, -0.4, 0.06, 0.04)
    this.addWound(this.armR, 0, -0.25, 0.06, 0.05)
    this.addWound(this.legL, 0.03, -0.35, 0.08, 0.045)
    this.addWound(this.legR, -0.02, -0.7, 0.08, 0.05)

    this.group.add(this.torso, this.legL, this.legR)
  }

  private makeArm(side: number) {
    const arm = new Group()
    const upper = new Mesh(new CylinderGeometry(0.06, 0.055, 0.42, 8), this.skin)
    upper.geometry.translate(0, -0.21, 0)
    const lower = new Mesh(new CylinderGeometry(0.05, 0.04, 0.4, 8), this.skin)
    lower.geometry.translate(0, -0.2, 0)
    lower.position.set(side * 0.02, -0.42, 0.02)
    const hand = new Mesh(new SphereGeometry(0.055, 8, 8), this.skin)
    hand.scale.set(0.9, 0.7, 1.15)
    hand.position.set(side * 0.02, -0.66, 0.04)
    // torn sleeve remnant on upper arm
    if (Math.random() > 0.35) {
      const rag = new Mesh(new CylinderGeometry(0.075, 0.07, 0.16, 8), this.cloth)
      rag.geometry.translate(0, -0.05, 0)
      arm.add(rag)
    }
    arm.add(upper, lower, hand)
    return arm
  }

  private makeLeg() {
    const leg = new Group()
    const thigh = new Mesh(new CylinderGeometry(0.09, 0.08, 0.48, 8), this.pants)
    thigh.geometry.translate(0, -0.24, 0)
    const shin = new Mesh(new CylinderGeometry(0.07, 0.055, 0.42, 8), this.pants)
    shin.geometry.translate(0, -0.21, 0)
    shin.position.set(0, -0.48, 0.02)
    // torn pant leg showing skin
    if (Math.random() > 0.4) {
      const tear = new Mesh(new CylinderGeometry(0.06, 0.05, 0.2, 8), this.skin)
      tear.position.set(0.02, -0.7, 0.04)
      leg.add(tear)
    }
    const foot = new Mesh(new SphereGeometry(0.07, 8, 8), this.skin)
    foot.scale.set(0.75, 0.45, 1.35)
    foot.position.set(0, -0.96, 0.06)
    // blood stain on pants
    const stain = new Mesh(new SphereGeometry(0.05, 6, 6), this.wound)
    stain.scale.set(1.2, 0.4, 0.8)
    stain.position.set(0.04, -0.3, 0.08)
    leg.add(thigh, shin, foot, stain)
    return leg
  }

  private addWound(
    parent: Group,
    x: number,
    y: number,
    z: number,
    size: number,
  ) {
    const sore = new Mesh(new SphereGeometry(size, 8, 8), this.wound)
    sore.scale.set(1.2, 0.55, 1)
    sore.position.set(x, y, z)
    const crust = new Mesh(new SphereGeometry(size * 0.55, 6, 6), this.raw)
    crust.position.set(x + size * 0.15, y + size * 0.1, z + size * 0.2)
    parent.add(sore, crust)
  }

  private addRawMeat(parent: Group, x: number, y: number, z: number) {
    const meat = new Mesh(new SphereGeometry(0.07 + Math.random() * 0.04, 8, 8), this.raw)
    meat.scale.set(1.3, 0.6, 1.1)
    meat.position.set(x, y, z)
    const flap = new Mesh(new SphereGeometry(0.05, 6, 6), this.wound)
    flap.scale.set(1.6, 0.35, 1)
    flap.position.set(x + 0.03, y - 0.03, z + 0.02)
    parent.add(meat, flap)
  }
}

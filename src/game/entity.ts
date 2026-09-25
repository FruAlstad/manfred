import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three'
import { Cell, Maze } from './maze'
import { Player } from './player'

const WALK_SPEED = 2.8
const HUNT_SPEED = 4.6
const CATCH = 1.25

export class Entity {
  readonly group = new Group()
  hunting = false
  dead = false
  private pathIndex = 0
  private path: Cell[] = []
  private retarget = 0
  private lastSeen: Cell | null = null
  private chaseMemory = 0
  private wander = 0
  private phase = Math.random() * Math.PI * 2
  private limp = 0.92 + Math.random() * 0.16
  private readonly _playerPos = new Vector3()
  private readonly _dest = new Vector3()
  private readonly _offset = new Vector3()
  private torso!: Group
  private head!: Group
  private armL!: Group
  private armR!: Group
  private legL!: Group
  private legR!: Group
  private cloth!: MeshStandardMaterial
  private pants!: MeshStandardMaterial
  private skin!: MeshStandardMaterial
  private hair!: MeshStandardMaterial
  private shoe!: MeshStandardMaterial
  private blood!: MeshStandardMaterial

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
    if (this.dead) return false
    const here = this.maze.worldToCell(this.position.x, this.position.z)
    const target = this.maze.worldToCell(player.position.x, player.position.z)
    this._playerPos.set(player.position.x, 0, player.position.z)
    const dist = this.position.distanceTo(this._playerPos)
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

    const speed = this.hunting ? HUNT_SPEED : WALK_SPEED
    let moving = 0

    if (this.hunting && sees) {
      moving = this.moveToward(this._playerPos, speed * dt)
    } else {
      this.retarget -= dt
      if (this.retarget <= 0 || this.pathIndex >= this.path.length) {
        const goal = this.hunting
          ? (this.lastSeen ?? target)
          : this.wanderCell(here)
        this.path = this.maze.path(here, goal)
        this.pathIndex = 1
        this.retarget = this.hunting ? 0.55 : 1.8
      }

      while (
        this.pathIndex + 1 < this.path.length &&
        this.maze.hasLineOfSight(here, this.path[this.pathIndex + 1])
      ) {
        this.pathIndex += 1
      }

      const waypoint = this.path[this.pathIndex]
      if (waypoint) {
        const world = this.maze.cellCenter(waypoint)
        this._dest.set(world.x, 0, world.z)
        const before = this.position.distanceTo(this._dest)
        moving = this.moveToward(this._dest, speed * dt)
        if (before <= speed * dt + 0.15) this.pathIndex += 1
      }
    }

    this.animate(dt, moving, this.hunting)
    return dist < CATCH
  }

  kill() {
    if (this.dead) return
    this.dead = true
    this.hunting = false
    this.group.visible = false
  }

  private moveToward(dest: Vector3, step: number) {
    this._offset.copy(dest).sub(this.position)
    this._offset.y = 0
    const len = this._offset.length()
    if (len < 0.001) return 0

    if (len > step) this._offset.multiplyScalar(step / len)
    this.tryMove(this._offset)

    this._offset.copy(dest).sub(this.position)
    this._offset.y = 0
    if (this._offset.lengthSq() > 0.0001) {
      this.group.lookAt(
        this.position.x + this._offset.x,
        0,
        this.position.z + this._offset.z,
      )
    }
    return 1
  }

  private tryMove(delta: Vector3) {
    const radius = 0.35
    const nextX = this.position.x + delta.x
    const nextZ = this.position.z + delta.z

    if (this.canStand(nextX, this.position.z, radius)) {
      this.position.x = nextX
    }
    if (this.canStand(this.position.x, nextZ, radius)) {
      this.position.z = nextZ
    }
  }

  private canStand(x: number, z: number, radius: number) {
    const samples = [
      [x, z],
      [x + radius, z],
      [x - radius, z],
      [x, z + radius],
      [x, z - radius],
    ]
    return samples.every(([sx, sz]) => {
      const cell = this.maze.worldToCell(sx, sz)
      return this.maze.isOpen(cell.x, cell.z)
    })
  }

  private animate(dt: number, moving: number, hunting: boolean) {
    const rate = hunting ? 10.5 : 6.8
    this.phase += dt * rate * this.limp * (moving || 0.1)
    const swing = Math.sin(this.phase) * (hunting ? 0.7 : 0.42) * Math.max(moving, 0.12)
    const bob = Math.abs(Math.sin(this.phase)) * 0.03 * moving

    this.group.position.y = bob
    this.torso.rotation.z = Math.sin(this.phase * 0.5) * 0.025
    this.torso.rotation.x = hunting ? -0.06 : -0.015
    this.head.rotation.y = Math.sin(this.phase * 0.28) * 0.06
    this.head.rotation.x = hunting ? 0.08 : 0.015
    this.armL.rotation.x = swing
    this.armL.rotation.z = 0.06
    this.armR.rotation.x = -swing
    this.armR.rotation.z = -0.06
    this.legL.rotation.x = -swing * 0.95
    this.legR.rotation.x = swing * 0.95
  }

  private wanderCell(from: Cell): Cell {
    this.wander -= 1
    if (this.wander <= 0) this.wander = 3 + Math.floor(Math.random() * 5)
    // cheap wander: walk a few random neighbor steps
    let cell = from
    for (let i = 0; i < 6; i += 1) {
      const options = this.maze.neighbors(cell)
      if (options.length === 0) break
      cell = options[Math.floor(Math.random() * options.length)]
    }
    return cell
  }

  private build() {
    const tall = 0.96 + Math.random() * 0.12
    const build = 0.92 + Math.random() * 0.14
    this.group.scale.set(build, tall, build * 0.98)

    const skinTone = 0.48 + Math.random() * 0.22
    const skinHue = 0.06 + Math.random() * 0.05
    this.skin = new MeshStandardMaterial({
      color: new Color().setHSL(skinHue, 0.32 + Math.random() * 0.15, skinTone),
      roughness: 0.72,
      metalness: 0,
    })
    this.hair = new MeshStandardMaterial({
      color: new Color().setHSL(
        0.06 + Math.random() * 0.08,
        0.25 + Math.random() * 0.4,
        0.08 + Math.random() * 0.28,
      ),
      roughness: 0.92,
      metalness: 0,
    })

    const shirtStyles = [
      () => new Color().setHSL(0.58, 0.35, 0.42),
      () => new Color().setHSL(0.02, 0.45, 0.38),
      () => new Color().setHSL(0.12, 0.4, 0.4),
      () => new Color().setHSL(0.33, 0.25, 0.35),
      () => new Color('#2a2a2e'),
      () => new Color('#e8e4dc'),
    ]
    this.cloth = new MeshStandardMaterial({
      color: shirtStyles[Math.floor(Math.random() * shirtStyles.length)](),
      roughness: 0.86,
      metalness: 0,
    })
    this.pants = new MeshStandardMaterial({
      color: new Color().setHSL(0.6, 0.15 + Math.random() * 0.15, 0.16 + Math.random() * 0.14),
      roughness: 0.9,
      metalness: 0,
    })
    this.shoe = new MeshStandardMaterial({
      color: new Color().setHSL(0.08, 0.25, 0.1 + Math.random() * 0.08),
      roughness: 0.8,
      metalness: 0.05,
    })
    this.blood = new MeshStandardMaterial({
      color: new Color('#5a0808'),
      roughness: 0.45,
      metalness: 0,
      emissive: new Color('#4a0505'),
      emissiveIntensity: 0.35,
    })

    const eyeWhite = new MeshStandardMaterial({
      color: new Color('#f4f1ea'),
      roughness: 0.35,
      metalness: 0,
    })
    const iris = new MeshStandardMaterial({
      color: new Color().setHSL(0.1 + Math.random() * 0.45, 0.4, 0.25 + Math.random() * 0.1),
      roughness: 0.3,
      metalness: 0,
    })
    const pupil = new MeshStandardMaterial({
      color: new Color('#0a0806'),
      roughness: 0.25,
      metalness: 0,
    })
    const lip = new MeshStandardMaterial({
      color: new Color().setHSL(0.0, 0.4, 0.42 + Math.random() * 0.08),
      roughness: 0.55,
      metalness: 0,
    })
    const brow = this.hair.clone()
    const belt = new MeshStandardMaterial({
      color: new Color('#2a1c12'),
      roughness: 0.75,
      metalness: 0.1,
    })

    this.torso = new Group()
    this.torso.position.y = 1.12

    const chest = new Mesh(new CylinderGeometry(0.2, 0.24, 0.38, 14), this.skin)
    chest.position.y = 0.18
    const shirt = new Mesh(new CylinderGeometry(0.235, 0.275, 0.58, 14), this.cloth)
    shirt.position.y = 0.06
    const hem = new Mesh(new CylinderGeometry(0.28, 0.275, 0.06, 14), this.cloth)
    hem.position.y = -0.24
    const collar = new Mesh(new CylinderGeometry(0.1, 0.145, 0.06, 12), this.cloth)
    collar.position.y = 0.38
    const neckSkin = new Mesh(new CylinderGeometry(0.08, 0.1, 0.08, 10), this.skin)
    neckSkin.position.y = 0.36
    const beltMesh = new Mesh(new CylinderGeometry(0.265, 0.27, 0.05, 12), belt)
    beltMesh.position.y = -0.3
    const buckle = new Mesh(new SphereGeometry(0.035, 8, 8), new MeshStandardMaterial({
      color: '#a89860',
      roughness: 0.4,
      metalness: 0.6,
    }))
    buckle.scale.set(1.2, 0.5, 0.4)
    buckle.position.set(0, -0.3, 0.26)
    this.torso.add(chest, shirt, hem, collar, neckSkin, beltMesh, buckle)

    // blood on shirt
    this.addBloodStain(this.torso, 0.12, 0.12, 0.26, 0.08)
    this.addBloodStain(this.torso, -0.1, -0.05, 0.25, 0.1)
    this.addBloodStain(this.torso, 0.02, -0.15, 0.26, 0.07)
    this.addBloodStain(this.torso, 0.08, 0.28, 0.2, 0.05)
    this.addBloodDrip(this.torso, 0.1, 0.05, 0.27)

    this.head = new Group()
    this.head.position.y = 0.56
    const neck = new Mesh(new CylinderGeometry(0.065, 0.08, 0.13, 10), this.skin)
    neck.position.y = -0.2

    const skull = new Mesh(new SphereGeometry(0.185, 18, 14), this.skin)
    skull.scale.set(0.92, 1.08, 0.98)

    const hairTop = new Mesh(new SphereGeometry(0.195, 14, 12), this.hair)
    hairTop.scale.set(0.95, 0.72, 1.02)
    hairTop.position.y = 0.07
    const hairSideL = new Mesh(new SphereGeometry(0.08, 10, 8), this.hair)
    hairSideL.scale.set(0.7, 1.2, 0.85)
    hairSideL.position.set(-0.14, 0.0, 0.02)
    const hairSideR = hairSideL.clone()
    hairSideR.position.x = 0.14
    const hairBack = new Mesh(new SphereGeometry(0.12, 10, 8), this.hair)
    hairBack.scale.set(1.1, 1.0, 0.7)
    hairBack.position.set(0, 0.0, -0.12)

    const cheekL = new Mesh(new SphereGeometry(0.05, 8, 8), this.skin)
    cheekL.position.set(-0.1, -0.02, 0.1)
    cheekL.scale.set(0.9, 1, 0.7)
    const cheekR = cheekL.clone()
    cheekR.position.x = 0.1

    const nose = new Mesh(new ConeGeometry(0.028, 0.07, 6), this.skin)
    nose.rotation.x = Math.PI / 2
    nose.position.set(0, -0.01, 0.175)

    const jaw = new Mesh(new SphereGeometry(0.1, 12, 10), this.skin)
    jaw.scale.set(1.05, 0.55, 0.88)
    jaw.position.set(0, -0.1, 0.03)

    const upperLip = new Mesh(new SphereGeometry(0.035, 8, 6), lip)
    upperLip.scale.set(1.6, 0.35, 0.7)
    upperLip.position.set(0, -0.095, 0.155)
    const lowerLip = new Mesh(new SphereGeometry(0.032, 8, 6), lip)
    lowerLip.scale.set(1.45, 0.4, 0.65)
    lowerLip.position.set(0, -0.115, 0.15)

    const eyeSocketL = new Mesh(new SphereGeometry(0.032, 10, 8), eyeWhite)
    eyeSocketL.position.set(-0.055, 0.035, 0.15)
    eyeSocketL.scale.set(1.15, 0.85, 0.7)
    const eyeSocketR = eyeSocketL.clone()
    eyeSocketR.position.x = 0.055
    const irisL = new Mesh(new SphereGeometry(0.016, 8, 8), iris)
    irisL.position.set(-0.055, 0.035, 0.168)
    const irisR = irisL.clone()
    irisR.position.x = 0.055
    const pupilL = new Mesh(new SphereGeometry(0.008, 6, 6), pupil)
    pupilL.position.set(-0.055, 0.035, 0.178)
    const pupilR = pupilL.clone()
    pupilR.position.x = 0.055

    const browL = new Mesh(new SphereGeometry(0.04, 6, 6), brow)
    browL.scale.set(1.4, 0.25, 0.4)
    browL.position.set(-0.055, 0.07, 0.15)
    browL.rotation.z = 0.12
    const browR = browL.clone()
    browR.position.x = 0.055
    browR.rotation.z = -0.12

    const earL = new Mesh(new SphereGeometry(0.04, 8, 8), this.skin)
    earL.scale.set(0.45, 1, 0.7)
    earL.position.set(-0.17, 0.0, 0.0)
    const earR = earL.clone()
    earR.position.x = 0.17

    this.head.add(
      neck, skull, hairTop, hairSideL, hairSideR, hairBack,
      cheekL, cheekR, nose, jaw, upperLip, lowerLip,
      eyeSocketL, eyeSocketR, irisL, irisR, pupilL, pupilR,
      browL, browR, earL, earR,
    )
    this.torso.add(this.head)

    this.armL = this.makeArm(-1)
    this.armR = this.makeArm(1)
    this.armL.position.set(-0.3, 0.28, 0)
    this.armR.position.set(0.3, 0.28, 0)
    this.torso.add(this.armL, this.armR)

    this.legL = this.makeLeg()
    this.legR = this.makeLeg()
    this.legL.position.set(-0.105, 0.6, 0)
    this.legR.position.set(0.105, 0.6, 0)

    // blood on pants / sleeves
    this.addBloodStain(this.armL, 0, -0.2, 0.07, 0.045)
    this.addBloodStain(this.armR, 0, -0.15, 0.07, 0.05)
    this.addBloodStain(this.legL, 0.04, -0.25, 0.09, 0.06)
    this.addBloodStain(this.legR, -0.03, -0.4, 0.09, 0.07)
    this.addBloodDrip(this.legL, 0.03, -0.35, 0.09)
    this.addBloodDrip(this.legR, -0.02, -0.55, 0.09)

    this.group.add(this.torso, this.legL, this.legR)
  }

  private makeArm(side: number) {
    const arm = new Group()
    const shoulder = new Mesh(new SphereGeometry(0.075, 10, 8), this.cloth)
    shoulder.position.y = 0.02
    const sleeve = new Mesh(new CylinderGeometry(0.068, 0.06, 0.36, 10), this.cloth)
    sleeve.geometry.translate(0, -0.18, 0)
    const elbow = new Mesh(new SphereGeometry(0.05, 8, 8), this.skin)
    elbow.position.set(side * 0.01, -0.36, 0.01)
    const forearm = new Mesh(new CylinderGeometry(0.048, 0.042, 0.34, 10), this.skin)
    forearm.geometry.translate(0, -0.17, 0)
    forearm.position.set(side * 0.01, -0.38, 0.02)
    const wrist = new Mesh(new SphereGeometry(0.038, 8, 8), this.skin)
    wrist.position.set(side * 0.01, -0.58, 0.03)
    const palm = new Mesh(new SphereGeometry(0.048, 8, 8), this.skin)
    palm.scale.set(0.85, 0.55, 1.15)
    palm.position.set(side * 0.01, -0.64, 0.04)
    for (let i = 0; i < 4; i += 1) {
      const finger = new Mesh(new CylinderGeometry(0.01, 0.008, 0.07, 5), this.skin)
      finger.rotation.x = 0.5
      finger.position.set(side * 0.01 + (i - 1.5) * 0.018, -0.7, 0.07)
      arm.add(finger)
    }
    arm.add(shoulder, sleeve, elbow, forearm, wrist, palm)
    return arm
  }

  private makeLeg() {
    const leg = new Group()
    const hip = new Mesh(new SphereGeometry(0.09, 10, 8), this.pants)
    hip.position.y = 0.02
    const thigh = new Mesh(new CylinderGeometry(0.09, 0.078, 0.46, 12), this.pants)
    thigh.geometry.translate(0, -0.23, 0)
    const knee = new Mesh(new SphereGeometry(0.06, 8, 8), this.pants)
    knee.position.set(0, -0.46, 0.015)
    const shin = new Mesh(new CylinderGeometry(0.068, 0.055, 0.44, 12), this.pants)
    shin.geometry.translate(0, -0.22, 0)
    shin.position.set(0, -0.48, 0.02)
    const ankle = new Mesh(new SphereGeometry(0.045, 8, 8), this.skin)
    ankle.position.set(0, -0.9, 0.03)
    const shoeBody = new Mesh(new SphereGeometry(0.075, 10, 8), this.shoe)
    shoeBody.scale.set(0.85, 0.5, 1.55)
    shoeBody.position.set(0, -0.96, 0.08)
    const sole = new Mesh(new CylinderGeometry(0.06, 0.065, 0.03, 10), this.shoe)
    sole.rotation.x = Math.PI / 2
    sole.scale.set(1, 1.6, 1)
    sole.position.set(0, -1.0, 0.08)
    leg.add(hip, thigh, knee, shin, ankle, shoeBody, sole)
    return leg
  }

  private addBloodStain(
    parent: Group,
    x: number,
    y: number,
    z: number,
    size: number,
  ) {
    const stain = new Mesh(new SphereGeometry(size, 8, 8), this.blood)
    stain.scale.set(1.4, 0.35, 1.1)
    stain.position.set(x, y, z)
    const splatter = new Mesh(new SphereGeometry(size * 0.55, 6, 6), this.blood)
    splatter.scale.set(1.2, 0.3, 0.9)
    splatter.position.set(x + size * 0.4, y - size * 0.3, z + size * 0.1)
    parent.add(stain, splatter)
  }

  private addBloodDrip(parent: Group, x: number, y: number, z: number) {
    const drip = new Mesh(new CylinderGeometry(0.012, 0.008, 0.14 + Math.random() * 0.1, 5), this.blood)
    drip.position.set(x, y - 0.08, z)
    const drop = new Mesh(new SphereGeometry(0.02, 6, 6), this.blood)
    drop.position.set(x, y - 0.16, z)
    parent.add(drip, drop)
  }
}

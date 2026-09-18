import {
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three'
import { Maze } from './maze'
import { Player } from './player'

const SPEED = 3.15
const CATCH = 1.15

export class Entity {
  readonly group = new Group()
  hunting = false
  private pathIndex = 0
  private path: Array<{ x: number; z: number }> = []
  private retarget = 0
  private wander = 0

  constructor(private maze: Maze) {
    const start = maze.cellCenter(maze.entityStart)
    this.group.position.set(start.x, 0, start.z)
    this.build()
  }

  get position() {
    return this.group.position
  }

  update(dt: number, player: Player) {
    const here = this.maze.worldToCell(this.position.x, this.position.z)
    const target = this.maze.worldToCell(player.position.x, player.position.z)
    const dist = this.position.distanceTo(new Vector3(player.position.x, 0, player.position.z))
    const sees = dist < 28 && this.maze.hasLineOfSight(here, target)
    this.hunting = sees || dist < 10

    this.retarget -= dt
    if (this.retarget <= 0) {
      this.path = this.maze.path(here, this.hunting ? target : this.wanderCell())
      this.pathIndex = 1
      this.retarget = this.hunting ? 0.35 : 1.4
    }

    const goal = this.path[this.pathIndex]
    if (goal) {
      const world = this.maze.cellCenter(goal)
      const dest = new Vector3(world.x, 0, world.z)
      const offset = dest.clone().sub(this.position)
      offset.y = 0
      const step = SPEED * (this.hunting ? 1.18 : 0.72) * dt
      if (offset.length() <= step) {
        this.position.copy(dest)
        this.pathIndex += 1
      } else {
        offset.normalize().multiplyScalar(step)
        this.position.add(offset)
      }
      this.group.lookAt(this.position.x + offset.x, 0, this.position.z + offset.z)
    }

    this.group.position.y = Math.sin(performance.now() * 0.006) * 0.05
    return dist < CATCH
  }

  private wanderCell() {
    this.wander -= 1
    if (this.wander <= 0) {
      this.wander = 4 + Math.floor(Math.random() * 8)
    }
    const open: Array<{ x: number; z: number }> = []
    for (let z = 1; z < this.maze.height - 1; z += 1) {
      for (let x = 1; x < this.maze.width - 1; x += 1) {
        if (this.maze.isOpen(x, z)) open.push({ x, z })
      }
    }
    return open[Math.floor(Math.random() * open.length)] ?? this.maze.entityStart
  }

  private build() {
    const black = new MeshStandardMaterial({
      color: new Color('#070606'),
      roughness: 0.95,
      emissive: new Color('#050203'),
    })
    const eye = new MeshStandardMaterial({
      color: new Color('#1a0808'),
      emissive: new Color('#4a0000'),
      emissiveIntensity: 1.8,
    })

    const body = new Mesh(new BoxGeometry(0.42, 2.1, 0.28), black)
    body.position.y = 1.2
    const head = new Mesh(new BoxGeometry(0.36, 0.48, 0.32), black)
    head.position.y = 2.42
    const left = new Mesh(new BoxGeometry(0.06, 0.06, 0.04), eye)
    left.position.set(-0.09, 2.48, 0.16)
    const right = new Mesh(new BoxGeometry(0.06, 0.06, 0.04), eye)
    right.position.set(0.09, 2.48, 0.16)
    const armL = new Mesh(new BoxGeometry(0.12, 1.5, 0.12), black)
    armL.position.set(-0.34, 1.1, 0)
    const armR = new Mesh(new BoxGeometry(0.12, 1.5, 0.12), black)
    armR.position.set(0.34, 1.1, 0)

    this.group.add(body, head, left, right, armL, armR)
  }
}

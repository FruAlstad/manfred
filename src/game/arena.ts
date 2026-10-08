import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  FogExp2,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Scene,
} from 'three'
import type { Box2 } from './street'

const SIZE = 48
const WALL_H = 9

export class Arena {
  readonly scene = new Scene()
  readonly solids: Box2[] = []
  readonly spawn = { x: 0, z: 18, yaw: Math.PI }
  readonly bossSpawn = { x: 0, z: -10 }
  private readonly root = new Group()

  constructor() {
    this.scene.background = new Color('#e8e4d8')
    this.scene.fog = new FogExp2(0xe8e4d8, 0.008)
    this.scene.add(new AmbientLight(0xfff6e8, 1.35))
    this.scene.add(new HemisphereLight(0xffffff, 0xd8d0c0, 1.1))
    const sun = new DirectionalLight(0xfff2d8, 1.4)
    sun.position.set(8, 24, 10)
    this.scene.add(sun)
    this.scene.add(this.root)
    this.build()
  }

  update(time: number) {
    for (const child of this.root.children) {
      if (child instanceof PointLight) {
        child.intensity = 3.2 + Math.sin(time * 2 + child.position.x) * 0.2
      }
    }
  }

  private build() {
    const floorMat = new MeshStandardMaterial({
      color: '#d8d2c4',
      roughness: 0.9,
    })
    const wallMat = new MeshStandardMaterial({
      color: '#f0ece2',
      roughness: 0.82,
    })
    const accent = new MeshStandardMaterial({
      color: '#e8dcc8',
      emissive: '#fff4d0',
      emissiveIntensity: 0.35,
      roughness: 0.65,
    })

    const floor = new Mesh(new PlaneGeometry(SIZE, SIZE), floorMat)
    floor.rotation.x = -Math.PI / 2
    this.root.add(floor)

    const ring = new Mesh(
      new PlaneGeometry(SIZE * 0.55, SIZE * 0.55),
      new MeshStandardMaterial({
        color: '#c8c0b0',
        roughness: 0.88,
        transparent: true,
        opacity: 0.85,
      }),
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.02
    this.root.add(ring)

    const half = SIZE * 0.5
    const thick = 1.2
    const walls: Array<{ x: number; z: number; sx: number; sz: number }> = [
      { x: 0, z: -half, sx: SIZE + thick, sz: thick },
      { x: 0, z: half, sx: SIZE + thick, sz: thick },
      { x: -half, z: 0, sx: thick, sz: SIZE + thick },
      { x: half, z: 0, sx: thick, sz: SIZE + thick },
    ]
    for (const w of walls) {
      const mesh = new Mesh(new BoxGeometry(w.sx, WALL_H, w.sz), wallMat)
      mesh.position.set(w.x, WALL_H * 0.5, w.z)
      this.root.add(mesh)
      this.solids.push({
        minX: w.x - w.sx * 0.5,
        maxX: w.x + w.sx * 0.5,
        minZ: w.z - w.sz * 0.5,
        maxZ: w.z + w.sz * 0.5,
      })
    }

    for (const [px, pz] of [
      [-14, -14],
      [14, -14],
      [-14, 14],
      [14, 14],
    ] as const) {
      const pillar = new Mesh(new BoxGeometry(2.2, WALL_H, 2.2), accent)
      pillar.position.set(px, WALL_H * 0.5, pz)
      this.root.add(pillar)
      this.solids.push({
        minX: px - 1.1,
        maxX: px + 1.1,
        minZ: pz - 1.1,
        maxZ: pz + 1.1,
      })
      const light = new PointLight(0xfff5e0, 3.4, 28, 2)
      light.position.set(px, 6, pz)
      this.root.add(light)
    }

    const centerLight = new PointLight(0xffffff, 4.5, 40, 2)
    centerLight.position.set(0, 10, 0)
    this.root.add(centerLight)

    // bright fill over the boss half of the arena
    const bossLight = new PointLight(0xfff8ee, 5, 35, 1.5)
    bossLight.position.set(0, 9, -8)
    this.root.add(bossLight)
  }
}

import {
  AmbientLight,
  BoxGeometry,
  Color,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Scene,
} from 'three'
import { CELL, Maze } from './maze'
import { makeCarpet, makeCeiling, makeWallpaper } from './textures'

const HEIGHT = 3.28
const THICK = 0.16

export class World {
  readonly scene = new Scene()
  readonly lights: Array<{ mesh: Mesh; light: PointLight; next: number }> = []
  readonly root = new Group()

  constructor(readonly maze: Maze) {
    this.scene.background = new Color('#d6c56a')
    this.scene.fog = null
    this.scene.add(new AmbientLight(0xe8d98a, 0.95))
    this.scene.add(new HemisphereLight(0xfff3c0, 0xc4a84a, 0.9))
    this.scene.add(this.root)
    this.build()
  }

  update(time: number) {
    for (const fixture of this.lights) {
      if (time > fixture.next) {
        const dead = Math.random() < 0.08
        const intensity = dead ? 0 : 1.15 + Math.random() * 0.25
        fixture.light.intensity = intensity
        const material = fixture.mesh.material as MeshStandardMaterial
        material.emissiveIntensity = dead ? 0.05 : 1.6
        fixture.next = time + (dead ? 0.08 + Math.random() * 0.25 : 0.4 + Math.random() * 2.8)
      }
    }
  }

  private build() {
    const wallpaper = new MeshStandardMaterial({
      map: makeWallpaper(),
      roughness: 0.86,
      color: '#efe07a',
    })
    const carpet = new MeshStandardMaterial({
      map: makeCarpet(),
      roughness: 0.95,
      color: '#d7c25a',
    })
    const ceiling = new MeshStandardMaterial({
      map: makeCeiling(),
      roughness: 0.9,
      color: '#ddd4b8',
    })
    const fixtureMat = new MeshStandardMaterial({
      color: '#f6f0c8',
      emissive: '#fff4c2',
      emissiveIntensity: 1.6,
      roughness: 0.3,
    })
    const exitMat = new MeshStandardMaterial({
      color: '#14110c',
      emissive: '#3a2a10',
      emissiveIntensity: 0.8,
      roughness: 0.7,
    })

    const floorGeo = new PlaneGeometry(CELL, CELL)
    const wallGeo = new BoxGeometry(CELL, HEIGHT, THICK)
    const wallGeoZ = new BoxGeometry(THICK, HEIGHT, CELL)
    const lightGeo = new BoxGeometry(2.2, 0.06, 0.42)

    for (let z = 0; z < this.maze.height; z += 1) {
      for (let x = 0; x < this.maze.width; x += 1) {
        if (!this.maze.isOpen(x, z)) continue
        const cx = (x + 0.5) * CELL
        const cz = (z + 0.5) * CELL

        const floor = new Mesh(floorGeo, carpet)
        floor.rotation.x = -Math.PI / 2
        floor.position.set(cx, 0, cz)
        this.root.add(floor)

        const roof = new Mesh(floorGeo, ceiling)
        roof.rotation.x = Math.PI / 2
        roof.position.set(cx, HEIGHT, cz)
        this.root.add(roof)

        if (!this.maze.isOpen(x, z - 1)) {
          const wall = new Mesh(wallGeo, wallpaper)
          wall.position.set(cx, HEIGHT / 2, z * CELL)
          this.root.add(wall)
        }
        if (!this.maze.isOpen(x, z + 1)) {
          const wall = new Mesh(wallGeo, wallpaper)
          wall.position.set(cx, HEIGHT / 2, (z + 1) * CELL)
          this.root.add(wall)
        }
        if (!this.maze.isOpen(x - 1, z)) {
          const wall = new Mesh(wallGeoZ, wallpaper)
          wall.position.set(x * CELL, HEIGHT / 2, cz)
          this.root.add(wall)
        }
        if (!this.maze.isOpen(x + 1, z)) {
          const wall = new Mesh(wallGeoZ, wallpaper)
          wall.position.set((x + 1) * CELL, HEIGHT / 2, cz)
          this.root.add(wall)
        }

        if ((x + z) % 2 === 0) {
          const mesh = new Mesh(lightGeo, fixtureMat.clone())
          mesh.position.set(cx, HEIGHT - 0.04, cz)
          this.root.add(mesh)
          if (x % 2 === 0 && z % 2 === 0) {
            const light = new PointLight(0xfff3c4, 2.1, CELL * 4.2, 1.05)
            light.position.set(cx, HEIGHT - 0.2, cz)
            this.root.add(light)
            this.lights.push({ mesh, light, next: Math.random() * 2 })
          }
        }
      }
    }

    const exit = this.maze.cellCenter(this.maze.exit)
    const door = new Mesh(new BoxGeometry(1.2, 2.3, 0.12), exitMat)
    door.position.set(exit.x, 1.15, exit.z)
    this.root.add(door)
    const glow = new PointLight(0x6a4a18, 1.4, 7, 2)
    glow.position.set(exit.x, 1.6, exit.z)
    this.root.add(glow)
  }
}

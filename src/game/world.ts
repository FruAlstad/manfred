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
import { makeBloodPuddle, makeCarpet, makeCeiling, makeWallpaper } from './textures'

const HEIGHT = 3.28
const THICK = 0.16
const MAX_LIGHTS = 8
const MAX_PUDDLES = 18

export class World {
  readonly scene = new Scene()
  readonly lights: Array<{ mesh: Mesh; light: PointLight; next: number }> = []
  readonly root = new Group()

  constructor(readonly maze: Maze) {
    this.scene.background = new Color('#d6c56a')
    this.scene.fog = null
    this.scene.add(new AmbientLight(0xe8d98a, 1.15))
    this.scene.add(new HemisphereLight(0xfff3c0, 0xc4a84a, 1.05))
    this.scene.add(this.root)
    this.build()
  }

  update(time: number) {
    // flicker only a couple lights, infrequently
    for (const fixture of this.lights) {
      if (time < fixture.next) continue
      const roll = Math.random()
      const material = fixture.mesh.material as MeshStandardMaterial
      if (roll < 0.12) {
        fixture.light.intensity = 0
        material.emissiveIntensity = 0.05
        fixture.next = time + 0.12 + Math.random() * 0.2
      } else {
        fixture.light.intensity = 2.2 + Math.random() * 0.3
        material.emissiveIntensity = 1.5
        fixture.next = time + 1.2 + Math.random() * 3
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
    const puddleGeo = new PlaneGeometry(1, 1)

    // few shared puddle materials (not one per puddle)
    const puddleMats = Array.from({ length: 3 }, () => {
      const map = makeBloodPuddle()
      map.generateMipmaps = false
      return new MeshStandardMaterial({
        map,
        transparent: true,
        depthWrite: false,
        roughness: 0.35,
        metalness: 0,
        color: '#ffffff',
        opacity: 0.9,
      })
    })

    let puddleCount = 0
    let lightCount = 0
    const openCells: Array<{ x: number; z: number; cx: number; cz: number }> = []

    for (let z = 0; z < this.maze.height; z += 1) {
      for (let x = 0; x < this.maze.width; x += 1) {
        if (!this.maze.isOpen(x, z)) continue
        const cx = (x + 0.5) * CELL
        const cz = (z + 0.5) * CELL
        openCells.push({ x, z, cx, cz })

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

        // visual fixtures without real lights on most cells
        if ((x + z) % 3 === 0) {
          const mesh = new Mesh(lightGeo, fixtureMat)
          mesh.position.set(cx, HEIGHT - 0.04, cz)
          this.root.add(mesh)
        }
      }
    }

    // place a limited number of real point lights far apart
    for (let i = openCells.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[openCells[i], openCells[j]] = [openCells[j], openCells[i]]
    }
    for (const cell of openCells) {
      if (lightCount >= MAX_LIGHTS) break
      if (lightCount > 0 && Math.random() > 0.35) continue
      const mesh = new Mesh(lightGeo, fixtureMat.clone())
      mesh.position.set(cell.cx, HEIGHT - 0.04, cell.cz)
      const light = new PointLight(0xfff3c4, 2.4, CELL * 5.5, 1)
      light.position.set(cell.cx, HEIGHT - 0.2, cell.cz)
      this.root.add(mesh, light)
      this.lights.push({ mesh, light, next: Math.random() * 2 })
      lightCount += 1
    }

    for (const cell of openCells) {
      if (puddleCount >= MAX_PUDDLES) break
      if (Math.random() > 0.08) continue
      const mat = puddleMats[puddleCount % puddleMats.length]
      const puddle = new Mesh(puddleGeo, mat)
      puddle.rotation.x = -Math.PI / 2
      puddle.rotation.z = Math.random() * Math.PI * 2
      puddle.position.set(
        cell.cx + (Math.random() - 0.5) * CELL * 0.5,
        0.012,
        cell.cz + (Math.random() - 0.5) * CELL * 0.5,
      )
      const size = 1.0 + Math.random() * 1.4
      puddle.scale.set(size, size * (0.75 + Math.random() * 0.3), 1)
      this.root.add(puddle)
      puddleCount += 1
    }

    const exit = this.maze.cellCenter(this.maze.exit)
    const door = new Mesh(new BoxGeometry(1.2, 2.3, 0.12), exitMat)
    door.position.set(exit.x, 1.15, exit.z)
    this.root.add(door)
    const glow = new PointLight(0x6a4a18, 1.2, 7, 2)
    glow.position.set(exit.x, 1.6, exit.z)
    this.root.add(glow)
  }
}

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
import { makeBloodDecal, makeCarpet, makeCeiling, makeWallpaper } from './textures'

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
        const roll = Math.random()
        const material = fixture.mesh.material as MeshStandardMaterial

        if (roll < 0.22) {
          // hard blink out
          fixture.light.intensity = 0
          material.emissiveIntensity = 0.04
          fixture.next = time + 0.05 + Math.random() * 0.12
        } else if (roll < 0.45) {
          // stutter flicker
          fixture.light.intensity = 0.25 + Math.random() * 0.7
          material.emissiveIntensity = 0.25 + Math.random() * 0.6
          fixture.next = time + 0.03 + Math.random() * 0.08
        } else {
          // steady buzz
          fixture.light.intensity = 1.9 + Math.random() * 0.4
          material.emissiveIntensity = 1.5 + Math.random() * 0.4
          fixture.next = time + 0.6 + Math.random() * 2.4
        }
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
    const bloodMap = makeBloodDecal()
    const bloodMat = new MeshStandardMaterial({
      map: bloodMap,
      transparent: true,
      depthWrite: false,
      roughness: 0.95,
      metalness: 0,
      color: '#ffffff',
    })
    const bloodGeo = new PlaneGeometry(1, 1.4)

    const addBlood = (
      x: number,
      y: number,
      z: number,
      rotY: number,
      scale = 1,
    ) => {
      const stain = new Mesh(bloodGeo, bloodMat)
      stain.position.set(x, y, z)
      stain.rotation.y = rotY
      stain.scale.setScalar(0.7 + Math.random() * 1.4 * scale)
      this.root.add(stain)
    }

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
          if (Math.random() < 0.28) {
            addBlood(cx + (Math.random() - 0.5) * 2.2, 0.9 + Math.random() * 1.5, z * CELL + 0.09, 0)
          }
        }
        if (!this.maze.isOpen(x, z + 1)) {
          const wall = new Mesh(wallGeo, wallpaper)
          wall.position.set(cx, HEIGHT / 2, (z + 1) * CELL)
          this.root.add(wall)
          if (Math.random() < 0.28) {
            addBlood(
              cx + (Math.random() - 0.5) * 2.2,
              0.9 + Math.random() * 1.5,
              (z + 1) * CELL - 0.09,
              Math.PI,
            )
          }
        }
        if (!this.maze.isOpen(x - 1, z)) {
          const wall = new Mesh(wallGeoZ, wallpaper)
          wall.position.set(x * CELL, HEIGHT / 2, cz)
          this.root.add(wall)
          if (Math.random() < 0.28) {
            addBlood(
              x * CELL + 0.09,
              0.9 + Math.random() * 1.5,
              cz + (Math.random() - 0.5) * 2.2,
              Math.PI / 2,
            )
          }
        }
        if (!this.maze.isOpen(x + 1, z)) {
          const wall = new Mesh(wallGeoZ, wallpaper)
          wall.position.set((x + 1) * CELL, HEIGHT / 2, cz)
          this.root.add(wall)
          if (Math.random() < 0.28) {
            addBlood(
              (x + 1) * CELL - 0.09,
              0.9 + Math.random() * 1.5,
              cz + (Math.random() - 0.5) * 2.2,
              -Math.PI / 2,
            )
          }
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

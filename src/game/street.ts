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

export type Box2 = { minX: number; maxX: number; minZ: number; maxZ: number }

/** Every house shares the same footprint length along the street. */
const HOUSE_LENGTH = 10
const HOUSE_DEPTH = 8
const HOUSE_HEIGHT = 7.2
const HOUSE_GAP = 1.4
const STREET_WIDTH = 15
const SIDEWALK = 2.8
const BLOCKS = 8
const STREET_HALF = STREET_WIDTH * 0.5
const WALL = 0.28
const DOOR_WIDTH = 1.6
const INTERIOR_PAD = 0.35

export class Street {
  readonly scene = new Scene()
  readonly solids: Box2[] = []
  /** Interior floors where the player can hide from zombies. */
  readonly hideZones: Box2[] = []
  readonly spawn = { x: 0, z: 0, yaw: 0 }
  readonly zombieSpawns: Array<{ x: number; z: number }> = []
  private readonly root = new Group()

  constructor() {
    this.scene.background = new Color('#87b8e0')
    this.scene.fog = new FogExp2(0xb8d4ec, 0.012)
    this.scene.add(new AmbientLight(0xfff4e0, 1.15))
    this.scene.add(new HemisphereLight(0xd8e8ff, 0x8a9a70, 0.95))
    const sun = new DirectionalLight(0xfff0d0, 1.35)
    sun.position.set(18, 42, 12)
    this.scene.add(sun)
    this.scene.add(this.root)
    this.build()
  }

  isHiding(x: number, z: number) {
    return this.hideZones.some(
      (zone) =>
        x >= zone.minX &&
        x <= zone.maxX &&
        z >= zone.minZ &&
        z <= zone.maxZ,
    )
  }

  update(_time: number) {
    // daytime — no lamp flicker
  }

  private build() {
    const roadLen = BLOCKS * (HOUSE_LENGTH + HOUSE_GAP) + HOUSE_GAP
    const halfLen = roadLen * 0.5

    const asphalt = new MeshStandardMaterial({
      color: '#5a5e66',
      roughness: 0.92,
    })
    const curb = new MeshStandardMaterial({
      color: '#9a9ea6',
      roughness: 0.85,
    })
    const walk = new MeshStandardMaterial({
      color: '#b0b4bc',
      roughness: 0.9,
    })
    const facadeMats = [
      new MeshStandardMaterial({ color: '#c4a890', roughness: 0.88 }),
      new MeshStandardMaterial({ color: '#a8b0c0', roughness: 0.88 }),
      new MeshStandardMaterial({ color: '#d2bba0', roughness: 0.88 }),
      new MeshStandardMaterial({ color: '#b8b0a8', roughness: 0.88 }),
    ]
    const roofMat = new MeshStandardMaterial({
      color: '#4a4440',
      roughness: 0.92,
    })
    const windowMat = new MeshStandardMaterial({
      color: '#7a9ab8',
      roughness: 0.25,
      metalness: 0.15,
    })
    const doorMat = new MeshStandardMaterial({
      color: '#6a4030',
      roughness: 0.75,
    })

    // Road
    const road = new Mesh(
      new PlaneGeometry(STREET_WIDTH, roadLen + 20),
      asphalt,
    )
    road.rotation.x = -Math.PI / 2
    road.position.y = 0.01
    this.root.add(road)

    // Center line
    const lineMat = new MeshStandardMaterial({ color: '#c8b060', roughness: 0.7 })
    for (let i = 0; i < 24; i += 1) {
      const stripe = new Mesh(new PlaneGeometry(0.18, 2.2), lineMat)
      stripe.rotation.x = -Math.PI / 2
      stripe.position.set(0, 0.02, -halfLen + 4 + i * 4.2)
      this.root.add(stripe)
    }

    // Sidewalks + curbs
    for (const side of [-1, 1] as const) {
      const sidewalk = new Mesh(
        new PlaneGeometry(SIDEWALK, roadLen + 20),
        walk,
      )
      sidewalk.rotation.x = -Math.PI / 2
      sidewalk.position.set(
        side * (STREET_HALF + SIDEWALK * 0.5),
        0.03,
        0,
      )
      this.root.add(sidewalk)

      const curbMesh = new Mesh(
        new BoxGeometry(0.22, 0.14, roadLen + 20),
        curb,
      )
      curbMesh.position.set(side * STREET_HALF, 0.07, 0)
      this.root.add(curbMesh)
    }

    // Equal-length hollow houses — open doors, hideable interiors
    const roofGeo = new BoxGeometry(HOUSE_DEPTH + 0.6, 0.45, HOUSE_LENGTH + 0.5)
    const windowGeo = new BoxGeometry(0.08, 1.1, 1.0)
    const floorMat = new MeshStandardMaterial({
      color: '#8a7a68',
      roughness: 0.95,
    })
    const innerMat = new MeshStandardMaterial({
      color: '#d8cfc4',
      roughness: 0.9,
    })

    for (const side of [-1, 1] as const) {
      for (let i = 0; i < BLOCKS; i += 1) {
        const z =
          -halfLen +
          HOUSE_GAP +
          HOUSE_LENGTH * 0.5 +
          i * (HOUSE_LENGTH + HOUSE_GAP)
        const x =
          side * (STREET_HALF + SIDEWALK + HOUSE_DEPTH * 0.5 + 0.3)
        const facade = facadeMats[i % facadeMats.length]
        const halfD = HOUSE_DEPTH * 0.5
        const halfL = HOUSE_LENGTH * 0.5
        const doorHalf = DOOR_WIDTH * 0.5

        // floor
        const floor = new Mesh(
          new PlaneGeometry(HOUSE_DEPTH - WALL * 2, HOUSE_LENGTH - WALL * 2),
          floorMat,
        )
        floor.rotation.x = -Math.PI / 2
        floor.position.set(x, 0.04, z)
        this.root.add(floor)

        // roof
        const roof = new Mesh(roofGeo, roofMat)
        roof.position.set(x, HOUSE_HEIGHT + 0.2, z)
        this.root.add(roof)

        // back wall (away from street)
        const backX = x + side * halfD
        this.addWall(
          HOUSE_DEPTH * 0.02 + WALL,
          HOUSE_HEIGHT,
          HOUSE_LENGTH,
          backX - side * WALL * 0.5,
          HOUSE_HEIGHT * 0.5,
          z,
          facade,
        )

        // side walls (along street direction)
        this.addWall(
          HOUSE_DEPTH,
          HOUSE_HEIGHT,
          WALL,
          x,
          HOUSE_HEIGHT * 0.5,
          z - halfL + WALL * 0.5,
          facade,
        )
        this.addWall(
          HOUSE_DEPTH,
          HOUSE_HEIGHT,
          WALL,
          x,
          HOUSE_HEIGHT * 0.5,
          z + halfL - WALL * 0.5,
          facade,
        )

        // front wall with door gap (street-facing)
        const frontX = x - side * halfD
        const flank = (HOUSE_LENGTH - DOOR_WIDTH) * 0.5
        this.addWall(
          WALL,
          HOUSE_HEIGHT,
          flank,
          frontX + side * WALL * 0.5,
          HOUSE_HEIGHT * 0.5,
          z - doorHalf - flank * 0.5,
          facade,
        )
        this.addWall(
          WALL,
          HOUSE_HEIGHT,
          flank,
          frontX + side * WALL * 0.5,
          HOUSE_HEIGHT * 0.5,
          z + doorHalf + flank * 0.5,
          facade,
        )
        // lintel above door (visual only — must not block doorway)
        const lintel = new Mesh(
          new BoxGeometry(WALL, HOUSE_HEIGHT - 2.3, DOOR_WIDTH),
          facade,
        )
        lintel.position.set(
          frontX + side * WALL * 0.5,
          2.3 + (HOUSE_HEIGHT - 2.3) * 0.5,
          z,
        )
        this.root.add(lintel)

        // ajar door panel (visual only, not solid)
        const ajar = new Mesh(
          new BoxGeometry(0.08, 2.1, 0.85),
          doorMat,
        )
        ajar.position.set(
          frontX + side * 0.15,
          1.05,
          z - doorHalf + 0.2,
        )
        ajar.rotation.y = side * 0.85
        this.root.add(ajar)

        // windows on front flanks
        const faceX = frontX + side * 0.02
        for (const row of [2.2, 4.6]) {
          for (const offset of [-3.2, 3.2]) {
            const win = new Mesh(windowGeo, windowMat)
            win.position.set(faceX, row, z + offset)
            this.root.add(win)
          }
        }

        // soft daylight leaking indoors
        const glow = new PointLight(0xfff5e8, 0.7, 8, 2)
        glow.position.set(x, 2.4, z)
        this.root.add(glow)

        // inner filler so walls aren't paper-thin looking from inside
        const ceiling = new Mesh(
          new PlaneGeometry(HOUSE_DEPTH - 0.5, HOUSE_LENGTH - 0.5),
          innerMat,
        )
        ceiling.rotation.x = Math.PI / 2
        ceiling.position.set(x, HOUSE_HEIGHT - 0.05, z)
        this.root.add(ceiling)

        // hide zone = walkable interior
        this.hideZones.push({
          minX: Math.min(x - halfD, x + halfD) + INTERIOR_PAD,
          maxX: Math.max(x - halfD, x + halfD) - INTERIOR_PAD,
          minZ: z - halfL + INTERIOR_PAD,
          maxZ: z + halfL - INTERIOR_PAD,
        })
      }
    }

    // End walls so you can't walk forever into the void
    const endDepth = STREET_WIDTH + SIDEWALK * 2 + HOUSE_DEPTH * 2 + 4
    for (const endZ of [-halfLen - 2, halfLen + 2]) {
      this.solids.push({
        minX: -endDepth * 0.5,
        maxX: endDepth * 0.5,
        minZ: endZ - 1,
        maxZ: endZ + 1,
      })
      const wall = new Mesh(
        new BoxGeometry(endDepth, HOUSE_HEIGHT, 2),
        facadeMats[0],
      )
      wall.position.set(0, HOUSE_HEIGHT * 0.5, endZ)
      this.root.add(wall)
    }

    // Street lamps (off — daytime)
    const poleMat = new MeshStandardMaterial({ color: '#4a4e56', roughness: 0.6 })
    const lampGeo = new BoxGeometry(0.18, 4.2, 0.18)
    const headGeo = new BoxGeometry(0.55, 0.18, 0.55)
    const headMat = new MeshStandardMaterial({
      color: '#c8c4b8',
      roughness: 0.45,
    })

    for (let i = 0; i < BLOCKS; i += 1) {
      const z =
        -halfLen +
        HOUSE_GAP +
        HOUSE_LENGTH * 0.5 +
        i * (HOUSE_LENGTH + HOUSE_GAP)
      for (const side of [-1, 1] as const) {
        const lx = side * (STREET_HALF - 0.55)
        const pole = new Mesh(lampGeo, poleMat)
        pole.position.set(lx, 2.1, z)
        this.root.add(pole)
        const head = new Mesh(headGeo, headMat)
        head.position.set(lx, 4.25, z)
        this.root.add(head)
      }
    }

    this.addApocalypse(roadLen, halfLen)

    this.spawn.x = 0
    this.spawn.z = halfLen - 16
    this.spawn.yaw = Math.PI

    // 15 zombies spread along the whole street (not too close to player start)
    const streetMinZ = -halfLen + 8
    const streetMaxZ = halfLen - 6
    for (let i = 0; i < 15; i += 1) {
      const t = (i + 0.5) / 15
      let z = streetMinZ + t * (streetMaxZ - streetMinZ)
      z += (Math.random() - 0.5) * 3.5
      // keep a clear gap around the player spawn for the head start
      if (Math.abs(z - this.spawn.z) < 8) {
        z = this.spawn.z < 0 ? z - 10 : z + 10
      }
      z = Math.min(streetMaxZ, Math.max(streetMinZ, z))
      const x = ((i % 5) - 2) * 2.4 + (Math.random() - 0.5) * 1.4
      this.zombieSpawns.push({
        x: Math.max(-5.8, Math.min(5.8, x)),
        z,
      })
    }
  }

  private addWall(
    sx: number,
    sy: number,
    sz: number,
    x: number,
    y: number,
    z: number,
    mat: MeshStandardMaterial,
  ) {
    const mesh = new Mesh(new BoxGeometry(sx, sy, sz), mat)
    mesh.position.set(x, y, z)
    this.root.add(mesh)
    this.solids.push({
      minX: x - sx * 0.5,
      maxX: x + sx * 0.5,
      minZ: z - sz * 0.5,
      maxZ: z + sz * 0.5,
    })
  }

  private addApocalypse(roadLen: number, halfLen: number) {
    const blood = new MeshStandardMaterial({
      color: '#4a0a0a',
      roughness: 0.55,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    })
    const rust = new MeshStandardMaterial({
      color: '#3a2a22',
      roughness: 0.9,
      metalness: 0.35,
    })
    const glass = new MeshStandardMaterial({
      color: '#1a2030',
      roughness: 0.3,
      metalness: 0.2,
      transparent: true,
      opacity: 0.5,
    })

    for (let i = 0; i < 14; i += 1) {
      const puddle = new Mesh(new PlaneGeometry(1, 1), blood)
      puddle.rotation.x = -Math.PI / 2
      puddle.rotation.z = Math.random() * Math.PI
      const size = 1.2 + Math.random() * 2.2
      puddle.scale.set(size, size * (0.5 + Math.random() * 0.5), 1)
      puddle.position.set(
        (Math.random() - 0.5) * (STREET_WIDTH - 1),
        0.025,
        -halfLen + 6 + Math.random() * (roadLen - 12),
      )
      this.root.add(puddle)
    }

    // wrecked cars blocking parts of the road
    for (let i = 0; i < 4; i += 1) {
      const z = -halfLen + 14 + i * ((roadLen - 24) / 3)
      const x = (i % 2 === 0 ? -1 : 1) * (1.6 + Math.random() * 1.2)
      const body = new Mesh(new BoxGeometry(2.1, 1.1, 4.4), rust)
      body.position.set(x, 0.55, z)
      body.rotation.y = (Math.random() - 0.5) * 0.5 + (i % 2) * 0.2
      this.root.add(body)
      const cabin = new Mesh(new BoxGeometry(1.9, 0.85, 2.0), glass)
      cabin.position.set(x, 1.25, z - 0.3)
      cabin.rotation.y = body.rotation.y
      this.root.add(cabin)

      const halfW = 1.05
      const halfL = 2.2
      const cos = Math.cos(body.rotation.y)
      const sin = Math.sin(body.rotation.y)
      // axis-aligned approx for collision
      this.solids.push({
        minX: x - halfW - 0.3,
        maxX: x + halfW + 0.3,
        minZ: z - halfL - 0.2,
        maxZ: z + halfL + 0.2,
      })
      void cos
      void sin
    }
  }
}

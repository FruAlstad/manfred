import {
  FogExp2,
  PerspectiveCamera,
  WebGLRenderer,
} from 'three'
import { Axe } from './axe'
import { GameAudio } from './audio'
import { Entity } from './entity'
import { Maze } from './maze'
import { Player } from './player'
import { World } from './world'

type Mode = 'title' | 'playing' | 'jumpscare' | 'dead' | 'escaped'

const MONSTER_COUNT = 4

export class Game {
  private renderer: WebGLRenderer
  private camera: PerspectiveCamera
  private maze: Maze
  private world: World
  private player: Player
  private entities: Entity[] = []
  private axes: Axe[] = []
  private heldAxe: Axe | null = null
  private attackT = 0
  private attackCooldown = 0
  private mouseClicked = false
  private audio = new GameAudio()
  private keys = new Set<string>()
  private justPressed = new Set<string>()
  private mode: Mode = 'title'
  private last = performance.now()
  private overlay: HTMLElement
  private jumpscare: HTMLElement
  private staminaBar: HTMLElement
  private hint: HTMLElement
  private pickupPrompt: HTMLElement
  private itemLabel: HTMLElement
  private crosshair: HTMLElement

  constructor(canvas: HTMLCanvasElement) {
    this.overlay = document.querySelector('#overlay') as HTMLElement
    this.jumpscare = document.querySelector('#jumpscare') as HTMLElement
    this.staminaBar = document.querySelector('#stamina i') as HTMLElement
    this.hint = document.querySelector('#hint') as HTMLElement
    this.pickupPrompt = document.querySelector('#pickup') as HTMLElement
    this.itemLabel = document.querySelector('#item') as HTMLElement
    this.crosshair = document.querySelector('#crosshair') as HTMLElement

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25))
    this.renderer.setSize(innerWidth, innerHeight)
    this.renderer.toneMappingExposure = 1.15

    this.camera = new PerspectiveCamera(72, innerWidth / innerHeight, 0.08, 36)
    this.maze = new Maze(21, 21)
    this.world = new World(this.maze)
    this.world.scene.fog = new FogExp2(0xd4c46a, 0.045)
    this.player = new Player(this.maze)

    const spawns = this.maze.spawnCells(MONSTER_COUNT, 7)
    for (const spawn of spawns) {
      const entity = new Entity(this.maze, spawn)
      this.entities.push(entity)
      this.world.scene.add(entity.group)
    }

    const axeCells = this.maze.spawnCells(3, 4)
    while (axeCells.length < 3) {
      axeCells.push(this.maze.entityStart)
    }
    for (const cell of axeCells.slice(0, 3)) {
      const axe = new Axe(this.maze, cell)
      this.axes.push(axe)
      this.world.scene.add(axe.group)
    }
    this.world.scene.add(this.camera)

    this.bind()
    this.loop = this.loop.bind(this)
    requestAnimationFrame(this.loop)
  }

  private bind() {
    document.querySelector('#start-btn')?.addEventListener('click', () => this.start())
    addEventListener('resize', () => this.resize())
    addEventListener('keydown', (event) => {
      if (!this.keys.has(event.code)) this.justPressed.add(event.code)
      this.keys.add(event.code)
      if (event.code === 'Escape') document.exitPointerLock()
    })
    addEventListener('keyup', (event) => this.keys.delete(event.code))
    addEventListener('mousemove', (event) => {
      if (document.pointerLockElement && this.mode === 'playing') {
        this.player.look(event.movementX, event.movementY)
      }
    })
    this.renderer.domElement.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return
      if (this.mode !== 'playing') return
      if (!document.pointerLockElement) {
        this.renderer.domElement.requestPointerLock()
        return
      }
      this.mouseClicked = true
    })
    this.renderer.domElement.addEventListener('click', () => {
      if (this.mode === 'playing' && !document.pointerLockElement) {
        this.renderer.domElement.requestPointerLock()
      }
    })
  }

  private start() {
    this.audio.start()
    this.mode = 'playing'
    this.overlay.hidden = true
    this.hint.hidden = false
    this.crosshair.hidden = false
    document.querySelector('#stamina')?.removeAttribute('hidden')
    this.renderer.domElement.requestPointerLock()
    setTimeout(() => {
      this.hint.hidden = true
    }, 5000)
  }

  private resize() {
    this.camera.aspect = innerWidth / innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(innerWidth, innerHeight)
  }

  private input() {
    let x = 0
    let z = 0
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z += 1
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z -= 1
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1
    return {
      x,
      z,
      sprint:
        this.keys.has('KeyF') ||
        this.keys.has('ShiftLeft') ||
        this.keys.has('ShiftRight'),
    }
  }

  private tryPickup() {
    if (!this.justPressed.has('KeyE')) return
    const px = this.player.position.x
    const pz = this.player.position.z
    const near = this.axes.find((axe) => axe.canPickup(px, pz))
    if (!near || !near.pickup()) return

    if (!this.heldAxe) {
      this.heldAxe = near
      this.camera.add(near.held)
      near.held.visible = true
    } else {
      // already holding one — just collect this axe from the floor
      near.held.visible = false
    }

    this.pickupPrompt.hidden = true
    this.itemLabel.hidden = false
    const count = this.axes.filter((a) => a.pickedUp).length
    this.itemLabel.textContent = count > 1 ? `AXES ×${count}` : 'AXE'
    this.hint.textContent =
      count > 1
        ? `axe acquired. (${count}/3) click to attack.`
        : 'axe acquired. click to attack.'
    this.hint.hidden = false
    setTimeout(() => {
      this.hint.hidden = true
    }, 2500)
  }

  private updatePickupPrompt() {
    const near = this.axes.some((axe) =>
      axe.canPickup(this.player.position.x, this.player.position.z),
    )
    this.pickupPrompt.hidden = !near
  }

  private tryAttack(dt: number) {
    this.attackCooldown = Math.max(0, this.attackCooldown - dt)
    if (this.attackT > 0) {
      this.attackT = Math.max(0, this.attackT - dt)
      const t = 1 - this.attackT / 0.22
      const swing = t < 0.45 ? t / 0.45 : 1 - (t - 0.45) / 0.55
      this.heldAxe?.swing(swing)
      if (this.attackT === 0) this.heldAxe?.resetPose()
    }

    if (!this.mouseClicked) return
    this.mouseClicked = false
    if (!this.heldAxe || this.attackCooldown > 0) return

    this.attackCooldown = 0.28
    this.attackT = 0.22
    this.audio.swing()

    const yaw = this.player.yaw
    const forwardX = -Math.sin(yaw)
    const forwardZ = -Math.cos(yaw)
    const reach = 4.5
    let hit = false

    for (const entity of this.entities) {
      if (entity.dead) continue
      const dx = entity.position.x - this.player.position.x
      const dz = entity.position.z - this.player.position.z
      const dist = Math.hypot(dx, dz)
      if (dist > reach || dist < 0.01) continue
      // easy hits: anything nearby, or roughly in front at longer range
      const dot = (dx / dist) * forwardX + (dz / dist) * forwardZ
      if (dist > 2.2 && dot < 0.05) continue
      entity.kill()
      hit = true
    }

    if (hit) {
      this.audio.hit()
      this.hint.textContent = 'monster slain.'
      this.hint.hidden = false
      setTimeout(() => {
        this.hint.hidden = true
      }, 1800)
    }
  }

  private triggerJumpscare() {
    this.mode = 'jumpscare'
    document.exitPointerLock()
    this.crosshair.hidden = true
    this.pickupPrompt.hidden = true
    this.audio.start()
    this.audio.jumpscare()
    void this.audio.ensureRunning().then(() => this.audio.jumpscare())
    this.jumpscare.hidden = false
    this.jumpscare.classList.remove('hit')
    void this.jumpscare.offsetWidth
    this.jumpscare.classList.add('hit')

    setTimeout(() => {
      this.jumpscare.hidden = true
      this.jumpscare.classList.remove('hit')
      this.end('dead')
    }, 2100)
  }

  private end(kind: 'dead' | 'escaped') {
    this.mode = kind
    document.exitPointerLock()
    this.overlay.hidden = false
    this.overlay.classList.add('end')
    this.crosshair.hidden = true
    this.pickupPrompt.hidden = true
    if (kind === 'dead') {
      void this.audio.ensureRunning().then(() => this.audio.deathCry())
      this.overlay.innerHTML = `
        <h1>NOCLIP FAILED</h1>
        <p class="sub">they found manfred in the wallpaper</p>
        <button type="button" id="again">TRY AGAIN</button>
      `
    } else {
      this.audio.exit()
      this.overlay.innerHTML = `
        <h1>AN EXIT</h1>
        <p class="sub">it led somewhere worse. manfred kept walking.</p>
        <button type="button" id="again">NO-CLIP AGAIN</button>
      `
    }
    document.querySelector('#again')?.addEventListener('click', () => location.reload())
  }

  private loop(now: number) {
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now

    if (this.mode === 'playing') {
      this.player.update(dt, this.input(), this.maze)
      this.tryPickup()
      this.updatePickupPrompt()
      this.tryAttack(dt)
      let anyHunting = false
      let caught = false
      for (const entity of this.entities) {
        if (entity.dead) continue
        if (entity.update(dt, this.player)) caught = true
        if (entity.hunting) anyHunting = true
      }
      this.world.update(now / 1000)
      this.audio.setHunting(anyHunting)
      this.audio.footstep(this.player.speed())
      this.staminaBar.style.transform = `scaleX(${this.player.stamina})`

      const exit = this.maze.cellCenter(this.maze.exit)
      const toExit = Math.hypot(
        this.player.position.x - exit.x,
        this.player.position.z - exit.z,
      )
      if (toExit < 1.1) this.end('escaped')
      else if (caught) this.triggerJumpscare()
    } else if (this.mode === 'jumpscare') {
      this.camera.position.copy(this.player.position)
      this.camera.position.y += Math.sin(now * 0.08) * 0.08
    }

    this.justPressed.clear()

    if (this.mode !== 'jumpscare') {
      this.camera.position.copy(this.player.position)
      this.camera.quaternion.setFromEuler(this.player.euler())
    }
    this.renderer.render(this.world.scene, this.camera)
    requestAnimationFrame(this.loop)
  }
}

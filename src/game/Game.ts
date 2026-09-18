import {
  FogExp2,
  PerspectiveCamera,
  Vector2,
  WebGLRenderer,
} from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { GameAudio } from './audio'
import { Entity } from './entity'
import { Maze } from './maze'
import { Player } from './player'
import { World } from './world'

type Mode = 'title' | 'playing' | 'dead' | 'escaped'

export class Game {
  private renderer: WebGLRenderer
  private camera: PerspectiveCamera
  private composer: EffectComposer
  private maze: Maze
  private world: World
  private player: Player
  private entity: Entity
  private audio = new GameAudio()
  private keys = new Set<string>()
  private mode: Mode = 'title'
  private last = performance.now()
  private overlay: HTMLElement
  private staminaBar: HTMLElement
  private hint: HTMLElement
  private crosshair: HTMLElement

  constructor(canvas: HTMLCanvasElement) {
    this.overlay = document.querySelector('#overlay') as HTMLElement
    this.staminaBar = document.querySelector('#stamina i') as HTMLElement
    this.hint = document.querySelector('#hint') as HTMLElement
    this.crosshair = document.querySelector('#crosshair') as HTMLElement

    this.renderer = new WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75))
    this.renderer.setSize(innerWidth, innerHeight)
    this.renderer.toneMappingExposure = 1.15

    this.camera = new PerspectiveCamera(72, innerWidth / innerHeight, 0.06, 42)
    this.maze = new Maze(21, 21)
    this.world = new World(this.maze)
    this.world.scene.fog = new FogExp2(0xd4c46a, 0.038)
    this.player = new Player(this.maze)
    this.entity = new Entity(this.maze)
    this.world.scene.add(this.entity.group)

    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.world.scene, this.camera))
    this.composer.addPass(
      new UnrealBloomPass(new Vector2(innerWidth, innerHeight), 0.12, 0.4, 0.85),
    )

    this.bind()
    this.loop = this.loop.bind(this)
    requestAnimationFrame(this.loop)
  }

  private bind() {
    document.querySelector('#start-btn')?.addEventListener('click', () => this.start())
    addEventListener('resize', () => this.resize())
    addEventListener('keydown', (event) => {
      this.keys.add(event.code)
      if (event.code === 'Escape') document.exitPointerLock()
    })
    addEventListener('keyup', (event) => this.keys.delete(event.code))
    addEventListener('mousemove', (event) => {
      if (document.pointerLockElement && this.mode === 'playing') {
        this.player.look(event.movementX, event.movementY)
      }
    })
    this.renderer.domElement.addEventListener('click', () => {
      if (this.mode === 'playing') this.renderer.domElement.requestPointerLock()
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
    this.composer.setSize(innerWidth, innerHeight)
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
      sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
    }
  }

  private end(kind: 'dead' | 'escaped') {
    this.mode = kind
    document.exitPointerLock()
    this.overlay.hidden = false
    this.overlay.classList.add('end')
    this.crosshair.hidden = true
    if (kind === 'dead') {
      this.audio.sting()
      this.overlay.innerHTML = `
        <h1>NOCLIP FAILED</h1>
        <p class="sub">manfred is part of the wallpaper now</p>
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
      const caught = this.entity.update(dt, this.player)
      this.world.update(now / 1000)
      this.audio.setHunting(this.entity.hunting)
      this.audio.footstep(this.player.speed())
      this.staminaBar.style.transform = `scaleX(${this.player.stamina})`

      const exit = this.maze.cellCenter(this.maze.exit)
      const toExit = Math.hypot(this.player.position.x - exit.x, this.player.position.z - exit.z)
      if (toExit < 1.1) this.end('escaped')
      if (caught) this.end('dead')
    }

    this.camera.position.copy(this.player.position)
    this.camera.quaternion.setFromEuler(this.player.euler())
    this.composer.render()
    requestAnimationFrame(this.loop)
  }
}

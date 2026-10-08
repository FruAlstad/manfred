import {
  FogExp2,
  PerspectiveCamera,
  Vector3,
  WebGLRenderer,
} from 'three'
import { Arena } from './arena'
import { Axe } from './axe'
import { GameAudio } from './audio'
import { Boss, BOSS_MAX_HP } from './boss'
import { Arrow, Bow, BOW_DAMAGE } from './bow'
import { Entity } from './entity'
import { Maze } from './maze'
import { Player } from './player'
import { Street } from './street'
import { Trap } from './trap'
import { World } from './world'
import { Zombie } from './zombie'

type Mode =
  | 'title'
  | 'playing'
  | 'street'
  | 'boss'
  | 'jumpscare'
  | 'dead'
  | 'escaped'

const MONSTER_COUNT = 10
const ZOMBIE_COUNT = 15
const TRAP_COUNT = 5

export class Game {
  private renderer: WebGLRenderer
  private camera: PerspectiveCamera
  private maze: Maze
  private world: World
  private street: Street | null = null
  private arena: Arena | null = null
  private player: Player
  private entities: Entity[] = []
  private zombies: Zombie[] = []
  private traps: Trap[] = []
  private axes: Axe[] = []
  private heldAxe: Axe | null = null
  private bow: Bow | null = null
  private arrows: Arrow[] = []
  private boss: Boss | null = null
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
  private bossHpWrap: HTMLElement
  private bossHpBar: HTMLElement
  private portalUnlocked = false
  private streetCleared = false
  private streetGrace = 0
  private bossCleared = false
  private readonly _aim = new Vector3()
  private readonly _arrowOrigin = new Vector3()
  private activeScene: World['scene'] | Street['scene'] | Arena['scene']

  constructor(canvas: HTMLCanvasElement) {
    this.overlay = document.querySelector('#overlay') as HTMLElement
    this.jumpscare = document.querySelector('#jumpscare') as HTMLElement
    this.staminaBar = document.querySelector('#stamina i') as HTMLElement
    this.hint = document.querySelector('#hint') as HTMLElement
    this.pickupPrompt = document.querySelector('#pickup') as HTMLElement
    this.itemLabel = document.querySelector('#item') as HTMLElement
    this.crosshair = document.querySelector('#crosshair') as HTMLElement
    this.bossHpWrap = document.querySelector('#boss-hp') as HTMLElement
    this.bossHpBar = document.querySelector('#boss-hp .bar i') as HTMLElement

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
    this.activeScene = this.world.scene
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

    const trapCells = this.maze.spawnCells(TRAP_COUNT, 6)
    for (const cell of trapCells.slice(0, TRAP_COUNT)) {
      const trap = new Trap(this.maze, cell)
      this.traps.push(trap)
      this.world.scene.add(trap.group)
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
      if (
        document.pointerLockElement &&
        (this.mode === 'playing' ||
          this.mode === 'street' ||
          this.mode === 'boss')
      ) {
        this.player.look(event.movementX, event.movementY)
      }
    })
    this.renderer.domElement.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return
      if (
        this.mode !== 'playing' &&
        this.mode !== 'street' &&
        this.mode !== 'boss'
      ) {
        return
      }
      if (!document.pointerLockElement) {
        this.renderer.domElement.requestPointerLock()
        return
      }
      this.mouseClicked = true
    })
    this.renderer.domElement.addEventListener('click', () => {
      if (
        (this.mode === 'playing' ||
          this.mode === 'street' ||
          this.mode === 'boss') &&
        !document.pointerLockElement
      ) {
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
      if (this.mode === 'boss' && this.bow) {
        const t = 1 - this.attackT / 0.28
        this.bow.setDraw(t < 0.35 ? t / 0.35 : 1 - (t - 0.35) / 0.65)
        if (this.attackT === 0) this.bow.resetPose()
      } else {
        const t = 1 - this.attackT / 0.22
        const swing = t < 0.45 ? t / 0.45 : 1 - (t - 0.45) / 0.55
        this.heldAxe?.swing(swing)
        if (this.attackT === 0) this.heldAxe?.resetPose()
      }
    }

    if (!this.mouseClicked) return
    this.mouseClicked = false
    if (this.attackCooldown > 0) return

    if (this.mode === 'boss' && this.bow) {
      this.shootBow()
      return
    }

    if (!this.heldAxe) return

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
      const dot = (dx / dist) * forwardX + (dz / dist) * forwardZ
      if (dist > 2.2 && dot < 0.05) continue
      entity.kill()
      hit = true
    }

    for (const zombie of this.zombies) {
      if (zombie.dead) continue
      const dx = zombie.position.x - this.player.position.x
      const dz = zombie.position.z - this.player.position.z
      const dist = Math.hypot(dx, dz)
      if (dist > reach || dist < 0.01) continue
      const dot = (dx / dist) * forwardX + (dz / dist) * forwardZ
      if (dist > 2.2 && dot < 0.05) continue
      zombie.kill()
      hit = true
    }

    if (hit) {
      this.audio.hit()
      const left = this.zombies.filter((z) => !z.dead).length
      this.hint.textContent =
        this.mode === 'street'
          ? left === 0
            ? 'street cleared. the boss awaits.'
            : `zombie down. ${left} left.`
          : 'monster slain.'
      this.hint.hidden = false
      setTimeout(() => {
        this.hint.hidden = true
      }, 1800)
    }
  }

  private shootBow() {
    this.attackCooldown = 0.35
    this.attackT = 0.28
    this.audio.swing()

    const yaw = this.player.yaw
    const pitch = this.player.pitch
    const cp = Math.cos(pitch)
    this._aim.set(-Math.sin(yaw) * cp, -Math.sin(pitch), -Math.cos(yaw) * cp)
    this._arrowOrigin.copy(this.player.position).addScaledVector(this._aim, 0.6)
    this._arrowOrigin.y = this.player.position.y - 0.05

    const arrow = new Arrow(this._arrowOrigin, this._aim)
    this.arrows.push(arrow)
    this.arena?.scene.add(arrow.group)
  }

  private updateArrows(dt: number) {
    if (!this.boss || !this.arena) return
    for (const arrow of this.arrows) {
      if (!arrow.alive) continue
      arrow.update(dt)
      const dx = arrow.group.position.x - this.boss.position.x
      const dy = arrow.group.position.y - 2.2
      const dz = arrow.group.position.z - this.boss.position.z
      if (Math.hypot(dx, dz) < 1.6 && Math.abs(dy) < 2.4) {
        arrow.alive = false
        this.arena.scene.remove(arrow.group)
        const killed = this.boss.hurt(BOW_DAMAGE)
        this.audio.hit()
        this.bossHpBar.style.transform = `scaleX(${this.boss.hpRatio})`
        this.hint.textContent = killed
          ? 'boss slain.'
          : `hit! ${this.boss.hp}/${BOSS_MAX_HP}`
        this.hint.hidden = false
        setTimeout(() => {
          if (this.mode === 'boss') this.hint.hidden = true
        }, 900)
      } else if (!arrow.alive) {
        this.arena.scene.remove(arrow.group)
      }
    }
    this.arrows = this.arrows.filter((a) => a.alive)
  }

  private allMonstersDead() {
    return this.entities.every((entity) => entity.dead)
  }

  private updatePortalHint(toPortal: number) {
    const allDead = this.allMonstersDead()
    if (allDead && !this.portalUnlocked) {
      this.portalUnlocked = true
      this.world.setPortalOpen(true)
      this.hint.textContent = 'all dead. find the portal.'
      this.hint.hidden = false
      return
    }
    if (toPortal > 3) return
    if (!allDead) {
      this.hint.textContent = 'the portal is sealed. kill all 10 monsters.'
      this.hint.hidden = false
      return
    }
    this.hint.textContent = 'step through the portal.'
    this.hint.hidden = false
  }

  private enterStreet() {
    this.audio.exit()
    this.mode = 'street'
    this.portalUnlocked = false
    this.streetCleared = false
    this.streetGrace = 5
    this.pickupPrompt.hidden = true

    for (const entity of this.entities) {
      this.world.scene.remove(entity.group)
    }
    for (const axe of this.axes) {
      this.world.scene.remove(axe.group)
    }
    this.entities = []
    this.axes = []

    // keep axe for the apocalypse, or give one if empty-handed
    if (!this.heldAxe) {
      const spare = new Axe(this.maze, this.maze.start)
      spare.pickup()
      this.heldAxe = spare
      this.camera.add(spare.held)
      spare.held.visible = true
    }
    this.itemLabel.hidden = false
    this.itemLabel.textContent = 'AXE'

    this.street = new Street()
    this.activeScene = this.street.scene
    this.street.scene.add(this.camera)
    this.camera.far = 160
    this.camera.updateProjectionMatrix()
    this.renderer.toneMappingExposure = 1.35
    this.player.place(this.street.spawn.x, this.street.spawn.z, this.street.spawn.yaw)

    this.zombies = []
    for (const spawn of this.street.zombieSpawns.slice(0, ZOMBIE_COUNT)) {
      const zombie = new Zombie(spawn.x, spawn.z, Math.PI)
      this.zombies.push(zombie)
      this.street.scene.add(zombie.group)
    }

    this.hint.textContent = '5 seconds. run. hide in the houses.'
    this.hint.hidden = false
    setTimeout(() => {
      if (this.mode === 'street' && this.streetGrace <= 0) this.hint.hidden = true
    }, 5500)

    if (!document.pointerLockElement) {
      this.renderer.domElement.requestPointerLock()
    }
  }

  private enterBoss() {
    this.mode = 'boss'
    this.streetCleared = true
    this.bossCleared = false
    this.pickupPrompt.hidden = true
    this.bossHpWrap.hidden = false
    this.bossHpBar.style.transform = 'scaleX(1)'

    // clear street leftovers
    for (const zombie of this.zombies) {
      this.street?.scene.remove(zombie.group)
    }
    this.zombies = []
    for (const arrow of this.arrows) {
      this.arena?.scene.remove(arrow.group)
    }
    this.arrows = []

    if (this.heldAxe) {
      this.heldAxe.held.visible = false
      this.camera.remove(this.heldAxe.held)
      this.heldAxe = null
    }

    this.bow = new Bow()
    this.camera.add(this.bow.held)
    this.itemLabel.hidden = false
    this.itemLabel.textContent = 'BOW · 100 DMG'

    this.arena = new Arena()
    this.activeScene = this.arena.scene
    this.arena.scene.add(this.camera)
    this.camera.far = 120
    this.camera.updateProjectionMatrix()
    this.renderer.toneMappingExposure = 1.45
    this.player.place(this.arena.spawn.x, this.arena.spawn.z, this.arena.spawn.yaw)

    this.boss = new Boss(this.arena.bossSpawn.x, this.arena.bossSpawn.z)
    this.arena.scene.add(this.boss.group)

    this.hint.textContent = 'boss fight. bow deals 100. boss has 2000 hp.'
    this.hint.hidden = false
    setTimeout(() => {
      if (this.mode === 'boss') this.hint.hidden = true
    }, 4500)

    if (!document.pointerLockElement) {
      this.renderer.domElement.requestPointerLock()
    }
  }

  private triggerJumpscare() {
    this.mode = 'jumpscare'
    document.exitPointerLock()
    this.crosshair.hidden = true
    this.pickupPrompt.hidden = true
    this.bossHpWrap.hidden = true
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
    this.bossHpWrap.hidden = true
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
        <h1>BOSS FALLEN</h1>
        <p class="sub">2000 hp gone. the bow went quiet. manfred kept walking.</p>
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
        if (entity.update(dt, this.player, this.traps)) caught = true
        if (entity.hunting) anyHunting = true
      }

      let trapped = false
      let monsterTrapped = false
      for (const trap of this.traps) {
        trap.update(dt)
        if (trap.check(this.player.position.x, this.player.position.z)) {
          trapped = true
          continue
        }
        for (const entity of this.entities) {
          if (entity.dead) continue
          if (trap.check(entity.position.x, entity.position.z)) {
            entity.kill()
            monsterTrapped = true
            break
          }
        }
      }
      if (monsterTrapped) {
        this.hint.textContent = 'a monster hit a trap.'
        this.hint.hidden = false
        setTimeout(() => {
          if (this.mode === 'playing') this.hint.hidden = true
        }, 1800)
      }

      this.world.update(now / 1000)
      this.audio.setHunting(anyHunting)
      this.audio.footstep(this.player.speed())
      this.staminaBar.style.transform = `scaleX(${this.player.stamina})`

      const portal = this.maze.cellCenter(this.maze.exit)
      const toPortal = Math.hypot(
        this.player.position.x - portal.x,
        this.player.position.z - portal.z,
      )
      this.updatePortalHint(toPortal)
      if (toPortal < 1.35 && this.allMonstersDead()) this.enterStreet()
      else if (caught || trapped) this.triggerJumpscare()
    } else if (this.mode === 'street' && this.street) {
      this.player.update(dt, this.input(), null, this.street.solids)
      this.tryAttack(dt)

      const wasGrace = this.streetGrace > 0
      this.streetGrace = Math.max(0, this.streetGrace - dt)
      if (wasGrace && this.streetGrace === 0) {
        this.hint.textContent = 'they are coming.'
        this.hint.hidden = false
        setTimeout(() => {
          if (this.mode === 'street') this.hint.hidden = true
        }, 2000)
      }

      let anyHunting = false
      let caught = false
      if (this.streetGrace <= 0) {
        const hidden = this.street.isHiding(
          this.player.position.x,
          this.player.position.z,
        )
        const zombieSolids = this.street.solids.concat(this.street.hideZones)
        for (const zombie of this.zombies) {
          if (zombie.dead) continue
          if (zombie.update(dt, this.player, zombieSolids, hidden)) {
            caught = true
          }
          if (zombie.hunting) anyHunting = true
        }
      }

      this.street.update(now / 1000)
      this.audio.setHunting(anyHunting)
      this.audio.footstep(this.player.speed())
      this.staminaBar.style.transform = `scaleX(${this.player.stamina})`

      if (caught) this.triggerJumpscare()
      else if (!this.streetCleared && this.zombies.every((z) => z.dead)) {
        this.streetCleared = true
        this.enterBoss()
      }
    } else if (this.mode === 'boss' && this.arena && this.boss) {
      this.player.update(dt, this.input(), null, this.arena.solids)
      this.tryAttack(dt)
      this.updateArrows(dt)
      this.arena.update(now / 1000)
      this.audio.footstep(this.player.speed())
      this.staminaBar.style.transform = `scaleX(${this.player.stamina})`
      this.bossHpBar.style.transform = `scaleX(${this.boss.hpRatio})`

      if (!this.boss.dead) {
        this.audio.setHunting(true)
        if (this.boss.update(dt, this.player, this.arena.solids)) {
          this.triggerJumpscare()
        }
      } else if (!this.bossCleared) {
        this.bossCleared = true
        this.audio.setHunting(false)
        this.end('escaped')
      }
    } else if (this.mode === 'jumpscare') {
      this.camera.position.copy(this.player.position)
      this.camera.position.y += Math.sin(now * 0.08) * 0.08
    }

    this.justPressed.clear()

    if (this.mode !== 'jumpscare') {
      this.camera.position.copy(this.player.position)
      this.camera.quaternion.setFromEuler(this.player.euler())
    }
    this.renderer.render(this.activeScene, this.camera)
    requestAnimationFrame(this.loop)
  }
}

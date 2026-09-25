import {
  CanvasTexture,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three'

function noiseCanvas(
  size: number,
  paint: (ctx: CanvasRenderingContext2D, size: number) => void,
) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create texture canvas')
  paint(ctx, size)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.anisotropy = 8
  return texture
}

function addNoise(
  ctx: CanvasRenderingContext2D,
  size: number,
  amount: number,
) {
  const image = ctx.getImageData(0, 0, size, size)
  const { data } = image
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * amount
    data[i] = Math.max(0, Math.min(255, data[i] + n))
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n * 0.92))
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n * 0.55))
  }
  ctx.putImageData(image, 0, 0)
}

export function makeWallpaper() {
  const texture = noiseCanvas(512, (ctx, size) => {
    ctx.fillStyle = '#d6c46a'
    ctx.fillRect(0, 0, size, size)
    ctx.strokeStyle = 'rgba(150, 132, 48, 0.18)'
    ctx.lineWidth = 1
    for (let y = 8; y < size; y += 18) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(size, y)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(168, 148, 58, 0.12)'
    for (let x = 0; x < size; x += 32) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, size)
      ctx.stroke()
    }
    addNoise(ctx, size, 22)
  })
  texture.repeat.set(2.2, 1.4)
  return texture
}

/** Irregular wet blood puddle for the floor. */
export function makeBloodPuddle() {
  return noiseCanvas(512, (ctx, size) => {
    ctx.clearRect(0, 0, size, size)
    const cx = size * 0.5
    const cy = size * 0.5

    // main irregular puddle body
    drawPuddleBlob(ctx, cx, cy, size * 0.34, 1, 0.78)
    // connected lobes
    drawPuddleBlob(ctx, cx + size * 0.16, cy - size * 0.08, size * 0.16, 0.85, 0.55)
    drawPuddleBlob(ctx, cx - size * 0.14, cy + size * 0.1, size * 0.14, 0.8, 0.5)
    drawPuddleBlob(ctx, cx + size * 0.05, cy + size * 0.18, size * 0.12, 0.75, 0.42)

    // satellite droplets
    for (let i = 0; i < 14; i += 1) {
      const angle = Math.random() * Math.PI * 2
      const dist = size * (0.22 + Math.random() * 0.22)
      const dx = cx + Math.cos(angle) * dist
      const dy = cy + Math.sin(angle) * dist
      drawPuddleBlob(ctx, dx, dy, 4 + Math.random() * 14, 0.7, 0.35 + Math.random() * 0.25)
    }

    // thin wet trails between lobes
    for (let i = 0; i < 6; i += 1) {
      const a = Math.random() * Math.PI * 2
      const len = size * (0.12 + Math.random() * 0.18)
      ctx.strokeStyle = `rgba(${70 + Math.random() * 40}, 4, 4, ${0.25 + Math.random() * 0.3})`
      ctx.lineWidth = 1.5 + Math.random() * 3
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * size * 0.08, cy + Math.sin(a) * size * 0.08)
      ctx.quadraticCurveTo(
        cx + Math.cos(a) * len * 0.55 + (Math.random() - 0.5) * 20,
        cy + Math.sin(a) * len * 0.55 + (Math.random() - 0.5) * 20,
        cx + Math.cos(a) * len,
        cy + Math.sin(a) * len,
      )
      ctx.stroke()
    }

    // subtle surface noise for wet look
    const image = ctx.getImageData(0, 0, size, size)
    const { data } = image
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 8) continue
      const n = (Math.random() - 0.5) * 18
      data[i] = Math.max(0, Math.min(255, data[i] + n))
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n * 0.2))
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n * 0.15))
    }
    ctx.putImageData(image, 0, 0)
  })
}

function drawPuddleBlob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  opacity: number,
  stretch: number,
) {
  const lobes = 10 + Math.floor(Math.random() * 6)
  ctx.beginPath()
  for (let i = 0; i <= lobes; i += 1) {
    const t = (i / lobes) * Math.PI * 2
    const wobble = 0.72 + Math.random() * 0.45
    const px = x + Math.cos(t) * radius * wobble
    const py = y + Math.sin(t) * radius * stretch * wobble
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()

  const gradient = ctx.createRadialGradient(x, y, radius * 0.05, x, y, radius * 1.15)
  gradient.addColorStop(0, `rgba(95, 8, 8, ${0.95 * opacity})`)
  gradient.addColorStop(0.35, `rgba(70, 5, 5, ${0.82 * opacity})`)
  gradient.addColorStop(0.7, `rgba(45, 3, 3, ${0.55 * opacity})`)
  gradient.addColorStop(1, 'rgba(25, 0, 0, 0)')
  ctx.fillStyle = gradient
  ctx.fill()

  // darker wet core
  const core = ctx.createRadialGradient(x - radius * 0.1, y - radius * 0.08, 0, x, y, radius * 0.45)
  core.addColorStop(0, `rgba(35, 0, 0, ${0.55 * opacity})`)
  core.addColorStop(1, 'rgba(35, 0, 0, 0)')
  ctx.fillStyle = core
  ctx.beginPath()
  ctx.ellipse(x, y, radius * 0.45, radius * stretch * 0.4, 0, 0, Math.PI * 2)
  ctx.fill()

  // thin glossy rim highlight
  ctx.strokeStyle = `rgba(140, 30, 30, ${0.22 * opacity})`
  ctx.lineWidth = 1.2
  ctx.beginPath()
  for (let i = 0; i <= lobes; i += 1) {
    const t = (i / lobes) * Math.PI * 2
    const wobble = 0.7 + Math.random() * 0.35
    const px = x + Math.cos(t) * radius * wobble * 0.92
    const py = y + Math.sin(t) * radius * stretch * wobble * 0.92
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.stroke()
}

export function makeCarpet() {
  const texture = noiseCanvas(256, (ctx, size) => {
    ctx.fillStyle = '#cbb54b'
    ctx.fillRect(0, 0, size, size)
    addNoise(ctx, size, 36)
    ctx.fillStyle = 'rgba(90, 70, 20, 0.08)'
    for (let i = 0; i < 18; i += 1) {
      ctx.beginPath()
      ctx.ellipse(
        Math.random() * size,
        Math.random() * size,
        8 + Math.random() * 28,
        4 + Math.random() * 14,
        Math.random() * Math.PI,
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }
  })
  texture.repeat.set(4, 4)
  return texture
}

export function makeCeiling() {
  const texture = noiseCanvas(256, (ctx, size) => {
    ctx.fillStyle = '#d8d0b4'
    ctx.fillRect(0, 0, size, size)
    ctx.strokeStyle = 'rgba(120, 110, 80, 0.35)'
    ctx.lineWidth = 2
    const step = size / 2
    for (let i = 0; i <= size; i += step) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, size)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(size, i)
      ctx.stroke()
    }
    addNoise(ctx, size, 16)
  })
  texture.repeat.set(2, 2)
  return texture
}

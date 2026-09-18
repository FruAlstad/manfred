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
    paintBlood(ctx, size, 14)
    addNoise(ctx, size, 22)
  })
  texture.repeat.set(2.2, 1.4)
  return texture
}

export function makeBloodDecal() {
  return noiseCanvas(256, (ctx, size) => {
    ctx.clearRect(0, 0, size, size)
    paintBlood(ctx, size, 8)
    for (let i = 0; i < 18; i += 1) {
      const x = Math.random() * size
      let y = Math.random() * size * 0.45
      ctx.strokeStyle = `rgba(${90 + Math.random() * 50}, 8, 8, ${0.35 + Math.random() * 0.45})`
      ctx.lineWidth = 1 + Math.random() * 3
      ctx.beginPath()
      ctx.moveTo(x, y)
      while (y < size) {
        y += 6 + Math.random() * 14
        ctx.lineTo(x + (Math.random() - 0.5) * 10, y)
      }
      ctx.stroke()
    }
  })
}

function paintBlood(
  ctx: CanvasRenderingContext2D,
  size: number,
  blobs: number,
) {
  for (let i = 0; i < blobs; i += 1) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = 10 + Math.random() * 48
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r)
    gradient.addColorStop(0, `rgba(${110 + Math.random() * 40}, 10, 10, 0.72)`)
    gradient.addColorStop(0.55, `rgba(70, 6, 6, 0.42)`)
    gradient.addColorStop(1, 'rgba(40, 0, 0, 0)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.ellipse(
      x,
      y,
      r,
      r * (0.55 + Math.random() * 0.7),
      Math.random() * Math.PI,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }
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

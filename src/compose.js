import { OPEN_SHAPES, shapePath } from './shapes.js'

export const LAYOUTS = {
  single: { id: 'single', label: 'One big photo', shots: 1 },
  strip: { id: 'strip', label: 'Photo strip', shots: 3 },
}

const clampN = (v, a, b) => Math.min(b, Math.max(a, v))

export function shotAspect(shots) {
  const s = shots && shots[0]
  return s ? s.width / s.height : 4 / 5
}

export function getLayout(id, shots) {
  const aspect = shotAspect(shots)
  if (id === 'strip') {
    const m = 36
    const gap = 24
    const sw = 800 - m * 2
    const sh = Math.round(clampN(sw / aspect, 360, 700))
    const slots = [0, 1, 2].map((i) => ({ x: m, y: m + i * (sh + gap), w: sw, h: sh }))
    const fy = slots[2].y + sh + gap
    const fh = 300
    return { id, shots: 3, W: 800, H: fy + fh, slots, footer: { y: fy, h: fh } }
  }
  const m = 32
  const sw = 1200 - m * 2
  const sh = Math.round(clampN(sw / aspect, 600, 1500))
  const fh = aspect > 1.15 ? 170 : 260
  const fy = m + sh + 24
  return { id: 'single', shots: 1, W: 1200, H: fy + fh, slots: [{ x: m, y: m, w: sw, h: sh }], footer: { y: fy, h: fh } }
}

export const DEFAULT_PHOTO = { zoom: 1, ox: 0, oy: 0 }

export function panLimits(shot, slot, zoom) {
  const k = Math.max(slot.w / shot.width, slot.h / shot.height) * zoom
  return {
    mx: Math.max(0, (shot.width * k - slot.w) / 2) / slot.w,
    my: Math.max(0, (shot.height * k - slot.h) / 2) / slot.h,
  }
}

export const INK = '#030a2e'

export const FILTERS = [
  { id: 'none', name: 'Original', css: 'none' },
  { id: 'pop', name: 'Pop', css: 'saturate(1.6) contrast(1.1)' },
  { id: 'warm', name: 'Sunshine', css: 'sepia(0.3) saturate(1.5) brightness(1.05)' },
  { id: 'cool', name: 'Ice', css: 'hue-rotate(12deg) saturate(1.2) brightness(1.05)' },
  { id: 'retro', name: 'Retro', css: 'sepia(0.55) contrast(1.2) saturate(1.2)' },
  { id: 'mono', name: 'Mono', css: 'grayscale(1) contrast(1.15)' },
  { id: 'neon', name: 'Neon', css: 'contrast(1.3) saturate(2.2) hue-rotate(-18deg)' },
  { id: 'candy', name: 'Candy', css: 'saturate(1.8) brightness(1.1) hue-rotate(-10deg) contrast(0.95)' },
  { id: 'peach', name: 'Peachy', css: 'sepia(0.25) saturate(1.4) hue-rotate(-14deg) brightness(1.1)' },
  { id: 'dreamy', name: 'Dreamy', css: 'brightness(1.12) contrast(0.85) saturate(1.3) blur(0.6px)' },
  { id: 'lavender', name: 'Lavender', css: 'sepia(0.2) hue-rotate(230deg) saturate(1.3) brightness(1.08)' },
  { id: 'mintyfresh', name: 'Minty', css: 'hue-rotate(60deg) saturate(1.3) brightness(1.08) contrast(0.95)' },
  { id: 'sunset', name: 'Sunset', css: 'sepia(0.45) hue-rotate(-25deg) saturate(1.9) contrast(1.05)' },
  { id: 'glow', name: 'Glow', css: 'brightness(1.25) contrast(0.9) saturate(1.2)' },
  { id: 'film', name: 'Film', css: 'sepia(0.3) contrast(0.9) saturate(0.85) brightness(1.05)' },
  { id: 'fade', name: 'Faded', css: 'contrast(0.78) brightness(1.15) saturate(0.8)' },
  { id: 'cyber', name: 'Cyber', css: 'hue-rotate(160deg) saturate(1.8) contrast(1.2)' },
  { id: 'noir', name: 'Noir', css: 'grayscale(1) contrast(1.5) brightness(0.9)' },
  { id: 'bubblepink', name: 'Blush', css: 'sepia(0.35) hue-rotate(-35deg) saturate(1.6) brightness(1.1)' },
]

function rng(seed) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const FRAMES = [
  {
    id: 'circuit',
    name: 'Circuit',
    ink: '#ffffff',
    border: '#ffffff',
    bg(ctx, W, H) {
      const r = rng(7)
      ctx.fillStyle = INK
      ctx.fillRect(0, 0, W, H)
      ctx.strokeStyle = '#2460e7'
      ctx.fillStyle = '#2460e7'
      ctx.lineWidth = 7
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      const g = 50
      for (let i = 0; i < 46; i++) {
        let x = Math.round((r() * W) / g) * g
        let y = Math.round((r() * H) / g) * g
        ctx.beginPath()
        ctx.moveTo(x, y)
        for (let s = 0; s < 4; s++) {
          const d = Math.floor(r() * 4)
          const len = (1 + Math.floor(r() * 4)) * g
          if (d === 0) x += len
          else if (d === 1) x -= len
          else if (d === 2) y += len
          else y -= len
          ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(x, y, 13, 0, Math.PI * 2)
        ctx.fillStyle = INK
        ctx.fill()
        ctx.stroke()
      }
    },
  },
  {
    id: 'sunny',
    name: 'Sunny',
    ink: INK,
    border: '#ffffff',
    bg(ctx, W, H) {
      ctx.fillStyle = '#ffd23f'
      ctx.fillRect(0, 0, W, H)
      const cols = ['#ff5fa2', '#3ca2fa', '#ffffff']
      const step = 84
      for (let row = 0, y = 0; y < H + step; row++, y += step) {
        for (let x = (row % 2) * (step / 2); x < W + step; x += step) {
          ctx.fillStyle = cols[(row + Math.round(x / step)) % 3]
          ctx.beginPath()
          ctx.arc(x, y, 20, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    },
  },
  {
    id: 'bubblegum',
    name: 'Bubblegum',
    ink: INK,
    border: '#ffffff',
    bg(ctx, W, H) {
      ctx.fillStyle = '#ff5fa2'
      ctx.fillRect(0, 0, W, H)
      ctx.save()
      ctx.rotate(-Math.PI / 6)
      ctx.fillStyle = '#ff8bbd'
      for (let x = -H; x < W + H; x += 120) ctx.fillRect(x, -H, 56, H * 3)
      ctx.restore()
    },
  },
  {
    id: 'pixel',
    name: 'Pixel',
    ink: '#ffffff',
    border: '#ffffff',
    bg(ctx, W, H) {
      const r = rng(21)
      const cols = ['#2460e7', '#3ca2fa', '#1a48b8', '#5db7ff']
      const s = 40
      for (let y = 0; y < H; y += s) {
        for (let x = 0; x < W; x += s) {
          ctx.fillStyle = cols[Math.floor(r() * cols.length)]
          ctx.fillRect(x, y, s, s)
        }
      }
    },
  },
  {
    id: 'mint',
    name: 'Mint',
    ink: INK,
    border: INK,
    bg(ctx, W, H) {
      const r = rng(5)
      ctx.fillStyle = '#2ee6a6'
      ctx.fillRect(0, 0, W, H)
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.55)' : 'rgba(3,10,46,.14)'
        ctx.beginPath()
        ctx.arc(r() * W, r() * H, 40 + r() * 150, 0, Math.PI * 2)
        ctx.fill()
      }
    },
  },
  {
    id: 'clean',
    name: 'Clean',
    ink: INK,
    border: INK,
    bg(ctx, W, H) {
      ctx.fillStyle = '#f4f7ff'
      ctx.fillRect(0, 0, W, H)
    },
  },
]

export const ICONS = [
  { id: 'robot', color: '#3ca2fa', path: 'M11 2h2v2.2h4a3 3 0 0 1 3 3V17a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7.2a3 3 0 0 1 3-3h4zM8.5 9a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4zm7 0a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4zM8.5 15h7v1.5h-7z' },
  { id: 'bolt', color: '#ffd23f', path: 'M13 2L4 14h6l-1 8 9-12h-6z' },
  { id: 'rocket', color: '#ff5fa2', path: 'M12 2c3 2 5 6 5 10l2 3v3l-3-1.5H8L5 18v-3l2-3c0-4 2-8 5-10zM12 8.5a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4z' },
  { id: 'bulb', color: '#ffd23f', path: 'M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2zM9 19h6v1.5a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 20.5z' },
  { id: 'smile', color: '#ffd23f', path: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM8.5 8.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm7 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM7 14h10a5 5 0 0 1-10 0z' },
  { id: 'star', color: '#ffd23f', path: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z' },
  { id: 'heart', color: '#ff5fa2', path: 'M12 21s-8-5.6-8-11.2C4 6.6 6.2 4.5 8.7 4.5c1.5 0 2.7.8 3.3 1.9.6-1.1 1.8-1.9 3.3-1.9 2.5 0 4.7 2.1 4.7 5.3C20 15.4 12 21 12 21z' },
  { id: 'flame', color: '#ff8a3d', path: 'M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-9.5z' },
  { id: 'sparkle', color: '#2ee6a6', path: 'M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z' },
  { id: 'gamepad', color: '#2460e7', path: 'M6 8h12a4 4 0 0 1 4 4v3a3 3 0 0 1-5.2 2L15 15H9l-1.8 2A3 3 0 0 1 2 15v-3a4 4 0 0 1 4-4zM7 10v1.5H5.5V13H7v1.5h1.5V13H10v-1.5H8.5V10zM16 11.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm2.5 1a1 1 0 1 0 0 2 1 1 0 0 0 0-2z' },
  { id: 'crown', color: '#ffd23f', path: 'M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z' },
  { id: 'moon', color: '#3ca2fa', path: 'M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z' },
  { id: 'cloud', color: '#ffffff', path: 'M7 18a4 4 0 0 1-.5-7.97A6 6 0 0 1 18 9.5 4.3 4.3 0 0 1 17.5 18z' },
  { id: 'note', color: '#ff5fa2', path: 'M9 3v12.3A3.5 3.5 0 1 0 11 18.5V7.5l8-2V13a3.5 3.5 0 1 0 2 3.2V3z' },
].map((i) => ({ ...i, path2d: typeof Path2D === 'undefined' ? null : new Path2D(i.path) }))
export const ICON_MAP = Object.fromEntries(ICONS.map((i) => [i.id, i]))

function paintIcon(ctx, icon, size, color, outline) {
  ctx.save()
  ctx.scale(size / 24, size / 24)
  ctx.translate(-12, -12)
  ctx.fillStyle = color
  ctx.lineJoin = 'round'
  ctx.lineWidth = 1.6
  ctx.strokeStyle = outline
  ctx.fill(icon.path2d, 'evenodd')
  ctx.stroke(icon.path2d)
  ctx.restore()
}

export const STICKERS = [
  { id: 'robocar', kind: 'img', src: '/assets/robocar-removed-bg.webp', size: 0.49 },
  { id: 'uno', kind: 'img', src: '/assets/uno.webp', size: 0.44 },
  { id: 'pi', kind: 'img', src: '/assets/pi-removed-bg.webp', size: 0.42 },
  { id: 'esp32', kind: 'img', src: '/assets/esp32-removed-bg.webp', size: 0.39 },
  { id: 'led', kind: 'img', src: '/assets/led-removed-bg.webp', size: 0.26 },
  { id: 'bolt', kind: 'img', src: '/assets/bolt.webp', size: 0.29 },
  { id: 'screwdriver', kind: 'img', src: '/assets/screwdriver.webp', size: 0.44 },
  { id: 'bord', kind: 'img', src: '/assets/bord.webp', size: 0.44 },
  { id: 'logo', kind: 'img', src: '/assets/main.webp', size: 0.29, round: true },
  ...ICONS.map((i) => ({ id: `i-${i.id}`, kind: 'icon', icon: i.id, color: i.color, size: 0.2 })),
]

export const BUBBLES = [
  { text: 'AFAQ!', color: '#ffd23f' },
  { text: 'BEEP BOOP', color: '#2ee6a6' },
  { text: 'LEVEL UP', color: '#ff5fa2' },
  { text: 'POWER ON', color: '#3ca2fa' },
  { text: '404 SMILE NOT FOUND', color: '#ffffff' },
  { text: 'SHORT CIRCUIT', color: '#ffd23f' },
  { text: 'MAKER MODE', color: '#ff5fa2' },
]

const imageCache = new Map()
export function loadImage(src) {
  if (!imageCache.has(src)) {
    imageCache.set(
      src,
      new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = src
      }).then((img) => {
        imageCache.set(src, img)
        return img
      }),
    )
  }
  const v = imageCache.get(src)
  return v instanceof HTMLImageElement ? v : null
}

export function whenLoaded(src) {
  loadImage(src)
  return Promise.resolve(imageCache.get(src))
}

export function preloadAll() {
  const srcs = [...STICKERS.filter((s) => s.kind === 'img').map((s) => s.src), '/assets/main.webp']
  return Promise.all(srcs.map((s) => { loadImage(s); return imageCache.get(s) }))
}

export function fontsReady() {
  return Promise.all([
    document.fonts.load('40px "Minecraft"'),
    document.fonts.load('600 40px "Fredoka Variable"'),
  ]).catch(() => {})
}

export function stickerBox(ctx, s, W) {
  if (s.kind === 'img') {
    const img = loadImage(s.src)
    const w = s.size * W
    const ar = img ? img.naturalHeight / img.naturalWidth : 1
    return { w, h: s.round ? w : w * ar }
  }
  if (s.kind === 'emoji' || s.kind === 'icon') {
    const w = s.size * W
    return { w, h: w }
  }
  const fs = s.size * W * 0.34
  ctx.font = `${fs}px "Minecraft", "Fredoka Variable", sans-serif`
  const tw = ctx.measureText(s.text).width
  return { w: tw + fs, h: fs * 1.9, fs }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function drawCover(ctx, src, slot, filter, photo) {
  const t = photo || DEFAULT_PHOTO
  const k = Math.max(slot.w / src.width, slot.h / src.height) * t.zoom
  const dw = src.width * k
  const dh = src.height * k
  const { mx, my } = panLimits(src, slot, t.zoom)
  const ox = clampN(t.ox, -mx, mx) * slot.w
  const oy = clampN(t.oy, -my, my) * slot.h
  ctx.filter = filter
  ctx.drawImage(src, slot.x + (slot.w - dw) / 2 + ox, slot.y + (slot.h - dh) / 2 + oy, dw, dh)
  ctx.filter = 'none'
}

function drawSticker(ctx, s, W, H) {
  const box = stickerBox(ctx, s, W)
  ctx.save()
  ctx.translate(s.x * W, s.y * H)
  ctx.rotate(s.rot)
  ctx.shadowColor = 'rgba(3,10,46,.35)'
  ctx.shadowBlur = 14
  ctx.shadowOffsetY = 8
  if (s.kind === 'img') {
    const img = loadImage(s.src)
    if (img) {
      if (s.round) {
        roundRect(ctx, -box.w / 2, -box.h / 2, box.w, box.h, box.w * 0.22)
        ctx.save()
        ctx.clip()
        ctx.drawImage(img, -box.w / 2, -box.h / 2, box.w, box.h)
        ctx.restore()
      } else {
        ctx.drawImage(img, -box.w / 2, -box.h / 2, box.w, box.h)
      }
    }
  } else if (s.kind === 'icon') {
    paintIcon(ctx, ICON_MAP[s.icon], box.w, s.color, INK)
  } else if (s.kind === 'emoji') {
    ctx.font = `${box.w * 0.85}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(s.value, 0, box.h * 0.04)
  } else {
    const lw = box.fs * 0.14
    ctx.shadowColor = INK
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = lw * 1.2
    ctx.shadowOffsetY = lw * 1.2
    ctx.fillStyle = s.color
    roundRect(ctx, -box.w / 2, -box.h / 2, box.w, box.h, box.h * 0.32)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.lineWidth = lw
    ctx.strokeStyle = INK
    ctx.stroke()
    ctx.fillStyle = INK
    ctx.font = `${box.fs}px "Minecraft", "Fredoka Variable", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(s.text, 0, box.fs * 0.06)
  }
  ctx.restore()
}

function paintInk(ctx, ink) {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const s of ink) {
    ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over'
    ctx.strokeStyle = s.color
    ctx.fillStyle = s.color
    ctx.lineWidth = s.size
    if (s.type === 'shape') {
      shapePath(ctx, s.shape, s.x0, s.y0, s.x1, s.y1, s.size)
      if (s.filled && !OPEN_SHAPES.has(s.shape)) ctx.fill()
      ctx.stroke()
      continue
    }
    const p = s.points
    if (p.length === 1) {
      ctx.beginPath()
      ctx.arc(p[0].x, p[0].y, s.size / 2, 0, Math.PI * 2)
      ctx.fill()
      continue
    }
    ctx.beginPath()
    ctx.moveTo(p[0].x, p[0].y)
    for (let i = 1; i < p.length - 1; i++) {
      ctx.quadraticCurveTo(p[i].x, p[i].y, (p[i].x + p[i + 1].x) / 2, (p[i].y + p[i + 1].y) / 2)
    }
    ctx.lineTo(p[p.length - 1].x, p[p.length - 1].y)
    ctx.stroke()
  }
  ctx.restore()
}

// The eraser only removes ink, never the photo, so erasing needs its own layer.
function drawInk(ctx, ink) {
  if (!ink.some((s) => s.erase)) return paintInk(ctx, ink)
  const off = document.createElement('canvas')
  off.width = ctx.canvas.width
  off.height = ctx.canvas.height
  const o = off.getContext('2d')
  o.setTransform(ctx.getTransform())
  paintInk(o, ink)
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.drawImage(off, 0, 0)
  ctx.restore()
}

export function handlePoints(ctx, s, W, H) {
  const box = stickerBox(ctx, s, W)
  const pad = 16
  const hw = box.w / 2 + pad
  const hh = box.h / 2 + pad
  const c = Math.cos(s.rot)
  const sn = Math.sin(s.rot)
  const at = (x, y) => ({ x: s.x * W + x * c - y * sn, y: s.y * H + x * sn + y * c })
  return { del: at(-hw, -hh), scale: at(hw, hh) }
}

function drawSelection(ctx, s, W, H, hr) {
  const box = stickerBox(ctx, s, W)
  const pad = 16
  ctx.save()
  ctx.translate(s.x * W, s.y * H)
  ctx.rotate(s.rot)
  ctx.lineWidth = 7
  ctx.setLineDash([22, 14])
  ctx.strokeStyle = INK
  ctx.strokeRect(-box.w / 2 - pad, -box.h / 2 - pad, box.w + pad * 2, box.h + pad * 2)
  ctx.lineWidth = 4
  ctx.strokeStyle = '#ffffff'
  ctx.strokeRect(-box.w / 2 - pad, -box.h / 2 - pad, box.w + pad * 2, box.h + pad * 2)
  ctx.restore()

  const { del, scale } = handlePoints(ctx, s, W, H)
  const knob = (p, color, glyph) => {
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.fillStyle = color
    ctx.strokeStyle = INK
    ctx.lineWidth = hr * 0.16
    ctx.beginPath()
    ctx.arc(0, 0, hr, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.lineWidth = hr * 0.2
    ctx.lineCap = 'round'
    ctx.beginPath()
    glyph(hr * 0.42)
    ctx.stroke()
    ctx.restore()
  }
  knob(del, '#ff5fa2', (a) => {
    ctx.moveTo(-a, -a)
    ctx.lineTo(a, a)
    ctx.moveTo(a, -a)
    ctx.lineTo(-a, a)
  })
  knob(scale, '#ffd23f', (a) => {
    ctx.moveTo(-a, a)
    ctx.lineTo(a, -a)
    ctx.moveTo(a, -a)
    ctx.lineTo(a, -a * 0.2)
    ctx.moveTo(a, -a)
    ctx.lineTo(a * 0.2, -a)
    ctx.moveTo(-a, a)
    ctx.lineTo(-a, a * 0.2)
    ctx.moveTo(-a, a)
    ctx.lineTo(-a * 0.2, a)
  })
}

function drawFooter(ctx, layout, frame, caption) {
  const { W } = layout
  const { y, h } = layout.footer
  const k = Math.min(W / 1200, h / 300)
  const logo = 200 * k
  const title = 92 * k
  const sub = 40 * k
  const line = 50 * k
  const gap = 36 * k
  const cy = y + h / 2
  const textLeft = W / 2 - (logo + gap + 560 * k) / 2 + logo + gap
  const left = textLeft - logo - gap

  const img = loadImage('/assets/main.webp')
  ctx.save()
  ctx.fillStyle = INK
  roundRect(ctx, left + 8 * k, cy - logo / 2 + 8 * k, logo, logo, logo * 0.24)
  ctx.fill()
  if (img) {
    roundRect(ctx, left, cy - logo / 2, logo, logo, logo * 0.24)
    ctx.save()
    ctx.clip()
    ctx.drawImage(img, left, cy - logo / 2, logo, logo)
    ctx.restore()
    ctx.lineWidth = 8 * k
    ctx.strokeStyle = frame.ink === '#ffffff' ? '#ffffff' : INK
    ctx.stroke()
  }
  ctx.fillStyle = frame.ink
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `${title}px "Minecraft"`
  ctx.fillText('AFAQ', textLeft, cy - 6 * k)
  ctx.font = `${sub}px "Minecraft"`
  ctx.fillText('Scientific Club', textLeft, cy + sub + 2 * k)
  ctx.font = `600 ${line}px "Fredoka Variable", sans-serif`
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  ctx.fillText(caption || `Opening Day · ${date}`, textLeft, cy + sub + line + 14 * k, 600 * k)
  ctx.restore()
}

export function renderComposite(canvas, state, opts = {}) {
  const { scale = 1, selectedId = null, withStickers = true, withFooter = true, handleR = 40 } = opts
  const layout = getLayout(state.layout, state.shots)
  const { W, H } = layout
  canvas.width = Math.round(W * scale)
  canvas.height = Math.round(H * scale)
  const ctx = canvas.getContext('2d')
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  const frame = FRAMES.find((f) => f.id === state.frameId) || FRAMES[0]
  const filter = (FILTERS.find((f) => f.id === state.filterId) || FILTERS[0]).css

  frame.bg(ctx, W, H)

  layout.slots.forEach((slot, i) => {
    const b = 8
    ctx.fillStyle = INK
    roundRect(ctx, slot.x - b + 8, slot.y - b + 8, slot.w + b * 2, slot.h + b * 2, 28)
    ctx.fill()
    ctx.fillStyle = frame.border
    roundRect(ctx, slot.x - b, slot.y - b, slot.w + b * 2, slot.h + b * 2, 28)
    ctx.fill()
    ctx.save()
    roundRect(ctx, slot.x, slot.y, slot.w, slot.h, 20)
    ctx.clip()
    const shot = state.shots[i]
    if (shot) drawCover(ctx, shot, slot, filter, state.photo)
    else {
      ctx.fillStyle = '#1a2456'
      ctx.fillRect(slot.x, slot.y, slot.w, slot.h)
    }
    ctx.restore()
  })

  if (withFooter) drawFooter(ctx, layout, frame, state.caption)

  if (withStickers) {
    state.stickers.forEach((s) => drawSticker(ctx, s, W, H))
    if (state.ink && state.ink.length) drawInk(ctx, state.ink)
    const sel = state.stickers.find((s) => s.id === selectedId)
    if (sel) drawSelection(ctx, sel, W, H, handleR)
  }
}

export function hitTest(ctx, state, px, py) {
  const { W, H } = getLayout(state.layout, state.shots)
  for (let i = state.stickers.length - 1; i >= 0; i--) {
    const s = state.stickers[i]
    const box = stickerBox(ctx, s, W)
    const dx = px - s.x * W
    const dy = py - s.y * H
    const c = Math.cos(-s.rot)
    const sn = Math.sin(-s.rot)
    const lx = dx * c - dy * sn
    const ly = dx * sn + dy * c
    const hw = Math.max(box.w, 90) / 2 + 12
    const hh = Math.max(box.h, 90) / 2 + 12
    if (Math.abs(lx) <= hw && Math.abs(ly) <= hh) return s.id
  }
  return null
}

export function toJpegBlob(state) {
  const c = document.createElement('canvas')
  renderComposite(c, state, { scale: 1, selectedId: null })
  return new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', 0.92))
}

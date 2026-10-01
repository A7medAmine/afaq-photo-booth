import { formatDate, translate } from './i18n.jsx'
import stickerCatalog from './stickerCatalog.json'
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

function starPath(ctx, cx, cy, R, inner, rot) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? R * inner : R
    const a = rot + (i * Math.PI) / 5 - Math.PI / 2
    const px = cx + Math.cos(a) * rad
    const py = cy + Math.sin(a) * rad
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
}

function heartPath(ctx, cx, cy, s) {
  ctx.beginPath()
  ctx.moveTo(cx, cy + s * 0.9)
  ctx.bezierCurveTo(cx - s * 1.6, cy - s * 0.1, cx - s * 0.9, cy - s * 1.2, cx, cy - s * 0.4)
  ctx.bezierCurveTo(cx + s * 0.9, cy - s * 1.2, cx + s * 1.6, cy - s * 0.1, cx, cy + s * 0.9)
  ctx.closePath()
  ctx.fill()
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
  {
    id: 'galaxy',
    name: 'Galaxy',
    ink: '#ffffff',
    border: '#ffffff',
    bg(ctx, W, H) {
      const r = rng(33)
      const g = ctx.createLinearGradient(0, 0, W, H)
      g.addColorStop(0, '#0b0630')
      g.addColorStop(0.55, '#2a1170')
      g.addColorStop(1, '#6a1b9a')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
      for (let i = 0; i < 4; i++) {
        const x = r() * W
        const y = r() * H
        const rad = 200 + r() * 260
        const n = ctx.createRadialGradient(x, y, 0, x, y, rad)
        n.addColorStop(0, i % 2 ? 'rgba(255,95,162,.28)' : 'rgba(60,162,250,.28)')
        n.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = n
        ctx.fillRect(0, 0, W, H)
      }
      ctx.fillStyle = '#ffffff'
      for (let i = 0; i < 160; i++) {
        ctx.globalAlpha = 0.35 + r() * 0.65
        ctx.beginPath()
        ctx.arc(r() * W, r() * H, 1.5 + r() * 3.5, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      ctx.fillStyle = '#ffd23f'
      for (let i = 0; i < 14; i++) starPath(ctx, r() * W, r() * H, 10 + r() * 14, 0.45, r() * 1.2)
    },
  },
  {
    id: 'candy',
    name: 'Candy',
    ink: INK,
    border: '#ffffff',
    bg(ctx, W, H) {
      ctx.fillStyle = '#fff1f7'
      ctx.fillRect(0, 0, W, H)
      ctx.save()
      ctx.rotate(Math.PI / 4)
      const d = Math.hypot(W, H)
      const cols = ['#ff5fa2', '#ffffff', '#3ca2fa', '#ffffff']
      for (let i = 0, x = -d; x < d; i++, x += 46) {
        ctx.fillStyle = cols[i % 4]
        ctx.fillRect(x, -d, 46, d * 2)
      }
      ctx.restore()
    },
  },
  {
    id: 'hearts',
    name: 'Hearts',
    ink: '#ffffff',
    border: '#ffffff',
    bg(ctx, W, H) {
      const r = rng(11)
      ctx.fillStyle = '#d6246e'
      ctx.fillRect(0, 0, W, H)
      const cols = ['#ff5fa2', '#ff9ec7', '#ffffff', '#ff3d81']
      const step = 110
      for (let row = 0, y = 0; y < H + step; row++, y += step) {
        for (let x = (row % 2) * (step / 2); x < W + step; x += step) {
          ctx.fillStyle = cols[Math.floor(r() * cols.length)]
          ctx.globalAlpha = 0.8
          heartPath(ctx, x, y, 22 + r() * 10)
        }
      }
      ctx.globalAlpha = 1
    },
  },
  {
    id: 'checker',
    name: 'Checker',
    ink: INK,
    border: '#ffffff',
    bg(ctx, W, H) {
      const s = 70
      for (let y = 0, j = 0; y < H; y += s, j++) {
        for (let x = 0, i = 0; x < W; x += s, i++) {
          ctx.fillStyle = (i + j) % 2 ? '#ffd23f' : '#ffffff'
          ctx.fillRect(x, y, s, s)
        }
      }
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    ink: '#ffffff',
    border: '#ffffff',
    bg(ctx, W, H) {
      const g = ctx.createLinearGradient(0, 0, 0, H)
      g.addColorStop(0, '#ffb347')
      g.addColorStop(0.45, '#ff5f6d')
      g.addColorStop(1, '#7b2ff7')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = 'rgba(255,255,255,.14)'
      for (let i = 0; i < 6; i++) {
        ctx.beginPath()
        ctx.arc(W * (0.1 + i * 0.18), H * (0.2 + (i % 3) * 0.3), 120 + (i % 2) * 70, 0, Math.PI * 2)
        ctx.fill()
      }
    },
  },
  {
    id: 'waves',
    name: 'Waves',
    ink: '#ffffff',
    border: '#ffffff',
    bg(ctx, W, H) {
      ctx.fillStyle = '#1a6fe0'
      ctx.fillRect(0, 0, W, H)
      const cols = ['#3ca2fa', '#5db7ff', '#2460e7']
      ctx.lineWidth = 16
      ctx.lineCap = 'round'
      for (let y = 0, row = 0; y < H + 60; y += 60, row++) {
        ctx.strokeStyle = cols[row % 3]
        ctx.beginPath()
        for (let x = -20; x <= W + 20; x += 10) {
          const yy = y + Math.sin(x / 55 + row) * 18
          if (x === -20) ctx.moveTo(x, yy)
          else ctx.lineTo(x, yy)
        }
        ctx.stroke()
      }
    },
  },
  {
    id: 'confetti',
    name: 'Confetti',
    ink: INK,
    border: '#ffffff',
    bg(ctx, W, H) {
      const r = rng(77)
      ctx.fillStyle = '#fff8e1'
      ctx.fillRect(0, 0, W, H)
      const cols = ['#ff5fa2', '#3ca2fa', '#ffd23f', '#2ee6a6', '#8e5cff']
      for (let i = 0; i < 130; i++) {
        ctx.save()
        ctx.translate(r() * W, r() * H)
        ctx.rotate(r() * Math.PI)
        ctx.fillStyle = cols[i % cols.length]
        if (i % 3 === 0) {
          ctx.beginPath()
          ctx.arc(0, 0, 9 + r() * 7, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.fillRect(-6, -18, 12, 36 * (0.5 + r() * 0.5))
        }
        ctx.restore()
      }
    },
  },
  {
    id: 'grid',
    name: 'Neon Grid',
    ink: '#ffffff',
    border: '#2ee6a6',
    bg(ctx, W, H) {
      ctx.fillStyle = '#10062e'
      ctx.fillRect(0, 0, W, H)
      ctx.strokeStyle = '#ff5fa2'
      ctx.lineWidth = 3
      ctx.shadowColor = '#ff5fa2'
      ctx.shadowBlur = 12 * pixelScale(ctx)
      const s = 60
      ctx.beginPath()
      for (let x = 0; x <= W; x += s) {
        ctx.moveTo(x, 0)
        ctx.lineTo(x, H)
      }
      for (let y = 0; y <= H; y += s) {
        ctx.moveTo(0, y)
        ctx.lineTo(W, y)
      }
      ctx.stroke()
      ctx.shadowBlur = 0
    },
  },
  {
    id: 'stars',
    name: 'Stars',
    ink: INK,
    border: '#ffffff',
    bg(ctx, W, H) {
      const r = rng(19)
      ctx.fillStyle = '#ffd23f'
      ctx.fillRect(0, 0, W, H)
      const cols = ['#ffffff', '#ff5fa2', '#ff9d1f']
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = cols[i % cols.length]
        starPath(ctx, r() * W, r() * H, 18 + r() * 26, 0.5, r())
      }
    },
  },
]

const club = (o) => ({ kind: 'img', group: 'club', ...o })
const EMOJI_GROUPS = {
  faces: ['1f916', '1f60e', '1f47e'],
  fun: ['1f389', '1f3ae', '2b50', '2764-fe0f'],
  tech: ['26a1', '1f680', '1f527', '1f4a1', '1f525'],
}

// Face-only art lives in FACE_STICKERS, so it is left out of the free-placement list.
const FACE_ONLY = new Set(['mustache_a', 'mustache_b', 'beard', 'deal_with_it_glasses'])
const PACK = stickerCatalog
  .filter((s) => !FACE_ONLY.has(s.id))
  .map((s) => ({
    id: `p-${s.id}`,
    kind: 'img',
    group: s.group,
    src: `/assets/stickers/${s.id}.webp`,
    size: Math.min(0.5, Math.max(0.22, 0.34 * Math.sqrt(s.aspect))),
  }))

export const STICKERS = [
  club({ id: 'robocar', src: '/assets/robocar-removed-bg.webp', size: 0.49 }),
  club({ id: 'bolt', src: '/assets/bolt.webp', size: 0.29 }),
  club({ id: 'logo', src: '/assets/main.webp', size: 0.29, round: true }),
  ...Object.entries(EMOJI_GROUPS).flatMap(([group, codes]) =>
    codes.map((c) => ({ id: `e-${c}`, kind: 'img', group, src: `/assets/emoji/${c}.png`, size: 0.2 })),
  ),
  ...PACK,
]

export const BUBBLE_COLORS = ['#ffd23f', '#2ee6a6', '#ff5fa2', '#3ca2fa', '#ffffff', '#ffd23f', '#ff5fa2']

const FONT_STACK = '"Minecraft", "Fredoka Variable", "Baloo Bhaijaan 2 Variable", sans-serif'
const UI_STACK = '"Fredoka Variable", "Baloo Bhaijaan 2 Variable", sans-serif'
const hasArabic = (t) => /[؀-ۿ]/.test(t)

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
    document.fonts.load('600 40px "Baloo Bhaijaan 2 Variable"', 'آفاق ابتسم'),
  ]).catch(() => {})
}

export function stickerBox(ctx, s, W) {
  if (s.kind === 'img') {
    const img = loadImage(s.src)
    const w = s.size * W
    const ar = img ? img.naturalHeight / img.naturalWidth : 1
    return { w, h: s.round ? w : w * ar }
  }
  if (s.kind === 'emoji') {
    const w = s.size * W
    return { w, h: w }
  }
  const fs = s.size * W * 0.34
  ctx.font = `${fs}px ${FONT_STACK}`
  ctx.direction = hasArabic(s.text) ? 'rtl' : 'ltr'
  const tw = ctx.measureText(s.text).width
  return { w: tw + fs, h: fs * 1.9, fs }
}

// Shadow blur and offset ignore the canvas transform, so they are scaled by hand to look the
// same in the small editor canvas and the full-resolution export.
function pixelScale(ctx) {
  const m = ctx.getTransform()
  return Math.hypot(m.a, m.b)
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
  if (s.blend) ctx.globalCompositeOperation = s.blend
  if (s.alpha != null) ctx.globalAlpha = s.alpha
  const px = pixelScale(ctx)
  if (!s.flat) ctx.shadowColor = 'rgba(3,10,46,.35)'
  if (!s.flat) ctx.shadowBlur = 14 * px
  if (!s.flat) ctx.shadowOffsetY = 8 * px
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
  } else if (s.kind === 'emoji') {
    ctx.font = `${box.w * 0.85}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(s.value, 0, box.h * 0.04)
  } else {
    const lw = box.fs * 0.14
    ctx.shadowColor = INK
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = lw * 1.2 * px
    ctx.shadowOffsetY = lw * 1.2 * px
    ctx.fillStyle = s.color
    roundRect(ctx, -box.w / 2, -box.h / 2, box.w, box.h, box.h * 0.32)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.lineWidth = lw
    ctx.strokeStyle = INK
    ctx.stroke()
    ctx.fillStyle = INK
    ctx.font = `${box.fs}px ${FONT_STACK}`
    ctx.direction = hasArabic(s.text) ? 'rtl' : 'ltr'
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

// Bucket: fills the connected area of the drawing under the tap. Only the ink layer is read, never the
// photo, so a shape drawn on the picture fills up to its own border. A tap in open space that is not
// enclosed by ink does nothing. The result is painted into the ink layer, so undo and the eraser work.
const fillCache = new WeakMap()

function bucketFill(ctx, layer, s) {
  const w = ctx.canvas.width
  const h = ctx.canvas.height
  const k = ctx.getTransform().a
  const sx = Math.min(w - 1, Math.max(0, Math.floor(s.x * k)))
  const sy = Math.min(h - 1, Math.max(0, Math.floor(s.y * k)))
  const top = layer.getImageData(0, 0, w, h)
  const l = top.data

  let sig = 0
  const l32 = new Uint32Array(l.buffer)
  for (let i = 0; i < l32.length; i++) sig = (Math.imul(sig, 31) + l32[i]) | 0
  const key = `${w}x${h}:${sig}`
  let mask = fillCache.get(s)?.key === key ? fillCache.get(s).mask : null

  if (!mask) {
    const s0 = (sy * w + sx) * 4
    const [sr, sg, sb, sa] = [l[s0], l[s0 + 1], l[s0 + 2], l[s0 + 3]]
    const seedClear = sa < 40
    const match = (p) => {
      const i = p * 4
      if (seedClear) return l[i + 3] <= 200
      return Math.abs(l[i] - sr) <= 40 && Math.abs(l[i + 1] - sg) <= 40 && Math.abs(l[i + 2] - sb) <= 40 && Math.abs(l[i + 3] - sa) <= 40
    }
    const seen = new Uint8Array(w * h)
    const stack = new Int32Array(w * h)
    let n = 0
    let leaks = false
    stack[n++] = sy * w + sx
    seen[sy * w + sx] = 1
    const push = (p) => {
      if (!seen[p] && match(p)) {
        seen[p] = 1
        stack[n++] = p
      }
    }
    while (n) {
      const p = stack[--n]
      const x = p % w
      if (x === 0 || x === w - 1 || p < w || p >= w * (h - 1)) leaks = true
      if (x > 0) push(p - 1)
      if (x < w - 1) push(p + 1)
      if (p >= w) push(p - w)
      if (p < w * (h - 1)) push(p + w)
    }
    // Empty space that reaches the edge of the picture is not an enclosed shape.
    mask = seedClear && leaks ? new Uint8Array(w * h) : seen
    fillCache.set(s, { key, mask })
  }

  const rgb = parseInt(s.color.slice(1), 16)
  const fr = (rgb >> 16) & 255
  const fg = (rgb >> 8) & 255
  const fb = rgb & 255
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p]) continue
    const i = p * 4
    const a = l[i + 3] / 255
    l[i] = Math.round(l[i] * a + fr * (1 - a))
    l[i + 1] = Math.round(l[i + 1] * a + fg * (1 - a))
    l[i + 2] = Math.round(l[i + 2] * a + fb * (1 - a))
    l[i + 3] = 255
  }
  layer.save()
  layer.setTransform(1, 0, 0, 1, 0, 0)
  layer.putImageData(top, 0, 0)
  layer.restore()
}

// The eraser only removes ink, never the photo, so erasing needs its own layer.
function drawInk(ctx, ink) {
  if (!ink.some((s) => s.erase || s.type === 'fill')) return paintInk(ctx, ink)
  const off = document.createElement('canvas')
  off.width = ctx.canvas.width
  off.height = ctx.canvas.height
  const o = off.getContext('2d')
  o.setTransform(ctx.getTransform())
  // Strokes and fills are applied in order so a fill is bounded by the ink drawn before it.
  for (const s of ink) {
    if (s.type === 'fill') bucketFill(ctx, o, s)
    else paintInk(o, [s])
  }
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

function drawFooter(ctx, layout, frame, caption, lang = 'en') {
  const { W } = layout
  const { y, h } = layout.footer
  const rtl = lang === 'ar'
  const k = Math.min(W / 1200, h / 300)
  const logo = 200 * k
  const title = 92 * k
  const sub = 40 * k
  const line = 50 * k
  const gap = 36 * k
  const cy = y + h / 2
  const textW = 560 * k
  const x0 = W / 2 - (logo + gap + textW) / 2
  const left = rtl ? x0 + textW + gap : x0
  const textX = rtl ? x0 + textW : x0 + logo + gap

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
  ctx.textAlign = rtl ? 'right' : 'left'
  ctx.direction = rtl ? 'rtl' : 'ltr'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `${title}px "Minecraft"`
  ctx.fillText('AFAQ', textX, cy - 6 * k)
  ctx.font = rtl ? `700 ${sub * 1.15}px "Baloo Bhaijaan 2 Variable", sans-serif` : `${sub}px ${FONT_STACK}`
  ctx.fillText(translate(lang, 'footer.sub'), textX, cy + sub + (rtl ? 0 : 2) * k)
  ctx.font = `600 ${line}px ${UI_STACK}`
  const text = caption || translate(lang, 'footer.caption', { date: formatDate(lang) })
  ctx.direction = hasArabic(text) ? 'rtl' : ctx.direction
  ctx.fillText(text, textX, cy + sub + line + (rtl ? 26 : 14) * k, textW)
  ctx.restore()
}

function drawBase(ctx, layout, state, withFooter) {
  const frame = FRAMES.find((f) => f.id === state.frameId) || FRAMES[0]
  const filter = (FILTERS.find((f) => f.id === state.filterId) || FILTERS[0]).css
  const { W, H } = layout

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

  if (withFooter) drawFooter(ctx, layout, frame, state.caption, state.lang)
}

// The frame, photos (with their CSS filter) and footer are the expensive part and only change on
// edits to those, not while a sticker or stroke is being dragged. With opts.cache the canvas keeps
// them in an offscreen layer. The ink drawn before the stroke in progress is kept the same way.
const layers = new WeakMap()

function sameList(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

function drawInkCached(ctx, layer, ink, scale, W, H) {
  const done = ink.slice(0, -1)
  const last = ink[ink.length - 1]
  // A fill or erase has to see everything under it, so those go through the full path.
  if (!done.length || last.erase || last.type === 'fill') return drawInk(ctx, ink)
  let c = layer.ink
  if (!c || c.scale !== scale || c.W !== W || !sameList(c.done, done)) {
    const canvas = c?.canvas || document.createElement('canvas')
    canvas.width = Math.round(W * scale)
    canvas.height = Math.round(H * scale)
    const o = canvas.getContext('2d')
    o.setTransform(scale, 0, 0, scale, 0, 0)
    drawInk(o, done)
    c = layer.ink = { canvas, scale, W, done }
  }
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.drawImage(c.canvas, 0, 0)
  ctx.restore()
  paintInk(ctx, [last])
}

export function renderComposite(canvas, state, opts = {}) {
  const { scale = 1, selectedId = null, withStickers = true, withFooter = true, handleR = 40, cache = false } = opts
  const layout = getLayout(state.layout, state.shots)
  const { W, H } = layout
  const cw = Math.round(W * scale)
  const ch = Math.round(H * scale)
  if (canvas.width !== cw) canvas.width = cw
  if (canvas.height !== ch) canvas.height = ch
  const ctx = canvas.getContext('2d')
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.imageSmoothingQuality = 'high'
  ctx.clearRect(0, 0, W, H)

  if (cache && document.fonts.status === 'loaded') {
    let layer = layers.get(canvas)
    if (!layer) layers.set(canvas, (layer = {}))
    const k = layer.base
    const hit =
      k && k.scale === scale && k.layoutId === layout.id && k.H === H && k.shots === state.shots && k.frameId === state.frameId &&
      k.filterId === state.filterId && k.photo === state.photo && k.caption === state.caption && k.lang === state.lang && k.withFooter === withFooter
    if (!hit) {
      const canvasB = k?.canvas || document.createElement('canvas')
      canvasB.width = cw
      canvasB.height = ch
      const b = canvasB.getContext('2d')
      b.setTransform(scale, 0, 0, scale, 0, 0)
      b.imageSmoothingQuality = 'high'
      drawBase(b, layout, state, withFooter)
      layer.base = { canvas: canvasB, scale, layoutId: layout.id, H, shots: state.shots, frameId: state.frameId, filterId: state.filterId, photo: state.photo, caption: state.caption, lang: state.lang, withFooter }
    }
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(layer.base.canvas, 0, 0)
    ctx.restore()
    if (withStickers) {
      state.stickers.forEach((s) => drawSticker(ctx, s, W, H))
      if (state.ink && state.ink.length) drawInkCached(ctx, layer, state.ink, scale, W, H)
      const sel = state.stickers.find((s) => s.id === selectedId)
      if (sel) drawSelection(ctx, sel, W, H, handleR)
    }
    return
  }

  drawBase(ctx, layout, state, withFooter)

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

// Returns a smaller copy of a shot or canvas, or the source itself when it already fits.
export function scaledCopy(src, maxSide) {
  const k = maxSide / Math.max(src.width, src.height)
  if (k >= 1) return src
  const c = document.createElement('canvas')
  c.width = Math.round(src.width * k)
  c.height = Math.round(src.height * k)
  const ctx = c.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, c.width, c.height)
  return c
}

const MAX_EXPORT_PIXELS = 40e6
const MAX_CANVAS_SIDE = 16384
const PREVIEW_SIDE = 1600

// The layout is designed at roughly 1200px wide; the export is scaled up so the photos keep
// their full camera resolution instead of being shrunk into the layout.
export function exportScale(state) {
  const { W, H, slots } = getLayout(state.layout, state.shots)
  const zoom = (state.photo || DEFAULT_PHOTO).zoom
  let s = 1
  slots.forEach((slot, i) => {
    const shot = state.shots[i]
    if (shot) s = Math.max(s, 1 / (Math.max(slot.w / shot.width, slot.h / shot.height) * zoom))
  })
  return Math.min(s, Math.sqrt(MAX_EXPORT_PIXELS / (W * H)), MAX_CANVAS_SIDE / Math.max(W, H))
}

const jpeg = (c, q) => new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', q))

// full: the photo at camera resolution, for download. preview: a medium copy for screens and sharing.
export async function renderFinal(state) {
  const c = document.createElement('canvas')
  renderComposite(c, state, { scale: exportScale(state), selectedId: null })
  const [full, preview] = await Promise.all([jpeg(c, 0.92), jpeg(scaledCopy(c, PREVIEW_SIDE), 0.82)])
  c.width = c.height = 0
  return { full, preview }
}

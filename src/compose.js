import { formatDate, translate } from './i18n.jsx'
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

const club = (o) => ({ kind: 'img', group: 'club', ...o })
const EMOJI_GROUPS = {
  faces: ['1f916', '1f60e', '1f47e'],
  fun: ['1f389', '1f3ae', '2b50', '2764-fe0f'],
  tech: ['26a1', '1f680', '1f527', '1f4a1', '1f525'],
}

export const STICKERS = [
  club({ id: 'robocar', src: '/assets/robocar-removed-bg.webp', size: 0.49 }),
  club({ id: 'uno', src: '/assets/uno.webp', size: 0.44 }),
  club({ id: 'pi', src: '/assets/pi-removed-bg.webp', size: 0.42 }),
  club({ id: 'esp32', src: '/assets/esp32-removed-bg.webp', size: 0.39 }),
  club({ id: 'led', src: '/assets/led-removed-bg.webp', size: 0.26 }),
  club({ id: 'bolt', src: '/assets/bolt.webp', size: 0.29 }),
  club({ id: 'screwdriver', src: '/assets/screwdriver.webp', size: 0.44 }),
  club({ id: 'bord', src: '/assets/bord.webp', size: 0.44 }),
  club({ id: 'logo', src: '/assets/main.webp', size: 0.29, round: true }),
  ...Object.entries(EMOJI_GROUPS).flatMap(([group, codes]) =>
    codes.map((c) => ({ id: `e-${c}`, kind: 'img', group, src: `/assets/emoji/${c}.png`, size: 0.2 })),
  ),
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

export function renderComposite(canvas, state, opts = {}) {
  const { scale = 1, selectedId = null, withStickers = true, withFooter = true, handleR = 40 } = opts
  const layout = getLayout(state.layout, state.shots)
  const { W, H } = layout
  canvas.width = Math.round(W * scale)
  canvas.height = Math.round(H * scale)
  const ctx = canvas.getContext('2d')
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.imageSmoothingQuality = 'high'
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

  if (withFooter) drawFooter(ctx, layout, frame, state.caption, state.lang)

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

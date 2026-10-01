import { loadImage } from './compose.js'

function art(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  return c.toDataURL('image/png')
}

function glow(ctx, x, y, r, stops) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  stops.forEach(([at, color]) => g.addColorStop(at, color))
  ctx.fillStyle = g
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}

const blush = (hue) => art(256, 256, (ctx) => glow(ctx, 128, 128, 128, [[0, `hsla(${hue},100%,62%,.75)`], [0.55, `hsla(${hue},100%,62%,.35)`], [1, `hsla(${hue},100%,62%,0)`]]))

const freckles = art(400, 160, (ctx) => {
  ctx.fillStyle = 'rgba(105,48,22,.9)'
  const dots = [[40, 80, 7], [80, 55, 6], [95, 105, 8], [135, 70, 6], [150, 110, 5], [180, 50, 5], [220, 50, 5], [250, 110, 5], [265, 70, 6], [305, 105, 8], [320, 55, 6], [360, 80, 7], [120, 40, 4], [280, 40, 4], [200, 120, 4]]
  dots.forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r * 1.5, 0, Math.PI * 2); ctx.fill() })
})

const clownNose = art(160, 160, (ctx) => {
  ctx.beginPath()
  ctx.arc(80, 80, 70, 0, Math.PI * 2)
  ctx.clip()
  glow(ctx, 55, 52, 130, [[0, '#ff8a8a'], [0.35, '#ee2b2b'], [1, '#a01010']])
  ctx.fillStyle = 'rgba(255,255,255,.75)'
  ctx.beginPath()
  ctx.ellipse(55, 48, 16, 10, -0.6, 0, Math.PI * 2)
  ctx.fill()
})

// Sticker parts per face: cheeks land on both cheeks, everything else once.
export const PARTS = { cheeks: 2 }

export const FACE_STICKERS = [
  { id: 'f-tophat', anchor: 'top', src: '/assets/emoji/1f3a9.png', width: 1.3 },
  { id: 'f-crown', anchor: 'top', src: '/assets/emoji/1f451.png', width: 1.1 },
  { id: 'f-cap', anchor: 'top', src: '/assets/emoji/1f9e2.png', width: 1.35 },
  { id: 'f-bow', anchor: 'top', src: '/assets/emoji/1f380.png', width: 0.7 },
  { id: 'f-hat-cowboy', anchor: 'top', src: '/assets/stickers/hat_cowboy.webp', width: 1.6 },
  { id: 'f-hat-witch', anchor: 'top', src: '/assets/stickers/hat_witch_black.webp', width: 1.55 },
  { id: 'f-hat-witch-purple', anchor: 'top', src: '/assets/stickers/hat_witch_purple.webp', width: 1.35 },
  { id: 'f-glasses', anchor: 'eyes', src: '/assets/emoji/1f453.png', width: 1.45 },
  { id: 'f-deal-with-it', anchor: 'eyes', src: '/assets/stickers/deal_with_it_glasses.webp', width: 1.5 },
  { id: 'f-shades', anchor: 'eyes', src: '/assets/emoji/1f576-fe0f.png', width: 1.45 },
  { id: 'f-blush', anchor: 'cheeks', src: blush(345), width: 0.42, flat: true, blend: 'multiply', alpha: 0.8 },
  { id: 'f-blush-peach', anchor: 'cheeks', src: blush(18), width: 0.42, flat: true, blend: 'multiply', alpha: 0.8 },
  { id: 'f-blush-heart', anchor: 'cheeks', src: '/assets/stickers/blush_k1.webp', width: 0.3, flat: true, blend: 'multiply', alpha: 0.8 },
  { id: 'f-blush-anime', anchor: 'cheeks', src: '/assets/stickers/blush_k2.webp', width: 0.5, flat: true, blend: 'multiply', alpha: 0.8 },
  { id: 'f-blush-lines', anchor: 'cheeks', src: '/assets/stickers/blush_k3.webp', width: 0.4, flat: true, blend: 'multiply', alpha: 0.8 },
  { id: 'f-blush-kawaii', anchor: 'cheeks', src: '/assets/stickers/blush_k4.webp', width: 0.4, flat: true, blend: 'multiply', alpha: 0.8 },
  { id: 'f-heart', anchor: 'cheeks', src: '/assets/emoji/2764-fe0f.png', width: 0.2 },
  { id: 'f-star', anchor: 'cheeks', src: '/assets/emoji/2b50.png', width: 0.2 },
  { id: 'f-freckles', anchor: 'freckles', src: freckles, width: 0.8, flat: true },
  { id: 'f-clown', anchor: 'nose', src: clownNose, width: 0.2 },
  { id: 'f-mustache', anchor: 'mustache', src: '/assets/stickers/mustache_a.webp', width: 0.5 },
  { id: 'f-mustache-b', anchor: 'mustache', src: '/assets/stickers/mustache_b.webp', width: 0.5 },
  { id: 'f-beard', anchor: 'beard', src: '/assets/stickers/beard.webp', width: 0.95 },
]

const MAX_FACES = 12
const TILE_SCALES = [0.6, 0.36]
const cache = new WeakMap()
let landmarker = null

function getLandmarker() {
  landmarker ||= import('@mediapipe/tasks-vision').then(async ({ FaceLandmarker, FilesetResolver }) => {
    const fileset = await FilesetResolver.forVisionTasks('/mediapipe')
    const make = (delegate) =>
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: '/mediapipe/face_landmarker.task', delegate },
        runningMode: 'IMAGE',
        numFaces: MAX_FACES,
        minFaceDetectionConfidence: 0.35,
        minFacePresenceConfidence: 0.35,
      })
    return make('GPU').catch(() => make('CPU'))
  })
  return landmarker
}

// Lets the browser paint and handle input between detection passes.
const breathe = () => new Promise((r) => setTimeout(r, 0))

export function warmUpFaces() {
  getLandmarker().catch(() => { landmarker = null })
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 300))
  idle(() => FACE_STICKERS.forEach((s) => loadImage(s.src)))
}

const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

function toFace(lm, w, h, ox = 0, oy = 0) {
  const p = (i) => ({ x: lm[i].x * w + ox, y: lm[i].y * h + oy })
  const left = p(33)
  const right = p(263)
  return {
    roll: Math.atan2(right.y - left.y, right.x - left.x),
    eyes: mid(left, right),
    eyeSpan: dist(left, right),
    forehead: p(10),
    chin: p(152),
    nose: p(1),
    mustache: mid(p(2), p(0)),
    mouth: mid(p(0), p(17)),
    cheeks: [p(50), p(280)],
    width: dist(p(234), p(454)),
  }
}

// MediaPipe shrinks its input, so faces in a wide group shot end up a few pixels
// wide. Scan overlapping crops as well as the whole image, then merge the results.
function tiles(w, h) {
  return TILE_SCALES.flatMap((scale) => {
    const size = Math.round(Math.min(w, h) * scale)
    const stride = Math.round(size / 2)
    const axis = (len) => {
      const out = []
      for (let at = 0; at + size < len; at += stride) out.push(at)
      out.push(len - size)
      return out
    }
    return axis(h).flatMap((y) => axis(w).map((x) => ({ x, y, size })))
  })
}

function dedupe(found) {
  const kept = []
  found.sort((a, b) => a.off - b.off).forEach((f) => {
    const dup = kept.some((k) => Math.hypot(k.eyes.x - f.eyes.x, k.eyes.y - f.eyes.y) < Math.min(k.width, f.width) * 0.6)
    if (!dup) kept.push(f)
  })
  return kept
}

export async function detectFaces(shot) {
  if (cache.has(shot)) return cache.get(shot)
  const lm = await getLandmarker()
  const found = []
  const collect = (res, w, h, ox, oy, cx, cy) =>
    res.faceLandmarks.forEach((f) => {
      const face = toFace(f, w, h, ox, oy)
      // Faces cut by a crop edge have poor landmarks, so prefer the crop where the face sits most centrally.
      found.push({ ...face, off: Math.hypot(face.eyes.x - (ox + cx), face.eyes.y - (oy + cy)) / w })
    })
  collect(lm.detect(shot), shot.width, shot.height, 0, 0, shot.width / 2, shot.height / 2)
  const crop = document.createElement('canvas')
  for (const t of tiles(shot.width, shot.height)) {
    crop.width = crop.height = t.size
    crop.getContext('2d').drawImage(shot, t.x, t.y, t.size, t.size, 0, 0, t.size, t.size)
    await breathe()
    collect(lm.detect(crop), t.size, t.size, t.x, t.y, t.size / 2, t.size / 2)
  }
  const faces = dedupe(found)
    .filter((f) => f.width > 0)
    .sort((a, b) => a.eyes.x - b.eyes.x)
    .slice(0, MAX_FACES)
  cache.set(shot, faces)
  return faces
}

// Maps a point in shot pixels to layout coordinates, mirroring drawCover in compose.js.
export function shotToLayout(shot, slot, photo, pt) {
  const k = Math.max(slot.w / shot.width, slot.h / shot.height) * photo.zoom
  const dw = shot.width * k
  const dh = shot.height * k
  return {
    k,
    x: slot.x + (slot.w - dw) / 2 + photo.ox * slot.w + pt.x * k,
    y: slot.y + (slot.h - dh) / 2 + photo.oy * slot.h + pt.y * k,
  }
}

// Returns { x, y, size, rot } (x/y/size as fractions of layout W) for one face sticker.
// aspect is image height / width, used to lift hats clear of the forehead.
// part picks which of the face's anchor points to use (0 or 1 for cheeks).
export function placeOnFace(item, face, shot, slot, photo, layout, aspect = 1, part = 0) {
  const at = (pt) => shotToLayout(shot, slot, photo, pt)
  const eyes = at(face.eyes)
  const w = (item.anchor === 'eyes' ? face.eyeSpan : face.width) * eyes.k * item.width
  const up = { x: Math.sin(face.roll), y: -Math.cos(face.roll) }
  const lift = (p, d) => ({ x: p.x + up.x * d, y: p.y + up.y * d })
  let { x, y } = eyes
  if (item.anchor === 'top') ({ x, y } = lift(at(face.forehead), w * aspect * 0.4))
  else if (item.anchor === 'cheeks') ({ x, y } = at(face.cheeks[part]))
  else if (item.anchor === 'nose') ({ x, y } = at(face.nose))
  else if (item.anchor === 'mustache') ({ x, y } = at(face.mustache))
  else if (item.anchor === 'beard') {
    // Hang the beard from the mouth: its top edge sits at the lips, the bulk covers the chin.
    const m = at(face.mouth)
    const c = at(face.chin)
    ;({ x, y } = { x: (m.x + c.x) / 2 - up.x * w * aspect * 0.12, y: (m.y + c.y) / 2 - up.y * w * aspect * 0.12 })
  } else if (item.anchor === 'freckles') ({ x, y } = lift(at(face.nose), w * aspect * 0.15))
  return { x: x / layout.W, y: y / layout.H, size: w / layout.W, rot: face.roll }
}

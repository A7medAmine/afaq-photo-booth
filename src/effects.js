import { scaledCopy } from './compose.js'

// Photo effects that change the shot's own pixels: big or tiny heads, and Naruto's shadow clones.
// They run before frames, filters and stickers, so everything else is drawn on the changed shot.
// Face positions are moved the same way, so face stickers still land on the right spot.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

function canvasOf(src) {
  const c = document.createElement('canvas')
  c.width = src.width
  c.height = src.height
  c.getContext('2d').drawImage(src, 0, 0)
  return c
}

// How much each head is scaled. The middle of the warp area is scaled evenly (the whole head),
// then it eases back to the untouched photo by the area's edge, so there is no seam.
export const HEAD_SIZES = { big: 1.45, tiny: 0.68 }
const EVEN = 0.4

// For a pixel at radius u (0 at the head's centre, 1 at the warp area's edge) in the result,
// the radius to read from in the original.
const sourceRadius = (u, m) => u * (1 / m + (1 - 1 / m) * smooth(EVEN, 1, u))

// The inverse: where a point at source radius u ends up. sourceRadius only grows, so halving works.
function resultRadius(u, m) {
  let lo = 0
  let hi = 1
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (sourceRadius(mid, m) < u) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

// The head (with hair) sits a little above the nose; the warp area is twice its size, tilted with the face.
function headArea(face) {
  const rx = face.width * 1.5
  return { c: lerp(face.nose, face.forehead, 0.3), rx, ry: rx * 1.2, cos: Math.cos(face.roll), sin: Math.sin(face.roll) }
}

function warpHead(canvas, face, m) {
  const a = headArea(face)
  const reach = Math.max(a.rx, a.ry)
  const x0 = Math.max(0, Math.floor(a.c.x - reach))
  const y0 = Math.max(0, Math.floor(a.c.y - reach))
  const x1 = Math.min(canvas.width, Math.ceil(a.c.x + reach))
  const y1 = Math.min(canvas.height, Math.ceil(a.c.y + reach))
  const w = x1 - x0
  const h = y1 - y0
  if (w < 2 || h < 2) return
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const src = ctx.getImageData(x0, y0, w, h)
  const out = new ImageData(new Uint8ClampedArray(src.data), w, h)
  const s = src.data
  const d = out.data
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x + x0 - a.c.x
      const dy = y + y0 - a.c.y
      // Into the face's own axes, then scaled so the area's edge is at radius 1.
      const lx = (dx * a.cos + dy * a.sin) / a.rx
      const ly = (-dx * a.sin + dy * a.cos) / a.ry
      const u = Math.hypot(lx, ly)
      if (u >= 1 || u === 0) continue
      const k = sourceRadius(u, m) / u
      const sx = clamp(a.c.x + (lx * k * a.rx * a.cos - ly * k * a.ry * a.sin) - x0, 0, w - 1.001)
      const sy = clamp(a.c.y + (lx * k * a.rx * a.sin + ly * k * a.ry * a.cos) - y0, 0, h - 1.001)
      const ix = sx | 0
      const iy = sy | 0
      const fx = sx - ix
      const fy = sy - iy
      const i00 = (iy * w + ix) * 4
      const i10 = i00 + 4
      const i01 = i00 + w * 4
      const i11 = i01 + 4
      const o = (y * w + x) * 4
      for (let c = 0; c < 3; c++) {
        d[o + c] = (s[i00 + c] * (1 - fx) + s[i10 + c] * fx) * (1 - fy) + (s[i01 + c] * (1 - fx) + s[i11 + c] * fx) * fy
      }
    }
  }
  ctx.putImageData(out, x0, y0)
}

// Where a point of the original photo lands after the head warp.
function warpPoint(face, m) {
  const a = headArea(face)
  return (p) => {
    const dx = p.x - a.c.x
    const dy = p.y - a.c.y
    const lx = (dx * a.cos + dy * a.sin) / a.rx
    const ly = (-dx * a.sin + dy * a.cos) / a.ry
    const u = Math.hypot(lx, ly)
    if (u >= 1 || u === 0) return p
    const k = resultRadius(u, m) / u
    return { x: a.c.x + lx * k * a.rx * a.cos - ly * k * a.ry * a.sin, y: a.c.y + lx * k * a.rx * a.sin + ly * k * a.ry * a.cos }
  }
}

// Moves every landmark of a face; its sizes follow the change in distance between the eyes.
function mapFace(face, move, extra) {
  const eyePair = face.eyePair.map(move)
  const k = dist(eyePair[0], eyePair[1]) / (dist(face.eyePair[0], face.eyePair[1]) || 1)
  return {
    ...face,
    ...extra,
    eyes: move(face.eyes),
    forehead: move(face.forehead),
    chin: move(face.chin),
    nose: move(face.nose),
    mustache: move(face.mustache),
    mouth: move(face.mouth),
    cheeks: face.cheeks.map(move),
    eyePair,
    eyeSpan: face.eyeSpan * k,
    width: face.width * k,
  }
}

// Faces found on the editor's smaller copy, moved onto a shot k times bigger.
export const scaleFaces = (faces, k) => (faces || []).map((f) => mapFace(f, (p) => ({ x: p.x * k, y: p.y * k })))

let segmenter = null

function getSegmenter() {
  segmenter ||= import('@mediapipe/tasks-vision').then(async ({ ImageSegmenter, FilesetResolver }) => {
    const fileset = await FilesetResolver.forVisionTasks('/mediapipe')
    return ImageSegmenter.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: '/mediapipe/selfie_segmenter.tflite', delegate: 'CPU' },
      runningMode: 'IMAGE',
      outputCategoryMask: false,
      outputConfidenceMasks: true,
    })
  })
  segmenter.catch(() => { segmenter = null })
  return segmenter
}

// The people in a shot, as a small canvas whose alpha is how sure the model is that each pixel is a
// person, plus the box around them in shot pixels.
async function peopleMask(shot) {
  const seg = await getSegmenter()
  const res = seg.segment(scaledCopy(shot, 512))
  try {
    const masks = res.confidenceMasks || []
    // A one-class model gives the person mask alone; a two-class one puts the background first.
    const mask = masks[masks.length - 1]
    if (!mask) return null
    const conf = mask.getAsFloat32Array()
    const { width: w, height: h } = mask
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')
    const img = ctx.createImageData(w, h)
    let minX = w
    let minY = h
    let maxX = -1
    let maxY = -1
    for (let i = 0; i < conf.length; i++) {
      img.data[i * 4 + 3] = smooth(0.3, 0.7, conf[i]) * 255
      if (conf[i] > 0.5) {
        const x = i % w
        const y = (i / w) | 0
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
    if (maxX < 0) return null
    ctx.putImageData(img, 0, 0)
    const kx = shot.width / w
    const ky = shot.height / h
    return { canvas: c, box: { x: minX * kx, y: minY * ky, w: (maxX - minX + 1) * kx, h: (maxY - minY + 1) * ky } }
  } finally {
    res.close()
  }
}

// Clones stand beside the guests, a little smaller as if further back. Listed back to front;
// dx is in clone spacings from the guests' middle, s their scale.
export const CLONE_COUNTS = [0, 2, 4]
const CLONE_SPOTS = {
  2: [{ dx: -1, s: 0.86 }, { dx: 1, s: 0.86 }],
  4: [{ dx: -1.7, s: 0.7 }, { dx: 1.7, s: 0.7 }, { dx: -0.95, s: 0.86 }, { dx: 0.95, s: 0.86 }],
}

async function addClones(canvas, faces, count) {
  const found = await peopleMask(canvas)
  if (!found) return { faces }
  const { W, H } = { W: canvas.width, H: canvas.height }
  const people = document.createElement('canvas')
  people.width = W
  people.height = H
  const p = people.getContext('2d')
  p.imageSmoothingQuality = 'high'
  // A slight blur softens the cut-out edge.
  p.filter = `blur(${Math.max(1, W / 900)}px)`
  p.drawImage(found.canvas, 0, 0, W, H)
  p.filter = 'none'
  p.globalCompositeOperation = 'source-in'
  p.drawImage(canvas, 0, 0)

  const { box } = found
  const cx = box.x + box.w / 2
  const base = box.y + box.h
  const spots = CLONE_SPOTS[count] || []
  // Close-ups fill the frame, so the spacing shrinks until the outermost clones' middles are in the picture.
  const reach = Math.max(...spots.map((s) => Math.abs(s.dx)))
  const gap = Math.min(clamp(box.w * 0.62, W * 0.18, W * 0.42), (W * 0.44) / reach)
  const ctx = canvas.getContext('2d')
  const clones = []
  for (const spot of spots) {
    const ox = cx + spot.dx * gap
    // Scaled about the bottom of the guests, so their feet (or the bottom of the photo) stay put.
    ctx.drawImage(people, ox - cx * spot.s, base - base * spot.s, W * spot.s, H * spot.s)
    const move = (pt) => ({ x: ox + (pt.x - cx) * spot.s, y: base + (pt.y - base) * spot.s })
    faces.forEach((f) => clones.push(mapFace(f, move, { clone: true })))
  }
  // The guests themselves go back on top of their clones.
  ctx.drawImage(people, 0, 0)
  return { faces: [...faces, ...clones.filter((f) => f.eyes.x > 0 && f.eyes.x < W && f.eyes.y > 0 && f.eyes.y < H)], front: people }
}

// Returns the changed shot and its faces, or the same ones when there is nothing to do.
// warp: 'big' or 'tiny' per face (by index), clones: how many copies of the guests to add.
// With clones, front is the guests cut out of the shot: compose.js draws it over the clones' face
// stickers, so a clone's headband never covers the real guest standing in front of it.
export async function applyEffects(shot, faces = [], { warp = [], clones = 0 } = {}) {
  const heads = faces.map((f, i) => HEAD_SIZES[warp[i]]).map((m, i) => m && { m, face: faces[i] }).filter(Boolean)
  if (!heads.length && !clones) return { shot, faces }
  const canvas = canvasOf(shot)
  let moved = faces
  let front = null
  for (const { m, face } of heads) {
    // Earlier warps may have moved this face; use where it is now.
    const now = moved[faces.indexOf(face)]
    warpHead(canvas, now, m)
    const move = warpPoint(now, m)
    moved = moved.map((f) => mapFace(f, move))
  }
  if (clones) {
    try {
      ;({ faces: moved, front = null } = await addClones(canvas, moved, clones))
    } catch { /* no clones without the segmentation model */ }
  }
  return { shot: canvas, faces: moved, front }
}

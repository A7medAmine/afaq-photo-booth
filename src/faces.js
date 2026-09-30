import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { loadImage } from './compose.js'

export const FACE_STICKERS = [
  { id: 'f-tophat', anchor: 'top', src: '/assets/emoji/1f3a9.png', width: 1.1 },
  { id: 'f-crown', anchor: 'top', src: '/assets/emoji/1f451.png', width: 0.95 },
  { id: 'f-cap', anchor: 'top', src: '/assets/emoji/1f9e2.png', width: 1.15 },
  { id: 'f-bow', anchor: 'top', src: '/assets/emoji/1f380.png', width: 0.7 },
  { id: 'f-glasses', anchor: 'eyes', src: '/assets/emoji/1f453.png', width: 1.45 },
  { id: 'f-shades', anchor: 'eyes', src: '/assets/emoji/1f576-fe0f.png', width: 1.45 },
]

const MAX_FACES = 6
const cache = new WeakMap()
let landmarker = null

function getLandmarker() {
  landmarker ||= FilesetResolver.forVisionTasks('/mediapipe').then((fileset) =>
    FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: '/mediapipe/face_landmarker.task' },
      runningMode: 'IMAGE',
      numFaces: MAX_FACES,
    }),
  )
  return landmarker
}

export function warmUpFaces() {
  FACE_STICKERS.forEach((s) => loadImage(s.src))
  getLandmarker().catch(() => { landmarker = null })
}

const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

function toFace(lm, w, h) {
  const p = (i) => ({ x: lm[i].x * w, y: lm[i].y * h })
  const left = p(33)
  const right = p(263)
  return {
    roll: Math.atan2(right.y - left.y, right.x - left.x),
    eyes: mid(left, right),
    eyeSpan: dist(left, right),
    forehead: p(10),
    width: dist(p(234), p(454)),
  }
}

export async function detectFaces(shot) {
  if (cache.has(shot)) return cache.get(shot)
  const lm = await getLandmarker()
  const res = lm.detect(shot)
  const faces = res.faceLandmarks
    .map((f) => toFace(f, shot.width, shot.height))
    .sort((a, b) => a.eyes.x - b.eyes.x)
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
export function placeOnFace(item, face, shot, slot, photo, layout, aspect = 1) {
  const eyes = shotToLayout(shot, slot, photo, face.eyes)
  const forehead = shotToLayout(shot, slot, photo, face.forehead)
  const w = (item.anchor === 'eyes' ? face.eyeSpan : face.width) * eyes.k * item.width
  let { x, y } = eyes
  if (item.anchor === 'top') {
    const lift = w * aspect * 0.4
    x = forehead.x + Math.sin(face.roll) * lift
    y = forehead.y - Math.cos(face.roll) * lift
  }
  return { x: x / layout.W, y: y / layout.H, size: w / layout.W, rot: face.roll }
}

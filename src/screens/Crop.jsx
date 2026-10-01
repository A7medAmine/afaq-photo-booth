import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n.jsx'

const MAX_ZOOM = 4
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// The photo slot has a fixed shape, so the crop box keeps the slot's aspect ratio.
// Crop box (centre + width, in source pixels) <-> stored photo { zoom, ox, oy }.
function geometry(shot, slot) {
  const cover = Math.max(slot.w / shot.width, slot.h / shot.height)
  return { cover, aspect: slot.w / slot.h, maxW: slot.w / cover }
}

function fromPhoto(shot, slot, photo) {
  const { cover, aspect } = geometry(shot, slot)
  const k = cover * photo.zoom
  const w = slot.w / k
  return { w, h: w / aspect, cx: shot.width / 2 - (photo.ox * slot.w) / k, cy: shot.height / 2 - (photo.oy * slot.h) / k }
}

function toPhoto(shot, slot, box) {
  const { cover } = geometry(shot, slot)
  const k = slot.w / box.w
  return { zoom: Math.round((k / cover) * 1000) / 1000, ox: ((shot.width / 2 - box.cx) * k) / slot.w, oy: ((shot.height / 2 - box.cy) * k) / slot.h }
}

const CORNERS = [
  ['tl', -1, -1],
  ['tr', 1, -1],
  ['bl', -1, 1],
  ['br', 1, 1],
]

export default function Crop({ shot, slot, photo, onCancel, onDone }) {
  const { t } = useI18n()
  const canvasRef = useRef(null)
  const boardRef = useRef(null)
  const drag = useRef(null)
  const { aspect, maxW } = geometry(shot, slot)
  const minW = maxW / MAX_ZOOM
  const [box, setBox] = useState(() => fromPhoto(shot, slot, photo))

  useEffect(() => {
    const c = canvasRef.current
    c.width = shot.width
    c.height = shot.height
    c.getContext('2d').drawImage(shot, 0, 0)
  }, [shot])

  const toSource = (ev) => {
    const r = boardRef.current.getBoundingClientRect()
    return { x: ((ev.clientX - r.left) / r.width) * shot.width, y: ((ev.clientY - r.top) / r.height) * shot.height }
  }

  const place = (cx, cy, w) => {
    const h = w / aspect
    return { w, h, cx: clamp(cx, w / 2, shot.width - w / 2), cy: clamp(cy, h / 2, shot.height - h / 2) }
  }

  const start = (ev, corner) => {
    ev.preventDefault()
    ev.stopPropagation()
    boardRef.current.setPointerCapture(ev.pointerId)
    const p = toSource(ev)
    if (corner) {
      const [, sx, sy] = corner
      drag.current = { mode: 'size', sx, sy, ax: box.cx - (sx * box.w) / 2, ay: box.cy - (sy * box.h) / 2 }
    } else {
      drag.current = { mode: 'move', dx: p.x - box.cx, dy: p.y - box.cy }
    }
  }

  const move = (ev) => {
    const d = drag.current
    if (!d) return
    const p = toSource(ev)
    if (d.mode === 'move') {
      setBox((b) => place(p.x - d.dx, p.y - d.dy, b.w))
      return
    }
    const roomX = d.sx > 0 ? shot.width - d.ax : d.ax
    const roomY = d.sy > 0 ? shot.height - d.ay : d.ay
    const want = Math.max((p.x - d.ax) * d.sx, (p.y - d.ay) * d.sy * aspect)
    const w = clamp(want, minW, Math.min(maxW, roomX, roomY * aspect))
    setBox({ w, h: w / aspect, cx: d.ax + (d.sx * w) / 2, cy: d.ay + (d.sy * w) / aspect / 2 })
  }

  const end = () => {
    drag.current = null
  }

  const pct = (v, total) => `${(v / total) * 100}%`

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={t('crop.title')}>
      <div className="crop-card">
        <h2>{t('crop.title')}</h2>
        <p className="hint">{t('crop.hint')}</p>
        <div className="crop-board" ref={boardRef} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
          <canvas ref={canvasRef} className="crop-img" />
          <div
            className="crop-box"
            style={{ left: pct(box.cx - box.w / 2, shot.width), top: pct(box.cy - box.h / 2, shot.height), width: pct(box.w, shot.width), height: pct(box.h, shot.height) }}
            onPointerDown={(ev) => start(ev, null)}
          >
            {CORNERS.map((c) => (
              <span key={c[0]} className={`crop-handle ${c[0]}`} onPointerDown={(ev) => start(ev, c)} />
            ))}
          </div>
        </div>
        <div className="crop-foot">
          <button className="btn btn-ghost" onClick={() => setBox(place(shot.width / 2, shot.height / 2, maxW))}>{t('crop.reset')}</button>
          <button className="btn btn-ghost" onClick={onCancel}>{t('cap.cancel')}</button>
          <button className="btn btn-sun big" onClick={() => onDone(toPhoto(shot, slot, box))}>{t('crop.apply')}</button>
        </div>
      </div>
    </div>
  )
}

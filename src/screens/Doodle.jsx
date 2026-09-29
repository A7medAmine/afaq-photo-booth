import { useCallback, useEffect, useRef, useState } from 'react'
import ColorSwatches from './ColorSwatches.jsx'
import ToolIcon from './ToolIcon.jsx'
import { OPEN_SHAPES, SHAPES, shapePath } from '../shapes.js'

const SIZE = 800
const COLORS = ['#030a2e', '#ffffff', '#ff5fa2', '#ffd23f', '#2ee6a6', '#3ca2fa', '#2460e7', '#ff8a3d']
const BRUSHES = [8, 18, 36]
const MIN_ZOOM = 1
const MAX_ZOOM = 6

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Bucket: fills the connected region under (x, y). Existing ink is composited over the
// fill so anti-aliased edges keep their colour and no light halo is left around a path.
function floodFill(ctx, x, y, hex) {
  const img = ctx.getImageData(0, 0, SIZE, SIZE)
  const d = img.data
  const sx = clamp(Math.floor(x), 0, SIZE - 1)
  const sy = clamp(Math.floor(y), 0, SIZE - 1)
  const s0 = (sy * SIZE + sx) * 4
  const [sr, sg, sb, sa] = [d[s0], d[s0 + 1], d[s0 + 2], d[s0 + 3]]
  const [fr, fg, fb] = hexToRgb(hex)
  const seedClear = sa < 40
  if (!seedClear && sa === 255 && sr === fr && sg === fg && sb === fb) return

  const match = (i) => {
    const a = d[i + 3]
    if (seedClear) return a <= 200
    return Math.abs(d[i] - sr) <= 40 && Math.abs(d[i + 1] - sg) <= 40 && Math.abs(d[i + 2] - sb) <= 40 && Math.abs(a - sa) <= 40
  }

  const seen = new Uint8Array(SIZE * SIZE)
  const stack = new Int32Array(SIZE * SIZE)
  let top = 0
  stack[top++] = sy * SIZE + sx
  seen[sy * SIZE + sx] = 1
  const push = (p) => {
    if (!seen[p] && match(p * 4)) {
      seen[p] = 1
      stack[top++] = p
    }
  }
  while (top) {
    const p = stack[--top]
    const px = p % SIZE
    if (px > 0) push(p - 1)
    if (px < SIZE - 1) push(p + 1)
    if (p >= SIZE) push(p - SIZE)
    if (p < SIZE * (SIZE - 1)) push(p + SIZE)
  }
  for (let p = 0; p < seen.length; p++) {
    if (!seen[p]) continue
    const i = p * 4
    const ea = d[i + 3] / 255
    d[i] = Math.round(d[i] * ea + fr * (1 - ea))
    d[i + 1] = Math.round(d[i + 1] * ea + fg * (1 - ea))
    d[i + 2] = Math.round(d[i + 2] * ea + fb * (1 - ea))
    d[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
}

function paintOp(ctx, op) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (op.type === 'fill') {
    floodFill(ctx, op.x, op.y, op.color)
    return
  }
  ctx.globalCompositeOperation = op.erase ? 'destination-out' : 'source-over'
  ctx.strokeStyle = op.color
  ctx.fillStyle = op.color
  ctx.lineWidth = op.size
  if (op.type === 'shape') {
    shapePath(ctx, op.shape, op.x0, op.y0, op.x1, op.y1, op.size)
    if (op.filled && !OPEN_SHAPES.has(op.shape)) ctx.fill()
    ctx.stroke()
  } else {
    const p = op.points
    if (p.length === 1) {
      ctx.beginPath()
      ctx.arc(p[0].x, p[0].y, op.size / 2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.moveTo(p[0].x, p[0].y)
      for (let i = 1; i < p.length - 1; i++) {
        const mx = (p[i].x + p[i + 1].x) / 2
        const my = (p[i].y + p[i + 1].y) / 2
        ctx.quadraticCurveTo(p[i].x, p[i].y, mx, my)
      }
      ctx.lineTo(p[p.length - 1].x, p[p.length - 1].y)
      ctx.stroke()
    }
  }
  ctx.globalCompositeOperation = 'source-over'
}

function cropToContent(canvas) {
  const { data } = canvas.getContext('2d').getImageData(0, 0, SIZE, SIZE)
  let x0 = SIZE
  let y0 = SIZE
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (data[(y * SIZE + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0) return null
  const pad = 12
  x0 = Math.max(0, x0 - pad)
  y0 = Math.max(0, y0 - pad)
  x1 = Math.min(SIZE - 1, x1 + pad)
  y1 = Math.min(SIZE - 1, y1 + pad)
  const out = document.createElement('canvas')
  out.width = x1 - x0 + 1
  out.height = y1 - y0 + 1
  out.getContext('2d').drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height)
  return { url: out.toDataURL('image/png'), width: out.width, height: out.height }
}

export default function Doodle({ colors = [], onAddColor, onCancel, onDone }) {
  const boardRef = useRef(null)
  const canvasRef = useRef(null)
  const committed = useRef(null)
  const current = useRef(null)
  const pointers = useRef(new Map())
  const pinch = useRef(null)
  const pan = useRef(null)
  const tap = useRef(null)
  const viewRef = useRef({ s: 1, tx: 0, ty: 0 })
  const [view, setViewState] = useState(viewRef.current)
  const [ops, setOps] = useState([])
  const [color, setColor] = useState(COLORS[2])
  const [size, setSize] = useState(BRUSHES[1])
  const [tool, setTool] = useState('pen')
  const [shape, setShape] = useState('circle')
  const [filled, setFilled] = useState(true)

  const setView = useCallback((v) => {
    const B = boardRef.current ? boardRef.current.clientWidth : 0
    const s = clamp(v.s, MIN_ZOOM, MAX_ZOOM)
    const next = { s, tx: clamp(v.tx, B - B * s, 0), ty: clamp(v.ty, B - B * s, 0) }
    viewRef.current = next
    setViewState(next)
  }, [])

  const zoomAt = useCallback(
    (cx, cy, factor) => {
      const { s, tx, ty } = viewRef.current
      const ns = clamp(s * factor, MIN_ZOOM, MAX_ZOOM)
      const k = ns / s
      setView({ s: ns, tx: cx - (cx - tx) * k, ty: cy - (cy - ty) * k })
    },
    [setView],
  )

  const zoomCenter = (factor) => {
    const B = boardRef.current.clientWidth
    zoomAt(B / 2, B / 2, factor)
  }

  const live = useCallback(() => {
    const ctx = canvasRef.current.getContext('2d')
    ctx.clearRect(0, 0, SIZE, SIZE)
    if (committed.current) ctx.drawImage(committed.current, 0, 0)
    if (current.current) paintOp(ctx, current.current)
  }, [])

  useEffect(() => {
    if (!committed.current) {
      committed.current = document.createElement('canvas')
      committed.current.width = SIZE
      committed.current.height = SIZE
    }
    const ctx = committed.current.getContext('2d', { willReadFrequently: true })
    ctx.clearRect(0, 0, SIZE, SIZE)
    ops.forEach((op) => paintOp(ctx, op))
    live()
  }, [ops, live])

  useEffect(() => {
    const el = boardRef.current
    const onWheel = (ev) => {
      ev.preventDefault()
      const r = el.getBoundingClientRect()
      zoomAt(ev.clientX - r.left, ev.clientY - r.top, Math.exp(-ev.deltaY * 0.0015))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  // Canvas coordinates. getBoundingClientRect already includes the zoom transform.
  const pos = (ev) => {
    const r = canvasRef.current.getBoundingClientRect()
    return { x: ((ev.clientX - r.left) / r.width) * SIZE, y: ((ev.clientY - r.top) / r.height) * SIZE }
  }

  const boardPoint = (p) => {
    const r = boardRef.current.getBoundingClientRect()
    return { x: p.x - r.left, y: p.y - r.top }
  }

  const pinchState = () => {
    const [a, b] = [...pointers.current.values()]
    return { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: boardPoint({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }) }
  }

  const down = (ev) => {
    canvasRef.current.setPointerCapture(ev.pointerId)
    pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
    if (pointers.current.size === 2) {
      current.current = null
      tap.current = null
      pan.current = null
      pinch.current = pinchState()
      live()
      return
    }
    if (pointers.current.size > 2) return
    const p = pos(ev)
    if (tool === 'pan') {
      pan.current = { x: ev.clientX, y: ev.clientY }
    } else if (tool === 'fill') {
      tap.current = { id: ev.pointerId, p }
    } else if (tool === 'shape') {
      current.current = { type: 'shape', shape, color, size, filled, x0: p.x, y0: p.y, x1: p.x, y1: p.y }
      live()
    } else {
      current.current = { type: 'stroke', color, size, erase: tool === 'erase', points: [p] }
      live()
    }
  }

  const move = (ev) => {
    if (!pointers.current.has(ev.pointerId)) return
    pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
    if (pinch.current && pointers.current.size === 2) {
      const next = pinchState()
      const prev = pinch.current
      const { s, tx, ty } = viewRef.current
      const ns = clamp(s * (next.dist / prev.dist), MIN_ZOOM, MAX_ZOOM)
      const k = ns / s
      setView({
        s: ns,
        tx: prev.mid.x - (prev.mid.x - tx) * k + (next.mid.x - prev.mid.x),
        ty: prev.mid.y - (prev.mid.y - ty) * k + (next.mid.y - prev.mid.y),
      })
      pinch.current = next
      return
    }
    if (pan.current) {
      const { s, tx, ty } = viewRef.current
      setView({ s, tx: tx + ev.clientX - pan.current.x, ty: ty + ev.clientY - pan.current.y })
      pan.current = { x: ev.clientX, y: ev.clientY }
      return
    }
    const op = current.current
    if (!op) return
    const p = pos(ev)
    if (op.type === 'shape') {
      op.x1 = p.x
      op.y1 = p.y
    } else {
      op.points.push(p)
    }
    live()
  }

  const up = (ev) => {
    pointers.current.delete(ev.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 0) pan.current = null
    if (tap.current && tap.current.id === ev.pointerId) {
      const { p } = tap.current
      tap.current = null
      setOps((o) => [...o, { type: 'fill', x: p.x, y: p.y, color }])
      return
    }
    const op = current.current
    if (!op) return
    current.current = null
    if (op.type === 'shape' && Math.hypot(op.x1 - op.x0, op.y1 - op.y0) < 4) {
      live()
      return
    }
    setOps((o) => [...o, op])
  }

  const finish = () => {
    const result = cropToContent(canvasRef.current)
    if (result) onDone(result)
  }

  const pickTool = (t) => setTool(t)
  const hasInk = ops.some((o) => o.type !== 'stroke' || !o.erase)
  const drawsLine = tool === 'pen' || tool === 'erase' || tool === 'shape'
  const canFill = tool === 'shape' && !OPEN_SHAPES.has(shape)

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Draw a sticker">
      <div className="doodle-card">
        <div className="doodle-board" ref={boardRef}>
          <canvas
            ref={canvasRef}
            width={SIZE}
            height={SIZE}
            className={`doodle-canvas tool-${tool}`}
            style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.s})` }}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            aria-label="Drawing area"
          />
          <div className="zoom-ctl">
            <button className="tool" aria-label="Zoom out" onClick={() => zoomCenter(1 / 1.5)} disabled={view.s <= MIN_ZOOM}>−</button>
            <button className="tool zoom-val" aria-label="Reset zoom" onClick={() => setView({ s: 1, tx: 0, ty: 0 })}>{Math.round(view.s * 100)}%</button>
            <button className="tool" aria-label="Zoom in" onClick={() => zoomCenter(1.5)} disabled={view.s >= MAX_ZOOM}>+</button>
          </div>
        </div>

        <div className="doodle-tools">
          <h2>Draw your sticker</h2>

          <ColorSwatches
            base={COLORS}
            custom={colors}
            value={tool === 'erase' ? null : color}
            onPick={(c) => {
              setColor(c)
              if (tool === 'erase' || tool === 'pan') setTool('pen')
            }}
            onAdd={(c) => {
              onAddColor(c)
              setColor(c)
              if (tool === 'erase' || tool === 'pan') setTool('pen')
            }}
          />

          <div className="tool-grid" role="radiogroup" aria-label="Tool">
            {[
              ['pen', 'Pen'],
              ['fill', 'Fill'],
              ['erase', 'Eraser'],
              ['pan', 'Move'],
            ].map(([id, label]) => (
              <button key={id} role="radio" aria-checked={tool === id} className={`tool ${tool === id ? 'on' : ''}`} onClick={() => pickTool(id)}>
                <span className="tool-icon"><ToolIcon name={id} /></span>
                <span>{label}</span>
              </button>
            ))}
          </div>

          <div className="shape-grid" role="radiogroup" aria-label="Shape">
            {SHAPES.map((s) => (
              <button
                key={s.id}
                role="radio"
                aria-checked={tool === 'shape' && shape === s.id}
                aria-label={s.label}
                title={s.label}
                className={`tool shape ${tool === 'shape' && shape === s.id ? 'on' : ''}`}
                onClick={() => {
                  setShape(s.id)
                  setTool('shape')
                }}
              >
                <ToolIcon name={s.id} size={26} />
              </button>
            ))}
          </div>
          {canFill && (
            <button className={`tool wide ${filled ? 'on' : ''}`} onClick={() => setFilled((f) => !f)} aria-pressed={filled}>
              {filled ? 'Filled shape' : 'Outline only'}
            </button>
          )}

          {drawsLine && (
            <div className="brushes" role="radiogroup" aria-label="Brush size">
              {BRUSHES.map((b) => (
                <button key={b} role="radio" aria-checked={size === b} aria-label={`Brush ${b}`} className={`brush ${size === b ? 'on' : ''}`} onClick={() => setSize(b)}>
                  <span style={{ width: b * 0.9, height: b * 0.9 }} />
                </button>
              ))}
            </div>
          )}

          <div className="doodle-actions">
            <button className="tool wide" onClick={() => setOps((o) => o.slice(0, -1))} disabled={!ops.length}>Undo</button>
            <button className="tool wide" onClick={() => setOps([])} disabled={!ops.length}>Clear</button>
          </div>

          <div className="doodle-foot">
            <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
            <button className="btn btn-sun big" onClick={finish} disabled={!hasInk}>Use sticker</button>
          </div>
        </div>
      </div>
    </div>
  )
}

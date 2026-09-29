import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BUBBLES,
  ICON_MAP,
  FILTERS,
  FRAMES,
  DEFAULT_PHOTO,
  getLayout,
  panLimits,
  STICKERS,
  handlePoints,
  hitTest,
  renderComposite,
  toJpegBlob,
  whenLoaded,
} from '../compose.js'
import Doodle from './Doodle.jsx'
import ColorSwatches from './ColorSwatches.jsx'
import ToolIcon from './ToolIcon.jsx'
import { OPEN_SHAPES, SHAPES } from '../shapes.js'

const TABS = ['Frames', 'Filters', 'Stickers', 'Draw', 'Text', 'Photo']
const INK_COLORS = ['#030a2e', '#ffffff', '#ff5fa2', '#ffd23f', '#2ee6a6', '#3ca2fa', '#2460e7', '#ff8a3d']
const INK_SIZES = [8, 18, 36]

function Icon({ id, color, size = 44 }) {
  const i = ICON_MAP[id]
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={i.path} fill={color || i.color} fillRule="evenodd" stroke="#030a2e" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}
const TEXT_COLORS = ['#ffd23f', '#ff5fa2', '#2ee6a6', '#3ca2fa', '#ffffff', '#ff8a3d']
const fitSize = (len) => clamp(0.62 / (0.34 * (0.62 * len + 1)), 0.08, 0.45)
const uid = () => Math.random().toString(36).slice(2, 9)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

function Mini({ layout, shots, frameId, filterId, caption, width = 96 }) {
  const ref = useRef(null)
  useEffect(() => {
    const { W } = getLayout(layout, shots)
    renderComposite(ref.current, { layout, shots, frameId, filterId, caption, stickers: [] }, { scale: width / W })
  }, [layout, shots, frameId, filterId, caption, width])
  return <canvas ref={ref} className="mini" />
}

export default function Edit({ custom = [], layout, shots, edit, setEdit, onRetake, onFinish }) {
  const [tab, setTab] = useState('Frames')
  const [selectedId, setSelectedId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [customText, setCustomText] = useState('')
  const [textColor, setTextColor] = useState(TEXT_COLORS[0])
  const [inkColor, setInkColor] = useState(INK_COLORS[2])
  const [inkSize, setInkSize] = useState(INK_SIZES[1])
  const [drawTool, setDrawTool] = useState('pen')
  const [shape, setShape] = useState('circle')
  const [filled, setFilled] = useState(true)
  const canvasRef = useRef(null)
  const drag = useRef(null)
  const L = useMemo(() => getLayout(layout, shots), [layout, shots])

  const state = useMemo(() => ({ layout, shots, ...edit }), [layout, shots, edit])

  const [tick, setTick] = useState(0)
  useEffect(() => {
    const bump = () => setTick((t) => t + 1)
    window.addEventListener('resize', bump)
    return () => window.removeEventListener('resize', bump)
  }, [])

  const handleR = () => {
    const w = canvasRef.current.getBoundingClientRect().width || L.W
    return (26 * L.W) / w
  }

  useEffect(() => {
    renderComposite(canvasRef.current, state, { scale: 0.6, selectedId, handleR: handleR() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, selectedId, tick])

  const patchEdit = (p) => setEdit((e) => ({ ...e, ...p }))
  const patchSticker = (id, fn) =>
    setEdit((e) => ({ ...e, stickers: e.stickers.map((s) => (s.id === id ? { ...s, ...fn(s) } : s)) }))

  const addSticker = (base, pos) => {
    const s = {
      ...base,
      id: uid(),
      x: pos ? clamp(pos.x / L.W, 0, 1) : 0.5 + (Math.random() - 0.5) * 0.3,
      y: pos ? clamp(pos.y / L.H, 0, 1) : L.slots[0].y / L.H + 0.15 + Math.random() * 0.15,
      rot: (Math.random() - 0.5) * 0.4,
    }
    setEdit((e) => ({ ...e, stickers: [...e.stickers, s] }))
    setSelectedId(s.id)
  }

  const toLayoutXY = (ev) => {
    const r = canvasRef.current.getBoundingClientRect()
    return { x: ((ev.clientX - r.left) / r.width) * L.W, y: ((ev.clientY - r.top) / r.height) * L.H }
  }

  const onDown = (ev) => {
    const { x, y } = toLayoutXY(ev)
    if (tab === 'Photo') {
      const p = edit.photo || DEFAULT_PHOTO
      drag.current = { mode: 'pan', x, y, ox0: p.ox, oy0: p.oy }
      canvasRef.current.setPointerCapture(ev.pointerId)
      return
    }
    if (tab === 'Draw') {
      const base = { color: inkColor, size: (inkSize * L.W) / 1200 }
      const stroke =
        drawTool === 'shape'
          ? { type: 'shape', shape, filled, ...base, x0: x, y0: y, x1: x, y1: y }
          : { type: 'stroke', erase: drawTool === 'erase', ...base, points: [{ x, y }] }
      setEdit((e) => ({ ...e, ink: [...(e.ink || []), stroke] }))
      drag.current = { mode: 'ink' }
      canvasRef.current.setPointerCapture(ev.pointerId)
      return
    }
    const sel = edit.stickers.find((t) => t.id === selectedId)
    if (sel) {
      const ctx = canvasRef.current.getContext('2d')
      const hp = handlePoints(ctx, sel, L.W, L.H)
      const reach = handleR() * 1.3
      if (Math.hypot(x - hp.del.x, y - hp.del.y) <= reach) return remove()
      if (Math.hypot(x - hp.scale.x, y - hp.scale.y) <= reach) {
        const cx = sel.x * L.W
        const cy = sel.y * L.H
        drag.current = {
          mode: 'scale',
          id: sel.id,
          cx,
          cy,
          d0: Math.hypot(x - cx, y - cy),
          a0: Math.atan2(y - cy, x - cx),
          size0: sel.size,
          rot0: sel.rot,
        }
        canvasRef.current.setPointerCapture(ev.pointerId)
        return
      }
    }
    const id = hitTest(canvasRef.current.getContext('2d'), state, x, y)
    setSelectedId(id)
    if (id) {
      const s = edit.stickers.find((t) => t.id === id)
      drag.current = { id, dx: x - s.x * L.W, dy: y - s.y * L.H }
      canvasRef.current.setPointerCapture(ev.pointerId)
    }
  }
  const onMove = (ev) => {
    if (!drag.current) return
    const { x, y } = toLayoutXY(ev)
    if (drag.current.mode === 'pan') {
      const d = drag.current
      const slot = L.slots[0]
      const zoom = (edit.photo || DEFAULT_PHOTO).zoom
      const { mx, my } = panLimits(shots[0], slot, zoom)
      patchEdit({
        photo: {
          zoom,
          ox: clamp(d.ox0 + (x - d.x) / slot.w, -mx, mx),
          oy: clamp(d.oy0 + (y - d.y) / slot.h, -my, my),
        },
      })
      return
    }
    if (drag.current.mode === 'ink') {
      setEdit((e) => ({
        ...e,
        ink: e.ink.map((s, i) => {
          if (i !== e.ink.length - 1) return s
          return s.type === 'shape' ? { ...s, x1: x, y1: y } : { ...s, points: [...s.points, { x, y }] }
        }),
      }))
      return
    }
    if (drag.current.mode === 'scale') {
      const d = drag.current
      const dist = Math.hypot(x - d.cx, y - d.cy)
      patchSticker(d.id, () => ({
        size: clamp((d.size0 * dist) / Math.max(d.d0, 1), 0.08, 0.9),
        rot: d.rot0 + (Math.atan2(y - d.cy, x - d.cx) - d.a0),
      }))
      return
    }
    const { id, dx, dy } = drag.current
    patchSticker(id, () => ({ x: clamp((x - dx) / L.W, 0, 1), y: clamp((y - dy) / L.H, 0, 1) }))
  }
  const onDropSticker = (ev) => {
    ev.preventDefault()
    try {
      const base = JSON.parse(ev.dataTransfer.getData('application/x-sticker'))
      addSticker(base, toLayoutXY(ev))
    } catch { /* not a sticker */ }
  }
  const dragProps = (base) => ({
    draggable: true,
    onDragStart: (ev) => {
      ev.dataTransfer.setData('application/x-sticker', JSON.stringify(base))
      ev.dataTransfer.effectAllowed = 'copy'
    },
  })
  const onUp = () => {
    if (drag.current && drag.current.mode === 'ink') {
      setEdit((e) => {
        const last = e.ink[e.ink.length - 1]
        return last && last.type === 'shape' && Math.hypot(last.x1 - last.x0, last.y1 - last.y0) < 4 ? { ...e, ink: e.ink.slice(0, -1) } : e
      })
    }
    drag.current = null
  }

  const selected = edit.stickers.find((s) => s.id === selectedId)
  const tweak = (fn) => selected && patchSticker(selected.id, fn)
  const remove = () => {
    setEdit((e) => ({ ...e, stickers: e.stickers.filter((s) => s.id !== selectedId) }))
    setSelectedId(null)
  }
  const toFront = () =>
    setEdit((e) => {
      const s = e.stickers.find((t) => t.id === selectedId)
      return { ...e, stickers: [...e.stickers.filter((t) => t.id !== selectedId), s] }
    })

  const addColor = useCallback(
    (c) => {
      setInkColor(c)
      setEdit((e) => {
        const all = [...INK_COLORS, ...(e.colors || [])]
        return all.includes(c) ? e : { ...e, colors: [...(e.colors || []), c].slice(-10) }
      })
    },
    [setEdit],
  )

  const addText = () => {
    const text = customText.trim()
    if (!text) return
    addSticker({ kind: 'text', text, color: textColor, size: fitSize(text.length) })
    setCustomText('')
  }

  const addDoodle = async ({ url, width }) => {
    await whenLoaded(url)
    const base = { kind: 'img', src: url, size: 0.15 + 0.35 * (width / 800), doodle: true }
    setEdit((e) => ({ ...e, doodles: [...(e.doodles || []), { ...base, id: `d-${uid()}` }] }))
    setDrawing(false)
    addSticker(base)
  }

  const finish = async () => {
    setBusy(true)
    setSelectedId(null)
    onFinish(await toJpegBlob(state))
  }

  return (
    <main className="screen edit">
      <section className="stage">
        <canvas
          ref={canvasRef}
          className={`edit-canvas ${tab === 'Draw' ? 'drawing' : ''} ${tab === 'Photo' ? 'panning' : ''}`}
          style={{ aspectRatio: `${L.W} / ${L.H}`, '--ar': L.W / L.H }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDropSticker}
          aria-label="Your photo. Drag stickers to move them."
        />
        <div className={`sticker-bar ${selected ? 'on' : ''}`} role="toolbar" aria-label="Selected sticker">
          <button className="tool" aria-label="Smaller" onClick={() => tweak((s) => ({ size: clamp(s.size * 0.88, 0.08, 0.9) }))}>−</button>
          <button className="tool" aria-label="Bigger" onClick={() => tweak((s) => ({ size: clamp(s.size * 1.14, 0.08, 0.9) }))}>+</button>
          <button className="tool" aria-label="Turn left" onClick={() => tweak((s) => ({ rot: s.rot - 0.2 }))}>↺</button>
          <button className="tool" aria-label="Turn right" onClick={() => tweak((s) => ({ rot: s.rot + 0.2 }))}>↻</button>
          <button className="tool wide" onClick={toFront}>Bring to front</button>
          <button className="tool danger wide" onClick={remove}>Remove</button>
        </div>
      </section>

      <aside className="panel">
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={`tab ${tab === t ? 'on' : ''}`} onClick={() => {
                setTab(t)
                setSelectedId(null)
              }}>
              {t}
            </button>
          ))}
        </div>

        <div className="panel-body">
          {tab === 'Frames' && (
            <div className="grid minis">
              {FRAMES.map((f) => (
                <button key={f.id} className={`opt ${edit.frameId === f.id ? 'on' : ''}`} onClick={() => patchEdit({ frameId: f.id })}>
                  <Mini layout={layout} shots={shots} caption={edit.caption} filterId={edit.filterId} frameId={f.id} />
                  <span>{f.name}</span>
                </button>
              ))}
            </div>
          )}

          {tab === 'Filters' && (
            <div className="grid minis">
              {FILTERS.map((f) => (
                <button key={f.id} className={`opt ${edit.filterId === f.id ? 'on' : ''}`} onClick={() => patchEdit({ filterId: f.id })}>
                  <Mini layout={layout} shots={shots} caption={edit.caption} frameId={edit.frameId} filterId={f.id} />
                  <span>{f.name}</span>
                </button>
              ))}
            </div>
          )}

          {tab === 'Stickers' && (
            <div className="grid stickers">
              <button className="opt sticker draw-btn" onClick={() => setDrawing(true)}>
                <span className="emoji">✏️</span>
                <span>Draw one</span>
              </button>
              {[...(edit.doodles || []), ...custom, ...STICKERS].map((s) => (
                <button key={s.id} className="opt sticker" {...dragProps(s)} aria-label={`Add ${s.id} sticker`} onClick={() => addSticker(s)}>
                  {s.kind === 'img' ? <img src={s.src} alt="" /> : s.kind === 'icon' ? <Icon id={s.icon} /> : <span className="emoji">{s.value}</span>}
                </button>
              ))}
            </div>
          )}

          {tab === 'Draw' && (
            <div className="draw-tab">
              <p className="hint">Draw right on your photo with your finger.</p>
              <ColorSwatches base={INK_COLORS} custom={edit.colors} value={inkColor} onPick={setInkColor} onAdd={addColor} />
              <div className="tool-grid two" role="radiogroup" aria-label="Tool">
                {[['pen', 'Pen'], ['erase', 'Eraser']].map(([id, label]) => (
                  <button key={id} role="radio" aria-checked={drawTool === id} className={`tool ${drawTool === id ? 'on' : ''}`} onClick={() => setDrawTool(id)}>
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
                    aria-checked={drawTool === 'shape' && shape === s.id}
                    aria-label={s.label}
                    title={s.label}
                    className={`tool shape ${drawTool === 'shape' && shape === s.id ? 'on' : ''}`}
                    onClick={() => {
                      setShape(s.id)
                      setDrawTool('shape')
                    }}
                  >
                    <ToolIcon name={s.id} size={26} />
                  </button>
                ))}
              </div>
              {drawTool === 'shape' && !OPEN_SHAPES.has(shape) && (
                <button className={`tool wide ${filled ? 'on' : ''}`} onClick={() => setFilled((f) => !f)} aria-pressed={filled}>
                  {filled ? 'Filled shape' : 'Outline only'}
                </button>
              )}
              <div className="brushes" role="radiogroup" aria-label="Brush size">
                {INK_SIZES.map((b) => (
                  <button key={b} role="radio" aria-checked={inkSize === b} aria-label={`Brush ${b}`} className={`brush ${inkSize === b ? 'on' : ''}`} onClick={() => setInkSize(b)}>
                    <span style={{ width: b * 0.9, height: b * 0.9 }} />
                  </button>
                ))}
              </div>
              <div className="doodle-actions">
                <button className="tool wide" disabled={!(edit.ink || []).length} onClick={() => patchEdit({ ink: edit.ink.slice(0, -1) })}>Undo</button>
                <button className="tool wide" disabled={!(edit.ink || []).length} onClick={() => patchEdit({ ink: [] })}>Clear drawing</button>
              </div>
            </div>
          )}

          {tab === 'Photo' && (
            <div className="photo-tab">
              <p className="hint">Drag the photo to move it. Zoom in to crop closer.</p>
              <label className="field">
                Zoom
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={(edit.photo || DEFAULT_PHOTO).zoom}
                  onChange={(e) => {
                    const zoom = Number(e.target.value)
                    const p = edit.photo || DEFAULT_PHOTO
                    const { mx, my } = panLimits(shots[0], L.slots[0], zoom)
                    patchEdit({ photo: { zoom, ox: clamp(p.ox, -mx, mx), oy: clamp(p.oy, -my, my) } })
                  }}
                />
              </label>
              <button className="btn btn-ghost" onClick={() => patchEdit({ photo: DEFAULT_PHOTO })}>Show the whole photo</button>
              {layout === 'strip' && <p className="note">Zoom and position apply to all 3 photos.</p>}
            </div>
          )}

          {tab === 'Text' && (
            <div className="text-tab">
              <label className="field">
                Message on the frame (bottom line)
                <input
                  type="text"
                  maxLength={26}
                  value={edit.caption}
                  placeholder="Opening Day + today's date"
                  onChange={(e) => patchEdit({ caption: e.target.value })}
                />
              </label>
              <div className="field">
                Add your own text
                <input
                  type="text"
                  maxLength={30}
                  value={customText}
                  placeholder="Type anything"
                  onChange={(e) => setCustomText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addText()}
                />
              </div>
              <div className="swatches" role="radiogroup" aria-label="Text colour">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c}
                    role="radio"
                    aria-checked={textColor === c}
                    aria-label={`Text colour ${c}`}
                    className={`swatch ${textColor === c ? 'on' : ''}`}
                    style={{ background: c }}
                    onClick={() => setTextColor(c)}
                  />
                ))}
              </div>
              <button className="btn btn-sun" onClick={addText} disabled={!customText.trim()}>Add text to photo</button>
              <p className="hint">Quick speech bubbles</p>
              <div className="bubbles">
                {BUBBLES.map((b) => (
                  <button
                    key={b.text}
                    {...dragProps({ kind: 'text', text: b.text, color: b.color, size: 0.3 })}
                    className="bubble"
                    style={{ background: b.color }}
                    onClick={() => addSticker({ kind: 'text', text: b.text, color: b.color, size: 0.3 })}
                  >
                    {b.text}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="panel-foot">
          <button className="btn btn-ghost" onClick={onRetake} disabled={busy}>Retake</button>
          <button className="btn btn-sun big" onClick={finish} disabled={busy}>{busy ? 'One moment...' : 'Get my photo'}</button>
        </div>
      </aside>
      {drawing && <Doodle colors={edit.colors} onAddColor={addColor} onCancel={() => setDrawing(false)} onDone={addDoodle} />}
    </main>
  )
}

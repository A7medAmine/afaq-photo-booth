import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BUBBLE_COLORS,
  FILTERS,
  FRAMES,
  DEFAULT_PHOTO,
  getLayout,
  STICKERS,
  handlePoints,
  loadImage,
  hitTest,
  renderComposite,
  toJpegBlob,
  whenLoaded,
} from '../compose.js'
import Doodle from './Doodle.jsx'
import Crop from './Crop.jsx'
import ColorSwatches from './ColorSwatches.jsx'
import ToolIcon from './ToolIcon.jsx'
import BrushSize from './BrushSize.jsx'
import { groupOf } from '../customStickers.js'
import { detectFaces, FACE_STICKERS, PARTS, placeOnFace, shotToLayout } from '../faces.js'
import { OPEN_SHAPES, SHAPES } from '../shapes.js'
import { BUBBLE_TEXT, useI18n } from '../i18n.jsx'

const TABS = [['Frames', 'edit.frames'], ['Filters', 'edit.filters'], ['Stickers', 'edit.stickers'], ['Face', 'edit.face'], ['Draw', 'edit.draw'], ['Text', 'edit.text'], ['Photo', 'edit.photo']]
const DEFAULT_GROUP_NAMES = { mine: 'Mine', club: 'Club', faces: 'Faces', fun: 'Fun', tech: 'Tech', cats: 'Cats', memes: 'Memes', music: 'Music', cute: 'Cute', arabic: 'Arabic', objects: 'Objects' }
const INK_COLORS = ['#030a2e', '#ffffff', '#ff5fa2', '#ffd23f', '#2ee6a6', '#3ca2fa', '#2460e7', '#ff8a3d']
const INK_SIZES = [8, 18, 36]
const TEXT_COLORS = ['#ffd23f', '#ff5fa2', '#2ee6a6', '#3ca2fa', '#ffffff', '#ff8a3d']
const fitSize = (len) => clamp(0.62 / (0.34 * (0.62 * len + 1)), 0.08, 0.45)
const uid = () => Math.random().toString(36).slice(2, 9)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const MAX_ZOOM = 5
const ZOOM_STEP = 1.5

function Mini({ layout, shots, frameId, filterId, caption, lang, width = 96 }) {
  const ref = useRef(null)
  useEffect(() => {
    const { W } = getLayout(layout, shots)
    renderComposite(ref.current, { layout, shots, frameId, filterId, caption, lang, stickers: [] }, { scale: width / W })
  }, [layout, shots, frameId, filterId, caption, lang, width])
  return <canvas ref={ref} className="mini" />
}

export default function Edit({ custom = [], faceCustom = [], hidden = [], groups: allGroups = [], assign = {}, layout, shots, edit, setEdit, onRetake, onExit, onFinish }) {
  const { t, lang } = useI18n()
  const [tab, setTab] = useState('Frames')
  const [selectedId, setSelectedId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [cropping, setCropping] = useState(false)
  const [group, setGroup] = useState('all')
  const [customText, setCustomText] = useState('')
  const [textColor, setTextColor] = useState(TEXT_COLORS[0])
  const [inkColor, setInkColor] = useState(INK_COLORS[2])
  const [inkSize, setInkSize] = useState(INK_SIZES[1])
  const [drawTool, setDrawTool] = useState('pen')
  const [shape, setShape] = useState('circle')
  const [filled, setFilled] = useState(true)
  const [faces, setFaces] = useState(null)
  const [who, setWho] = useState([])
  const [showNums, setShowNums] = useState(true)
  const canvasRef = useRef(null)
  const stageRef = useRef(null)
  const boxRef = useRef(null)
  const drag = useRef(null)
  const pointers = useRef(new Map())
  const pinch = useRef(null)
  const [view, setView] = useState({ z: 1, x: 0, y: 0 })
  const [hand, setHand] = useState(false)
  const L = useMemo(() => getLayout(layout, shots), [layout, shots])

  const state = useMemo(() => ({ layout, shots, lang, ...edit }), [layout, shots, lang, edit])

  const [tick, setTick] = useState(0)
  const viewRef = useRef(view)
  viewRef.current = view
  useEffect(() => {
    const bump = () => setTick((t) => t + 1)
    window.addEventListener('resize', bump)
    return () => window.removeEventListener('resize', bump)
  }, [])

  // Zoom is a CSS transform on the canvas, so pointer maths through getBoundingClientRect stays correct.
  const fitView = (z, x, y) => {
    const cv = canvasRef.current
    const w = cv ? cv.offsetWidth : 0
    const h = cv ? cv.offsetHeight : 0
    const zc = clamp(z, 1, MAX_ZOOM)
    return { z: zc, x: clamp(x, w * (1 - zc), 0), y: clamp(y, h * (1 - zc), 0) }
  }
  // Zoom to z keeping the box point (ax, ay) fixed under the finger or cursor.
  const zoomAt = (z, ax, ay) =>
    setView((v) => {
      const zc = clamp(z, 1, MAX_ZOOM)
      const k = zc / v.z
      return fitView(zc, ax - (ax - v.x) * k, ay - (ay - v.y) * k)
    })
  const zoomCenter = (f) => {
    const cv = canvasRef.current
    zoomAt(view.z * f, cv.offsetWidth / 2, cv.offsetHeight / 2)
  }
  const resetView = () => {
    setView({ z: 1, x: 0, y: 0 })
    setHand(false)
  }
  const boxPoint = (ev) => {
    const r = boxRef.current.getBoundingClientRect()
    return { x: ev.clientX - r.left - 5, y: ev.clientY - r.top - 5 }
  }

  useEffect(() => {
    const box = boxRef.current
    const wheel = (ev) => {
      ev.preventDefault()
      const r = box.getBoundingClientRect()
      zoomAt(viewRef.current.z * Math.exp(-ev.deltaY * 0.0015), ev.clientX - r.left - 5, ev.clientY - r.top - 5)
    }
    box.addEventListener('wheel', wheel, { passive: false })
    return () => box.removeEventListener('wheel', wheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setView((v) => fitView(v.z, v.x, v.y))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  const handleR = () => {
    const w = canvasRef.current.getBoundingClientRect().width || L.W
    return (26 * L.W) / w
  }

  // Pointer moves can arrive several times per frame, so paint at most once per frame.
  useEffect(() => {
    const raf = requestAnimationFrame(() =>
      renderComposite(canvasRef.current, state, { scale: view.z > 1.5 ? 1.8 : 0.9, selectedId, handleR: handleR(), cache: true }),
    )
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, selectedId, tick, view.z > 1.5, view.z])

  useEffect(() => {
    let live = true
    Promise.all(L.slots.map((_, i) => detectFaces(shots[i])))
      .then((f) => live && (setFaces(f), setWho([])))
      .catch(() => live && setFaces([]))
    return () => { live = false }
  }, [L, shots])

  const faceItems = useMemo(() => [...FACE_STICKERS.filter((s) => !hidden.includes(s.id)), ...faceCustom], [hidden, faceCustom])
  const placeFace = (item, shot, idx, photo, part = 0) => {
    const img = loadImage(item.src)
    return placeOnFace(item, faces[shot][idx], shots[shot], L.slots[shot], photo, L, img ? img.naturalHeight / img.naturalWidth : 1, part)
  }

  // Face stickers follow the photo when it is zoomed or panned, until the user moves them by hand.
  // The latest items and placer are read through a ref so this only runs when the photo or faces change.
  const latest = useRef({})
  latest.current = { faceItems, placeFace }
  useEffect(() => {
    if (!faces) return
    const photo = edit.photo || DEFAULT_PHOTO
    setEdit((e) => {
      if (!e.stickers.some((s) => s.face)) return e
      return {
        ...e,
        stickers: e.stickers.map((s) => {
          const f = s.face
          const item = f && latest.current.faceItems.find((i) => i.id === f.item)
          return item && faces[f.shot]?.[f.idx] ? { ...s, ...latest.current.placeFace(item, f.shot, f.idx, photo, f.part) } : s
        }),
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edit.photo, faces, setEdit])

  const patchEdit = (p) => setEdit((e) => ({ ...e, ...p }))
  const patchSticker = (id, fn) =>
    setEdit((e) => ({ ...e, stickers: e.stickers.map((s) => (s.id === id ? { ...s, ...fn(s), face: undefined } : s)) }))

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
    pointers.current.set(ev.pointerId, boxPoint(ev))
    canvasRef.current.setPointerCapture(ev.pointerId)
    if (pointers.current.size === 2) {
      // A second finger turns the gesture into pinch-zoom and pan; drop whatever the first finger started.
      if (drag.current?.mode === 'ink') setEdit((e) => ({ ...e, ink: e.ink.slice(0, -1) }))
      drag.current = null
      const [a, b] = [...pointers.current.values()]
      const v = viewRef.current
      pinch.current = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, v }
      return
    }
    if (pointers.current.size > 2) return
    if (hand && view.z > 1) {
      const p = boxPoint(ev)
      drag.current = { mode: 'pan', px: p.x, py: p.y, v: viewRef.current }
      return
    }
    const { x, y } = toLayoutXY(ev)
    if (tab === 'Photo') return
    if (tab === 'Draw') {
      if (drawTool === 'fill') {
        setEdit((e) => ({ ...e, ink: [...(e.ink || []), { type: 'fill', color: inkColor, x, y }] }))
        return
      }
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
    if (pointers.current.has(ev.pointerId)) pointers.current.set(ev.pointerId, boxPoint(ev))
    if (pinch.current) {
      if (pointers.current.size < 2) return
      const [a, b] = [...pointers.current.values()]
      const { d0, mx, my, v } = pinch.current
      const z = clamp(v.z * (Math.hypot(a.x - b.x, a.y - b.y) / d0), 1, MAX_ZOOM)
      const k = z / v.z
      const cx = (a.x + b.x) / 2
      const cy = (a.y + b.y) / 2
      setView(fitView(z, cx - (mx - v.x) * k, cy - (my - v.y) * k))
      return
    }
    if (!drag.current) return
    if (drag.current.mode === 'pan') {
      const { px, py, v } = drag.current
      const p = boxPoint(ev)
      setView(fitView(v.z, v.x + p.x - px, v.y + p.y - py))
      return
    }
    const { x, y } = toLayoutXY(ev)
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
  const onUp = (ev) => {
    pointers.current.delete(ev.pointerId)
    if (pinch.current) {
      if (pointers.current.size < 2) pinch.current = null
      return
    }
    if (drag.current && drag.current.mode === 'ink') {
      setEdit((e) => {
        const last = e.ink[e.ink.length - 1]
        return last && last.type === 'shape' && Math.hypot(last.x1 - last.x0, last.y1 - last.y0) < 4 ? { ...e, ink: e.ink.slice(0, -1) } : e
      })
    }
    drag.current = null
  }

  const visible = STICKERS.filter((s) => !hidden.includes(s.id))
  const mine = [...(edit.doodles || []), ...custom]
  const inGroup = (s, id) => groupOf(s, assign) === id
  const groups = allGroups.filter((g) => [...mine, ...visible].some((s) => inGroup(s, g.id)))
  const active = groups.some((g) => g.id === group) ? group : 'all'
  const shown = active === 'all' ? [...mine, ...visible] : [...mine, ...visible].filter((s) => inGroup(s, active))

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

  // Face stickers go to the chosen people (any number), or to everyone when nobody is chosen.
  const faceKey = (shot, idx) => `${shot}:${idx}`
  const toggleWho = (key) => setWho((w) => (w.includes(key) ? w.filter((k) => k !== key) : [...w, key]))
  const everyone = faces ? faces.flatMap((list, shot) => list.map((_, idx) => ({ shot, idx, key: faceKey(shot, idx) }))) : []
  const faceCount = everyone.length
  const targets = who.length ? everyone.filter((f) => who.includes(f.key)) : everyone
  const inTarget = (s) => s.face && (!who.length || who.includes(faceKey(s.face.shot, s.face.idx)))
  const onFace = (item) => edit.stickers.filter((s) => inTarget(s) && s.face.item === item.id).length
  const toggleFace = (item) => {
    const photo = edit.photo || DEFAULT_PHOTO
    const parts = PARTS[item.anchor] || 1
    const added = onFace(item) === targets.length * parts
    const fresh = added
      ? []
      : targets.flatMap(({ shot, idx }) =>
          Array.from({ length: parts }, (_, part) => ({
            kind: 'img',
            src: item.src,
            flat: item.flat,
            blend: item.blend,
            alpha: item.alpha,
            id: uid(),
            rot: 0,
            face: { shot, idx, item: item.id, part },
            ...placeFace(item, shot, idx, photo, part),
          })),
        )
    setEdit((e) => ({
      ...e,
      stickers: [...e.stickers.filter((s) => !(inTarget(s) && (added ? s.face.item === item.id : faceItems.find((i) => i.id === s.face.item)?.anchor === item.anchor))), ...fresh],
    }))
    setSelectedId(null)
  }
  const clearFaces = () => setEdit((e) => ({ ...e, stickers: e.stickers.filter((s) => !inTarget(s)) }))

  // Numbered badges sit under each face on the photo so one person can be picked by tapping.
  const badges = []
  const cv = canvasRef.current
  const stage = stageRef.current
  if (tab === 'Face' && showNums && faces && cv && stage) {
    const r = cv.getBoundingClientRect()
    const sr = stage.getBoundingClientRect()
    const k = r.width / L.W
    const photo = edit.photo || DEFAULT_PHOTO
    everyone.forEach((f, n) => {
      const face = faces[f.shot][f.idx]
      const c = shotToLayout(shots[f.shot], L.slots[f.shot], photo, { x: (face.eyes.x + face.chin.x) / 2, y: (face.eyes.y + face.chin.y) / 2 })
      const chin = shotToLayout(shots[f.shot], L.slots[f.shot], photo, face.chin)
      const bx = r.left - sr.left + c.x * k
      const by = r.top - sr.top + c.y * k
      const br = boxRef.current.getBoundingClientRect()
      if (bx + sr.left < br.left || bx + sr.left > br.right || by + sr.top < br.top || by + sr.top > br.bottom) return
      badges.push({ ...f, n: n + 1, x: r.left - sr.left + c.x * k, y: r.top - sr.top + c.y * k, d: face.width * c.k * k * 1.5, drop: (chin.y - c.y) * k + 16 })
    })
  }

  const finish = async () => {
    setBusy(true)
    setSelectedId(null)
    onFinish(await toJpegBlob(state))
  }

  return (
    <main className="screen edit">
      <section className="stage" ref={stageRef}>
        <div className="zoom-wrap" style={{ '--ar': L.W / L.H }}>
          <div className="zoom-box" ref={boxRef}>
            <canvas
              ref={canvasRef}
              className={`edit-canvas ${tab === 'Draw' && !hand ? 'drawing' : ''} ${hand && view.z > 1 ? 'hand' : ''}`}
              style={{ aspectRatio: `${L.W} / ${L.H}`, transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDropSticker}
              aria-label={t('edit.canvas')}
            />
          </div>
          <div className="view-ctl">
            <button className="tool" aria-label={t('zoom.in')} disabled={view.z >= MAX_ZOOM} onClick={() => zoomCenter(ZOOM_STEP)}>+</button>
            <button className="tool" aria-label={t('zoom.out')} disabled={view.z <= 1} onClick={() => zoomCenter(1 / ZOOM_STEP)}>−</button>
            {view.z > 1 && (
              <>
                <button className={`tool ${hand ? 'on' : ''}`} aria-label={t('zoom.pan')} aria-pressed={hand} onClick={() => setHand((h) => !h)}>✋</button>
                <button className="tool" aria-label={t('zoom.reset')} onClick={resetView}>⤢</button>
                <span className="view-lvl">{Math.round(view.z * 100)}%</span>
              </>
            )}
          </div>
        </div>
        {badges.map((b) => (
          <div key={b.key} className="face-pick" style={{ left: b.x, top: b.y, width: b.d, height: b.d }}>
            {who.includes(b.key) && <span className="face-ring" />}
            <button className={`face-badge ${who.includes(b.key) ? 'on' : ''}`} aria-pressed={who.includes(b.key)} aria-label={t('face.person', { n: b.n })} style={{ marginTop: b.drop }} onClick={() => toggleWho(b.key)}>{b.n}</button>
          </div>
        ))}
        <div className={`sticker-bar ${selected ? 'on' : ''}`} role="toolbar" aria-label={t('edit.selected')}>
          <button className="tool" aria-label={t('edit.smaller')} onClick={() => tweak((s) => ({ size: clamp(s.size * 0.88, 0.08, 0.9) }))}>−</button>
          <button className="tool" aria-label={t('edit.bigger')} onClick={() => tweak((s) => ({ size: clamp(s.size * 1.14, 0.08, 0.9) }))}>+</button>
          <button className="tool" aria-label={t('edit.turnLeft')} onClick={() => tweak((s) => ({ rot: s.rot - 0.2 }))}>↺</button>
          <button className="tool" aria-label={t('edit.turnRight')} onClick={() => tweak((s) => ({ rot: s.rot + 0.2 }))}>↻</button>
          <button className="tool wide" onClick={toFront}>{t('edit.front')}</button>
          <button className="tool danger wide" onClick={remove}>{t('edit.remove')}</button>
        </div>
      </section>

      <aside className="panel">
        <div className="tabs" role="tablist">
          {TABS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={`tab ${tab === id ? 'on' : ''}`} onClick={() => {
                setTab(id)
                setSelectedId(null)
              }}>
              {t(label)}
            </button>
          ))}
        </div>

        <div className="panel-body">
          {tab === 'Frames' && (
            <div className="grid minis">
              {FRAMES.map((f) => (
                <button key={f.id} className={`opt ${edit.frameId === f.id ? 'on' : ''}`} onClick={() => patchEdit({ frameId: f.id })}>
                  <Mini layout={layout} shots={shots} caption={edit.caption} lang={lang} filterId={edit.filterId} frameId={f.id} />
                  <span>{t(`frame.${f.id}`)}</span>
                </button>
              ))}
            </div>
          )}

          {tab === 'Filters' && (
            <div className="grid minis">
              {FILTERS.map((f) => (
                <button key={f.id} className={`opt ${edit.filterId === f.id ? 'on' : ''}`} onClick={() => patchEdit({ filterId: f.id })}>
                  <Mini layout={layout} shots={shots} caption={edit.caption} lang={lang} frameId={edit.frameId} filterId={f.id} />
                  <span>{t(`filter.${f.id}`)}</span>
                </button>
              ))}
            </div>
          )}

          {tab === 'Stickers' && (
            <div className="grid stickers">
              <button className="opt sticker draw-btn" onClick={() => setDrawing(true)}>
                <span className="emoji">✏️</span>
                <span>{t('edit.drawOne')}</span>
              </button>
              <div className="chips" role="tablist" aria-label={t('edit.groups')}>
                {[{ id: 'all', name: t('edit.all') }, ...groups].map((g) => (
                  <button key={g.id} role="tab" aria-selected={active === g.id} className={`chip ${active === g.id ? 'on' : ''}`} onClick={() => setGroup(g.id)}>
                    {g.id !== 'all' && DEFAULT_GROUP_NAMES[g.id] === g.name ? t(`group.${g.id}`) : g.name}
                  </button>
                ))}
              </div>
              {shown.map((s) => (
                <button key={s.id} className="opt sticker" {...dragProps(s)} aria-label={`${t('edit.addSticker')} ${s.id}`} onClick={() => addSticker(s)}>
                  {s.kind === 'img' ? <img src={s.src} alt="" /> : <span className="emoji">{s.value}</span>}
                </button>
              ))}
            </div>
          )}

          {tab === 'Face' && (
            <div className="face-tab">
              <p className="hint">{t('face.hint')}</p>
              <p className="note" role="status">{!faces ? t('face.looking') : faceCount ? t('face.found', { n: faceCount }) : t('face.none')}</p>
              {faceCount > 1 && (
                <div className="chips" role="group" aria-label={t('face.apply')}>
                  <button aria-pressed={!who.length} className={`chip ${!who.length ? 'on' : ''}`} onClick={() => setWho([])}>{t('face.everyone')}</button>
                  {everyone.map((f, n) => (
                    <button key={f.key} aria-pressed={who.includes(f.key)} className={`chip ${who.includes(f.key) ? 'on' : ''}`} onClick={() => toggleWho(f.key)}>{n + 1}</button>
                  ))}
                </div>
              )}
              <div className="grid stickers">
                {faceItems.map((item) => (
                  <button key={item.id} className={`opt sticker ${targets.length && onFace(item) === targets.length * (PARTS[item.anchor] || 1) ? 'on' : ''}`} disabled={!targets.length} onClick={() => toggleFace(item)}>
                    <img src={item.src} alt="" />
                  </button>
                ))}
              </div>
              {faceCount > 1 && (
                <button className="btn btn-ghost" aria-pressed={!showNums} onClick={() => setShowNums((v) => !v)}>{showNums ? t('face.hideNums') : t('face.showNums')}</button>
              )}
              <button className="btn btn-ghost" disabled={!edit.stickers.some(inTarget)} onClick={clearFaces}>{t('face.clear')}</button>
            </div>
          )}

          {tab === 'Draw' && (
            <div className="draw-tab">
              <p className="hint">{t('edit.drawHint')}</p>
              <ColorSwatches base={INK_COLORS} custom={edit.colors} value={inkColor} onPick={setInkColor} onAdd={addColor} />
              <div className="tool-grid three" role="radiogroup" aria-label={t('edit.tool')}>
                {[['pen', t('edit.pen')], ['fill', t('doodle.fill')], ['erase', t('edit.eraser')]].map(([id, label]) => (
                  <button key={id} role="radio" aria-checked={drawTool === id} className={`tool ${drawTool === id ? 'on' : ''}`} onClick={() => setDrawTool(id)}>
                    <span className="tool-icon"><ToolIcon name={id} /></span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              <div className="shape-grid" role="radiogroup" aria-label={t('edit.shape')}>
                {SHAPES.map((s) => (
                  <button
                    key={s.id}
                    role="radio"
                    aria-checked={drawTool === 'shape' && shape === s.id}
                    aria-label={t(`shape.${s.id}`)}
                    title={t(`shape.${s.id}`)}
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
                  {filled ? t('edit.filled') : t('edit.outline')}
                </button>
              )}
              <BrushSize value={inkSize} onChange={setInkSize} presets={INK_SIZES} />
              <div className="doodle-actions">
                <button className="tool wide" disabled={!(edit.ink || []).length} onClick={() => patchEdit({ ink: edit.ink.slice(0, -1) })}>{t('edit.undo')}</button>
                <button className="tool wide" disabled={!(edit.ink || []).length} onClick={() => patchEdit({ ink: [] })}>{t('edit.clearDrawing')}</button>
              </div>
            </div>
          )}

          {tab === 'Photo' && (
            <div className="photo-tab">
              <p className="hint">{t('edit.panHint')}</p>
              <button className="btn btn-sun" onClick={() => setCropping(true)}>{t('edit.crop')}</button>
              <button className="btn btn-ghost" disabled={!edit.photo || edit.photo.zoom === 1} onClick={() => patchEdit({ photo: DEFAULT_PHOTO })}>{t('edit.whole')}</button>
              {layout === 'strip' && <p className="note">{t('edit.zoomAll')}</p>}
            </div>
          )}

          {tab === 'Text' && (
            <div className="text-tab">
              <label className="field">
                {t('edit.caption')}
                <input
                  type="text"
                  maxLength={26}
                  value={edit.caption}
                  placeholder={t('edit.captionPh')}
                  onChange={(e) => patchEdit({ caption: e.target.value })}
                />
              </label>
              <div className="field">
                {t('edit.ownText')}
                <input
                  type="text"
                  maxLength={30}
                  value={customText}
                  placeholder={t('edit.ownTextPh')}
                  onChange={(e) => setCustomText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addText()}
                />
              </div>
              <div className="swatches" role="radiogroup" aria-label={t('edit.textColor')}>
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c}
                    role="radio"
                    aria-checked={textColor === c}
                    aria-label={`${t('edit.textColor')} ${c}`}
                    className={`swatch ${textColor === c ? 'on' : ''}`}
                    style={{ background: c }}
                    onClick={() => setTextColor(c)}
                  />
                ))}
              </div>
              <button className="btn btn-sun" onClick={addText} disabled={!customText.trim()}>{t('edit.addText')}</button>
              <p className="hint">{t('edit.bubbles')}</p>
              <div className="bubbles">
                {BUBBLE_TEXT[lang].map((text, i) => ({ text, color: BUBBLE_COLORS[i] })).map((b) => (
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
          <button className="btn btn-ghost" onClick={onExit} disabled={busy} aria-label={t('edit.exitLabel')}>{t('edit.exit')}</button>
          <button className="btn btn-ghost" onClick={onRetake} disabled={busy}>{t('edit.retake')}</button>
          <button className="btn btn-sun big" onClick={finish} disabled={busy}>{busy ? t('edit.busy') : t('edit.finish')}</button>
        </div>
      </aside>
      {cropping && (
        <Crop
          shot={shots[0]}
          slot={L.slots[0]}
          photo={edit.photo || DEFAULT_PHOTO}
          onCancel={() => setCropping(false)}
          onDone={(photo) => {
            patchEdit({ photo })
            setCropping(false)
          }}
        />
      )}
      {drawing && <Doodle colors={edit.colors} onAddColor={addColor} onCancel={() => setDrawing(false)} onDone={addDoodle} />}
    </main>
  )
}

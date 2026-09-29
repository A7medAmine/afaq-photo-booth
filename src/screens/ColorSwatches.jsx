import { useRef, useState } from 'react'
import { useI18n } from '../i18n.jsx'

function hsvToHex(h, s, v) {
  const f = (n) => {
    const k = (n + h / 60) % 6
    const c = v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
    return Math.round(c * 255).toString(16).padStart(2, '0')
  }
  return `#${f(5)}${f(3)}${f(1)}`
}

function Picker({ onCancel, onOk }) {
  const { t } = useI18n()
  const [h, setH] = useState(330)
  const [s, setS] = useState(0.85)
  const [v, setV] = useState(1)
  const area = useRef(null)
  const hex = hsvToHex(h, s, v)

  const setFromPointer = (ev) => {
    const r = area.current.getBoundingClientRect()
    setS(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)))
    setV(1 - Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)))
  }

  return (
    <div className="modal picker-modal" role="dialog" aria-modal="true" aria-label="Pick a colour">
      <div className="picker-card">
        <div
          ref={area}
          className="sv-area"
          style={{ '--hue': `hsl(${h}, 100%, 50%)` }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            setFromPointer(e)
          }}
          onPointerMove={(e) => e.buttons && setFromPointer(e)}
        >
          <span className="sv-knob" style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%`, background: hex }} />
        </div>
        <input
          className="hue-range"
          type="range"
          min="0"
          max="359"
          value={h}
          aria-label={t('color.shade')}
          onChange={(e) => setH(Number(e.target.value))}
        />
        <div className="picker-preview">
          <span className="picker-chip" style={{ background: hex }} />
          <span className="picker-hex">{hex}</span>
        </div>
        <div className="picker-actions">
          <button className="btn btn-ghost" onClick={onCancel}>{t('color.cancel')}</button>
          <button className="btn btn-sun" onClick={() => onOk(hex)}>{t('color.ok')}</button>
        </div>
      </div>
    </div>
  )
}

export default function ColorSwatches({ base, custom = [], value, onPick, onAdd, label }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  return (
    <div className="swatches" role="radiogroup" aria-label={label || t('color.label')}>
      {[...base, ...custom].map((c) => (
        <button
          key={c}
          role="radio"
          aria-checked={value === c}
          aria-label={`${label || t('color.label')} ${c}`}
          className={`swatch ${value === c ? 'on' : ''}`}
          style={{ background: c }}
          onClick={() => onPick(c)}
        />
      ))}
      <button className="swatch plus" aria-label={t('color.add')} onClick={() => setOpen(true)}>+</button>
      {open && (
        <Picker
          onCancel={() => setOpen(false)}
          onOk={(hex) => {
            onAdd(hex)
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}

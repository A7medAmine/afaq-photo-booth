import { useI18n } from '../i18n.jsx'

const MIN = 4
const MAX = 64

export default function BrushSize({ value, onChange, presets = [8, 18, 36] }) {
  const { t } = useI18n()
  const clampV = (v) => Math.min(MAX, Math.max(MIN, Math.round(v)))
  const pct = ((value - MIN) / (MAX - MIN)) * 100
  return (
    <div className="brush-size">
      <div className="brush-head">
        <span>{t('edit.brush')}</span>
        <span className="brush-num">{value}</span>
      </div>
      <div className="brush-row">
        <button className="tool" aria-label="-" onClick={() => onChange(clampV(value - 4))} disabled={value <= MIN}>−</button>
        <input
          type="range"
          min={MIN}
          max={MAX}
          step="1"
          value={value}
          aria-label={t('edit.brush')}
          style={{ '--pct': `${pct}%` }}
          onChange={(e) => onChange(clampV(Number(e.target.value)))}
        />
        <button className="tool" aria-label="+" onClick={() => onChange(clampV(value + 4))} disabled={value >= MAX}>+</button>
      </div>
      <div className="brush-preview" aria-hidden="true">
        <span style={{ width: value, height: value }} />
      </div>
      <div className="brushes" role="radiogroup" aria-label={t('edit.brush')}>
        {presets.map((b) => (
          <button key={b} role="radio" aria-checked={value === b} aria-label={`${t('edit.brush')} ${b}`} className={`brush ${value === b ? 'on' : ''}`} onClick={() => onChange(b)}>
            <span style={{ width: b * 0.6, height: b * 0.6 }} />
          </button>
        ))}
      </div>
    </div>
  )
}

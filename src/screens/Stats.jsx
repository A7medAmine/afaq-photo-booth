import { useState } from 'react'
import { FACE_STICKERS } from '../faces.js'
import { translate } from '../i18n.jsx'
import { hourKey, readStats, resetStats } from '../stats.js'

const en = (key) => translate('en', key)
const EFFECT_NAMES = { 'head-big': 'Big head', 'head-tiny': 'Tiny head', clones: 'Shadow clones' }
const LAYOUT_NAMES = { single: 'One big photo', strip: 'Strip of 3' }

// The most used entries of a count map, biggest first.
const top = (map, n = 5) => Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n)

function TopList({ title, map, name }) {
  const rows = top(map)
  const max = rows[0]?.[1] || 1
  return (
    <div className="stats-list">
      <strong>{title}</strong>
      {rows.length ? (
        rows.map(([id, n]) => (
          <div className="stats-bar" key={id}>
            <span>{name(id)}</span>
            <span className="stats-fill" style={{ '--w': n / max }} aria-hidden="true" />
            <b>{n}</b>
          </div>
        ))
      ) : (
        <span className="note">Nothing yet.</span>
      )}
    </div>
  )
}

function faceName(id) {
  const f = FACE_STICKERS.find((s) => s.id === id)
  return f ? id.replace(/^f-/, '').replace(/-/g, ' ') : 'Uploaded sticker'
}

function download(stats) {
  const blob = new Blob([JSON.stringify(stats, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `afaq-booth-stats-${hourKey().replace(' ', '-')}h.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

// Operator view of the event so far: how busy the booth was and what guests liked.
export default function Stats() {
  const [stats, setStats] = useState(readStats)
  const today = hourKey().slice(0, 10)
  const hours = Array.from({ length: 24 }, (_, h) => stats.hours[`${today} ${String(h).padStart(2, '0')}`] || 0)
  const peak = Math.max(...hours)
  const busiest = top(stats.hours, 1)[0]
  const totals = [
    ['Photos finished', stats.photos],
    ['Shots taken', stats.shots],
    ['Retakes', stats.retakes],
    ['Downloads ready (QR)', stats.uploads],
    ['Kept for the club', stats.kept],
    ['Stickers added', stats.stickers],
  ]
  return (
    <div className="field stats" dir="ltr">
      Event stats
      <span className="note">
        Since {new Date(stats.since).toLocaleString()}. Counts only, kept on this computer; no photos or guest details.
      </span>
      <div className="stats-totals">
        {totals.map(([label, n]) => (
          <div key={label}>
            <b>{n}</b>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="stats-hours" aria-label="Photos per hour today">
        {hours.map((n, h) => (
          <div key={h} title={`${h}:00 - ${n} photos`}>
            <span style={{ '--h': peak ? n / peak : 0 }} />
            <small>{h % 3 === 0 ? h : ''}</small>
          </div>
        ))}
      </div>
      <span className="note">
        Photos per hour today.{busiest ? ` Busiest hour so far: ${busiest[0]}:00 with ${busiest[1]} photos.` : ''}
      </span>
      <div className="stats-lists">
        <TopList title="Frames" map={stats.frames} name={(id) => en(`frame.${id}`)} />
        <TopList title="Filters" map={stats.filters} name={(id) => en(`filter.${id}`)} />
        <TopList title="Face stickers" map={stats.faceItems} name={faceName} />
        <TopList title="Layouts" map={stats.layouts} name={(id) => LAYOUT_NAMES[id] || id} />
        <TopList title="Secret themes found" map={stats.themes} name={(id) => en(`group.${id}`)} />
        <TopList title="Effects" map={stats.effects} name={(id) => EFFECT_NAMES[id] || id} />
      </div>
      <div className="row-tight">
        <button className="btn btn-ghost" onClick={() => setStats(readStats())}>Refresh</button>
        <button className="btn btn-ghost" onClick={() => download(stats)}>Download as JSON</button>
        <button
          className="btn btn-ghost"
          onClick={() => {
            if (!window.confirm('Reset all event stats to zero? This cannot be undone.')) return
            resetStats()
            setStats(readStats())
          }}
        >
          Reset stats
        </button>
      </div>
    </div>
  )
}

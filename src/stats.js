// Event stats, kept on this booth computer only: counts, never photos or anything about a guest.
const LS = 'afaq-booth-stats'

const fresh = () => ({
  since: Date.now(),
  // Photos guests finished in the editor, and the shots taken for them.
  photos: 0,
  shots: 0,
  retakes: 0,
  uploads: 0,
  kept: 0,
  layouts: {},
  frames: {},
  filters: {},
  themes: {},
  faceItems: {},
  effects: {},
  stickers: 0,
  // Finished photos per hour, keyed "YYYY-MM-DD HH" in local time.
  hours: {},
})

export function readStats() {
  try {
    return { ...fresh(), ...JSON.parse(localStorage.getItem(LS) || '{}') }
  } catch {
    return fresh()
  }
}

function save(s) {
  try { localStorage.setItem(LS, JSON.stringify(s)) } catch { /* private mode */ }
}

const bump = (map, key, n = 1) => key && (map[key] = (map[key] || 0) + n)
const pad = (n) => String(n).padStart(2, '0')
export const hourKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}`

// count('retakes') adds one; count('shots', 3) adds three.
export function count(key, n = 1) {
  const s = readStats()
  s[key] = (s[key] || 0) + n
  save(s)
}

export function countTheme(theme) {
  const s = readStats()
  bump(s.themes, theme)
  save(s)
}

// One finished photo, from the editor's state.
export function countPhoto({ layout, frameId, filterId, stickers = [], warp = {}, clones = 0 }) {
  const s = readStats()
  s.photos += 1
  bump(s.layouts, layout)
  bump(s.frames, frameId)
  bump(s.filters, filterId)
  bump(s.hours, hourKey())
  s.stickers += stickers.filter((t) => !t.face).length
  new Set(stickers.filter((t) => t.face).map((t) => t.face.item)).forEach((id) => bump(s.faceItems, id))
  new Set(Object.values(warp)).forEach((m) => bump(s.effects, `head-${m}`))
  if (clones) bump(s.effects, 'clones')
  save(s)
}

export function resetStats() {
  save(fresh())
}

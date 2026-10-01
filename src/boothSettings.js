import { useCallback, useState } from 'react'

const LS = 'afaq-booth-session'

// Operator limits for one guest's visit. Counts of 0 switch the feature off.
export const SESSION_DEFAULTS = {
  maxEdits: 1,
  maxExtends: 2,
  extendSeconds: 30,
  doneSeconds: 60,
  editIdleSeconds: 120,
}

export const SESSION_LIMITS = {
  maxEdits: [0, 10],
  maxExtends: [0, 10],
  extendSeconds: [10, 300],
  doneSeconds: [15, 600],
  editIdleSeconds: [30, 900],
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS) || '{}')
    const out = { ...SESSION_DEFAULTS }
    for (const k of Object.keys(out)) {
      const [lo, hi] = SESSION_LIMITS[k]
      if (Number.isFinite(saved[k])) out[k] = Math.min(hi, Math.max(lo, Math.round(saved[k])))
    }
    return out
  } catch {
    return { ...SESSION_DEFAULTS }
  }
}

export function useBoothSettings() {
  const [booth, setBooth] = useState(load)
  const updateBooth = useCallback((patch) => {
    setBooth((b) => {
      const next = { ...b }
      for (const [k, v] of Object.entries(patch)) {
        const [lo, hi] = SESSION_LIMITS[k]
        if (Number.isFinite(v)) next[k] = Math.min(hi, Math.max(lo, Math.round(v)))
      }
      try { localStorage.setItem(LS, JSON.stringify(next)) } catch { /* private mode */ }
      return next
    })
  }, [])
  return { booth, updateBooth }
}

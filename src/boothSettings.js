import { useCallback, useState } from 'react'

const LS = 'afaq-booth-session'

// Operator limits for one guest's visit. Counts of 0 switch the feature off.
export const SESSION_DEFAULTS = {
  maxEdits: 1,
  maxExtends: 2,
  extendSeconds: 30,
  doneSeconds: 60,
  editIdleSeconds: 120,
  countdownSeconds: 3,
  // 1 waits for a 👍 (or a secret sign) before each countdown, 0 starts it straight away.
  gestureShutter: 1,
  gestureWaitSeconds: 10,
  // 1 lets guests pinch with one hand to zoom in and out.
  gestureZoom: 1,
  // 1 draws the tracked hand joints over the preview so guests see what is detected.
  showHandTracking: 0,
  // 1 lets guests on the start screen make a frame with both hands to pick one big photo.
  frameStart: 1,
  // 1 plays sound effects (button taps, countdown, shutter, chimes).
  sound: 1,
  // 1 shows a pose challenge ("superhero pose", "group hug"...) before each shot.
  posePrompts: 1,
}

export const SESSION_LIMITS = {
  maxEdits: [0, 10],
  maxExtends: [0, 10],
  extendSeconds: [10, 300],
  doneSeconds: [15, 600],
  editIdleSeconds: [30, 900],
  countdownSeconds: [3, 10],
  gestureShutter: [0, 1],
  gestureWaitSeconds: [3, 60],
  gestureZoom: [0, 1],
  showHandTracking: [0, 1],
  frameStart: [0, 1],
  sound: [0, 1],
  posePrompts: [0, 1],
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

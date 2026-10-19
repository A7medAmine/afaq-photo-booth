import { useEffect, useRef, useState } from 'react'

// Calls onIdle after ms without a tap or key press. Returns the seconds left once the
// last warnMs are running, otherwise null, so the screen can ask "still there?".
export function useIdle(active, ms, onIdle, warnMs = 0) {
  const [left, setLeft] = useState(null)
  const fired = useRef(false)
  useEffect(() => {
    setLeft(null)
    fired.current = false
    if (!active) return
    let last = Date.now()
    let warned = false
    const bump = () => {
      last = Date.now()
      fired.current = false
      if (warned) {
        warned = false
        setLeft(null)
      }
    }
    const t = setInterval(() => {
      const remain = ms - (Date.now() - last)
      if (remain <= 0) {
        if (!fired.current) {
          fired.current = true
          onIdle()
        }
        return
      }
      if (warnMs && remain <= warnMs) {
        warned = true
        setLeft(Math.ceil(remain / 1000))
      }
    }, 500)
    window.addEventListener('pointerdown', bump)
    window.addEventListener('keydown', bump)
    return () => {
      clearInterval(t)
      window.removeEventListener('pointerdown', bump)
      window.removeEventListener('keydown', bump)
    }
  }, [active, ms, onIdle, warnMs])
  return left
}

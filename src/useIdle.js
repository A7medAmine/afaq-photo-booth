import { useEffect } from 'react'

export function useIdle(active, ms, onIdle) {
  useEffect(() => {
    if (!active) return
    let t = setTimeout(onIdle, ms)
    const bump = () => {
      clearTimeout(t)
      t = setTimeout(onIdle, ms)
    }
    window.addEventListener('pointerdown', bump)
    window.addEventListener('keydown', bump)
    return () => {
      clearTimeout(t)
      window.removeEventListener('pointerdown', bump)
      window.removeEventListener('keydown', bump)
    }
  }, [active, ms, onIdle])
}

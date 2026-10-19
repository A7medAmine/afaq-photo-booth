import { useEffect, useState } from 'react'
import { checkPin, getPinLength } from '../pin.js'
import { sfx } from '../sound.js'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'clear']

export default function PinPad({ onCancel, onUnlock }) {
  const [value, setValue] = useState('')
  const [wrong, setWrong] = useState(false)
  const [checking, setChecking] = useState(false)
  const [fails, setFails] = useState(0)
  const [lockedUntil, setLockedUntil] = useState(0)
  const [now, setNow] = useState(Date.now())
  const locked = lockedUntil > now
  const pinLen = getPinLength()

  useEffect(() => {
    if (!locked) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [locked])

  useEffect(() => {
    if (value.length < pinLen || checking) return
    let cancelled = false
    setChecking(true)
    checkPin(value).then((ok) => {
      if (cancelled) return
      setChecking(false)
      if (ok) {
        sfx.success()
        onUnlock()
        return
      }
      setWrong(true)
      sfx.error()
      const f = fails + 1
      setFails(f)
      if (f >= 5) {
        setLockedUntil(Date.now() + 30000)
        setNow(Date.now())
        setFails(0)
      }
      setTimeout(() => {
        if (!cancelled) {
          setValue('')
          setWrong(false)
        }
      }, 600)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const press = (k) => {
    if (locked || wrong || checking) return
    if (k === 'back') setValue((v) => v.slice(0, -1))
    else if (k === 'clear') setValue('')
    else setValue((v) => (v.length < pinLen ? v + k : v))
  }

  return (
    <div className="modal picker-modal" role="dialog" aria-modal="true" aria-label="Enter operator PIN">
      <div className="pin-card">
        <h2>Operator PIN</h2>
        <div className={`pin-dots ${wrong ? 'wrong' : ''}`} aria-live="polite">
          {Array.from({ length: pinLen }).map((_, i) => (
            <span key={i} className={i < value.length ? 'on' : ''} />
          ))}
        </div>
        <p className="pin-msg">
          {locked ? `Too many tries. Wait ${Math.ceil((lockedUntil - now) / 1000)}s.` : wrong ? 'Wrong PIN' : 'Enter the PIN to open settings.'}
        </p>
        <div className="pin-keys">
          {KEYS.map((k) => (
            <button key={k} className="pin-key" disabled={locked || checking} onClick={() => press(k)} aria-label={k === 'back' ? 'Delete' : k === 'clear' ? 'Clear' : k}>
              {k === 'back' ? '\u232B' : k === 'clear' ? 'C' : k}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

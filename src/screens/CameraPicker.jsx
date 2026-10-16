import { useCallback, useEffect, useState } from 'react'
import { listUsbPhones, scanWifiPhones } from '../camera.js'

const USB_STATE = {
  unauthorized: 'Tap Allow on the phone to trust this computer, then search again',
  offline: 'Offline. Unplug the cable and plug it back in',
}

// Labels stay empty until the page has camera permission, so ask once and let go at once.
async function listWebcams() {
  const list = async () => (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput')
  let cams = await list()
  if (cams.length && cams.every((d) => !d.label)) {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      s.getTracks().forEach((t) => t.stop())
      cams = await list()
    } catch { /* keep the unnamed list */ }
  }
  return cams
}

const describe = (h) =>
  [h.camera && `${h.camera} camera`, h.width && `${h.width}x${h.height}`, Number.isFinite(h.battery) && `battery ${Math.round(h.battery)}%`]
    .filter(Boolean)
    .join(', ')

function Section({ title, state, children, empty }) {
  return (
    <section className="cam-section">
      <h3>{title}</h3>
      {state.loading && <p className="note">Searching...</p>}
      {!state.loading && state.error && <p className="note cam-warn">{state.error}</p>}
      {!state.loading && !state.error && !state.items.length && <p className="note">{state.hint || empty}</p>}
      {!state.loading && state.items.length > 0 && <ul className="cam-list">{children}</ul>}
    </section>
  )
}

function Row({ name, detail, warn, inUse, disabled, onChoose }) {
  return (
    <li className={`cam-row${inUse ? ' in-use' : ''}`}>
      <div className="cam-info">
        <strong>{name}</strong>
        {detail && <span className="note">{detail}</span>}
        {warn && <span className="note cam-warn">{warn}</span>}
      </div>
      <button className={`btn ${inUse ? 'btn-sun' : 'btn-ghost'}`} disabled={disabled} onClick={onChoose}>
        {inUse ? 'In use' : 'Use this'}
      </button>
    </li>
  )
}

const idle = { loading: true, items: [], error: '', hint: '' }

export default function CameraPicker({ cam, onClose }) {
  const { settings, update, reconnect } = cam
  const [webcams, setWebcams] = useState(idle)
  const [usb, setUsb] = useState(idle)
  const [wifi, setWifi] = useState(idle)

  const search = useCallback(() => {
    const run = (set, job) => {
      set(idle)
      job.then(
        (r) => set({ ...idle, loading: false, ...r }),
        (e) => set({ ...idle, loading: false, error: e.message }),
      )
    }
    run(setWebcams, listWebcams().then((items) => ({ items })))
    run(setUsb, listUsbPhones().then(({ phones, hint }) => ({ items: phones, hint })))
    run(setWifi, scanWifiPhones().then((items) => ({ items })))
  }, [])

  useEffect(search, [search])

  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const choose = (patch) => {
    const same = Object.entries(patch).every(([k, v]) => settings[k] === v)
    update(patch)
    if (same) reconnect()
    onClose()
  }

  const phone = settings.source === 'phone'
  const searching = webcams.loading || usb.loading || wifi.loading

  return (
    <div className="modal picker-modal" role="dialog" aria-modal="true" aria-label="Choose a camera">
      <div className="modal-card cam-picker">
        <header className="cam-picker-head">
          <h2>Choose a camera</h2>
          <button className="btn btn-sun" onClick={onClose}>✕ Close</button>
        </header>

        <Section title="Phone on USB cable" state={usb} empty="No phone plugged in.">
          {usb.items.map((p) => (
            <Row
              key={p.serial}
              name={p.model}
              detail={p.health ? `Camera app open: ${describe(p.health)}` : p.state === 'device' ? '' : p.serial}
              warn={USB_STATE[p.state] || (p.state === 'device' && !p.health ? 'Camera app not answering. Open it on the phone' : '')}
              disabled={p.state !== 'device'}
              inUse={phone && settings.phoneMode === 'usb' && settings.phoneSerial === p.serial}
              onChoose={() => choose({ source: 'phone', phoneMode: 'usb', phoneSerial: p.serial })}
            />
          ))}
        </Section>

        <Section title="Phone on Wi-Fi or hotspot" state={wifi} empty="No camera app found on this network. Open the app and check both devices share a network.">
          {wifi.items.map((p) => (
            <Row
              key={p.url}
              name={p.self ? 'This computer (fake phone)' : p.health.model || p.health.name || 'AFAQ camera app'}
              detail={`${p.url.replace(/^https?:\/\//, '')} · ${describe(p.health)}`}
              inUse={phone && settings.phoneMode !== 'usb' && settings.phoneUrl === p.url}
              onChoose={() => choose({ source: 'phone', phoneMode: 'wifi', phoneUrl: p.url })}
            />
          ))}
        </Section>

        <Section title="This computer's cameras" state={webcams} empty="No camera found on this computer.">
          {webcams.items.map((d, i) => (
            <Row
              key={d.deviceId || i}
              name={d.label || `Camera ${i + 1}`}
              inUse={!phone && settings.deviceId === d.deviceId}
              onChoose={() => choose({ source: 'device', deviceId: d.deviceId })}
            />
          ))}
        </Section>

        <button className="btn btn-ghost" disabled={searching} onClick={search}>
          {searching ? 'Searching...' : 'Search again'}
        </button>
      </div>
    </div>
  )
}

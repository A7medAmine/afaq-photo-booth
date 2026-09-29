import { useEffect, useState } from 'react'
import VideoView from '../VideoView.jsx'
import { fileToShot, normalizePhoneUrl, testPhone } from '../camera.js'
import { LAYOUTS } from '../compose.js'
import { setPin } from '../pin.js'
import PinPad from './PinPad.jsx'

function Settings({ cam, custom, onClose, onTestFiles }) {
  const { settings, update, devices, error, demo, phoneStatus } = cam
  const [phoneUrl, setPhoneUrl] = useState(settings.phoneUrl)
  const [test, setTest] = useState('')
  const [testing, setTesting] = useState(false)
  useEffect(() => { setTest('') }, [settings.source])
  const runTest = async () => {
    setTesting(true)
    setTest('')
    try {
      const h = await testPhone(phoneUrl, settings.phoneMode === 'usb')
      setTest(`Connected: ${h.camera} camera, ${h.width}x${h.height}`)
    } catch (e) {
      setTest(e.message)
    }
    setTesting(false)
  }
  const statusText = { idle: '', connecting: 'Connecting...', live: 'Live', lost: 'Lost, reconnecting...' }[phoneStatus]
  const [over, setOver] = useState(false)
  const [newPin, setNewPin] = useState('')
  const [pinSaved, setPinSaved] = useState(false)
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Operator settings">
      <div className="modal-card">
        <h2>Operator settings</h2>
        <label className="field">
          Camera source
          <select value={settings.source} onChange={(e) => update({ source: e.target.value })}>
            <option value="device">This computer's camera</option>
            <option value="phone">Phone app</option>
          </select>
        </label>
        {settings.source === 'phone' && (
          <label className="field">
            Connection
            <select value={settings.phoneMode} onChange={(e) => { setTest(''); update({ phoneMode: e.target.value }) }}>
              <option value="wifi">Wi-Fi or hotspot</option>
              <option value="usb">USB cable</option>
            </select>
          </label>
        )}
        {settings.source === 'phone' && settings.phoneMode === 'usb' && (
          <div className="field">
            <div className="row-tight">
              <button className="btn btn-ghost" disabled={testing} onClick={runTest}>
                {testing ? 'Testing...' : 'Test connection'}
              </button>
            </div>
            {test && <span className="note">{test}</span>}
            {statusText && <span className="note">Status: {statusText}</span>}
            <span className="note">Plug the phone in with USB debugging on, open the camera app, then test. No address needed.</span>
          </div>
        )}
        {settings.source === 'phone' && settings.phoneMode !== 'usb' && (
          <div className="field">
            Phone address
            <div className="row-tight">
              <input
                type="text"
                inputMode="url"
                placeholder="http://192.168.1.50:8080"
                value={phoneUrl}
                onChange={(e) => setPhoneUrl(e.target.value)}
                onBlur={() => {
                  const u = normalizePhoneUrl(phoneUrl)
                  setPhoneUrl(u)
                  update({ phoneUrl: u })
                }}
              />
              <button className="btn btn-ghost" disabled={testing} onClick={runTest}>
                {testing ? 'Testing...' : 'Test connection'}
              </button>
            </div>
            {test && <span className="note">{test}</span>}
            {statusText && <span className="note">Status: {statusText}</span>}
          </div>
        )}
        {settings.source === 'device' && (
        <label className="field">
          Camera
          <select value={settings.deviceId} onChange={(e) => update({ deviceId: e.target.value })}>
            <option value="">Default camera</option>
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        </label>
        )}
        <label className="check">
          <input type="checkbox" checked={settings.mirror} onChange={(e) => update({ mirror: e.target.checked })} />
          Mirror the picture like a selfie
        </label>
        {demo && (
          <p className="note">
            Showing the demo camera. {error ? `Reason: ${error}.` : ''} {settings.source === 'device' ? 'Plug in a camera and choose it above.' : 'Check the phone address above.'}
          </p>
        )}
        <div className="field">
          Custom stickers
          <div
            className={`custom-grid ${over ? 'over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOver(true) }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOver(false); custom.add([...e.dataTransfer.files]) }}
          >
            {custom.list.map((s) => (
              <div className="custom-item" key={s.id}>
                <img src={s.src} alt="" />
                <button aria-label="Remove sticker" onClick={() => custom.remove(s.id)}>×</button>
              </div>
            ))}
            <label className="custom-add">
              + Add
              <input type="file" accept="image/*" multiple hidden onChange={(e) => { custom.add([...e.target.files]); e.target.value = '' }} />
            </label>
          </div>
          <span className="note">Drop images here or use Add. Transparent PNGs look best. Guests see these first in the Stickers tab.</span>
        </div>
        <label className="btn btn-ghost test-btn">
          Test: use my own picture
          <input type="file" accept="image/*" multiple hidden onChange={(e) => { onTestFiles([...e.target.files]); e.target.value = '' }} />
        </label>
        <div className="field">
          Change operator PIN
          <div className="row-tight">
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="4 digits"
              value={newPin}
              onChange={(e) => { setNewPin(e.target.value.replace(/\D/g, '')); setPinSaved(false) }}
            />
            <button
              className="btn btn-ghost"
              disabled={newPin.length !== 4}
              onClick={() => { setPin(newPin); setNewPin(''); setPinSaved(true) }}
            >
              Save PIN
            </button>
          </div>
          {pinSaved && <span className="note">PIN changed.</span>}
        </div>
        <p className="note">Photos upload to: {import.meta.env.VITE_CLOUD_URL || 'this server (local cloud)'}</p>
        <button className="btn btn-sun" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

export default function Attract({ cam, custom, onStart, onTestPhotos }) {
  const [stage, setStage] = useState(null)

  const useFiles = async (all) => {
    const files = [...all].filter((f) => f.type.startsWith('image/'))
    if (!files.length) return
    const layout = files.length > 1 ? 'strip' : 'single'
    const { shots } = LAYOUTS[layout]
    const list = Array.from({ length: shots }, (_, i) => files[i % files.length])
    onTestPhotos(layout, await Promise.all(list.map((f) => fileToShot(f))))
  }
  return (
    <main
      className="screen attract"
    >
      <header className="brand">
        <img src="/assets/main.webp" alt="" />
        <span>AFAQ Scientific Club</span>
      </header>

      <section className="hero-copy">
        <h1>Strike a pose</h1>
        <p>Snap your photo, cover it in robots, then scan a code to keep it on your phone.</p>
        <div className="start-row">
          <button className="btn btn-sun big" onClick={() => onStart('single')}>One big photo</button>
          <button className="btn btn-pink big" onClick={() => onStart('strip')}>Strip of 3</button>
        </div>
      </section>

      <section className="hero-visual" aria-hidden="true">
        <img className="float f-uno" src="/assets/uno.webp" alt="" />
        <div className="polaroid">
          <span className="tape" />
          <VideoView stream={cam.stream} mirror={cam.settings.mirror} className="live" />
          <div className="polaroid-cap">You, live</div>
        </div>
        <img className="float f-car" src="/assets/robocar-removed-bg.webp" alt="" />
        <img className="float f-bolt" src="/assets/bolt.webp" alt="" />
      </section>

      <button className="gear" aria-label="Operator settings" onClick={() => setStage("pin")}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      </button>
      {stage === 'pin' && <PinPad onCancel={() => setStage(null)} onUnlock={() => setStage('settings')} />}
      {stage === 'settings' && (
        <Settings
          cam={cam}
          custom={custom}
          onClose={() => setStage(null)}
          onTestFiles={(files) => {
            setStage(null)
            useFiles(files)
          }}
        />
      )}
    </main>
  )
}

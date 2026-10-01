import { useEffect, useState } from 'react'
import VideoView from '../VideoView.jsx'
import { fileToShot, normalizePhoneUrl, readHealth, testPhone } from '../camera.js'
import { SESSION_LIMITS } from '../boothSettings.js'
import { LAYOUTS, STICKERS } from '../compose.js'
import { groupOf } from '../customStickers.js'
import { FACE_STICKERS } from '../faces.js'
import { setPin } from '../pin.js'
import PinPad from './PinPad.jsx'
import { LANGS, useI18n } from '../i18n.jsx'

const LIMIT_FIELDS = [
  ['maxEdits', 'Times a guest can go back to edit', 'times. 0 hides the button.'],
  ['maxExtends', 'Times a guest can extend the reset timer', 'times. 0 hides the button.'],
  ['extendSeconds', 'Seconds added by each extension', 'seconds'],
  ['doneSeconds', 'Seconds before the last screen resets', 'seconds'],
  ['editIdleSeconds', 'Seconds of no touching before the editor resets', 'seconds. A warning shows for the last 20.'],
]

function CameraHealth({ cam }) {
  const { settings, phoneStatus, demo, error, reconnect } = cam
  const phone = settings.source === 'phone'
  const [health, setHealth] = useState(null)
  const [checked, setChecked] = useState(null)
  const [spin, setSpin] = useState(false)
  useEffect(() => {
    if (!phone) return setHealth(null)
    let live = true
    const poll = async () => {
      let h = null
      try { h = await readHealth(settings) } catch { /* shown as unreachable */ }
      if (live) {
        setHealth(h)
        setChecked(new Date())
      }
    }
    poll()
    const t = setInterval(poll, 5000)
    return () => { live = false; clearInterval(t) }
  }, [phone, settings.phoneUrl, settings.phoneMode, phoneStatus])
  const state = demo
    ? { cls: 'bad', text: 'Not connected: showing the demo camera' }
    : phone
      ? { live: { cls: 'ok', text: 'Connected and streaming' }, connecting: { cls: 'warn', text: 'Connecting...' }, lost: { cls: 'bad', text: 'Stream lost, reconnecting...' }, idle: { cls: 'warn', text: 'Waiting' } }[phoneStatus]
      : { cls: 'ok', text: "Using this computer's camera" }
  const low = health?.battery != null && health.battery <= 20 && !health.charging
  return (
    <div className="field health">
      Camera health
      <div className="health-row">
        <span className={`dot ${state.cls}`} aria-hidden="true" />
        <strong>{state.text}</strong>
      </div>
      {phone && (
        <ul className="health-list">
          <li>Phone app: {health ? `reachable (${health.camera} camera, ${health.width}x${health.height})` : 'not answering'}</li>
          <li>
            Battery:{' '}
            {health?.battery != null ? (
              <span className={low ? 'low' : ''}>{Math.round(health.battery)}%{health.charging ? ' (charging)' : ''}{low ? ' - plug the phone in' : ''}</span>
            ) : health ? 'not reported by the phone app' : 'unknown'}
          </li>
          {checked && <li>Last checked {checked.toLocaleTimeString()}</li>}
        </ul>
      )}
      {error && <span className="note">Reason: {error}</span>}
      <div className="row-tight">
        <button
          className="btn btn-ghost"
          disabled={spin}
          onClick={() => {
            setSpin(true)
            reconnect()
            setTimeout(() => setSpin(false), 2000)
          }}
        >
          {spin ? 'Reconnecting...' : 'Reconnect camera'}
        </button>
      </div>
    </div>
  )
}

function Settings({ cam, custom, booth, updateBooth, onClose, onTestFiles }) {
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
  const [newGroup, setNewGroup] = useState('')
  const [over, setOver] = useState(null)
  const everything = [...custom.list, ...STICKERS]
  const groupIds = new Set(custom.groups.map((g) => g.id))
  const makeGroup = () => {
    custom.addGroup(newGroup)
    setNewGroup('')
  }
  const uploadFolder = (files) => {
    const byDir = new Map()
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue
      const parts = (f.webkitRelativePath || '').split('/')
      const dir = parts.length > 1 ? parts[parts.length - 2] : 'New folder'
      byDir.set(dir, [...(byDir.get(dir) || []), f])
    }
    for (const [dir, fs] of byDir) custom.add(fs, custom.addGroup(dir.slice(0, 16)))
  }
  const [newPin, setNewPin] = useState('')
  const [pinSaved, setPinSaved] = useState(false)
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Operator settings">
      <div className="modal-card settings-card">
        <header className="modal-head">
          <h2>Operator settings</h2>
          <button className="btn btn-sun modal-x" aria-label="Close settings" onClick={onClose}>✕ Close</button>
        </header>
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
        <CameraHealth cam={cam} />
        <div className="field">
          Guest session limits
          {LIMIT_FIELDS.map(([key, label, unit]) => (
            <label className="limit" key={key}>
              <span>{label}</span>
              <input
                type="number"
                inputMode="numeric"
                min={SESSION_LIMITS[key][0]}
                max={SESSION_LIMITS[key][1]}
                value={booth[key]}
                onChange={(e) => updateBooth({ [key]: e.target.valueAsNumber })}
              />
              <span className="note">{unit}</span>
            </label>
          ))}
          <span className="note">The limits reset for every new guest. Guest photos are deleted from the server 10 minutes after upload unless the guest ticks the box to let the club keep them.</span>
        </div>
        <div className="field">
          Sticker folders
          <div className="row-tight">
            <input
              type="text"
              maxLength={16}
              placeholder="New folder name"
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && makeGroup()}
            />
            <button className="btn btn-ghost" disabled={!newGroup.trim()} onClick={makeGroup}>New folder</button>
          </div>
          <div className="row-tight">
            <label className="btn btn-ghost">
              Upload a whole folder
              <input type="file" accept="image/*" multiple hidden {...{ webkitdirectory: '', directory: '' }} onChange={(e) => { uploadFolder([...e.target.files]); e.target.value = '' }} />
            </label>
            <button className="btn btn-ghost" onClick={() => custom.setAllBuiltin(STICKERS.map((s) => s.id))}>Hide all built-in</button>
            <button className="btn btn-ghost" onClick={() => custom.setAllBuiltin([])}>Show all built-in</button>
          </div>
          <span className="note">Drop pictures onto a folder or use its Add button. Drag a sticker onto another folder to move it. Tap a built-in sticker to hide or show it. Transparent PNGs look best.</span>
          {[...custom.groups, { id: '', name: 'No group', fixed: true }].map((g) => {
            const items = everything.filter((s) => (groupIds.has(groupOf(s, custom.assign)) ? groupOf(s, custom.assign) : '') === g.id)
            if (g.fixed && !items.length) return null
            return (
              <div
                className={`folder ${over === g.id ? 'over' : ''}`}
                key={g.id || 'none'}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOver(g.id) }}
                onDragLeave={() => setOver(null)}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setOver(null)
                  const sid = e.dataTransfer.getData('application/x-sticker-id')
                  if (sid) custom.assignGroup(sid, g.id)
                  else custom.add([...e.dataTransfer.files], g.id)
                }}
              >
                <div className="folder-head">
                  {g.fixed ? (
                    <strong>{g.name}</strong>
                  ) : (
                    <input type="text" maxLength={16} value={g.name} onChange={(e) => custom.renameGroup(g.id, e.target.value)} aria-label="Folder name" />
                  )}
                  {!g.fixed && (
                    <>
                      <label className="btn btn-ghost">
                        + Add pictures
                        <input type="file" accept="image/*" multiple hidden onChange={(e) => { custom.add([...e.target.files], g.id); e.target.value = '' }} />
                      </label>
                      <button className="btn btn-ghost" aria-label={`Delete ${g.name} folder`} onClick={() => { if (window.confirm(`Delete the "${g.name}" folder? The stickers inside are kept and move to the unsorted folder.`)) custom.deleteGroup(g.id) }}>Delete</button>
                    </>
                  )}
                </div>
                <div className="custom-grid">
                  {items.map((s) => {
                    const off = !s.custom && custom.hidden.includes(s.id)
                    return (
                      <div
                        className={`custom-item ${s.custom ? '' : 'builtin'} ${off ? 'off' : ''}`}
                        key={s.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('application/x-sticker-id', s.id)}
                        onClick={() => !s.custom && custom.toggleBuiltin(s.id)}
                      >
                        <img src={s.src} alt="" />
                        {s.custom ? (
                          <button aria-label="Remove sticker" onClick={(e) => { e.stopPropagation(); custom.remove(s.id) }}>×</button>
                        ) : (
                          <span className="builtin-badge">{off ? 'Hidden' : ''}</span>
                        )}
                      </div>
                    )
                  })}
                  {!items.length && <span className="note">Empty. Drop pictures here.</span>}
                </div>
              </div>
            )
          })}
          <details>
            <summary>Move stickers with menus</summary>
            <div className="custom-grid assign-grid">
              {everything.map((s) => (
                <div className="assign-item" key={s.id}>
                  <img src={s.src} alt="" />
                  <select
                    aria-label="Folder for this sticker"
                    value={groupIds.has(groupOf(s, custom.assign)) ? groupOf(s, custom.assign) : ''}
                    onChange={(e) => custom.assignGroup(s.id, e.target.value)}
                  >
                    <option value="">No group</option>
                    {custom.groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </details>
        </div>
        <div className="field">
          Face stickers
          <span className="note">These land on faces by themselves. Use a transparent PNG cropped tight around the hat or glasses, facing the camera. Tap a built-in one to hide or show it.</span>
          {[['top', 'On the head (hats, crowns)'], ['eyes', 'On the eyes (glasses)'], ['cheeks', 'On the cheeks (blush, hearts; one per cheek)'], ['nose', 'On the nose'], ['freckles', 'Across nose and cheeks (freckles)'], ['mustache', 'Under the nose (mustaches)'], ['beard', 'On the chin (beards)']].map(([anchor, title]) => (
            <div className="folder" key={anchor}>
              <div className="folder-head">
                <strong>{title}</strong>
                <label className="btn btn-ghost">
                  + Add pictures
                  <input type="file" accept="image/*" multiple hidden onChange={(e) => { custom.add([...e.target.files], '', anchor); e.target.value = '' }} />
                </label>
              </div>
              <div className="custom-grid">
                {[...custom.faceList, ...FACE_STICKERS].filter((f) => f.anchor === anchor).map((f) => {
                  const off = !f.custom && custom.hidden.includes(f.id)
                  return (
                    <div className={`custom-item ${f.custom ? '' : 'builtin'} ${off ? 'off' : ''}`} key={f.id} onClick={() => !f.custom && custom.toggleBuiltin(f.id)}>
                      <img src={f.src} alt="" />
                      {f.custom ? (
                        <button aria-label="Remove face sticker" onClick={(e) => { e.stopPropagation(); custom.remove(f.id) }}>×</button>
                      ) : (
                        <span className="builtin-badge">{off ? 'Hidden' : ''}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
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
        <footer className="modal-foot">
          <button className="btn btn-sun big" onClick={onClose}>Done</button>
        </footer>
      </div>
    </div>
  )
}

// [sticker, { width, position, tilt, delay }] — each one drops in, then bobs forever.
const pos = (width, place, rot, i) => ({ width: `${width}%`, ...place, '--rot': `${rot}deg`, '--i': i })
const FLOATERS = [
  ['cat_sunglasses_thumbs', pos(30, { right: '-3%', top: '0%' }, 12, 0)],
  ['spiderman_jump', pos(38, { left: '-6%', bottom: '2%' }, -8, 1)],
  ['sparkles', pos(15, { left: '4%', top: '4%' }, -14, 2)],
  ['unicorn', pos(22, { right: '-1%', bottom: '4%' }, 8, 3)],
  ['cherries', pos(16, { left: '-8%', top: '34%' }, -12, 4)],
  ['hello_kitty', pos(20, { right: '-7%', top: '38%' }, 10, 5)],
  ['duck_sunglasses', pos(16, { left: '30%', bottom: '-5%' }, 6, 6)],
  ['plus_1000_aura', pos(22, { left: '34%', top: '0%' }, -5, 7)],
]

export default function Attract({ cam, custom, booth, updateBooth, onStart, onTestPhotos }) {
  const [stage, setStage] = useState(null)
  const { t, lang, setLang } = useI18n()

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
      <div className="twinkles" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => <span key={i} style={{ '--i': i, left: `${(i * 37 + 8) % 97}%`, top: `${(i * 53 + 11) % 91}%` }} />)}
      </div>

      <header className="brand">
        <img src="/assets/main.webp" alt="" />
        <span>{t('brand')}</span>
      </header>

      <div className="lang-switch" role="radiogroup" aria-label={t('lang.label')}>
        {LANGS.map((l) => (
          <button key={l.id} role="radio" aria-checked={lang === l.id} lang={l.id} className={`lang-btn ${lang === l.id ? 'on' : ''}`} onClick={() => setLang(l.id)}>
            {l.label}
          </button>
        ))}
      </div>

      <section className="hero-copy">
        <h1>{t('attract.title')}</h1>
        <p>{t('attract.lead')}</p>
        <div className="start-row">
          <button className="btn btn-sun big" onClick={() => onStart('single')}>{t('attract.single')}</button>
          <button className="btn btn-pink big" onClick={() => onStart('strip')}>{t('attract.strip')}</button>
        </div>
      </section>

      <section className="hero-visual" aria-hidden="true">
        {FLOATERS.map(([name, pos]) => (
          <img key={name} className="float" style={pos} src={`/assets/stickers/${name}.webp`} alt="" />
        ))}
        <div className="polaroid">
          <span className="tape" />
          <VideoView stream={cam.stream} mirror={cam.settings.mirror} className="live" />
          <div className="polaroid-cap">{t('attract.live')}</div>
        </div>
      </section>

      <button className="gear" aria-label={t('attract.settings')} onClick={() => setStage('pin')}>
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
          booth={booth}
          updateBooth={updateBooth}
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

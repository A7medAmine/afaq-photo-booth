import { useEffect, useState } from 'react'
import VideoView from '../VideoView.jsx'
import { fileToShot, normalizePhoneUrl, testPhone } from '../camera.js'
import { LAYOUTS, STICKERS } from '../compose.js'
import { groupOf } from '../customStickers.js'
import { FACE_STICKERS } from '../faces.js'
import { setPin } from '../pin.js'
import PinPad from './PinPad.jsx'
import { LANGS, useI18n } from '../i18n.jsx'

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
                      <button className="btn btn-ghost" aria-label={`Delete ${g.name} folder`} onClick={() => custom.deleteGroup(g.id)}>Delete</button>
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
          {[['top', 'On the head (hats, crowns)'], ['eyes', 'On the eyes (glasses)'], ['cheeks', 'On the cheeks (blush, hearts; one per cheek)'], ['nose', 'On the nose'], ['freckles', 'Across nose and cheeks (freckles)']].map(([anchor, title]) => (
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

export default function Attract({ cam, custom, onStart, onTestPhotos }) {
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
        <img className="float f-uno" src="/assets/uno.webp" alt="" />
        <div className="polaroid">
          <span className="tape" />
          <VideoView stream={cam.stream} mirror={cam.settings.mirror} className="live" />
          <div className="polaroid-cap">{t('attract.live')}</div>
        </div>
        <img className="float f-car" src="/assets/robocar-removed-bg.webp" alt="" />
        <img className="float f-bolt" src="/assets/bolt.webp" alt="" />
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

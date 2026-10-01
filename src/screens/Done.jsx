import { useCallback, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { useI18n } from '../i18n.jsx'

const CLOUD = (import.meta.env.VITE_CLOUD_URL || '').replace(/\/$/, '')
const KEY = import.meta.env.VITE_UPLOAD_KEY || ''
const headers = (extra) => ({ ...(KEY ? { 'X-Upload-Key': KEY } : {}), ...extra })

// Photos are only stored for a few minutes unless the guest ticks the box. A photo from an earlier
// pass through the editor is deleted once the new one is uploaded, so nothing is left behind.
export default function Done({ blob, share, onShare, booth, editsLeft, extendsLeft, onEdit, onExtend, onNext }) {
  const { t } = useI18n()
  const [status, setStatus] = useState('uploading')
  const [qr, setQr] = useState('')
  const [link, setLink] = useState('')
  const [left, setLeft] = useState(booth.doneSeconds)
  const [keep, setKeep] = useState(!!share?.keep)
  const [ttl, setTtl] = useState(10)
  const preview = useMemo(() => URL.createObjectURL(blob), [blob])

  const upload = useCallback(async () => {
    setStatus('uploading')
    try {
      const res = await fetch(`${CLOUD}/api/photos`, {
        method: 'POST',
        headers: headers({ 'Content-Type': 'image/jpeg', ...(share?.keep ? { 'X-Keep': '1' } : {}) }),
        body: blob,
      })
      if (!res.ok) throw new Error(`Upload failed (${res.status})`)
      const { id, token, url, ttlMinutes } = await res.json()
      if (share?.id) fetch(`${CLOUD}/api/photos/${share.id}`, { method: 'DELETE', headers: headers({ 'X-Token': share.token }) }).catch(() => {})
      onShare({ id, token, keep: !!share?.keep })
      setTtl(ttlMinutes)
      setLink(url)
      setQr(await QRCode.toDataURL(url, { width: 640, margin: 1, color: { dark: '#030a2e', light: '#ffffff' } }))
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blob])

  useEffect(() => {
    upload()
  }, [upload])

  useEffect(() => {
    if (status !== 'ready') return
    const t = setInterval(() => setLeft((s) => s - 1), 1000)
    return () => clearInterval(t)
  }, [status])

  useEffect(() => {
    if (left <= 0) onNext()
  }, [left, onNext])

  const toggleKeep = async (on) => {
    setKeep(on)
    onShare({ ...share, keep: on })
    try {
      const r = await fetch(`${CLOUD}/api/photos/${share.id}/keep`, {
        method: 'PUT',
        headers: headers({ 'Content-Type': 'application/json', 'X-Token': share.token }),
        body: JSON.stringify({ keep: on }),
      })
      if (!r.ok) throw new Error()
    } catch {
      setKeep(!on)
      onShare({ ...share, keep: !on })
    }
  }

  return (
    <main className="screen done">
      <div className="done-photo">
        <span className="tape" />
        <img src={preview} alt={t('done.photoAlt')} />
      </div>

      <section className="done-info">
        {status === 'uploading' && (
          <>
            <img className="spin-bolt" src="/assets/bolt.webp" alt="" />
            <h1>{t('done.sending')}</h1>
            <p>{t('done.wait')}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <h1>{t('done.errTitle')}</h1>
            <p>{t('done.errBody')}</p>
            <div className="row">
              <button className="btn btn-sun big" onClick={upload}>{t('done.retry')}</button>
              <a className="btn btn-ghost big" href={preview} download="afaq-photo.jpg">{t('done.save')}</a>
            </div>
          </>
        )}
        {status === 'ready' && (
          <>
            <h1>{t('done.scan')}</h1>
            <div className="qr"><img src={qr} alt={`${t('done.qrAlt')}: ${link}`} /></div>
            <p>{t('done.scanBody')}</p>
            <label className="keep">
              <input type="checkbox" checked={keep} onChange={(e) => toggleKeep(e.target.checked)} />
              <span>
                {t('done.keep')}
                <small>{keep ? t('done.keepOn') : t('done.keepOff', { n: ttl })}</small>
              </span>
            </label>
            <div className="row">
              <button className="btn btn-sun big" onClick={onNext}>{t('done.next')}</button>
              {editsLeft > 0 && (
                <button className="btn btn-ghost big" onClick={onEdit}>{t('done.edit', { n: editsLeft })}</button>
              )}
            </div>
            <div className="row">
              <span className="timer">{t('done.resets', { n: left })}</span>
              {extendsLeft > 0 && (
                <button className="btn btn-ghost" onClick={() => { setLeft((s) => s + booth.extendSeconds); onExtend() }}>
                  {t('done.extend', { s: booth.extendSeconds, n: extendsLeft })}
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  )
}

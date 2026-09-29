import { useCallback, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { useI18n } from '../i18n.jsx'

const CLOUD = (import.meta.env.VITE_CLOUD_URL || '').replace(/\/$/, '')
const KEY = import.meta.env.VITE_UPLOAD_KEY || ''
const RESET_AFTER = 60

export default function Done({ blob, onNext }) {
  const { t } = useI18n()
  const [status, setStatus] = useState('uploading')
  const [qr, setQr] = useState('')
  const [link, setLink] = useState('')
  const [left, setLeft] = useState(RESET_AFTER)
  const preview = useMemo(() => URL.createObjectURL(blob), [blob])

  const upload = useCallback(async () => {
    setStatus('uploading')
    try {
      const res = await fetch(`${CLOUD}/api/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg', ...(KEY ? { 'X-Upload-Key': KEY } : {}) },
        body: blob,
      })
      if (!res.ok) throw new Error(`Upload failed (${res.status})`)
      const { url } = await res.json()
      setLink(url)
      setQr(await QRCode.toDataURL(url, { width: 640, margin: 1, color: { dark: '#030a2e', light: '#ffffff' } }))
      setStatus('ready')
    } catch {
      setStatus('error')
    }
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
            <div className="row">
              <button className="btn btn-sun big" onClick={onNext}>{t('done.next')}</button>
              <span className="timer">{t('done.resets', { n: left })}</span>
            </div>
          </>
        )}
      </section>
    </main>
  )
}

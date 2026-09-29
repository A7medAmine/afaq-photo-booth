import { useCallback, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'

const CLOUD = (import.meta.env.VITE_CLOUD_URL || '').replace(/\/$/, '')
const KEY = import.meta.env.VITE_UPLOAD_KEY || ''
const RESET_AFTER = 60

export default function Done({ blob, onNext }) {
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
        <img src={preview} alt="Your finished photo" />
      </div>

      <section className="done-info">
        {status === 'uploading' && (
          <>
            <img className="spin-bolt" src="/assets/bolt.webp" alt="" />
            <h1>Sending your photo</h1>
            <p>Hang on, this takes a few seconds.</p>
          </>
        )}
        {status === 'error' && (
          <>
            <h1>Could not upload</h1>
            <p>The booth cannot reach the photo server. Check the internet connection, then try again.</p>
            <div className="row">
              <button className="btn btn-sun big" onClick={upload}>Try again</button>
              <a className="btn btn-ghost big" href={preview} download="afaq-photo.jpg">Save on this device</a>
            </div>
          </>
        )}
        {status === 'ready' && (
          <>
            <h1>Scan to get your photo</h1>
            <div className="qr"><img src={qr} alt={`QR code to download your photo: ${link}`} /></div>
            <p>Open your phone camera and point it at the code.</p>
            <div className="row">
              <button className="btn btn-sun big" onClick={onNext}>Next person</button>
              <span className="timer">Resets in {left}s</span>
            </div>
          </>
        )}
      </section>
    </main>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'

const LS = 'afaq-booth-camera'
const DEFAULTS = { deviceId: '', mirror: true, source: 'device', phoneUrl: '', phoneMode: 'wifi' }
const FRAME_STALL_MS = 5000
const RETRY_MS = 3000

function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(LS) || '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

export function normalizePhoneUrl(raw) {
  let u = (raw || '').trim()
  if (!u) return ''
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`
  return u.replace(/\/+$/, '')
}

function fetchTimeout(url, ms, opts = {}) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), ms)
  return fetch(url, { ...opts, signal: ctl.signal, cache: 'no-store' }).finally(() => clearTimeout(timer))
}

export const USB_URL = 'http://localhost:8080'

export function phoneBaseOf(settings) {
  if (settings.source !== 'phone') return ''
  return settings.phoneMode === 'usb' ? USB_URL : normalizePhoneUrl(settings.phoneUrl)
}

// The browser cannot run adb, so the local booth server sets up the USB forward.
export async function setupUsb() {
  let r
  try {
    r = await fetchTimeout('/api/phone/usb', 10000, { method: 'POST' })
  } catch {
    throw new Error('Booth server not reachable')
  }
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.error || 'USB setup failed')
}

export async function testPhone(rawUrl, usb = false) {
  if (usb) await setupUsb()
  const base = usb ? USB_URL : normalizePhoneUrl(rawUrl)
  if (!base) throw new Error('Enter the phone address first')
  let r
  try {
    r = await fetchTimeout(`${base}/health`, 4000)
  } catch {
    throw new Error('No answer. Check the address, that the app is running and that both devices share a network')
  }
  if (!r.ok) throw new Error(`Phone answered with status ${r.status}`)
  const h = await r.json().catch(() => null)
  if (!h?.ok) throw new Error('That address does not look like the AFAQ camera app')
  return h
}

function makeDemoStream() {
  const c = document.createElement('canvas')
  c.width = 1280
  c.height = 720
  const ctx = c.getContext('2d')
  const logo = new Image()
  logo.src = '/assets/main.webp'
  const t0 = performance.now()
  const draw = () => {
    const t = (performance.now() - t0) / 1000
    const g = ctx.createLinearGradient(0, 0, c.width, c.height)
    g.addColorStop(0, `hsl(${(t * 30) % 360},80%,55%)`)
    g.addColorStop(1, `hsl(${(t * 30 + 90) % 360},80%,45%)`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, c.width, c.height)
    const s = 260
    const x = c.width / 2 + Math.sin(t * 1.3) * 380 - s / 2
    const y = c.height / 2 + Math.cos(t * 1.7) * 160 - s / 2
    if (logo.complete && logo.naturalWidth) ctx.drawImage(logo, x, y, s, s)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 44px sans-serif'
    ctx.fillText('DEMO CAMERA', 40, 80)
  }
  draw()
  const timer = setInterval(draw, 1000 / 30)
  const stream = c.captureStream(30)
  stream.getTracks().forEach((tr) => {
    const stop = tr.stop.bind(tr)
    tr.stop = () => {
      clearInterval(timer)
      stop()
    }
  })
  return stream
}

function findBytes(buf, needle, from = 0) {
  outer: for (let i = from; i <= buf.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (buf[i + j] !== needle[j]) continue outer
    return i
  }
  return -1
}

// A plain <img> gives no per-frame events for MJPEG, so the stream is parsed by hand.
// That also gives exact frame times for stall detection.
async function readMjpeg(url, signal, onFrame) {
  const r = await fetch(url, { signal, cache: 'no-store' })
  if (!r.ok || !r.body) throw new Error(`Stream status ${r.status}`)
  const reader = r.body.getReader()
  const headEnd = new TextEncoder().encode('\r\n\r\n')
  const dec = new TextDecoder()
  let buf = new Uint8Array(0)
  for (;;) {
    const { done, value } = await reader.read()
    if (done) throw new Error('Stream ended')
    const merged = new Uint8Array(buf.length + value.length)
    merged.set(buf)
    merged.set(value, buf.length)
    buf = merged
    for (;;) {
      const h = findBytes(buf, headEnd)
      if (h < 0) break
      const len = +(/content-length:\s*(\d+)/i.exec(dec.decode(buf.subarray(0, h)))?.[1] || 0)
      if (!len) {
        buf = buf.slice(h + 4)
        continue
      }
      if (buf.length < h + 4 + len) break
      onFrame(buf.slice(h + 4, h + 4 + len))
      buf = buf.slice(h + 4 + len)
    }
    if (buf.length > 8_000_000) buf = new Uint8Array(0)
  }
}

// Draws the phone's MJPEG into a canvas so the booth sees a normal MediaStream.
// Reconnects on its own; onStatus reports 'live' or 'lost'.
// Reads the phone's /health once, for the operator's camera status panel.
// Battery is optional: { battery: 0-100, charging: bool } when the phone app reports it.
export async function readHealth(settings) {
  const base = phoneBaseOf(settings)
  if (!base) throw new Error('No phone address')
  const r = await fetchTimeout(`${base}/health`, 3000)
  if (!r.ok) throw new Error(`Phone answered with status ${r.status}`)
  const h = await r.json()
  if (!h?.ok) throw new Error('Not the AFAQ camera app')
  return h
}

export function makePhoneStream(baseUrl, onStatus, beforeRetry) {
  const c = document.createElement('canvas')
  c.width = 1280
  c.height = 720
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, c.width, c.height)
  const stream = c.captureStream(30)
  let stopped = false
  let ctl = null
  let lastFrame = 0
  let busy = false

  const onFrame = async (bytes) => {
    if (busy || stopped) return
    busy = true
    try {
      const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }))
      if (stopped) return bmp.close()
      if (c.width !== bmp.width || c.height !== bmp.height) {
        c.width = bmp.width
        c.height = bmp.height
      }
      ctx.drawImage(bmp, 0, 0)
      bmp.close()
      if (!lastFrame) onStatus('live')
      lastFrame = performance.now()
    } catch { /* corrupt frame, skip */ } finally {
      busy = false
    }
  }

  const watchdog = setInterval(() => {
    if (lastFrame && performance.now() - lastFrame > FRAME_STALL_MS) ctl?.abort()
  }, 1000)

  ;(async () => {
    while (!stopped) {
      ctl = new AbortController()
      lastFrame = 0
      try {
        await readMjpeg(`${baseUrl}/stream`, ctl.signal, onFrame)
      } catch { /* retry below */ }
      if (stopped) return
      onStatus('lost')
      await new Promise((r) => setTimeout(r, RETRY_MS))
      await beforeRetry?.()
    }
  })()

  stream.getTracks().forEach((tr) => {
    const stop = tr.stop.bind(tr)
    tr.stop = () => {
      stopped = true
      clearInterval(watchdog)
      ctl?.abort()
      stop()
    }
  })
  return stream
}

export function useCamera() {
  const [settings, setSettings] = useState(loadSettings)
  const [stream, setStream] = useState(null)
  const [devices, setDevices] = useState([])
  const [error, setError] = useState('')
  const [demo, setDemo] = useState(false)
  const [phoneStatus, setPhoneStatus] = useState('idle')
  const [attempt, setAttempt] = useState(0)
  const current = useRef(null)

  const update = useCallback((patch) => {
    setSettings((s) => {
      const next = { ...s, ...patch }
      try { localStorage.setItem(LS, JSON.stringify(next)) } catch { /* private mode */ }
      return next
    })
  }, [])

  const phoneBase = phoneBaseOf(settings)
  const usb = settings.phoneMode === 'usb'

  useEffect(() => {
    let cancelled = false
    let retry = null
    let onDemo = false
    const forceDemo = new URLSearchParams(location.search).has('demo')
    const swap = (s, isDemo) => {
      current.current?.getTracks().forEach((t) => t.stop())
      current.current = s
      onDemo = isDemo
      setDemo(isDemo)
      setStream(s)
    }
    const showDemo = () => swap(makeDemoStream(), true)

    async function startPhone() {
      if (!onDemo) setPhoneStatus('connecting')
      setError('')
      try {
        await testPhone(phoneBase, usb)
      } catch (e) {
        if (cancelled) return
        setError(e.message)
        setPhoneStatus('lost')
        if (!onDemo) showDemo()
        retry = setTimeout(startPhone, RETRY_MS)
        return
      }
      if (cancelled) return
      swap(makePhoneStream(phoneBase, (st) => !cancelled && setPhoneStatus(st), usb ? () => setupUsb().catch(() => {}) : undefined), false)
    }

    async function startDevice() {
      setError('')
      try {
        if (forceDemo) throw new Error('demo requested')
        const video = {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          ...(settings.deviceId ? { deviceId: { exact: settings.deviceId } } : { facingMode: 'user' }),
        }
        const s = await navigator.mediaDevices.getUserMedia({ video, audio: false })
        if (cancelled) return s.getTracks().forEach((t) => t.stop())
        swap(s, false)
        setDevices((await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput'))
      } catch (e) {
        if (cancelled) return
        if (!forceDemo) setError(e?.message || 'Camera unavailable')
        showDemo()
      }
    }

    if (phoneBase && !forceDemo) {
      startPhone()
    } else {
      setPhoneStatus('idle')
      current.current?.getTracks().forEach((t) => t.stop())
      startDevice()
    }
    return () => {
      cancelled = true
      clearTimeout(retry)
    }
  }, [settings.deviceId, phoneBase, usb, attempt])

  const reconnect = useCallback(() => setAttempt((n) => n + 1), [])

  return { stream, devices, error, demo, settings, update, phoneStatus, reconnect }
}

export function capture(video, mirror) {
  const c = document.createElement('canvas')
  c.width = video.videoWidth
  c.height = video.videoHeight
  const ctx = c.getContext('2d')
  if (mirror) {
    ctx.translate(c.width, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(video, 0, 0)
  return c
}

export async function grabStill(cam, video, mirror) {
  const fromPreview = () => (video?.videoWidth ? capture(video, mirror) : null)
  if (cam.settings.source !== 'phone' || cam.phoneStatus !== 'live') return fromPreview()
  const preview = fromPreview()
  try {
    const r = await fetchTimeout(`${phoneBaseOf(cam.settings)}/photo`, 10000)
    if (!r.ok) throw new Error(`Photo status ${r.status}`)
    const bmp = await createImageBitmap(await r.blob())
    const k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * k)
    c.height = Math.round(bmp.height * k)
    const ctx = c.getContext('2d')
    if (mirror) {
      ctx.translate(c.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(bmp, 0, 0, c.width, c.height)
    bmp.close()
    return c
  } catch {
    return preview
  }
}

export async function fileToShot(file) {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k)
  c.height = Math.round(bmp.height * k)
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  return c
}

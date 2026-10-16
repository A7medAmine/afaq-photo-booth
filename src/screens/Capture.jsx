import { useEffect, useRef, useState } from 'react'
import VideoView from '../VideoView.jsx'
import { grabStill } from '../camera.js'
import { LAYOUTS } from '../compose.js'
import { sfx } from '../sound.js'
import { CLONE_SIGN, SHUTTER_GESTURES, showHands as drawHands, watchGestures, watchZoom } from '../gestures.js'
import { useI18n } from '../i18n.jsx'

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const THUMB_W = 240
const REVIEW_W = 1280
// Secret signs work like 👍 but are never shown in the hints: each one is a surprise that
// unlocks a hidden theme. ✌️ unlocks Palestine; Naruto's crossed-fingers clone sign unlocks Naruto.
const SECRETS = {
  Victory: { theme: 'palestine', art: ['/assets/palestine/flag-wave.svg', '/assets/palestine/melon-wedge.svg'] },
  [CLONE_SIGN]: { theme: 'naruto', art: ['/assets/naruto/headband.svg', '/assets/naruto/naruto-ramen.webp'] },
}
const START_GESTURES = [...SHUTTER_GESTURES, CLONE_SIGN]
const REVIEW_GESTURES = [...START_GESTURES, 'Thumb_Down']


// Shows the shot just taken over the live video, while it develops and while the guest
// decides to keep or retake it.
function ReviewShot({ shot, className = '' }) {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current
    c.width = Math.min(REVIEW_W, shot.width)
    c.height = Math.round((c.width * shot.height) / shot.width)
    c.getContext('2d').drawImage(shot, 0, 0, c.width, c.height)
  }, [shot])
  return <canvas ref={ref} className={`review-shot ${className}`} />
}

// Digital zoom: keeps the middle of the shot at the camera's own pixels, as the preview shows it.
function cropCenter(src, zoom) {
  if (zoom <= 1) return src
  const c = document.createElement('canvas')
  c.width = Math.round(src.width / zoom)
  c.height = Math.round(src.height / zoom)
  c.getContext('2d').drawImage(src, (src.width - c.width) / 2, (src.height - c.height) / 2, c.width, c.height, 0, 0, c.width, c.height)
  return c
}

// Encoding a full-size shot to a data URL blocks the main thread (and with it the phone preview),
// so only the new shot is shrunk and encoded, asynchronously.
function thumbUrl(shot) {
  const c = document.createElement('canvas')
  c.width = THUMB_W
  c.height = Math.round((THUMB_W * shot.height) / shot.width)
  c.getContext('2d').drawImage(shot, 0, 0, c.width, c.height)
  return new Promise((r) => c.toBlob((b) => r(b ? URL.createObjectURL(b) : ''), 'image/jpeg', 0.7))
}

// gestureWait > 0 waits up to that many seconds for a 👍 (or a secret sign) before each countdown.
// onDone(shots, theme) gets the theme of the last secret sign shown ('palestine' or 'naruto'), else null.
// gestureZoom lets guests pinch with one hand to zoom the shot.
// showHands draws the tracked hand joints over the picture for the whole capture.
export default function Capture({ cam, layout, countdown = 3, gestureWait = 0, gestureZoom = false, showHands = false, onDone, onCancel }) {
  const L = LAYOUTS[layout]
  const { t } = useI18n()
  const videoRef = useRef(null)
  const handsRef = useRef(null)
  const [count, setCount] = useState(null)
  const [index, setIndex] = useState(0)
  const [flash, setFlash] = useState(false)
  const [thumbs, setThumbs] = useState([])
  const [waitLeft, setWaitLeft] = useState(null)
  const [hold, setHold] = useState(0)
  const [holding, setHolding] = useState(null)
  const [review, setReview] = useState(null)
  // { shot, done }: the instant preview frame while the full-quality shot loads, then that shot.
  const [developing, setDeveloping] = useState(null)
  const [aspect, setAspect] = useState(16 / 9)
  const [zoom, setZoom] = useState(1)
  // The secret just shown (an entry of SECRETS), while its banner is up.
  const [surprise, setSurprise] = useState(null)
  const themeRef = useRef(null)
  const zoomRef = useRef(1)
  const mirror = cam.settings.mirror
  const camRef = useRef(cam)
  camRef.current = cam

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const sync = () => v.videoWidth && setAspect(v.videoWidth / v.videoHeight)
    sync()
    v.addEventListener('loadedmetadata', sync)
    v.addEventListener('resize', sync)
    return () => {
      v.removeEventListener('loadedmetadata', sync)
      v.removeEventListener('resize', sync)
    }
  }, [])

  // Paused while a shot is under review, where the live picture is hidden.
  useEffect(() => {
    if (!gestureZoom || review) return
    return watchZoom(videoRef.current, {
      start: zoomRef.current,
      onZoom: (z) => {
        zoomRef.current = z
        setZoom(z)
      },
    })
  }, [gestureZoom, review])

  // Over a shot under review the full camera frame is mapped, since the zoomed live view is hidden.
  useEffect(() => {
    if (!showHands) return
    return drawHands(videoRef.current, handsRef.current, {
      mirror: camRef.current.settings.mirror,
      getZoom: () => (review ? 1 : zoomRef.current),
    })
  }, [showHands, review])

  useEffect(() => {
    let dead = false
    let cancelWait = null
    const shots = []
    const urls = []
    // Resolves with the held gesture, or null when the wait runs out, so the booth never gets stuck.
    const waitForGesture = (wanted) =>
      new Promise((resolve) => {
        let left = gestureWait
        setWaitLeft(left)
        const tick = setInterval(() => {
          left -= 1
          if (left <= 0) finish()
          else setWaitLeft(left)
        }, 1000)
        const stop = watchGestures(videoRef.current, {
          wanted,
          onGesture: (name) => {
            const secret = SECRETS[name]
            if (secret && themeRef.current !== secret.theme) {
              themeRef.current = secret.theme
              setSurprise(secret)
              sfx.secret()
              setTimeout(() => !dead && setSurprise((s) => (s === secret ? null : s)), 2600)
            } else if (wanted === START_GESTURES) sfx.sign()
            finish(name)
          },
          onHold: (held, name) => {
            setHold(held)
            setHolding(name)
          },
        })
        function finish(name = null) {
          clearInterval(tick)
          stop()
          cancelWait = null
          setWaitLeft(null)
          setHold(0)
          setHolding(null)
          resolve(name)
        }
        cancelWait = finish
      })
    ;(async () => {
      await wait(500)
      // With gestures on, only the first shot waits on live video; later shots start
      // from the keep sign given while reviewing the previous one.
      let needSign = !!gestureWait
      for (let i = 0; i < L.shots; i++) {
        if (dead) return
        setIndex(i)
        if (needSign) {
          setCount(null)
          await waitForGesture(START_GESTURES)
          if (dead) return
          needSign = false
        }
        for (let c = countdown; c >= 1; c--) {
          setCount(c)
          // Pitch climbs over the last three seconds only, however long the countdown.
          sfx.tick(c)
          await wait(1000)
          if (dead) return
        }
        setCount(0)
        sfx.shutter()
        setFlash(true)
        const c = camRef.current
        const z = zoomRef.current
        // The preview frame shows at once, washed out like a developing instant photo, so guests
        // see their shot while the phone sends the full-quality one.
        const { preview, full } = grabStill(c, videoRef.current, c.settings.mirror)
        if (preview) setDeveloping({ shot: cropCenter(preview, z), done: false })
        await wait(350)
        setFlash(false)
        const raw = await full
        const shot = raw && cropCenter(raw, z)
        if (dead) return
        if (!shot) {
          setDeveloping(null)
          await wait(i < L.shots - 1 ? 1100 : 500)
          continue
        }
        setDeveloping({ shot, done: true })
        shots.push(shot)
        const at = shots.length - 1
        thumbUrl(shot).then((u) => {
          if (!u) return
          urls.push(u)
          // A retaken shot's thumbnail can finish encoding after it was thrown away.
          if (dead || shots[at] !== shot) return URL.revokeObjectURL(u)
          setThumbs((t) => Object.assign([...t], { [at]: u }))
        })
        // Long enough for the reveal to finish clearing (see .review-shot.developed).
        if (!gestureWait) {
          await wait(i < L.shots - 1 ? 1100 : 900)
          setDeveloping(null)
          continue
        }
        // Review starts while the shot is still clearing, so guests can answer straight away.
        setCount(null)
        setReview(shot)
        const verdict = await waitForGesture(REVIEW_GESTURES)
        setReview(null)
        setDeveloping(null)
        if (dead) return
        if (verdict === 'Thumb_Down') {
          shots.pop()
          setThumbs((t) => Object.assign([...t], { [at]: undefined }))
          sfx.retake()
          i--
        } else if (verdict) sfx.keep()
      }
      if (!dead) onDone(shots, themeRef.current)
    })()
    return () => {
      dead = true
      cancelWait?.()
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="screen capture">
      <button className="btn btn-ghost cancel" onClick={onCancel}>{t('cap.cancel')}</button>
      <div className="cap-stage">
        <div className="cap-frame" style={{ aspectRatio: aspect, '--ar': aspect }}>
          <VideoView stream={cam.stream} mirror={mirror} zoom={zoom} videoRef={videoRef} className="live" />
          {zoom > 1 && !review && <div className="zoom-badge" aria-hidden="true">{zoom.toFixed(1)}×</div>}
          {/* One element for developing and review, so the reveal carries on into the review. */}
          {(developing || review) && (
            <ReviewShot shot={developing?.shot ?? review} className={developing ? (developing.done ? 'developed' : 'developing') : ''} />
          )}
          {developing && !developing.done && <div className="cap-msg developing-msg" aria-live="polite">{t('cap.developing')}</div>}
          {showHands && <canvas ref={handsRef} className="hand-overlay" aria-hidden="true" />}
          {waitLeft != null ? (
            <div className={`cap-msg gesture ${review ? 'reviewing' : ''}`} aria-live="polite">
              <span className={`gesture-ring ${holding === 'Thumb_Down' ? 'down' : ''}`} style={{ '--hold': hold }} aria-hidden="true">
                <span>{review ? (holding === 'Thumb_Down' ? '👎' : '👍👎') : '👍'}</span>
              </span>
              <span>{t(review ? 'cap.review' : 'cap.gesture')}</span>
              <small>{t(review ? 'cap.autoKeep' : 'cap.auto', { n: waitLeft })}</small>
              {gestureZoom && !review && <small>{t('cap.zoomHint')}</small>}
            </div>
          ) : (
            count === null && <div className="cap-msg">{t('cap.ready')}</div>
          )}
          {count > 0 && (
            <div key={count} className="digit" aria-live="assertive">{count}</div>
          )}
          {count === 0 && !developing && <div className="cap-msg smile">{t('cap.smile')}</div>}
          {surprise && (
            <div key={surprise.theme} className="cap-msg surprise" aria-live="polite">
              <span className="surprise-art">{surprise.art.map((src) => <img key={src} src={src} alt="" />)}</span>
              <span>{t(`cap.surprise.${surprise.theme}`)}</span>
            </div>
          )}
          {flash && <div className="flash" />}
        </div>
      </div>
      <div className="cap-side">
        <p className="cap-progress">
          {L.shots > 1 ? t('cap.progress', { n: Math.min(index + 1, L.shots), total: L.shots }) : t('cap.look')}
        </p>
        <div className="thumbs">
          {Array.from({ length: L.shots }).map((_, i) => (
            <div className="thumb" key={i}>
              {thumbs[i] ? <img src={thumbs[i]} alt={t('cap.shot', { n: i + 1 })} /> : <span>{i + 1}</span>}
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

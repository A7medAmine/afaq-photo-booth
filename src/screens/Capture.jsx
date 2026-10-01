import { useEffect, useRef, useState } from 'react'
import VideoView from '../VideoView.jsx'
import { grabStill } from '../camera.js'
import { LAYOUTS } from '../compose.js'
import { beep } from '../sound.js'
import { useI18n } from '../i18n.jsx'

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const THUMB_W = 240

// Encoding a full-size shot to a data URL blocks the main thread (and with it the phone preview),
// so only the new shot is shrunk and encoded, asynchronously.
function thumbUrl(shot) {
  const c = document.createElement('canvas')
  c.width = THUMB_W
  c.height = Math.round((THUMB_W * shot.height) / shot.width)
  c.getContext('2d').drawImage(shot, 0, 0, c.width, c.height)
  return new Promise((r) => c.toBlob((b) => r(b ? URL.createObjectURL(b) : ''), 'image/jpeg', 0.7))
}

export default function Capture({ cam, layout, onDone, onCancel }) {
  const L = LAYOUTS[layout]
  const { t } = useI18n()
  const videoRef = useRef(null)
  const [count, setCount] = useState(null)
  const [index, setIndex] = useState(0)
  const [flash, setFlash] = useState(false)
  const [thumbs, setThumbs] = useState([])
  const [aspect, setAspect] = useState(16 / 9)
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

  useEffect(() => {
    let dead = false
    const shots = []
    const urls = []
    ;(async () => {
      await wait(1200)
      for (let i = 0; i < L.shots; i++) {
        if (dead) return
        setIndex(i)
        for (let c = 3; c >= 1; c--) {
          setCount(c)
          beep(520 + (3 - c) * 120, 140)
          await wait(1000)
          if (dead) return
        }
        setCount(0)
        beep(1040, 220, 'square', 0.09)
        setFlash(true)
        const c = camRef.current
        const still = grabStill(c, videoRef.current, c.settings.mirror)
        await wait(350)
        setFlash(false)
        const shot = await still
        if (dead) return
        if (shot) {
          shots.push(shot)
          const at = shots.length - 1
          thumbUrl(shot).then((u) => {
            if (!u) return
            urls.push(u)
            if (dead) return URL.revokeObjectURL(u)
            setThumbs((t) => Object.assign([...t], { [at]: u }))
          })
        }
        await wait(i < L.shots - 1 ? 1100 : 500)
      }
      if (!dead) onDone(shots)
    })()
    return () => {
      dead = true
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="screen capture">
      <button className="btn btn-ghost cancel" onClick={onCancel}>{t('cap.cancel')}</button>
      <div className="cap-stage">
        <div className="cap-frame" style={{ aspectRatio: aspect, '--ar': aspect }}>
          <VideoView stream={cam.stream} mirror={mirror} videoRef={videoRef} className="live" />
          {count === null && <div className="cap-msg">{t('cap.ready')}</div>}
          {count > 0 && (
            <div key={count} className="digit" aria-live="assertive">{count}</div>
          )}
          {count === 0 && <div className="cap-msg smile">{t('cap.smile')}</div>}
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

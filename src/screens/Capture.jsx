import { useEffect, useRef, useState } from 'react'
import VideoView from '../VideoView.jsx'
import { grabStill } from '../camera.js'
import { LAYOUTS } from '../compose.js'
import { beep } from '../sound.js'
import { useI18n } from '../i18n.jsx'

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

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
        if (shot) shots.push(shot)
        setThumbs(shots.map((s) => s.toDataURL('image/jpeg', 0.5)))
        await wait(i < L.shots - 1 ? 1100 : 500)
      }
      if (!dead) onDone(shots)
    })()
    return () => {
      dead = true
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

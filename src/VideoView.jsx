import { useEffect, useRef } from 'react'

export default function VideoView({ stream, mirror, videoRef, className }) {
  const local = useRef(null)
  const ref = videoRef || local
  useEffect(() => {
    const v = ref.current
    if (v && stream) {
      v.srcObject = stream
      v.play?.().catch(() => {})
    }
  }, [stream, ref])
  return (
    <video
      ref={ref}
      className={className}
      autoPlay
      playsInline
      muted
      style={{ transform: mirror ? 'scaleX(-1)' : undefined }}
    />
  )
}

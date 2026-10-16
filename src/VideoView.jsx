import { useEffect, useRef } from 'react'

export default function VideoView({ stream, mirror, zoom = 1, videoRef, className }) {
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
      style={{ transform: mirror || zoom !== 1 ? `scale(${mirror ? -zoom : zoom}, ${zoom})` : undefined }}
    />
  )
}

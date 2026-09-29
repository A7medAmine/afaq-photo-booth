import { useCallback, useEffect, useState } from 'react'
import { useCamera } from './camera.js'
import { fontsReady, preloadAll } from './compose.js'
import { useCustomStickers } from './customStickers.js'
import { useIdle } from './useIdle.js'
import { useI18n } from './i18n.jsx'
import Attract from './screens/Attract.jsx'
import Capture from './screens/Capture.jsx'
import Edit from './screens/Edit.jsx'
import Done from './screens/Done.jsx'

const freshEdit = () => ({ frameId: 'circuit', filterId: 'none', caption: '', stickers: [], doodles: [], ink: [], colors: [], photo: { zoom: 1, ox: 0, oy: 0 } })

export default function App() {
  const cam = useCamera()
  const { t } = useI18n()
  const custom = useCustomStickers()
  const [ready, setReady] = useState(false)
  const [screen, setScreen] = useState('attract')
  const [layout, setLayout] = useState('single')
  const [shots, setShots] = useState([])
  const [edit, setEdit] = useState(freshEdit)
  const [finalBlob, setFinalBlob] = useState(null)

  useEffect(() => {
    const stop = (e) => e.preventDefault()
    window.addEventListener('dragover', stop)
    window.addEventListener('drop', stop)
    return () => {
      window.removeEventListener('dragover', stop)
      window.removeEventListener('drop', stop)
    }
  }, [])

  useEffect(() => {
    Promise.all([fontsReady(), preloadAll()]).finally(() => setReady(true))
  }, [])

  const reset = useCallback(() => {
    setScreen('attract')
    setShots([])
    setEdit(freshEdit())
    setFinalBlob(null)
  }, [])

  useIdle(screen === 'edit', 120000, reset)

  if (!ready) return <div className="boot">{t('boot')}</div>

  if (screen === 'capture')
    return (
      <Capture
        cam={cam}
        layout={layout}
        onCancel={reset}
        onDone={(s) => {
          setShots(s)
          setScreen('edit')
        }}
      />
    )
  if (screen === 'edit')
    return (
      <Edit
        layout={layout}
        shots={shots}
        edit={edit}
        custom={custom.list}
        hidden={custom.hidden}
        groups={custom.groups}
        assign={custom.assign}
        setEdit={setEdit}
        onRetake={() => setScreen('capture')}
        onExit={reset}
        onFinish={(blob) => {
          setFinalBlob(blob)
          setScreen('done')
        }}
      />
    )
  if (screen === 'done') return <Done blob={finalBlob} onNext={reset} />
  return (
    <Attract
      cam={cam}
      custom={custom}
      onTestPhotos={(l, s) => {
        setLayout(l)
        setShots(s)
        setScreen('edit')
      }}
      onStart={(l) => {
        setLayout(l)
        setShots([])
        setScreen('capture')
      }}
    />
  )
}

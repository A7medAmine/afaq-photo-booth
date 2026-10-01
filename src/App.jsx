import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { useCamera } from './camera.js'
import { fontsReady, preloadAll } from './compose.js'
import { warmUpFaces } from './faces.js'
import { useCustomStickers } from './customStickers.js'
import { useIdle } from './useIdle.js'
import { useBoothSettings } from './boothSettings.js'
import { useI18n } from './i18n.jsx'
import Attract from './screens/Attract.jsx'
import Capture from './screens/Capture.jsx'
const Edit = lazy(() => import('./screens/Edit.jsx'))
import Done from './screens/Done.jsx'

const IDLE_WARN = 20

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
  const [share, setShare] = useState(null)
  const [used, setUsed] = useState({ edits: 0, extends: 0 })
  const { booth, updateBooth } = useBoothSettings()

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
    warmUpFaces()
    import('./screens/Edit.jsx')
    Promise.all([fontsReady(), preloadAll()]).finally(() => setReady(true))
  }, [])

  const reset = useCallback(() => {
    setScreen('attract')
    setShots([])
    setEdit(freshEdit())
    setFinalBlob(null)
    setShare(null)
    setUsed({ edits: 0, extends: 0 })
  }, [])

  const idleLeft = useIdle(screen === 'edit', booth.editIdleSeconds * 1000, reset, IDLE_WARN * 1000)

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
      <>
      <Suspense fallback={<div className="boot">{t('boot')}</div>}>
      <Edit
        layout={layout}
        shots={shots}
        edit={edit}
        custom={custom.list}
        hidden={custom.hidden}
        faceCustom={custom.faceList}
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
      </Suspense>
        {idleLeft != null && (
          <div className="modal" role="alertdialog" aria-modal="true" aria-label={t('idle.title')}>
            <div className="modal-card idle-card">
              <h2>{t('idle.title')}</h2>
              <p>{t('idle.body', { n: idleLeft })}</p>
              <button className="btn btn-sun big">{t('idle.stay')}</button>
            </div>
          </div>
        )}
      </>
    )
  if (screen === 'done') return (
      <Done
        blob={finalBlob}
        share={share}
        onShare={setShare}
        booth={booth}
        editsLeft={Math.max(0, booth.maxEdits - used.edits)}
        extendsLeft={Math.max(0, booth.maxExtends - used.extends)}
        onEdit={() => {
          setUsed((u) => ({ ...u, edits: u.edits + 1 }))
          setScreen('edit')
        }}
        onExtend={() => setUsed((u) => ({ ...u, extends: u.extends + 1 }))}
        onNext={reset}
      />
    )
  return (
    <Attract
      cam={cam}
      custom={custom}
      booth={booth}
      updateBooth={updateBooth}
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

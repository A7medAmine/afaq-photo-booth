// Runs the hand-gesture model off the main thread, so the live preview and animations never
// wait on it. Receives small ImageBitmaps of camera frames and posts back the hands it finds.
import { FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision'

// MediaPipe's wasm loader is a classic script. A module worker cannot importScripts it, and a
// plain import would keep its ModuleFactory out of global scope, so it runs as a global eval.
self.import = async (url) => {
  const src = await (await fetch(url)).text()
  ;(0, eval)(`${src}\n//# sourceURL=${url}`)
}

let recognizer = null

function getRecognizer() {
  if (recognizer) return recognizer
  recognizer = FilesetResolver.forVisionTasks('/mediapipe').then((fileset) => {
    const make = (delegate) =>
      GestureRecognizer.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: '/mediapipe/gesture_recognizer.task', delegate },
        runningMode: 'VIDEO',
        numHands: 4,
      })
    return make('GPU').catch(() => make('CPU'))
  })
  // A failed load is retried on the next frame instead of staying broken.
  recognizer.catch(() => { recognizer = null })
  return recognizer
}

// VIDEO mode needs strictly increasing timestamps.
let lastTs = 0
const stamp = () => (lastTs = Math.max(lastTs + 1, performance.now()))

self.onmessage = async ({ data }) => {
  if (data.type === 'warm') {
    // The first calls compile GPU shaders and size buffers, so they run at boot, at the size
    // used for real frames, instead of in front of the guest.
    try {
      const r = await getRecognizer()
      const c = new OffscreenCanvas(data.width, data.height)
      c.getContext('2d').fillRect(0, 0, c.width, c.height)
      for (let i = 0; i < 2; i++) r.recognizeForVideo(c, stamp())
    } catch { /* warm-up only */ }
    return
  }
  const { id, bitmap } = data
  let result = null
  try {
    const res = (await getRecognizer()).recognizeForVideo(bitmap, stamp())
    result = {
      landmarks: res.landmarks,
      gestures: res.gestures.map((hand) => hand.map((g) => ({ categoryName: g.categoryName, score: g.score }))),
    }
  } catch { /* reported as no result */ }
  bitmap.close()
  self.postMessage({ id, result })
}

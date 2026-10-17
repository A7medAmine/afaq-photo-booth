// Hand-gesture shutter: the guest holds up a sign instead of walking back to the screen.
// Runs in the browser (the model in a worker, see handWorker.js); frames never leave the device.

export const SHUTTER_GESTURES = ['Victory', 'Thumb_Up']

const DETECT_W = 640
// Fast enough that a sign registers within a frame or two of being shown.
const FPS = 20
const MIN_SCORE = 0.6
// A frame or two without the hand (motion blur) does not restart the hold.
const GRACE_MS = 250
// Not a MediaPipe category: the two-hand cross sign, worked out from landmarks (see cloneSign).
export const CLONE_SIGN = 'Clone_Jutsu'
// The model runs in a worker (handWorker.js); only shrunk frames and results cross over.
let worker = null
const pending = new Map()
let nextId = 0

function getWorker() {
  if (worker) return worker
  worker = new Worker(new URL('./handWorker.js', import.meta.url), { type: 'module' })
  worker.onmessage = ({ data }) => {
    pending.get(data.id)?.(data.result)
    pending.delete(data.id)
  }
  // A crashed worker is replaced on the next frame instead of staying broken.
  worker.onerror = () => {
    pending.forEach((r) => r(null))
    pending.clear()
    worker.terminate()
    worker = null
  }
  return worker
}

function recognize(bitmap) {
  return new Promise((resolve) => {
    const id = ++nextId
    pending.set(id, resolve)
    getWorker().postMessage({ type: 'frame', id, bitmap }, [bitmap])
  })
}

export function warmUpGestures() {
  getWorker().postMessage({ type: 'warm', width: DETECT_W, height: Math.round((DETECT_W * 9) / 16) })
}

// A 4K camera frame is shrunk first; the model works at a far lower size anyway.
let fallback = null
function grab(video, w, h) {
  return createImageBitmap(video, { resizeWidth: w, resizeHeight: h, resizeQuality: 'low' }).catch(() => {
    fallback ??= document.createElement('canvas')
    fallback.width = w
    fallback.height = h
    fallback.getContext('2d').drawImage(video, 0, 0, w, h)
    return createImageBitmap(fallback)
  })
}

// With several guests in view only the person nearest the camera (the biggest hands) is in
// control: watchers see just that person's one or two hands, so neighbours' signs never mix in.
// Control moves to someone else when their hand is clearly bigger, or once the leader has gone.
const TAKEOVER = 1.25
// A leader hand missing this long (blur, a hand lowered for a moment) hands control on.
const LEAD_GRACE_MS = 500
// The leader's other hand is the nearest one about as big (as far from the camera),
// within this many palm lengths.
const PARTNER_REACH = 3.5

// The longest of three palm lines, so a hand turned sideways still measures close to its size.
function palmSize(hand, aspect) {
  const d = (a, b) => Math.hypot((hand[a].x - hand[b].x) * aspect, hand[a].y - hand[b].y)
  return Math.max(d(0, 5), d(0, 9), d(0, 17))
}

// Returns the indices of the leader's hands in res, updating the leader kept on the loop.
function pickLead(res, aspect, l, now) {
  const hands = res.landmarks
  const side = res.handedness || []
  const size = hands.map((h) => palmSize(h, aspect))
  const wrist = (i) => ({ x: hands[i][0].x * aspect, y: hands[i][0].y })
  const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
  // Handedness is often misread when hands overlap, so a same-side hand only counts as further away.
  const partnerOf = (i) => {
    let best = -1
    let bestGap = Infinity
    hands.forEach((_, j) => {
      if (j === i || size[j] < size[i] * 0.75) return
      const g = gap(wrist(i), wrist(j)) * (side[i] && side[i] === side[j] ? 2 : 1)
      if (g < size[i] * PARTNER_REACH && g < bestGap) [best, bestGap] = [j, g]
    })
    return best
  }
  const team = (i) => [i, partnerOf(i)].filter((j) => j >= 0)
  // The leader's hand this frame is the one nearest to where a leader hand was last frame.
  let lead = -1
  if (l.lead) {
    let bestGap = Infinity
    hands.forEach((_, i) => {
      const g = Math.min(...l.lead.wrists.map((w) => gap(wrist(i), w)))
      if (g < size[i] * 1.5 && g < bestGap) [lead, bestGap] = [i, g]
    })
    if (lead < 0 && now - l.lead.seen <= LEAD_GRACE_MS) return []
  }
  let set = lead >= 0 ? team(lead) : []
  const biggest = size.indexOf(Math.max(...size))
  if (biggest >= 0 && !set.includes(biggest) && (!set.length || size[biggest] > Math.max(...set.map((i) => size[i])) * TAKEOVER)) {
    set = team(biggest)
    l.leadId++
  }
  l.lead = set.length ? { wrists: set.map(wrist), seen: now } : null
  return set
}

// One recognition loop per video, shared by every watcher, so the shutter and zoom
// watchers do not each run the model on the same frame.
const loops = new Map()

// fn(res, now, aspect) gets only the leader's hands (see pickLead), with res.leadId changing
// whenever control moves to someone else. With all, fn gets every hand and res.lead, the
// indices of the leader's.
function onHands(video, fn, { all = false } = {}) {
  let loop = loops.get(video)
  if (!loop) {
    loop = { subs: new Map(), raf: 0, stopped: false, busy: false, lead: null, leadId: 0 }
    loops.set(video, loop)
    const l = loop
    let last = 0
    const tick = (now) => {
      if (l.stopped) return
      l.raf = requestAnimationFrame(tick)
      // One frame in flight at a time: a slow model drops frames instead of queueing them.
      if (l.busy || now - last < 1000 / FPS || !video?.videoWidth) return
      last = now
      l.busy = true
      const h = Math.round((DETECT_W * video.videoHeight) / video.videoWidth)
      grab(video, DETECT_W, h)
        .then(recognize)
        .then((res) => {
          l.busy = false
          if (res && !l.stopped) {
            const t = performance.now()
            const aspect = DETECT_W / h
            const lead = pickLead(res, aspect, l, t)
            const pick = (list) => lead.map((i) => list?.[i])
            const focused = { landmarks: pick(res.landmarks), gestures: pick(res.gestures), handedness: pick(res.handedness), leadId: l.leadId }
            const everyone = { ...res, lead }
            l.subs.forEach((all, f) => f(all ? everyone : focused, t, aspect))
          }
        })
        .catch(() => { l.busy = false })
    }
    l.raf = requestAnimationFrame(tick)
  }
  loop.subs.set(fn, all)
  const l = loop
  return () => {
    l.subs.delete(fn)
    if (l.subs.size) return
    l.stopped = true
    cancelAnimationFrame(l.raf)
    if (loops.get(video) === l) loops.delete(video)
  }
}

// One hand of the clone jutsu sign: index and middle out together, ring and little fingers folded.
// Returns the two fingers' base-to-tip segment (mid of both fingers), or null in any other pose.
// Lenient on purpose: in the cross one hand hides part of the other, so its folded fingers are
// often guessed badly; one of ring and little folded is enough.
function twoFingers(hand, aspect) {
  const d = (a, b) => Math.hypot((hand[a].x - hand[b].x) * aspect, hand[a].y - hand[b].y)
  const palm = d(0, 9)
  if (!palm) return null
  for (const [tip, knuckle] of [[8, 6], [12, 10]]) if (d(0, tip) < d(0, knuckle)) return null
  if (d(0, 16) > d(0, 14) * 1.15 && d(0, 20) > d(0, 18) * 1.15) return null
  const mid = (a, b) => ({ x: ((hand[a].x + hand[b].x) / 2) * aspect, y: (hand[a].y + hand[b].y) / 2 })
  return { palm, from: mid(5, 9), to: mid(8, 12) }
}

// Shortest distance between segments ab and cd.
function segGap(a, b, c, d) {
  const toSeg = (p, s, e) => {
    const vx = e.x - s.x
    const vy = e.y - s.y
    const t = Math.max(0, Math.min(1, ((p.x - s.x) * vx + (p.y - s.y) * vy) / (vx * vx + vy * vy || 1)))
    return Math.hypot(p.x - s.x - vx * t, p.y - s.y - vy * t)
  }
  const cross = (o, p, q) => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x)
  if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return 0
  return Math.min(toSeg(a, c, d), toSeg(b, c, d), toSeg(c, a, b), toSeg(d, a, b))
}

// Naruto's shadow clone sign: both hands two fingers out, the fingers crossed in a plus.
// Returns 'cross' for the sign, 'near' for two two-finger hands close together (the sign
// being formed, or a slightly sloppy one), else null.
function cloneSign(res, aspect) {
  const hands = res.landmarks.map((h) => twoFingers(h, aspect)).filter(Boolean)
  let near = false
  for (let i = 0; i < hands.length; i++) {
    for (let j = i + 1; j < hands.length; j++) {
      const [a, b] = [hands[i], hands[j]]
      const palm = (a.palm + b.palm) / 2
      const gap = segGap(a.from, a.to, b.from, b.to)
      const angle = (h) => Math.atan2(h.to.y - h.from.y, h.to.x - h.from.x)
      // Folded to 0-90°: 90 is a perfect cross, whichever way each hand points.
      let diff = Math.abs(angle(a) - angle(b)) % Math.PI
      if (diff > Math.PI / 2) diff = Math.PI - diff
      if (diff > Math.PI / 5 && gap < palm * 0.6) return 'cross'
      if (gap < palm * 1.2) near = true
    }
  }
  return near ? 'near' : null
}

// The cross sign needs less hold than a one-hand sign: it is never made by accident.
const CLONE_HOLD_MS = 250
// Hands crossing hide each other, so the sign drops out of more frames than a one-hand sign.
const CLONE_GRACE_MS = 600

// Watches the video until one of `wanted` is held for holdMs, then calls onGesture(name).
// onHold(fraction, name) reports how far the current hold is, for a progress ring.
// Returns a stop function. If the model fails to load it just never fires.
export function watchGestures(video, { wanted = SHUTTER_GESTURES, holdMs = 450, onGesture, onHold }) {
  let current = null
  let since = 0
  let seen = 0
  let done = false
  const stop = onHands(video, (res, now, aspect) => {
    if (done) return
    // The cross sign comes first: each of its hands alone often reads as ✌️. Two two-finger
    // hands close together are the cross being formed (or held but misread for a frame), so
    // they never count as ✌️ and keep a cross hold going instead of restarting it.
    const clone = wanted.includes(CLONE_SIGN) ? cloneSign(res, aspect) : null
    const keepClone = current === CLONE_SIGN && (clone === 'near' || now - seen <= CLONE_GRACE_MS)
    const hit = !clone && res.gestures.flat().find((g) => wanted.includes(g.categoryName) && g.score >= MIN_SCORE)
    const name = clone === 'cross' ? CLONE_SIGN : hit?.categoryName ?? null
    if (name && !(keepClone && name !== CLONE_SIGN)) {
      if (name !== current) {
        current = name
        since = now
      }
      seen = now
    } else if (current && !keepClone && now - seen > GRACE_MS) {
      current = null
    }
    const held = current ? Math.min(1, (now - since) / (current === CLONE_SIGN ? CLONE_HOLD_MS : holdMs)) : 0
    onHold?.(held, current)
    if (held >= 1) {
      done = true
      stop()
      onGesture(current)
    }
  })
  return () => {
    done = true
    stop()
  }
}

const HAND_CONNECTIONS = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]]

const GESTURE_EMOJI = { Victory: '✌️', Thumb_Up: '👍', Thumb_Down: '👎', Open_Palm: '✋', Closed_Fist: '✊', Pointing_Up: '☝️', ILoveYou: '🤟' }

// Draws every tracked hand (green joints and dots) and the sign it is read as, so guests
// can see what the booth sees; hands other than the leader's are dimmed. Landmarks are
// flipped and zoomed in code rather than with CSS so they line up with the preview and the
// labels stay readable.
// getZoom() returns the preview's current zoom. cover matches a video shown with
// object-fit: cover, whose edges are cropped. Returns a stop function that clears the canvas.
export function showHands(video, overlay, { mirror = false, getZoom = () => 1, cover = false }) {
  const ctx = overlay.getContext('2d')
  const clear = () => ctx.clearRect(0, 0, overlay.width, overlay.height)
  const stop = onHands(video, (res) => {
    const dpr = window.devicePixelRatio || 1
    const w = Math.round(overlay.clientWidth * dpr)
    const h = Math.round(overlay.clientHeight * dpr)
    if (overlay.width !== w || overlay.height !== h) {
      overlay.width = w
      overlay.height = h
    }
    clear()
    if (!res.landmarks.length) return
    const zoom = getZoom()
    // Under cover the video is scaled up along one axis until it fills the box.
    const over = cover && video.videoWidth ? (video.videoWidth / video.videoHeight) / (w / h) : 1
    const zx = zoom * Math.max(1, over)
    const zy = zoom * Math.max(1, 1 / over)
    const line = Math.max(2, w / 320)
    res.landmarks.forEach((hand, i) => {
      const pts = hand.map((p) => ({ ...p, x: 0.5 + ((mirror ? 1 - p.x : p.x) - 0.5) * zx, y: 0.5 + (p.y - 0.5) * zy }))
      // Guests further back show dimmed: only the leader's signs count.
      ctx.globalAlpha = res.lead.includes(i) ? 1 : 0.35
      ctx.strokeStyle = '#39ff6a'
      ctx.lineWidth = line
      ctx.beginPath()
      for (const [a, b] of HAND_CONNECTIONS) {
        ctx.moveTo(pts[a].x * w, pts[a].y * h)
        ctx.lineTo(pts[b].x * w, pts[b].y * h)
      }
      ctx.stroke()
      ctx.fillStyle = '#00c853'
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = line / 2
      for (const p of pts) {
        ctx.beginPath()
        ctx.arc(p.x * w, p.y * h, line * 1.4, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
      const g = res.gestures[i]?.[0]
      if (!g || g.categoryName === 'None') return
      const top = pts.reduce((a, p) => (p.y < a.y ? p : a))
      const label = `${GESTURE_EMOJI[g.categoryName] || ''} ${g.categoryName.replace('_', ' ')} ${Math.round(g.score * 100)}%`
      ctx.font = `bold ${Math.round(line * 9)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.lineJoin = 'round'
      ctx.lineWidth = line * 2
      ctx.strokeStyle = '#000'
      ctx.fillStyle = '#39ff6a'
      const y = Math.max(line * 10, top.y * h - line * 6)
      ctx.strokeText(label, top.x * w, y)
      ctx.fillText(label, top.x * w, y)
    })
    ctx.globalAlpha = 1
  }, { all: true })
  return () => {
    stop()
    clear()
  }
}

export const MAX_ZOOM = 3
const SIGNS = [...SHUTTER_GESTURES, 'Thumb_Down']

// Thumb-to-index gap over palm length, or null when the hand is not in the pinch pose:
// middle, ring and little fingers folded, index still out (a fist or 👍 is not a pinch).
function pinchRatio(hand, aspect) {
  const d = (a, b) => Math.hypot((hand[a].x - hand[b].x) * aspect, hand[a].y - hand[b].y)
  const palm = d(0, 9)
  if (!palm) return null
  for (const [tip, knuckle] of [[12, 10], [16, 14], [20, 18]]) if (d(0, tip) > d(0, knuckle)) return null
  if (d(0, 8) < d(0, 6)) return null
  return d(4, 8) / palm
}

// Fingertip gap, over palm length, under which the pinch counts as shut.
const PINCH_SHUT = 0.25
// A shut pinch held this long starts zooming out; any shorter is just the start of a spread.
const ZOOM_OUT_AFTER = 700
// Zoom levels lost per second while the shut pinch is held.
const ZOOM_OUT_RATE = 0.3
// Most zoom levels gained per second, however fast the fingers spread.
const ZOOM_IN_RATE = 0.6
// How strongly spreading zooms: 0.3 means a spread to ten times the start gap doubles the zoom.
const ZOOM_GAIN = 0.3
// The pinch pose must hold this long before it zooms, so a hand passing through it on the
// way to another sign (the clone sign's crossed fingers) does not zoom.
const PINCH_ARM = 350

// A hand close to another one is making a two-hand sign (clone, frame), not a pinch.
function nearOtherHand(hands, i, aspect) {
  const c = (h) => ({ x: ((h[0].x + h[9].x) / 2) * aspect, y: (h[0].y + h[9].y) / 2 })
  const palm = (h) => Math.hypot((h[0].x - h[9].x) * aspect, h[0].y - h[9].y)
  const a = c(hands[i])
  return hands.some((h, j) => j !== i && Math.hypot(c(h).x - a.x, c(h).y - a.y) < (palm(h) + palm(hands[i])) * 1.5)
}

// One-hand zoom, like a ratchet: in the pinch pose, spreading thumb and index zooms in, and
// closing them only re-grips, so the guest can close and spread again to zoom further.
// Holding the pinch shut zooms out gradually until it opens or reaches 1×.
// The zoom is relative to where the pinch started, so any hand size or distance works.
// Calls onZoom(level) with a level from 1 to MAX_ZOOM. Returns a stop function.
export function watchZoom(video, { start = 1, onZoom }) {
  let zoom = start
  let from = zoom
  let base = null
  let seen = 0
  let shutSince = 0
  let armedSince = 0
  let leadId = null
  return onHands(video, (res, now, aspect) => {
    // A new leader starts their own grip instead of carrying on from the last one's fingers.
    if (res.leadId !== leadId) {
      leadId = res.leadId
      base = null
      shutSince = 0
      armedSince = 0
    }
    let r = null
    if (!cloneSign(res, aspect)) {
      res.landmarks.forEach((hand, i) => {
        if (r != null || SIGNS.includes(res.gestures[i]?.[0]?.categoryName)) return
        if (nearOtherHand(res.landmarks, i, aspect)) return
        r = pinchRatio(hand, aspect)
      })
    }
    if (r == null) {
      if (now - seen > GRACE_MS) {
        base = null
        shutSince = 0
        armedSince = 0
      }
      return
    }
    const dt = now - seen
    seen = now
    armedSince ||= now
    if (now - armedSince < PINCH_ARM) return
    // Starting from touching fingertips would make the first millimetre jump to full zoom.
    const grip = () => {
      base = Math.max(r, 0.15)
      from = zoom
    }
    if (!base) {
      grip()
      shutSince = r < PINCH_SHUT ? now : 0
      return
    }
    if (r < PINCH_SHUT) {
      shutSince ||= now
      if (now - shutSince >= ZOOM_OUT_AFTER && zoom > 1) {
        zoom = Math.max(1, zoom - (ZOOM_OUT_RATE * Math.min(dt, 200)) / 1000)
        onZoom(zoom)
      }
      grip()
      return
    }
    shutSince = 0
    const target = Math.min(MAX_ZOOM, Math.max(1, from * (Math.max(r, 0.15) / base) ** ZOOM_GAIN))
    // Closing the fingers re-grips at the current zoom instead of zooming out.
    if (target < zoom) return grip()
    // Eases toward the target and ignores tiny tremors so the picture does not shimmer.
    if (Math.abs(target - zoom) < 0.02) return
    zoom += Math.min((target - zoom) * 0.12, (ZOOM_IN_RATE * Math.min(dt, 200)) / 1000)
    if (zoom < 1.02) zoom = 1
    onZoom(zoom)
  })
}

// One hand of the "frame" sign: thumb and index out in an L, the other three fingers folded.
// Returns the two fingertips, or null when the hand is in any other pose.
function lCorner(hand, aspect) {
  const d = (a, b) => Math.hypot((hand[a].x - hand[b].x) * aspect, hand[a].y - hand[b].y)
  const palm = d(0, 9)
  if (!palm) return null
  for (const [tip, knuckle] of [[12, 10], [16, 14], [20, 18]]) if (d(0, tip) > d(0, knuckle)) return null
  if (d(0, 8) < d(0, 6) * 1.1) return null
  // Thumb clear of the index knuckle and of the index tip: an open L, not a pinch or a fist.
  if (d(4, 5) < palm * 0.5 || d(4, 8) < palm * 0.7) return null
  return { palm, pts: [hand[4], hand[8]], wrist: hand[0] }
}

// The "frame" sign: two hands, each in an L, at opposite corners of a rectangle, like a
// photographer framing a shot. Held for holdMs it calls onFrame(). onHold(fraction) drives a
// progress ring. Returns a stop function.
export function watchFrame(video, { holdMs = 700, onFrame, onHold }) {
  let since = 0
  let seen = 0
  let done = false
  const stop = onHands(video, (res, now, aspect) => {
    if (done) return
    const corners = res.landmarks.map((h) => lCorner(h, aspect)).filter(Boolean)
    let hit = false
    for (let i = 0; i < corners.length && !hit; i++) {
      for (let j = i + 1; j < corners.length && !hit; j++) {
        const [a, b] = [corners[i], corners[j]]
        const palm = (a.palm + b.palm) / 2
        const xs = [...a.pts, ...b.pts].map((p) => p.x * aspect)
        const ys = [...a.pts, ...b.pts].map((p) => p.y)
        const wide = Math.max(...xs) - Math.min(...xs) > palm * 0.8
        const tall = Math.max(...ys) - Math.min(...ys) > palm * 0.6
        // Opposite corners: the wrists sit apart both across and up-down.
        const diag = Math.abs(a.wrist.x - b.wrist.x) * aspect > palm * 0.5 && Math.abs(a.wrist.y - b.wrist.y) > palm * 0.4
        hit = wide && tall && diag
      }
    }
    if (hit) {
      if (!since) since = now
      seen = now
    } else if (since && now - seen > GRACE_MS) {
      since = 0
    }
    const held = since ? Math.min(1, (now - since) / holdMs) : 0
    onHold?.(held)
    if (held >= 1) {
      done = true
      stop()
      onFrame()
    }
  })
  return () => {
    done = true
    stop()
  }
}

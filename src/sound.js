// Sound effects, synthesised with Web Audio so the booth needs no audio files and works offline.
let ctx
let master
let on = true

export function setSoundOn(v) {
  on = !!v
}

function audio() {
  if (!on) return null
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
      // The note gains below are small; the master lifts them to a clear level for a noisy
      // room and the limiter keeps overlapping sounds from clipping.
      master = ctx.createGain()
      master.gain.value = 5
      const limiter = ctx.createDynamicsCompressor()
      limiter.threshold.value = -8
      limiter.knee.value = 4
      limiter.ratio.value = 12
      limiter.attack.value = 0.002
      limiter.release.value = 0.15
      master.connect(limiter).connect(ctx.destination)
    }
    // Browsers start the context suspended until the first tap.
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  } catch {
    return null
  }
}

// One note: freq can glide to `to` over the note. `at` is seconds from now.
function tone(freq, ms, { type = 'square', gain = 0.06, to, at = 0, attack = 0.005 } = {}) {
  const a = audio()
  if (!a) return
  const t0 = a.currentTime + at
  const t1 = t0 + ms / 1000
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t0)
  if (to) o.frequency.exponentialRampToValueAtTime(to, t1)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t1)
  o.connect(g).connect(master)
  o.start(t0)
  o.stop(t1 + 0.02)
}

let noiseBuf
// A burst of white noise through a filter, for clicks and whooshes.
function noise(ms, { gain = 0.2, filter = 'highpass', freq = 2000, to, at = 0 } = {}) {
  const a = audio()
  if (!a) return
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  const t0 = a.currentTime + at
  const t1 = t0 + ms / 1000
  const src = a.createBufferSource()
  src.buffer = noiseBuf
  const f = a.createBiquadFilter()
  f.type = filter
  f.frequency.setValueAtTime(freq, t0)
  if (to) f.frequency.exponentialRampToValueAtTime(to, t1)
  const g = a.createGain()
  g.gain.setValueAtTime(gain, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t1)
  src.connect(f).connect(g).connect(master)
  src.start(t0)
  src.stop(t1 + 0.02)
}

const arp = (notes, step, { at = 0, ...opts } = {}) => notes.forEach((f, i) => tone(f, step * 1.6, { ...opts, at: at + (i * step) / 1000 }))

export const sfx = {
  // Any button press: a soft blip, a little fuller for the big main buttons.
  tap: (big) => (big ? tone(660, 110, { type: 'triangle', gain: 0.09, to: 990 }) : tone(1100, 70, { type: 'triangle', gain: 0.07 })),
  // START: the booth powers on.
  wake: () => {
    tone(220, 380, { type: 'sawtooth', gain: 0.035, to: 880 })
    arp([784, 1175], 90, { type: 'triangle', gain: 0.06, at: 0.3 })
  },
  // One countdown second; the pitch climbs over the last three.
  tick: (c) => tone(520 + Math.max(0, 3 - c) * 120, 140, { gain: 0.06 }),
  // A camera shutter: two quick mechanical clicks with a bright flash tone.
  shutter: () => {
    noise(40, { gain: 0.12, freq: 3000 })
    noise(70, { gain: 0.09, freq: 1800, at: 0.07 })
    tone(1040, 220, { gain: 0.05 })
  },
  // A hand sign was read.
  sign: () => tone(880, 70, { type: 'sine', gain: 0.05, to: 1320 }),
  // 👍 on the review: keep the shot.
  keep: () => arp([784, 1047], 80, { type: 'triangle', gain: 0.06 }),
  // 👎 on the review: a sad slide down before the retake.
  retake: () => tone(440, 320, { type: 'triangle', gain: 0.08, to: 220 }),
  // A secret theme unlocked: a sparkly arpeggio.
  secret: () => {
    arp([523, 659, 784, 1047, 1319], 70, { type: 'triangle', gain: 0.06 })
    noise(500, { gain: 0.04, filter: 'bandpass', freq: 6000, to: 9000, at: 0.2 })
  },
  // Sticker or text added.
  pop: () => tone(300, 90, { type: 'sine', gain: 0.12, to: 900 }),
  // Sticker removed.
  whoosh: () => noise(220, { gain: 0.12, filter: 'bandpass', freq: 2500, to: 400 }),
  // Photo is ready to scan.
  success: () => arp([523, 659, 784, 1047], 95, { type: 'triangle', gain: 0.07 }),
  // Upload failed or a wrong PIN.
  error: () => {
    tone(180, 160, { type: 'square', gain: 0.05 })
    tone(140, 220, { type: 'square', gain: 0.05, at: 0.17 })
  },
  // "Still there?" when the edit screen is about to time out.
  nudge: () => arp([988, 784], 140, { type: 'sine', gain: 0.07 }),
}

import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data')
const PORT = process.env.PORT || 8787
const UPLOAD_KEY = process.env.UPLOAD_KEY || ''
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '')
// Photos are temporary unless the guest ticks the box to let the club keep them.
const TEMP_MINUTES = Math.max(1, Number(process.env.TEMP_MINUTES) || 10)
const TEMP_MS = TEMP_MINUTES * 60 * 1000
const TOKEN_SECRET = process.env.TOKEN_SECRET || crypto.randomBytes(24).toString('hex')
const TEMP_DIR = path.join(DATA_DIR, 'temp')

fs.mkdirSync(DATA_DIR, { recursive: true })
fs.mkdirSync(TEMP_DIR, { recursive: true })

const app = express()

app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-Upload-Key, X-Token, X-Keep, X-Variant')
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

const PHONE_PORT = 8080
const isLocal = (req) => /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(req.socket.remoteAddress || '')

function adb(args, timeout = 8000) {
  return new Promise((resolve, reject) => {
    execFile('adb', args, { timeout }, (err, out, stderr) => {
      if (!err) return resolve(out)
      reject(new Error(err.code === 'ENOENT' ? 'adb is not installed on this computer' : (stderr || '').trim() || err.message))
    })
  })
}

// Lines of `adb devices -l` look like: R58M12ABCDE  device product:x model:SM_A525F device:y transport_id:1
async function usbPhones() {
  const out = await adb(['devices', '-l'])
  return out
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('*') && !l.startsWith('List of'))
    .map((l) => {
      const [serial, state] = l.split(/\s+/)
      return { serial, state, model: /model:(\S+)/.exec(l)?.[1]?.replace(/_/g, ' ') || serial }
    })
}

function usbHint(phones) {
  if (phones.some((p) => p.state === 'unauthorized')) return 'Tap Allow on the phone to trust this computer, then try again'
  if (phones.some((p) => p.state === 'offline')) return 'The phone is offline. Unplug it and plug it back in'
  return 'No phone found. Plug it in and allow USB debugging'
}

async function probeHealth(base, ms) {
  try {
    const r = await fetch(`${base}/health`, { signal: AbortSignal.timeout(ms) })
    if (!r.ok) return null
    const h = await r.json()
    return h?.ok ? h : null
  } catch {
    return null
  }
}

// Checks whether the camera app answers on one phone without touching the booth's own port 8080.
async function usbAppHealth(serial) {
  try {
    const port = (await adb(['-s', serial, 'forward', 'tcp:0', `tcp:${PHONE_PORT}`])).trim()
    if (!/^\d+$/.test(port)) return null
    const h = await probeHealth(`http://127.0.0.1:${port}`, 2500)
    adb(['-s', serial, 'forward', '--remove', `tcp:${port}`]).catch(() => {})
    return h
  } catch {
    return null
  }
}

// Every address in the /24 of each private network this computer is on, its own included
// so `npm run fake-phone` shows up too. A phone hotspot puts the phone at .1 of that range.
function lanHosts() {
  const hosts = new Set()
  const own = new Set()
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family !== 'IPv4' || a.internal) continue
      if (!/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address)) continue
      own.add(a.address)
      const prefix = a.address.split('.').slice(0, 3).join('.')
      for (let i = 1; i < 255; i++) hosts.add(`${prefix}.${i}`)
    }
  }
  return { hosts: [...hosts], own }
}

async function scanLan() {
  const { hosts, own } = lanHosts()
  const found = []
  let ownFound = false
  let next = 0
  const worker = async () => {
    while (next < hosts.length) {
      const host = hosts[next++]
      const url = `http://${host}:${PHONE_PORT}`
      const health = await probeHealth(url, 900)
      if (!health) continue
      // This computer answers on each of its networks; list it once.
      if (own.has(host)) {
        if (ownFound) continue
        ownFound = true
      }
      found.push({ url, health, self: own.has(host) })
    }
  }
  await Promise.all(Array.from({ length: 128 }, worker))
  return found.sort((a, b) => a.url.localeCompare(b.url, undefined, { numeric: true }))
}

app.get('/api/phone/usb', async (req, res) => {
  if (!isLocal(req)) return res.sendStatus(403)
  try {
    const phones = await usbPhones()
    await Promise.all(phones.map(async (p) => {
      p.health = p.state === 'device' ? await usbAppHealth(p.serial) : null
    }))
    res.json({ ok: true, phones, hint: phones.some((p) => p.state === 'device') ? '' : usbHint(phones) })
  } catch (e) {
    res.json({ ok: false, phones: [], error: e.message })
  }
})

app.get('/api/phone/scan', async (req, res) => {
  if (!isLocal(req)) return res.sendStatus(403)
  res.json({ ok: true, phones: await scanLan() })
})

// Forwards the chosen phone to localhost:8080. A phone that is no longer plugged in is
// replaced by the only phone that is, so a swapped phone still connects on its own.
app.post('/api/phone/usb', express.json(), async (req, res) => {
  if (!isLocal(req)) return res.sendStatus(403)
  try {
    const phones = await usbPhones()
    const ready = phones.filter((p) => p.state === 'device')
    const pick = ready.find((p) => p.serial === req.body?.serial) || (ready.length === 1 ? ready[0] : null)
    if (!pick) throw new Error(ready.length ? 'Several phones are plugged in. Choose one with Find cameras' : usbHint(phones))
    await adb(['-s', pick.serial, 'forward', `tcp:${PHONE_PORT}`, `tcp:${PHONE_PORT}`])
    res.json({ ok: true, serial: pick.serial, model: pick.model })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

const newId = () => crypto.randomBytes(6).toString('base64url')
const isId = (id) => /^[A-Za-z0-9_-]{6,12}$/.test(id)
// Each photo has a full-resolution file and a medium preview (`.p.jpg`). Either may be missing:
// the booth sends the preview first, and older booths send only the full file.
const VARIANTS = ['full', 'preview']
const nameOf = (id, variant) => (variant === 'preview' ? `${id}.p.jpg` : `${id}.jpg`)
const keptFile = (id, variant = 'full') => path.join(DATA_DIR, nameOf(id, variant))
const tempFile = (id, variant = 'full') => path.join(TEMP_DIR, nameOf(id, variant))
const fileIn = (kept, id, variant) => (kept ? keptFile(id, variant) : tempFile(id, variant))
const baseUrl = (req) => PUBLIC_URL || `${req.protocol}://${req.get('host')}`
const tokenOf = (id) => crypto.createHmac('sha256', TOKEN_SECRET).update(id).digest('base64url').slice(0, 22)
const allowed = (req, id) => {
  const got = Buffer.from(req.get('X-Token') || '')
  const want = Buffer.from(tokenOf(id))
  return got.length === want.length && crypto.timingSafeEqual(got, want)
}

// Where a photo lives right now, and when it disappears (null = kept).
// The expiry runs from the first upload, so the later full file does not extend it.
function locate(id) {
  if (!isId(id)) return null
  const present = (kept) => VARIANTS.filter((v) => fs.existsSync(fileIn(kept, id, v)))
  const kept = present(true)
  if (kept.length) return { kept: true, variants: kept, expires: null }
  const temp = present(false)
  if (!temp.length) return null
  const born = Math.min(...temp.map((v) => fs.statSync(tempFile(id, v)).mtimeMs))
  if (Date.now() - born >= TEMP_MS) return null
  return { kept: false, variants: temp, expires: born + TEMP_MS }
}

// Serves the asked-for variant, falling back to the other one while it is missing.
const pick = (at, id, want) => fileIn(at.kept, id, at.variants.includes(want) ? want : at.variants[0])

function setKept(id, at, keep) {
  for (const v of at.variants) fs.renameSync(fileIn(at.kept, id, v), fileIn(keep, id, v))
  if (!keep) {
    const now = new Date()
    for (const v of at.variants) fs.utimesSync(tempFile(id, v), now, now)
  }
}

function sweep() {
  for (const name of fs.readdirSync(TEMP_DIR)) {
    const file = path.join(TEMP_DIR, name)
    try {
      if (Date.now() - fs.statSync(file).mtimeMs >= TEMP_MS) fs.unlinkSync(file)
    } catch { /* already gone */ }
  }
}
sweep()
setInterval(sweep, 30 * 1000).unref()

const rawJpeg = express.raw({ type: 'image/*', limit: '60mb' })

app.post('/api/photos', rawJpeg, (req, res) => {
  if (UPLOAD_KEY && req.get('X-Upload-Key') !== UPLOAD_KEY) {
    return res.status(401).json({ error: 'bad upload key' })
  }
  if (!Buffer.isBuffer(req.body) || req.body.length < 1000) {
    return res.status(400).json({ error: 'send the JPEG as the raw request body' })
  }
  const id = newId()
  const keep = req.get('X-Keep') === '1'
  const variant = req.get('X-Variant') === 'preview' ? 'preview' : 'full'
  fs.writeFileSync(fileIn(keep, id, variant), req.body)
  res.json({ id, token: tokenOf(id), keep, ttlMinutes: TEMP_MINUTES, url: `${baseUrl(req)}/p/${id}` })
})

// The full-resolution file, sent after the preview. It lands next to the preview, kept or not.
app.put('/api/photos/:id/full', rawJpeg, (req, res) => {
  const { id } = req.params
  if (!isId(id) || !allowed(req, id)) return res.sendStatus(403)
  const at = locate(id)
  if (!at) return res.sendStatus(404)
  if (!Buffer.isBuffer(req.body) || req.body.length < 1000) {
    return res.status(400).json({ error: 'send the JPEG as the raw request body' })
  }
  const file = fileIn(at.kept, id, 'full')
  const stamp = !at.kept && at.variants.includes('preview') ? fs.statSync(tempFile(id, 'preview')).mtime : null
  fs.writeFileSync(file, req.body)
  if (stamp) fs.utimesSync(file, stamp, stamp)
  res.json({ ok: true })
})

// The guest can tick or untick "let the club keep my photo" after upload. Unticked photos expire.
app.put('/api/photos/:id/keep', express.json(), (req, res) => {
  const { id } = req.params
  if (!isId(id) || !allowed(req, id)) return res.sendStatus(403)
  const at = locate(id)
  if (!at) return res.sendStatus(404)
  const keep = req.body?.keep === true
  if (keep !== at.kept) setKept(id, at, keep)
  res.json({ keep })
})

app.delete('/api/photos/:id', (req, res) => {
  const { id } = req.params
  if (!isId(id) || !allowed(req, id)) return res.sendStatus(403)
  for (const v of VARIANTS) for (const f of [keptFile(id, v), tempFile(id, v)]) fs.rmSync(f, { force: true })
  res.sendStatus(204)
})

// /files/:id.jpg is the full photo; ?size=preview is the medium copy shown on the page.
app.get('/files/:id.jpg', (req, res) => {
  const { id } = req.params
  const at = locate(id)
  if (!at) return res.sendStatus(404)
  const want = req.query.size === 'preview' ? 'preview' : 'full'
  const suffix = want === 'preview' ? '-small' : ''
  if (req.query.dl) res.set('Content-Disposition', `attachment; filename="afaq-photo-${id}${suffix}.jpg"`)
  // The full file can still be on its way, so only a kept photo with both files is cached.
  const final = !at.expires && at.variants.length === VARIANTS.length
  res.set('Cache-Control', final ? 'public, max-age=86400' : 'private, no-store')
  res.type('image/jpeg').sendFile(pick(at, id, want))
})

app.get('/p/:id', (req, res) => {
  const { id } = req.params
  const at = locate(id)
  if (!at) return res.status(404).type('html').send(page('Photo not found', notFound()))
  const left = at.expires ? Math.max(1, Math.ceil((at.expires - Date.now()) / 60000)) : 0
  res.type('html').send(page('Your AFAQ photo', photoView(id, left), at.expires ? '' : `${baseUrl(req)}/files/${id}.jpg?size=preview`))
})

app.get('/', (_req, res) => res.type('html').send(page('AFAQ Photo Booth', notFound(true))))

const page = (title, body, ogImage = '') => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta property="og:title" content="${title}">
${ogImage ? `<meta property="og:image" content="${ogImage}">` : ''}
<style>
  @font-face { font-family: Pixel; src: url(/fonts/Minecraft.woff2) format("woff2"); }
  :root { --ink:#030a2e; --blue:#2460e7; --sky:#3ca2fa; --sun:#ffd23f; --pink:#ff5fa2; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100dvh; display:grid; place-items:center; padding:24px 16px;
    background: var(--blue); color:#fff; font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    background-image: radial-gradient(circle at 12% 18%, var(--sky) 0 90px, transparent 91px),
                      radial-gradient(circle at 92% 88%, var(--pink) 0 70px, transparent 71px); }
  main { width:min(420px,100%); text-align:center; }
  .brand { display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:18px;
    font-family: Pixel, monospace; font-size:20px; }
  .brand img { width:40px; height:40px; border-radius:10px; border:3px solid var(--ink); }
  .card { background:#fff; padding:12px 12px 14px; border:4px solid var(--ink); border-radius:18px;
    box-shadow:8px 8px 0 var(--ink); transform:rotate(-1.5deg); }
  .card img { display:block; width:100%; border-radius:8px; }
  h1 { font-family: Pixel, monospace; font-weight:400; font-size:26px; line-height:1.2; margin:26px 0 8px; }
  p { margin:0 0 22px; opacity:.92; line-height:1.5; }
  a.btn { display:block; padding:18px 20px; background:var(--sun); color:var(--ink); text-decoration:none;
    font-weight:800; font-size:20px; border:4px solid var(--ink); border-radius:18px; box-shadow:6px 6px 0 var(--ink); }
  a.btn:active { transform:translate(4px,4px); box-shadow:2px 2px 0 var(--ink); }
  a.alt { display:inline-block; margin-top:16px; color:#fff; font-weight:700; }
  small { display:block; margin-top:18px; opacity:.75; }
</style>
</head>
<body><main>
<div class="brand"><img src="/assets/main.webp" alt="">AFAQ Scientific Club</div>
${body}
</main></body></html>`

const photoView = (id, left) => `
<div class="card"><img src="/files/${id}.jpg?size=preview" alt="Your photo booth picture"></div>
<h1>Looking good!</h1>
<p>Save your picture to your phone.</p>
<a class="btn" href="/files/${id}.jpg?dl=1" download>Download full quality</a>
<a class="alt" href="/files/${id}.jpg?size=preview&dl=1" download>Smaller file, quicker to share</a>
<small>We never keep your photo unless you ask us to. ${left ? `This one is deleted from our server in about ${left} minute${left === 1 ? '' : 's'}, so download it now.` : 'You chose to let the club keep this one.'} Tip: on iPhone, press and hold the photo and choose Add to Photos.</small>`

const notFound = (home) => `
<h1>${home ? 'AFAQ Photo Booth' : 'Photo not found'}</h1>
<p>${home ? 'Scan the QR code at the booth to get your photo.' : 'This link may be wrong, or the photo has expired or was removed. Ask at the booth for a new code.'}</p>`

app.get('/favicon.svg', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'favicon.svg')))
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')))
app.use('/fonts', express.static(path.join(__dirname, 'public', 'fonts')))

app.listen(PORT, '0.0.0.0', () => console.log(`AFAQ booth cloud listening on :${PORT}`))

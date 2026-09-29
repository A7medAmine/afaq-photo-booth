import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data')
const PORT = process.env.PORT || 8787
const UPLOAD_KEY = process.env.UPLOAD_KEY || ''
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '')

fs.mkdirSync(DATA_DIR, { recursive: true })

const app = express()

app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-Upload-Key')
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.post('/api/phone/usb', (req, res) => {
  const ip = req.socket.remoteAddress || ''
  if (!/^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(ip)) return res.sendStatus(403)
  execFile('adb', ['forward', 'tcp:8080', 'tcp:8080'], { timeout: 8000 }, (err, _out, stderr) => {
    if (!err) return res.json({ ok: true })
    const missing = err.code === 'ENOENT'
    const msg = missing
      ? 'adb is not installed on this computer'
      : (stderr || '').trim() || 'No phone found. Plug it in and allow USB debugging'
    res.status(500).json({ ok: false, error: msg })
  })
})

const newId = () => crypto.randomBytes(6).toString('base64url')
const isId = (id) => /^[A-Za-z0-9_-]{6,12}$/.test(id)
const fileOf = (id) => path.join(DATA_DIR, `${id}.jpg`)
const baseUrl = (req) => PUBLIC_URL || `${req.protocol}://${req.get('host')}`

app.post('/api/photos', express.raw({ type: 'image/*', limit: '20mb' }), (req, res) => {
  if (UPLOAD_KEY && req.get('X-Upload-Key') !== UPLOAD_KEY) {
    return res.status(401).json({ error: 'bad upload key' })
  }
  if (!Buffer.isBuffer(req.body) || req.body.length < 1000) {
    return res.status(400).json({ error: 'send the JPEG as the raw request body' })
  }
  const id = newId()
  fs.writeFileSync(fileOf(id), req.body)
  res.json({ id, url: `${baseUrl(req)}/p/${id}` })
})

app.get('/files/:id.jpg', (req, res) => {
  const { id } = req.params
  if (!isId(id) || !fs.existsSync(fileOf(id))) return res.sendStatus(404)
  if (req.query.dl) res.set('Content-Disposition', `attachment; filename="afaq-photo-${id}.jpg"`)
  res.set('Cache-Control', 'public, max-age=86400')
  res.type('image/jpeg').sendFile(fileOf(id))
})

app.get('/p/:id', (req, res) => {
  const { id } = req.params
  if (!isId(id) || !fs.existsSync(fileOf(id))) {
    return res.status(404).type('html').send(page('Photo not found', notFound()))
  }
  res.type('html').send(page('Your AFAQ photo', photoView(id), `${baseUrl(req)}/files/${id}.jpg`))
})

app.get('/', (_req, res) => res.type('html').send(page('AFAQ Photo Booth', notFound(true))))

const page = (title, body, ogImage = '') => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
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
  small { display:block; margin-top:18px; opacity:.75; }
</style>
</head>
<body><main>
<div class="brand"><img src="/assets/main.webp" alt="">AFAQ Scientific Club</div>
${body}
</main></body></html>`

const photoView = (id) => `
<div class="card"><img src="/files/${id}.jpg" alt="Your photo booth picture"></div>
<h1>Looking good!</h1>
<p>Save your picture to your phone.</p>
<a class="btn" href="/files/${id}.jpg?dl=1" download>Download photo</a>
<small>Tip: on iPhone, press and hold the photo and choose Add to Photos.</small>`

const notFound = (home) => `
<h1>${home ? 'AFAQ Photo Booth' : 'Photo not found'}</h1>
<p>${home ? 'Scan the QR code at the booth to get your photo.' : 'This link may be wrong, or the photo was removed. Ask at the booth for a new code.'}</p>`

app.use('/assets', express.static(path.join(__dirname, '..', 'public', 'assets')))
app.use('/fonts', express.static(path.join(__dirname, '..', 'public', 'fonts')))

app.listen(PORT, '0.0.0.0', () => console.log(`AFAQ booth cloud listening on :${PORT}`))

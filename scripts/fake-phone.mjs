import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const PORT = 8080
const FPS = 10

function loadJpegs(dir) {
  try {
    return fs.readdirSync(dir).filter((f) => /\.jpe?g$/i.test(f)).map((f) => fs.readFileSync(path.join(dir, f)))
  } catch {
    return []
  }
}

let frames = loadJpegs(path.join(root, 'fake-phone'))
if (!frames.length) frames = loadJpegs(path.join(root, '..', 'cloud', 'data'))
if (!frames.length) {
  console.error('No JPEGs found. Drop any .jpg files into scripts/fake-phone/ and run again.')
  process.exit(1)
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
const health = { ok: true, camera: 'back', width: 1280, height: 720, stillWidth: 4032, stillHeight: 3024, battery: 76, charging: true }

http
  .createServer((req, res) => {
    const url = req.url.split('?')[0]
    if (req.method === 'OPTIONS') return res.writeHead(204, cors).end()
    if (url === '/health') {
      return res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }).end(JSON.stringify(health))
    }
    if (url === '/photo') {
      const img = frames[Math.floor(Math.random() * frames.length)]
      return res.writeHead(200, { ...cors, 'Content-Type': 'image/jpeg', 'Content-Length': img.length, 'Cache-Control': 'no-store' }).end(img)
    }
    if (url === '/stream') {
      res.writeHead(200, { ...cors, 'Content-Type': 'multipart/x-mixed-replace; boundary=frame', 'Cache-Control': 'no-store' })
      let i = 0
      const timer = setInterval(() => {
        const img = frames[i++ % frames.length]
        res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${img.length}\r\n\r\n`)
        res.write(img)
        res.write('\r\n')
      }, 1000 / FPS)
      req.on('close', () => clearInterval(timer))
      return
    }
    res.writeHead(404, { ...cors, 'Content-Type': 'application/json' }).end('{"ok":false,"error":"not found"}')
  })
  .listen(PORT, '0.0.0.0', () => console.log(`Fake phone on http://localhost:${PORT} with ${frames.length} image(s)`))

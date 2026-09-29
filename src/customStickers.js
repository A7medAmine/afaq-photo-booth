import { useCallback, useEffect, useState } from 'react'
import { whenLoaded } from './compose.js'

const DB = 'afaq-booth'
const STORE = 'stickers'
const MAX = 800

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx(mode, fn) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const out = fn(t.objectStore(STORE))
    t.oncomplete = () => resolve(out.result)
    t.onerror = () => reject(t.error)
  })
}

async function shrink(file) {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, MAX / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k)
  c.height = Math.round(bmp.height * k)
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  return new Promise((r) => c.toBlob(r, 'image/png'))
}

async function toSticker(rec) {
  const src = URL.createObjectURL(rec.blob)
  await whenLoaded(src).catch(() => {})
  return { id: rec.id, kind: 'img', src, size: 0.4, custom: true }
}

export function useCustomStickers() {
  const [list, setList] = useState([])

  useEffect(() => {
    let dead = false
    tx('readonly', (s) => s.getAll())
      .then((recs) => Promise.all(recs.sort((a, b) => a.added - b.added).map(toSticker)))
      .then((l) => !dead && setList(l))
      .catch(() => {})
    return () => {
      dead = true
    }
  }, [])

  const add = useCallback(async (files) => {
    const made = []
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue
      const rec = { id: `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, blob: await shrink(f), added: Date.now() }
      await tx('readwrite', (s) => s.put(rec))
      made.push(await toSticker(rec))
    }
    setList((l) => [...l, ...made])
  }, [])

  const remove = useCallback(async (id) => {
    await tx('readwrite', (s) => s.delete(id))
    setList((l) => l.filter((s) => s.id !== id))
  }, [])

  return { list, add, remove }
}

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
  return { id: rec.id, kind: 'img', src, size: 0.4, custom: true, ...(rec.anchor && { anchor: rec.anchor, width: FACE_WIDTH[rec.anchor] }) }
}

const FACE_WIDTH = { top: 1.05, eyes: 1.45, cheeks: 0.3, nose: 0.2, freckles: 0.8 }
const HIDDEN_KEY = 'afaq-hidden-stickers'
const GROUPS_KEY = 'afaq-sticker-groups'

export const DEFAULT_GROUPS = [
  { id: 'mine', name: 'Mine' },
  { id: 'club', name: 'Club' },
  { id: 'faces', name: 'Faces' },
  { id: 'fun', name: 'Fun' },
  { id: 'tech', name: 'Tech' },
]

export const groupOf = (s, assign) => assign[s.id] ?? s.group ?? 'mine'

function load(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key))
    return v ?? fallback
  } catch {
    return fallback
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch { /* storage unavailable */ }
}

function loadHidden() {
  const v = load(HIDDEN_KEY, [])
  return Array.isArray(v) ? v : []
}

function loadGroups() {
  const v = load(GROUPS_KEY, null)
  return v && Array.isArray(v.groups) ? { groups: v.groups, assign: v.assign || {} } : { groups: DEFAULT_GROUPS, assign: {} }
}

export function useCustomStickers() {
  const [all, setAll] = useState([])
  const [grp, setGrp] = useState(loadGroups)
  const [hidden, setHidden] = useState(loadHidden)

  const saveHidden = useCallback((next) => {
    setHidden(next)
    save(HIDDEN_KEY, next)
  }, [])

  const toggleBuiltin = useCallback(
    (id) => saveHidden(hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id]),
    [hidden, saveHidden],
  )
  const updateGroups = useCallback((fn) => {
    setGrp((g) => {
      const next = fn(g)
      save(GROUPS_KEY, next)
      return next
    })
  }, [])
  const addGroup = useCallback(
    (name) => {
      const n = name.trim()
      if (!n) return null
      const id = `g-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
      updateGroups((g) => ({ ...g, groups: [...g.groups, { id, name: n }] }))
      return id
    },
    [updateGroups],
  )
  const renameGroup = useCallback(
    (id, name) => updateGroups((g) => ({ ...g, groups: g.groups.map((x) => (x.id === id ? { ...x, name } : x)) })),
    [updateGroups],
  )
  const deleteGroup = useCallback(
    (id) => updateGroups((g) => ({ groups: g.groups.filter((x) => x.id !== id), assign: g.assign })),
    [updateGroups],
  )
  const assignGroup = useCallback(
    (stickerId, groupId) => updateGroups((g) => ({ ...g, assign: { ...g.assign, [stickerId]: groupId } })),
    [updateGroups],
  )
  const setAllBuiltin = useCallback((ids) => saveHidden(ids), [saveHidden])

  useEffect(() => {
    let dead = false
    tx('readonly', (s) => s.getAll())
      .then((recs) => Promise.all(recs.sort((a, b) => a.added - b.added).map(toSticker)))
      .then((l) => !dead && setAll(l))
      .catch(() => {})
    return () => {
      dead = true
    }
  }, [])

  const add = useCallback(async (files, groupId, anchor) => {
    const made = []
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue
      const rec = { id: `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, blob: await shrink(f), added: Date.now(), ...(anchor && { anchor }) }
      await tx('readwrite', (s) => s.put(rec))
      made.push(await toSticker(rec))
    }
    setAll((l) => [...l, ...made])
    if (groupId && made.length)
      updateGroups((g) => ({ ...g, assign: { ...g.assign, ...Object.fromEntries(made.map((m) => [m.id, groupId])) } }))
  }, [updateGroups])

  const remove = useCallback(async (id) => {
    await tx('readwrite', (s) => s.delete(id))
    setAll((l) => l.filter((s) => s.id !== id))
  }, [])

  return {
    list: all.filter((s) => !s.anchor), faceList: all.filter((s) => s.anchor), add, remove, hidden, toggleBuiltin, setAllBuiltin,
    groups: grp.groups, assign: grp.assign, addGroup, renameGroup, deleteGroup, assignGroup,
  }
}

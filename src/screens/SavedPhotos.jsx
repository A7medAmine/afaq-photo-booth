import { useEffect, useState } from 'react'

const CLOUD = (import.meta.env.VITE_CLOUD_URL || '').replace(/\/$/, '')
const KEY = import.meta.env.VITE_UPLOAD_KEY || ''
const headers = KEY ? { 'X-Upload-Key': KEY } : {}

// Operator view of the photos guests let the club keep, read from the cloud server.
export default function SavedPhotos() {
  const [photos, setPhotos] = useState(null)
  const [error, setError] = useState('')

  const load = async () => {
    setError('')
    try {
      const r = await fetch(`${CLOUD}/api/kept`, { headers, cache: 'no-store' })
      if (!r.ok) throw new Error(r.status === 401 ? 'The upload key does not match the server.' : `Server answered ${r.status}.`)
      setPhotos((await r.json()).photos)
    } catch (e) {
      setError(e instanceof TypeError ? 'Could not reach the photo server.' : e.message)
    }
  }
  useEffect(() => { load() }, [])

  const remove = async (id) => {
    if (!window.confirm('Delete this photo from the server? This cannot be undone.')) return
    try {
      const r = await fetch(`${CLOUD}/api/kept/${id}`, { method: 'DELETE', headers })
      if (!r.ok) throw new Error(`Server answered ${r.status}.`)
      setPhotos((list) => list.filter((p) => p.id !== id))
    } catch (e) {
      setError(e instanceof TypeError ? 'Could not reach the photo server.' : e.message)
    }
  }

  return (
    <div className="field" dir="ltr">
      Saved photos
      <span className="note">
        Photos guests let the club keep{photos ? `: ${photos.length}` : ''}. They stay on the server until deleted here.
      </span>
      {error && <span className="note">{error}</span>}
      {photos && !photos.length && <span className="note">No saved photos yet.</span>}
      {!!photos?.length && (
        <div className="saved-grid">
          {photos.map((p) => (
            <div className="saved-item" key={p.id}>
              <a href={p.url} target="_blank" rel="noreferrer">
                <img src={`${CLOUD}/files/${p.id}.jpg?size=preview`} alt="" loading="lazy" />
              </a>
              <span>{new Date(p.at).toLocaleString()}</span>
              <div className="row-tight">
                <a className="btn btn-ghost" href={`${CLOUD}/files/${p.id}.jpg?dl=1`} download>Download</a>
                <button className="btn btn-ghost" onClick={() => remove(p.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="row-tight">
        <button className="btn btn-ghost" onClick={load}>Refresh</button>
      </div>
    </div>
  )
}

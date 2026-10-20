const KEY = 'afaq-booth-pin'
const PIN_LENGTH = 4
const ENV = (import.meta.env.VITE_OPERATOR_PIN || '').trim()
const ENV_PIN = /^\d{4}$/.test(ENV) ? ENV : '1234'
const DIGEST_RE = /^[0-9a-f]{64}$/i
const SALT_RE = /^[0-9a-f]{32}$/i

const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')

function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return bytes
}

async function hash(pin, salt) {
  const pinBytes = new TextEncoder().encode(pin)
  const data = new Uint8Array(pinBytes.length + salt.length)
  data.set(pinBytes)
  data.set(salt, pinBytes.length)
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', data)))
}

function sameString(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function getPinLength() {
  return PIN_LENGTH
}

export async function checkPin(attempt) {
  if (typeof attempt !== 'string' || attempt.length !== PIN_LENGTH) return false
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const { digest, salt } = JSON.parse(raw)
      if (DIGEST_RE.test(digest) && SALT_RE.test(salt)) {
        return sameString(digest.toLowerCase(), await hash(attempt, fromHex(salt)))
      }
      localStorage.removeItem(KEY)
    }
  } catch {
    try { localStorage.removeItem(KEY) } catch { /* private mode */ }
  }
  return sameString(attempt, ENV_PIN)
}

export async function setPin(pin) {
  if (typeof pin !== 'string' || pin.length !== PIN_LENGTH) return false
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const digest = await hash(pin, salt)
    localStorage.setItem(KEY, JSON.stringify({ digest, salt: toHex(salt) }))
    return true
  } catch {
    return false
  }
}

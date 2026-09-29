const KEY = 'afaq-booth-pin'
const FALLBACK = import.meta.env.VITE_OPERATOR_PIN || '1234'

export function getPin() {
  try {
    return localStorage.getItem(KEY) || FALLBACK
  } catch {
    return FALLBACK
  }
}

export function setPin(pin) {
  try {
    localStorage.setItem(KEY, pin)
  } catch { /* private mode */ }
}

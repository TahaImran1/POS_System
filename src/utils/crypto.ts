/**
 * Universal Crypto Utility for PIN Security
 * Uses standard SHA-256 with Web Crypto API (supported natively in all modern browsers and Node 18+)
 */

export async function hashPin(pin: string): Promise<string> {
  const clean = (pin || '').trim()
  if (!clean) return ''
  
  // If string is already a 64-character hex SHA-256 hash, return lowercase
  if (/^[0-9a-f]{64}$/i.test(clean)) {
    return clean.toLowerCase()
  }

  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const encoder = new TextEncoder()
    const data = encoder.encode(clean)
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase()
  }

  // Safe fallback if Web Crypto API is not available
  try {
    const req = (globalThis as any).require
    if (typeof req === 'function') {
      const nodeCrypto = req('crypto')
      if (nodeCrypto?.createHash) {
        return nodeCrypto.createHash('sha256').update(clean).digest('hex').toLowerCase()
      }
    }
  } catch (_) {
    // Ignore error
  }

  let hash = 0
  for (let i = 0; i < clean.length; i++) {
    hash = ((hash << 5) - hash) + clean.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(16).padStart(64, '0')
}

export function isHashedPin(pin: string | null | undefined): boolean {
  if (!pin) return false
  return /^[0-9a-f]{64}$/i.test(pin.trim())
}

export async function comparePin(plainPin: string, storedPin: string): Promise<boolean> {
  const cleanPlain = (plainPin || '').trim()
  const cleanStored = (storedPin || '').trim()
  if (!cleanPlain || !cleanStored) return false

  // Direct plain-text match (backward compatibility for unmigrated entries)
  if (cleanPlain === cleanStored) {
    return true
  }

  const hashedInput = await hashPin(cleanPlain)
  return hashedInput.toLowerCase() === cleanStored.toLowerCase()
}

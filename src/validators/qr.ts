/**
 * QR Code input validation
 */

import type { ErrorCorrectionLevel } from '../encoders/qr/types'

/** Maximum data capacity by EC level and mode (version 40) */
const MAX_CAPACITY: Record<ErrorCorrectionLevel, Record<string, number>> = {
  L: { numeric: 7089, alphanumeric: 4296, byte: 2953 },
  M: { numeric: 5596, alphanumeric: 3391, byte: 2331 },
  Q: { numeric: 3993, alphanumeric: 2420, byte: 1663 },
  H: { numeric: 3057, alphanumeric: 1852, byte: 1273 },
}

/** Validate QR code input */
export function validateQRInput(
  text: string,
  ecLevel: ErrorCorrectionLevel = 'M',
): { valid: boolean; error?: string } {
  if (text.length === 0) {
    return { valid: false, error: 'Text cannot be empty' }
  }

  // Detect mode for capacity check
  const isNumeric = /^\d+$/.test(text)
  const alphanumericChars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:'
  const isAlphanumeric = !isNumeric && [...text].every(c => alphanumericChars.includes(c))

  const caps = MAX_CAPACITY[ecLevel]
  let maxCapacity: number
  let mode: string

  if (isNumeric) {
    maxCapacity = caps.numeric
    mode = 'numeric'
  } else if (isAlphanumeric) {
    maxCapacity = caps.alphanumeric
    mode = 'alphanumeric'
  } else {
    const encoded = new TextEncoder().encode(text)
    maxCapacity = caps.byte
    mode = 'byte'
    if (encoded.length > maxCapacity) {
      return {
        valid: false,
        error: `Data too long for QR code with EC level ${ecLevel} (byte mode). Maximum ${maxCapacity} bytes, got ${encoded.length}`,
      }
    }
    return { valid: true }
  }

  if (text.length > maxCapacity) {
    return {
      valid: false,
      error: `Data too long for QR code with EC level ${ecLevel} (${mode} mode). Maximum ${maxCapacity} chars, got ${text.length}`,
    }
  }

  return { valid: true }
}

/**
 * QR Code input validation
 */

import type { ErrorCorrectionLevel } from "../encoders/qr/types"
import { planEncoding } from "../encoders/qr/data"
import { detectMode } from "../encoders/qr/mode"

/** Maximum data capacity by EC level and mode (version 40) */
const MAX_CAPACITY: Record<ErrorCorrectionLevel, Record<string, number>> = {
  L: { numeric: 7089, alphanumeric: 4296, byte: 2953, kanji: 1817 },
  M: { numeric: 5596, alphanumeric: 3391, byte: 2331, kanji: 1435 },
  Q: { numeric: 3993, alphanumeric: 2420, byte: 1663, kanji: 1024 },
  H: { numeric: 3057, alphanumeric: 1852, byte: 1273, kanji: 784 },
}

export interface QRValidationResult {
  valid: boolean
  error?: string
  /** Minimum QR version needed (1-40), only when valid */
  version?: number
  /** Detected encoding mode */
  mode?: "numeric" | "alphanumeric" | "byte" | "kanji"
  /** Data length in the detected mode's units */
  dataLength?: number
  /** Maximum capacity for the detected mode and EC level */
  maxCapacity?: number
}

/** Validate QR code input */
export function validateQRInput(
  text: string,
  ecLevel: ErrorCorrectionLevel = "M",
): QRValidationResult {
  if (text.length === 0) {
    return { valid: false, error: "Text cannot be empty" }
  }

  // Detect mode
  const mode = detectMode(text)

  const caps = MAX_CAPACITY[ecLevel]
  const maxCapacity = caps[mode]!

  // Determine data length in the mode's units
  let dataLength: number
  if (mode === "byte") {
    dataLength = new TextEncoder().encode(text).length
  } else {
    dataLength = text.length
  }

  if (dataLength > maxCapacity) {
    return {
      valid: false,
      error: `Data too long for QR code with EC level ${ecLevel} (${mode} mode). Maximum ${maxCapacity} ${mode === "byte" ? "bytes" : "chars"}, got ${dataLength}`,
      mode,
      dataLength,
      maxCapacity,
    }
  }

  // Plan the encoding exactly as the encoder would, so the reported version is
  // the version the caller will actually get — including multi-segment splits
  let version: number
  try {
    version = planEncoding(text, ecLevel, {}).version
  } catch {
    return {
      valid: false,
      error: `Data too long for any QR code version with EC level ${ecLevel}`,
      mode,
      dataLength,
      maxCapacity,
    }
  }

  return {
    valid: true,
    version,
    mode,
    dataLength,
    maxCapacity,
  }
}

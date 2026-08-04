/**
 * QR Code version selection
 * Versions 1-40, size = 4*V + 17 modules per side
 */

import type { ErrorCorrectionLevel } from "./types"
import { getECInfo, getCharCountBits } from "./tables"
import { isNumeric, isAlphanumeric } from "./mode"

/** Calculate data capacity in bits for a given version and EC level */
export function getDataCapacityBits(version: number, ecLevel: ErrorCorrectionLevel): number {
  const info = getECInfo(version, ecLevel)
  return info.totalDataCodewords * 8
}

/** Get the module count (size) for a version */
export function getModuleCount(version: number): number {
  return version * 4 + 17
}

/**
 * Determine the optimal encoding mode based on data content
 * Uses simple mode selection (not optimal segmentation for now)
 */
export function selectMode(
  text: string,
  requestedMode?: string,
): "numeric" | "alphanumeric" | "byte" | "kanji" {
  if (requestedMode && requestedMode !== "auto") {
    return requestedMode as "numeric" | "alphanumeric" | "byte" | "kanji"
  }
  if (isNumeric(text)) return "numeric"
  if (isAlphanumeric(text)) return "alphanumeric"
  return "byte"
}

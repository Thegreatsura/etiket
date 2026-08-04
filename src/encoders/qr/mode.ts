/**
 * QR Code encoding modes - detection and encoding
 */

import { InvalidInputError } from "../../errors"
import { isKanjiChar, toShiftJIS } from "./kanji"

import { ALPHANUMERIC_CHARS } from "./tables"

/** Check if a string can be encoded in numeric mode */
export function isNumeric(text: string): boolean {
  return /^\d+$/.test(text)
}

/** Check if a string can be encoded in alphanumeric mode */
export function isAlphanumeric(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (ALPHANUMERIC_CHARS.indexOf(text[i]!) === -1) return false
  }
  return true
}

/** Check if a string can be encoded in Kanji mode (Shift-JIS double byte) */
export function isKanji(text: string): boolean {
  if (text.length === 0) return false
  for (const char of text) {
    if (!isKanjiChar(char)) return false
  }
  return true
}

/** Auto-detect the best encoding mode for the given text */
export function detectMode(text: string): "numeric" | "alphanumeric" | "byte" | "kanji" {
  if (isNumeric(text)) return "numeric"
  if (isAlphanumeric(text)) return "alphanumeric"
  if (isKanji(text)) return "kanji"
  return "byte"
}

/** Get alphanumeric character value (0-44) */
export function getAlphanumericValue(char: string): number {
  const idx = ALPHANUMERIC_CHARS.indexOf(char)
  if (idx === -1) throw new InvalidInputError(`Invalid alphanumeric character: ${char}`)
  return idx
}

/** Encode numeric data to bits */
export function encodeNumericData(text: string): number[] {
  const bits: number[] = []
  let i = 0

  // Process groups of 3 digits -> 10 bits
  while (i + 2 < text.length) {
    const val = Number.parseInt(text.substring(i, i + 3), 10)
    pushBits(bits, val, 10)
    i += 3
  }

  // Remaining 2 digits -> 7 bits
  if (i + 1 < text.length) {
    const val = Number.parseInt(text.substring(i, i + 2), 10)
    pushBits(bits, val, 7)
    i += 2
  }

  // Remaining 1 digit -> 4 bits
  if (i < text.length) {
    const val = Number.parseInt(text[i]!, 10)
    pushBits(bits, val, 4)
  }

  return bits
}

/** Encode alphanumeric data to bits */
export function encodeAlphanumericData(text: string): number[] {
  const bits: number[] = []
  let i = 0

  // Process pairs -> 11 bits each
  while (i + 1 < text.length) {
    const val = getAlphanumericValue(text[i]!) * 45 + getAlphanumericValue(text[i + 1]!)
    pushBits(bits, val, 11)
    i += 2
  }

  // Remaining single character -> 6 bits
  if (i < text.length) {
    pushBits(bits, getAlphanumericValue(text[i]!), 6)
  }

  return bits
}

/** Encode byte data to bits */
export function encodeByteData(data: Uint8Array): number[] {
  const bits: number[] = []
  for (const byte of data) {
    pushBits(bits, byte, 8)
  }
  return bits
}

/**
 * Encode Kanji data to bits (13 bits per character)
 * Input must be pre-converted to Shift JIS double-byte values
 */
export function encodeKanjiData(sjisValues: number[]): number[] {
  const bits: number[] = []
  for (const code of sjisValues) {
    let adjusted: number
    if (code >= 0x8140 && code <= 0x9ffc) {
      adjusted = code - 0x8140
    } else if (code >= 0xe040 && code <= 0xebbf) {
      adjusted = code - 0xc140
    } else {
      throw new InvalidInputError(`Invalid Shift JIS kanji value: 0x${code.toString(16)}`)
    }
    const hi = (adjusted >> 8) & 0xff
    const lo = adjusted & 0xff
    const value = hi * 0xc0 + lo
    pushBits(bits, value, 13)
  }
  return bits
}

/**
 * Convert a Unicode string to the Shift-JIS values kanji mode encodes.
 *
 * Uses the real mapping table: Unicode and Shift-JIS do not line up
 * arithmetically, so anything derived by formula produces symbols that decode
 * to the wrong characters.
 */
export function unicodeToShiftJIS(text: string): number[] {
  const values: number[] = []
  for (const char of text) {
    const sjis = toShiftJIS(char)
    if (sjis === undefined) {
      throw new InvalidInputError(
        `Character "${char}" (U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}) cannot be encoded in QR kanji mode`,
      )
    }
    values.push(sjis)
  }
  return values
}

/** Push a value as the specified number of bits (MSB first) */
export function pushBits(arr: number[], value: number, count: number): void {
  for (let i = count - 1; i >= 0; i--) {
    arr.push((value >> i) & 1)
  }
}

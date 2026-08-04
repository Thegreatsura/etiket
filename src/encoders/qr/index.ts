/**
 * QR Code encoder — Full ISO/IEC 18004 implementation
 * Supports versions 1-40, all EC levels (L/M/Q/H), all encoding modes
 */

import type { QRCodeOptions } from "./types"
import { encodeData } from "./data"
import { createMatrix, placeFunctionPatterns, placeData } from "./matrix"
import { selectBestMask, applyMask } from "./mask"
import { writeFormatInfo, writeVersionInfo } from "./format"
import { CapacityError, InvalidInputError } from "../../errors"

export type { QRCodeOptions, ErrorCorrectionLevel, EncodingMode, QRSegment } from "./types"

/**
 * Encode text as a QR code matrix
 * Returns a 2D boolean array (true = dark module)
 */
export function encodeQR(text: string, options: QRCodeOptions = {}): boolean[][] {
  if (text.length === 0) {
    throw new InvalidInputError("QR Code input must not be empty")
  }
  const { version, ecLevel, bits } = encodeData(text, options)
  const size = version * 4 + 17

  // Create matrix and place function patterns
  const matrix = createMatrix(size)
  placeFunctionPatterns(matrix, version)

  // Place data bits
  placeData(matrix, bits, version)

  // Select and apply best mask
  const bestMask = selectBestMask(matrix, size, version, options.mask)
  applyMask(matrix, bestMask, size, version)

  // Write format info
  writeFormatInfo(matrix, ecLevel, bestMask)

  // Write version info
  if (version >= 7) {
    writeVersionInfo(matrix, version)
  }

  // Convert to boolean array (null -> false)
  return matrix.map((row) => row.map((cell) => cell === true))
}

export interface QRSequenceOptions extends Omit<QRCodeOptions, "structuredAppend"> {
  /**
   * How many symbols to split the message into (2-16).
   * Omit to use the fewest symbols that hold the data.
   */
  symbols?: number
}

/**
 * Encode text as a Structured Append sequence: a set of QR symbols that a
 * reader reassembles into the original message.
 *
 * Returns a single ordinary symbol when the data fits in one — a sequence of
 * one is not a thing the standard allows.
 *
 * @example
 * ```ts
 * const symbols = encodeQRSequence(longText, { symbols: 3 })
 * // symbols[0], symbols[1], symbols[2] scan back as one message
 * ```
 */
export function encodeQRSequence(text: string, options: QRSequenceOptions = {}): boolean[][][] {
  if (text.length === 0) {
    throw new InvalidInputError("QR Code input must not be empty")
  }

  const { symbols: requested, ...qrOptions } = options
  if (requested !== undefined && (requested < 1 || requested > 16)) {
    throw new InvalidInputError(
      `A Structured Append sequence holds 1 to 16 symbols, got ${requested}`,
    )
  }

  const parity = parityOf(text)
  const chars = [...text]

  // Try increasingly many symbols until every chunk fits
  for (let total = requested ?? 1; total <= (requested ?? 16); total++) {
    const chunks = splitEvenly(chars, total)
    if (chunks.length !== total) continue

    const sequence = tryEncodeSequence(chunks, total, parity, qrOptions)
    if (sequence) return sequence
    if (requested !== undefined) {
      throw new CapacityError(
        `Data does not fit in ${total} QR symbol${total === 1 ? "" : "s"} at EC level ${qrOptions.ecLevel ?? "M"}`,
      )
    }
  }

  throw new CapacityError("Data does not fit in a Structured Append sequence of 16 QR symbols")
}

/** Encode every chunk, or return undefined if any of them overflows */
function tryEncodeSequence(
  chunks: string[],
  total: number,
  parity: number,
  qrOptions: QRCodeOptions,
): boolean[][][] | undefined {
  const matrices: boolean[][][] = []
  for (const [index, chunk] of chunks.entries()) {
    try {
      matrices.push(
        encodeQR(chunk, {
          ...qrOptions,
          structuredAppend: total > 1 ? { index, total, parity } : undefined,
        }),
      )
    } catch (error) {
      if (error instanceof CapacityError) return undefined
      throw error
    }
  }
  return matrices
}

/** XOR of every byte of the complete message, per ISO/IEC 18004 */
function parityOf(text: string): number {
  let parity = 0
  for (const byte of new TextEncoder().encode(text)) {
    parity ^= byte
  }
  return parity
}

/** Split code points into `count` chunks of as equal a size as possible */
function splitEvenly(chars: string[], count: number): string[] {
  const chunks: string[] = []
  const size = Math.ceil(chars.length / count)
  for (let i = 0; i < chars.length; i += size) {
    chunks.push(chars.slice(i, i + size).join(""))
  }
  return chunks
}

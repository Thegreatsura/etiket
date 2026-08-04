/**
 * QR Code data encoding and bitstream construction
 */

import type { ErrorCorrectionLevel, QRCodeOptions, QRSegment } from "./types"
import { MODE_INDICATOR } from "./types"
import { getECInfo, getCharCountBits } from "./tables"
import { getDataCapacityBits, selectMode } from "./version"
import { optimizeSegments } from "./segment"
import {
  encodeNumericData,
  encodeAlphanumericData,
  encodeByteData,
  encodeKanjiData,
  unicodeToShiftJIS,
  pushBits,
} from "./mode"
import { addErrorCorrection } from "./reed-solomon"
import { CapacityError } from "../../errors"

export interface EncodedData {
  version: number
  ecLevel: ErrorCorrectionLevel
  bits: number[]
}

/**
 * Encode text into QR code data bits with error correction
 */
export function encodeData(text: string, options: QRCodeOptions = {}): EncodedData {
  const ecLevel = options.ecLevel ?? "M"
  const { version, segments } = planEncoding(text, ecLevel, options)
  const ecInfo = getECInfo(version, ecLevel)

  // Build data bitstream
  const dataBits = buildDataBits(segments, version, ecInfo.totalDataCodewords)

  // Convert bits to bytes
  const dataBytes = bitsToBytes(dataBits)

  // Add error correction with interleaving
  const finalBytes = addErrorCorrection(
    dataBytes,
    ecInfo.ecCodewordsPerBlock,
    ecInfo.group1Blocks,
    ecInfo.group1DataCW,
    ecInfo.group2Blocks,
    ecInfo.group2DataCW,
  )

  // Convert back to bits
  const bits: number[] = []
  for (const byte of finalBytes) {
    pushBits(bits, byte, 8)
  }

  return { version, ecLevel, bits }
}

/** A segment plus the version it was measured against */
interface EncodingPlan {
  version: number
  segments: QRSegment[]
}

/**
 * Choose the segmentation and the smallest version that holds it.
 *
 * Segmentation depends on the version, because the character-count indicator
 * — and therefore the cost of switching modes — grows at versions 10 and 27.
 * So the split is recomputed for each candidate version rather than once up
 * front.
 */
export function planEncoding(
  text: string,
  ecLevel: ErrorCorrectionLevel,
  options: QRCodeOptions,
): EncodingPlan {
  const forcedMode = options.mode && options.mode !== "auto" ? options.mode : undefined

  if (options.version !== undefined) {
    const segments = segmentsFor(text, options.version, forcedMode)
    const needed = totalBits(segments, options.version)
    const capacity = getDataCapacityBits(options.version, ecLevel)
    if (needed > capacity) {
      throw new CapacityError(
        `Data too long for QR version ${options.version} with EC level ${ecLevel}: ${needed} bits needed, capacity is ${capacity}`,
      )
    }
    return { version: options.version, segments }
  }

  for (let version = 1; version <= 40; version++) {
    const segments = segmentsFor(text, version, forcedMode)
    if (totalBits(segments, version) <= getDataCapacityBits(version, ecLevel)) {
      return { version, segments }
    }
  }

  throw new CapacityError(`Data too long for any QR code version with EC level ${ecLevel}`)
}

/** Split the text into segments, or a single segment when the mode is forced */
function segmentsFor(text: string, version: number, forcedMode?: string): QRSegment[] {
  if (forcedMode) {
    const mode = selectMode(text, forcedMode)
    const data = new TextEncoder().encode(text)
    // Character-oriented modes keep the source text; only byte mode is bytes.
    return mode === "byte"
      ? [{ mode, data, charCount: data.length }]
      : [{ mode, data: text, charCount: text.length }]
  }
  return optimizeSegments(text, version)
}

/** Header + payload bits for a whole segment list */
function totalBits(segments: QRSegment[], version: number): number {
  let bits = 0
  for (const segment of segments) {
    bits += 4 + getCharCountBits(version, segment.mode) + segmentPayloadBits(segment)
  }
  return bits
}

function segmentPayloadBits(segment: QRSegment): number {
  const count = segment.charCount
  switch (segment.mode) {
    case "numeric":
      return Math.floor(count / 3) * 10 + (count % 3 === 2 ? 7 : count % 3 === 1 ? 4 : 0)
    case "alphanumeric":
      return Math.floor(count / 2) * 11 + (count % 2 === 1 ? 6 : 0)
    case "kanji":
      return count * 13
    default:
      return count * 8
  }
}

/** Build the data bitstream (before EC) */
function buildDataBits(
  segments: QRSegment[],
  version: number,
  totalDataCodewords: number,
): number[] {
  const bits: number[] = []

  for (const segment of segments) {
    appendSegment(bits, segment, version)
  }

  // Terminator
  const totalDataBits = totalDataCodewords * 8
  const terminatorLen = Math.min(4, totalDataBits - bits.length)
  if (terminatorLen > 0) {
    pushBits(bits, 0, terminatorLen)
  }

  // Pad to byte boundary
  while (bits.length % 8 !== 0) {
    bits.push(0)
  }

  // Pad to capacity with alternating bytes
  let padToggle = true
  while (bits.length < totalDataBits) {
    pushBits(bits, padToggle ? 236 : 17, 8)
    padToggle = !padToggle
  }

  return bits
}

/** Append one segment's mode indicator, character count and payload */
function appendSegment(bits: number[], segment: QRSegment, version: number): void {
  const mode = segment.mode
  if (mode === "eci") {
    throw new Error("ECI segments are not produced by this encoder")
  }

  pushBits(bits, MODE_INDICATOR[mode], 4)
  pushBits(bits, segment.charCount, getCharCountBits(version, mode))

  switch (mode) {
    case "numeric":
      bits.push(...encodeNumericData(asText(segment.data)))
      break
    case "alphanumeric":
      bits.push(...encodeAlphanumericData(asText(segment.data)))
      break
    case "byte":
      bits.push(...encodeByteData(asBytes(segment.data)))
      break
    case "kanji":
      bits.push(...encodeKanjiData(unicodeToShiftJIS(asText(segment.data))))
      break
  }
}

function asText(data: Uint8Array | string): string {
  return typeof data === "string" ? data : String.fromCharCode(...data)
}

function asBytes(data: Uint8Array | string): Uint8Array {
  return typeof data === "string" ? new TextEncoder().encode(data) : data
}

/** Convert bit array to byte array */
function bitsToBytes(bits: number[]): number[] {
  const bytes: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0
    for (let j = 0; j < 8 && i + j < bits.length; j++) {
      byte = (byte << 1) | bits[i + j]!
    }
    bytes.push(byte)
  }
  return bytes
}

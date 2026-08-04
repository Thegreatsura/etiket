/**
 * PDF417 data compaction encoder
 * Supports Text, Byte, and Numeric compaction modes
 */

import { InvalidInputError } from "../../errors"
import {
  TEXT_ALPHA_MAP,
  TEXT_LOWER_MAP,
  TEXT_MIXED_MAP,
  TEXT_PUNCT_MAP,
  TEXT_SWITCH,
  MODE_LATCH,
  TextSubMode,
} from "./tables"

/** ECI assignment number for UTF-8 */
const ECI_UTF8 = 26

export interface PDF417DataOptions {
  /**
   * ECI assignment number declaring the character set of the data.
   * Omit and the encoder declares ECI 26 (UTF-8) by itself as soon as the
   * input contains something ISO-8859-15 cannot represent.
   */
  eci?: number
}

/**
 * Encode input text into PDF417 data codewords.
 * Auto-detects the best compaction mode for segments of the input.
 *
 * @param text - Input string to encode
 * @param options - ECI declaration
 * @returns Array of codeword values (0-928), not including symbol length descriptor or EC
 */
export function encodeData(text: string, options: PDF417DataOptions = {}): number[] {
  const latin = toLatinBytes(text)
  const codewords: number[] = []

  // Anything ISO-8859-15 cannot hold goes out as UTF-8 under an ECI
  // declaration; truncating it to the low byte would corrupt the payload
  // while leaving the symbol perfectly scannable.
  if (latin === undefined) {
    pushECI(codewords, options.eci ?? ECI_UTF8)
    encodeByteSegment([...new TextEncoder().encode(text)], codewords)
    return codewords
  }

  if (options.eci !== undefined) {
    pushECI(codewords, options.eci)
  }

  const bytes = latin
  const segments = analyzeSegments(bytes)

  for (const segment of segments) {
    switch (segment.mode) {
      case "text":
        encodeTextSegment(text.slice(segment.start, segment.end), codewords)
        break
      case "numeric":
        encodeNumericSegment(text.slice(segment.start, segment.end), codewords)
        break
      case "byte":
        encodeByteSegment(bytes.slice(segment.start, segment.end), codewords)
        break
    }
  }

  return codewords
}

// ---- Segment analysis ----

interface Segment {
  mode: "text" | "byte" | "numeric"
  start: number
  end: number
}

// ISO-8859-15 differs from ISO-8859-1 at these code points
const ISO_8859_15_MAP: Record<number, number> = {
  0x20ac: 0xa4, // € Euro sign
  0x0160: 0xa6, // Š
  0x0161: 0xa8, // š
  0x017d: 0xb4, // Ž
  0x017e: 0xb8, // ž
  0x0152: 0xbc, // Œ
  0x0153: 0xbd, // œ
  0x0178: 0xbe, // Ÿ
}

/**
 * Convert a string to ISO-8859-15 bytes, or undefined when a character cannot
 * be represented — the caller then falls back to UTF-8 under an ECI.
 */
function toLatinBytes(text: string): number[] | undefined {
  const bytes: number[] = []
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    const mapped = ISO_8859_15_MAP[code]
    if (mapped !== undefined) {
      bytes.push(mapped)
    } else if (code <= 0xff) {
      bytes.push(code)
    } else {
      return undefined
    }
  }
  return bytes
}

/**
 * Emit an ECI designator per ISO/IEC 15438:
 * 927 + 1 codeword for 0-899, 926 + 2 codewords for 900-810899,
 * 925 + 1 codeword for the user-defined range 810900-811799.
 */
function pushECI(codewords: number[], eci: number): void {
  if (!Number.isInteger(eci) || eci < 0 || eci > 811_799) {
    throw new InvalidInputError(`PDF417 ECI assignment number must be 0-811799, got ${eci}`)
  }
  if (eci <= 899) {
    codewords.push(MODE_LATCH.ECI_CHARSET, eci)
  } else if (eci <= 810_899) {
    const value = eci - 900
    codewords.push(MODE_LATCH.ECI_GENERAL, Math.floor(value / 900), value % 900)
  } else {
    codewords.push(MODE_LATCH.ECI_USER, eci - 810_900)
  }
}

/** Check if a character is encodable in text compaction mode */
function isTextCompactable(ch: string): boolean {
  return (
    TEXT_ALPHA_MAP[ch] !== undefined ||
    TEXT_LOWER_MAP[ch] !== undefined ||
    TEXT_MIXED_MAP[ch] !== undefined ||
    TEXT_PUNCT_MAP[ch] !== undefined
  )
}

/** Check if a character is a digit */
function isDigit(ch: string): boolean {
  const c = ch.charCodeAt(0)
  return c >= 48 && c <= 57
}

/** A digit run this long is always cheaper in numeric compaction than in text */
const NUMERIC_RUN_THRESHOLD = 13
/**
 * An all-digit message pays no latch back to text, so numeric compaction wins
 * from a much shorter run — the same cut-off BWIPP uses.
 */
const ALL_NUMERIC_THRESHOLD = 8

/**
 * Analyze input and split into optimal segments by compaction mode.
 * - Runs of 13+ digits, and all-digit messages of 8+ digits, use numeric compaction
 * - Runs of text-compactable characters use text compaction
 * - Everything else uses byte compaction
 */
function analyzeSegments(bytes: number[]): Segment[] {
  const text = String.fromCharCode(...bytes)
  const segments: Segment[] = []
  let pos = 0

  while (pos < text.length) {
    // Check for long numeric run (13+ digits for efficiency)
    const numericRun = countDigits(text, pos)
    if (
      numericRun >= NUMERIC_RUN_THRESHOLD ||
      (numericRun === text.length && numericRun >= ALL_NUMERIC_THRESHOLD)
    ) {
      segments.push({ mode: "numeric", start: pos, end: pos + numericRun })
      pos += numericRun
      continue
    }

    // Check for text-compactable run
    const textRun = countTextCompactable(text, pos)
    if (textRun > 0) {
      segments.push({ mode: "text", start: pos, end: pos + textRun })
      pos += textRun
      continue
    }

    // Byte mode for non-text bytes
    const byteRun = countNonTextCompactable(text, pos)
    segments.push({ mode: "byte", start: pos, end: pos + byteRun })
    pos += byteRun
  }

  return segments
}

function countDigits(text: string, pos: number): number {
  let count = 0
  while (pos + count < text.length && isDigit(text[pos + count]!)) {
    count++
  }
  return count
}

function countTextCompactable(text: string, pos: number): number {
  let count = 0
  while (pos + count < text.length && isTextCompactable(text[pos + count]!)) {
    count++
  }
  return count
}

function countNonTextCompactable(text: string, pos: number): number {
  let count = 0
  // Digits all live in the Mixed sub-mode, so `isTextCompactable` already stops
  // this run at the start of a numeric one
  while (pos + count < text.length && !isTextCompactable(text[pos + count]!)) {
    count++
  }
  return Math.max(count, 1)
}

// ---- Text compaction ----

/**
 * Encode a text segment using text compaction mode.
 * Characters are encoded as pairs of values packed into codewords.
 * Each codeword carries two sub-codeword values: high * 30 + low.
 */
function encodeTextSegment(text: string, codewords: number[]): void {
  // Text compaction mode latch (900) — default mode, only needed if switching from another mode
  // For the first segment, text mode is the default so no latch needed.
  // For subsequent segments, we add the latch.
  if (codewords.length > 0) {
    codewords.push(MODE_LATCH.TEXT_COMPACTION)
  }

  for (const cw of textToCodewords(text)) {
    codewords.push(cw)
  }
}

/**
 * Pack text into codewords without a mode latch.
 *
 * This is the form the Macro PDF417 optional fields take: the reader is
 * already in text compaction when it reads them, so the 900 latch must not
 * appear.
 */
export function textToCodewords(text: string): number[] {
  const subCodewords = textToSubCodewords(text)
  const codewords: number[] = []

  // Pack sub-codewords into pairs → codewords
  // Each pair: high * 30 + low
  for (let i = 0; i < subCodewords.length; i += 2) {
    const high = subCodewords[i]!
    const low = i + 1 < subCodewords.length ? subCodewords[i + 1]! : 29 // pad with 29 (PS) per ISO 15438 5.4.2.1
    codewords.push(high * 30 + low)
  }

  return codewords
}

/** The four text compaction sub-modes, in the order ISO/IEC 15438 Table 4 lists them */
const SUB_MODES = [
  TextSubMode.Alpha,
  TextSubMode.Lower,
  TextSubMode.Mixed,
  TextSubMode.Punctuation,
] as const

/**
 * Shortest latch sequence between two sub-modes, indexed `[from][to]`.
 *
 * Only Mixed reaches every other sub-mode in one step. Alpha and Lower have no
 * latch to Punctuation and Lower has none back to Alpha, so those route through
 * Mixed; Punctuation only latches to Alpha, so it routes through Alpha.
 */
const LATCH_SEQUENCE: readonly (readonly (readonly number[])[])[] = [
  // from Alpha
  [
    [],
    [TEXT_SWITCH.ALPHA_TO_LOWER],
    [TEXT_SWITCH.ALPHA_TO_MIXED],
    [TEXT_SWITCH.ALPHA_TO_MIXED, TEXT_SWITCH.MIXED_TO_PUNCT_LATCH],
  ],
  // from Lower
  [
    [TEXT_SWITCH.LOWER_TO_MIXED, TEXT_SWITCH.MIXED_TO_ALPHA],
    [],
    [TEXT_SWITCH.LOWER_TO_MIXED],
    [TEXT_SWITCH.LOWER_TO_MIXED, TEXT_SWITCH.MIXED_TO_PUNCT_LATCH],
  ],
  // from Mixed
  [
    [TEXT_SWITCH.MIXED_TO_ALPHA],
    [TEXT_SWITCH.MIXED_TO_LOWER],
    [],
    [TEXT_SWITCH.MIXED_TO_PUNCT_LATCH],
  ],
  // from Punctuation
  [
    [TEXT_SWITCH.PUNCT_TO_ALPHA],
    [TEXT_SWITCH.PUNCT_TO_ALPHA, TEXT_SWITCH.ALPHA_TO_LOWER],
    [TEXT_SWITCH.PUNCT_TO_ALPHA, TEXT_SWITCH.ALPHA_TO_MIXED],
    [],
  ],
]

/**
 * Single-character shift into another sub-mode, indexed `[from][to]`.
 * `undefined` where the standard defines no shift for the pair.
 */
const SHIFT_CODE: readonly (readonly (number | undefined)[])[] = [
  // from Alpha
  [undefined, undefined, undefined, TEXT_SWITCH.ALPHA_TO_PUNCT_SHIFT],
  // from Lower
  [TEXT_SWITCH.LOWER_TO_ALPHA_SHIFT, undefined, undefined, TEXT_SWITCH.LOWER_TO_PUNCT_SHIFT],
  // from Mixed
  [undefined, undefined, undefined, TEXT_SWITCH.MIXED_TO_PUNCT_SHIFT],
  // from Punctuation — a shift out of Punctuation does not exist
  [undefined, undefined, undefined, undefined],
]

/** One move in the sub-codeword search: the values it emits and where it came from */
interface TextStep {
  /** Sub-codewords this step appends */
  emit: readonly number[]
  /** Character index the step starts from */
  index: number
  /** Sub-mode the step starts from */
  mode: TextSubMode
}

/**
 * Relax the cost of every sub-mode at one character position by latching into
 * it from another sub-mode. Repeated until nothing improves, so a two-step
 * route (Punctuation → Alpha → Lower) is considered as well as a direct one.
 */
function relaxLatches(cost: number[], back: (TextStep | undefined)[], index: number): void {
  let improved = true
  while (improved) {
    improved = false
    for (const from of SUB_MODES) {
      const base = cost[from]!
      if (!Number.isFinite(base)) continue
      for (const to of SUB_MODES) {
        if (from === to) continue
        const sequence = LATCH_SEQUENCE[from]![to]!
        const candidate = base + sequence.length
        if (candidate < cost[to]!) {
          cost[to] = candidate
          back[to] = { emit: sequence, index, mode: from }
          improved = true
        }
      }
    }
  }
}

/**
 * Convert text to a sequence of sub-codeword values using text compaction sub-modes.
 *
 * A greedy "switch when the current sub-mode cannot hold this character" pass
 * is legal but wasteful: it shifts where a latch is cheaper (a run of
 * punctuation costs one shift per character) and takes the long way round where
 * a direct latch exists. This instead searches for the shortest sequence,
 * carrying the cost of ending in each of the four sub-modes forwards through
 * the string and picking the cheapest at the end — matching, sub-codeword for
 * sub-codeword, what BWIPP produces for the same input.
 */
function textToSubCodewords(text: string): number[] {
  const length = text.length
  if (length === 0) return []

  const cost: number[][] = []
  const back: (TextStep | undefined)[][] = []
  for (let i = 0; i <= length; i++) {
    cost.push([Infinity, Infinity, Infinity, Infinity])
    back.push([undefined, undefined, undefined, undefined])
  }
  // Text compaction always starts in Alpha
  cost[0]![TextSubMode.Alpha] = 0

  for (let i = 0; i < length; i++) {
    relaxLatches(cost[i]!, back[i]!, i)
    const ch = text[i]!

    for (const to of SUB_MODES) {
      const value = getCharValue(ch, to)
      if (value === -1) continue

      // Already in `to`: the character costs one sub-codeword
      const direct = cost[i]![to]! + 1
      if (direct < cost[i + 1]![to]!) {
        cost[i + 1]![to] = direct
        back[i + 1]![to] = { emit: [value], index: i, mode: to }
      }

      // Or shift into `to` for this character alone and stay where we are
      for (const from of SUB_MODES) {
        if (from === to) continue
        const shift = SHIFT_CODE[from]![to]
        if (shift === undefined) continue
        const shifted = cost[i]![from]! + 2
        if (shifted < cost[i + 1]![from]!) {
          cost[i + 1]![from] = shifted
          back[i + 1]![from] = { emit: [shift, value], index: i, mode: from }
        }
      }
    }
  }

  let bestMode: TextSubMode = TextSubMode.Alpha
  for (const mode of SUB_MODES) {
    if (cost[length]![mode]! < cost[length]![bestMode]!) bestMode = mode
  }

  // Walk the back pointers to the start, then flip the collected runs around
  const chunks: (readonly number[])[] = []
  let index = length
  let mode = bestMode
  for (;;) {
    const step = back[index]![mode]
    if (step === undefined) break
    chunks.push(step.emit)
    index = step.index
    mode = step.mode
  }
  chunks.reverse()

  const values: number[] = []
  for (const chunk of chunks) values.push(...chunk)
  return values
}

/** Get the sub-codeword value for a character in a given sub-mode, or -1 if not available */
function getCharValue(ch: string, mode: TextSubMode): number {
  switch (mode) {
    case TextSubMode.Alpha:
      return TEXT_ALPHA_MAP[ch] ?? -1
    case TextSubMode.Lower:
      return TEXT_LOWER_MAP[ch] ?? -1
    case TextSubMode.Mixed:
      return TEXT_MIXED_MAP[ch] ?? -1
    case TextSubMode.Punctuation:
      return TEXT_PUNCT_MAP[ch] ?? -1
  }
}

// ---- Numeric compaction ----

/**
 * Encode a numeric segment using numeric compaction mode.
 * Numeric compaction encodes up to 44 digits into 15 codewords (base 900).
 * Prepends '1' to digit string, converts to base 900.
 */
function encodeNumericSegment(digits: string, codewords: number[]): void {
  codewords.push(MODE_LATCH.NUMERIC_COMPACTION)

  for (const cw of numericToCodewords(digits)) {
    codewords.push(cw)
  }
}

/**
 * Encode a run of digits with numeric compaction, without the 902 mode latch.
 *
 * The Macro PDF417 optional fields that carry numbers (segment count, time
 * stamp, file size, checksum) use this bare form.
 */
export function numericToCodewords(digits: string): number[] {
  const codewords: number[] = []

  // Process in groups of up to 44 digits
  let pos = 0
  while (pos < digits.length) {
    const chunk = digits.slice(pos, pos + 44)
    for (const cw of numericToBase900(chunk)) {
      codewords.push(cw)
    }
    pos += 44
  }

  return codewords
}

/**
 * Convert a string of digits to base-900 codewords.
 * Prepends '1' to the digit string, then converts the resulting number to base 900.
 */
function numericToBase900(digits: string): number[] {
  // Prepend '1' to ensure leading zeros are preserved
  const numStr = "1" + digits

  // Use BigInt for arbitrary precision arithmetic
  let value = BigInt(numStr)
  const base = BigInt(900)
  const result: number[] = []

  while (value > 0n) {
    result.unshift(Number(value % base))
    value = value / base
  }

  return result
}

// ---- Byte compaction ----

/**
 * Encode a byte segment using byte compaction mode.
 * Groups of 6 bytes are encoded as 5 codewords (base 256 -> base 900).
 * Remaining bytes are encoded 1:1.
 */
function encodeByteSegment(bytes: number[], codewords: number[]): void {
  if (bytes.length % 6 === 0) {
    codewords.push(MODE_LATCH.BYTE_COMPACTION_6) // groups of 6 optimization
  } else {
    codewords.push(MODE_LATCH.BYTE_COMPACTION)
  }

  let pos = 0

  // Encode full groups of 6 bytes as 5 codewords
  while (pos + 6 <= bytes.length) {
    const group = bytes.slice(pos, pos + 6)
    const groupCodewords = bytesToBase900(group)
    for (const cw of groupCodewords) {
      codewords.push(cw)
    }
    pos += 6
  }

  // Encode remaining bytes 1:1 (each byte becomes a codeword)
  while (pos < bytes.length) {
    codewords.push(bytes[pos]!)
    pos++
  }
}

/**
 * Convert 6 bytes to 5 base-900 codewords.
 */
function bytesToBase900(bytes: number[]): number[] {
  // Compute: value = b0*256^5 + b1*256^4 + b2*256^3 + b3*256^2 + b4*256 + b5
  let value = BigInt(0)
  for (const b of bytes) {
    value = value * BigInt(256) + BigInt(b)
  }

  // Convert to base 900, yielding 5 codewords
  const result: number[] = Array.from({ length: 5 }, () => 0)
  const base = BigInt(900)
  for (let i = 4; i >= 0; i--) {
    result[i] = Number(value % base)
    value = value / base
  }

  return result
}

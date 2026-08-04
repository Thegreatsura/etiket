/**
 * Data Matrix data encoder — ASCII encoding mode
 * Converts input text into data codewords per ISO/IEC 16022
 */

import { InvalidInputError } from "../../errors"

/**
 * Encode text into Data Matrix data codewords using ASCII encoding.
 *
 * ASCII encoding rules:
 * - ASCII values 0-127: codeword = value + 1
 * - Digit pairs "00"-"99": codeword = pair_value + 130 (single codeword for two digits)
 * - Extended ASCII 128-255: codeword 235 (Upper Shift) followed by value - 127
 */
export function encodeASCII(text: string): number[] {
  const codewords: number[] = []
  let i = 0

  while (i < text.length) {
    const charCode = text.charCodeAt(i)

    if (charCode > 255) {
      throw new InvalidInputError(
        `Data Matrix ASCII mode does not support character: "${text[i]}" (U+${charCode.toString(16).padStart(4, "0")})`,
      )
    }

    // Check for digit pair optimization
    if (
      charCode >= 48 &&
      charCode <= 57 && // current char is '0'-'9'
      i + 1 < text.length &&
      text.charCodeAt(i + 1) >= 48 &&
      text.charCodeAt(i + 1) <= 57 // next char is '0'-'9'
    ) {
      const pairValue = (charCode - 48) * 10 + (text.charCodeAt(i + 1) - 48)
      codewords.push(pairValue + 130)
      i += 2
    } else if (charCode >= 128) {
      // Extended ASCII: Upper Shift + (value - 127)
      codewords.push(235)
      codewords.push(charCode - 127)
      i++
    } else {
      // Standard ASCII: value + 1
      codewords.push(charCode + 1)
      i++
    }
  }

  return codewords
}

/**
 * Pad data codewords to fill the symbol capacity.
 * Uses pad value 129 with the 253-state randomization algorithm.
 */
export function padCodewords(codewords: number[], capacity: number): number[] {
  const padded = [...codewords]

  if (padded.length < capacity) {
    // First pad codeword is always 129
    padded.push(129)
  }

  // Remaining pad codewords use the 253-state randomization
  while (padded.length < capacity) {
    const position = padded.length + 1 // 1-based position
    const randomized = randomizePad(129, position)
    padded.push(randomized)
  }

  return padded
}

/**
 * 253-state randomization algorithm for pad codewords.
 * Ensures pad values appear pseudo-random to avoid false patterns.
 */
function randomizePad(padValue: number, position: number): number {
  const pseudoRandom = ((149 * position) % 253) + 1
  const result = padValue + pseudoRandom
  return result <= 254 ? result : result - 254
}

// C40 character set values
// Set 0 (basic): space=3, 0-9=4-13, A-Z=14-39
// Set 1 (shift 1): control chars 0-31
// Set 2 (shift 2): !"#$%&'()*+,-./:;<=>?@[\]^_
// Set 3 (shift 3): `a-z{|}~DEL
function c40Value(ch: number): { set: number; value: number } {
  if (ch === 32) return { set: 0, value: 3 } // space
  if (ch >= 48 && ch <= 57) return { set: 0, value: ch - 48 + 4 } // 0-9
  if (ch >= 65 && ch <= 90) return { set: 0, value: ch - 65 + 14 } // A-Z
  if (ch >= 0 && ch <= 31) return { set: 1, value: ch } // control
  if (ch >= 33 && ch <= 47) return { set: 2, value: ch - 33 } // !"#$%&'()*+,-./
  if (ch >= 58 && ch <= 64) return { set: 2, value: ch - 58 + 15 } // :;<=>?@
  if (ch >= 91 && ch <= 95) return { set: 2, value: ch - 91 + 22 } // [\]^_
  if (ch >= 96 && ch <= 127) return { set: 3, value: ch - 96 } // `a-z{|}~
  return { set: -1, value: 0 } // not C40 encodable
}

// Text mode: same as C40 but swaps upper/lowercase
function textValue(ch: number): { set: number; value: number } {
  if (ch === 32) return { set: 0, value: 3 }
  if (ch >= 48 && ch <= 57) return { set: 0, value: ch - 48 + 4 }
  if (ch >= 97 && ch <= 122) return { set: 0, value: ch - 97 + 14 } // a-z in basic set
  if (ch >= 0 && ch <= 31) return { set: 1, value: ch }
  if (ch >= 33 && ch <= 47) return { set: 2, value: ch - 33 }
  if (ch >= 58 && ch <= 64) return { set: 2, value: ch - 58 + 15 }
  if (ch >= 91 && ch <= 95) return { set: 2, value: ch - 91 + 22 }
  if (ch === 96) return { set: 3, value: 0 } // backtick
  if (ch >= 65 && ch <= 90) return { set: 3, value: ch - 65 + 1 } // A-Z in shift 3
  if (ch >= 123 && ch <= 127) return { set: 3, value: ch - 123 + 27 }
  return { set: -1, value: 0 }
}

/**
 * Encode text using C40 mode (efficient for uppercase + digits)
 * 3 characters → 2 codewords
 * Latch: codeword 230
 */
export function encodeC40(text: string): number[] {
  return encodeC40Text(text, 230, c40Value)
}

/**
 * Encode text using Text mode (efficient for lowercase + digits)
 * 3 characters → 2 codewords
 * Latch: codeword 239
 */
export function encodeTextMode(text: string): number[] {
  return encodeC40Text(text, 239, textValue)
}

function encodeC40Text(
  text: string,
  latchCW: number,
  valueFn: (ch: number) => { set: number; value: number },
): number[] {
  const codewords: number[] = [latchCW] // Latch to C40/Text
  const values: number[] = []
  // Track which source character index each value came from
  const valueCharIndex: number[] = []

  // Index of the first character that cannot be represented in C40/Text and
  // must therefore be encoded in ASCII, or text.length when there is none.
  let fallbackFrom = text.length

  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    const { set, value } = valueFn(ch)
    if (set === -1) {
      fallbackFrom = i
      break
    }
    if (set > 0) {
      values.push(set - 1) // Shift indicator (0=shift1, 1=shift2, 2=shift3)
      valueCharIndex.push(i)
      values.push(value)
      valueCharIndex.push(i)
    } else {
      values.push(value)
      valueCharIndex.push(i)
    }
  }

  // Pack triplets into codeword pairs
  let i = 0
  while (i + 2 < values.length) {
    const v = values[i]! * 1600 + values[i + 1]! * 40 + values[i + 2]! + 1
    codewords.push(Math.floor(v / 256))
    codewords.push(v % 256)
    i += 3
  }

  // Unlatch, then encode in ASCII everything the triplets did not cover: any
  // 1-2 leftover values plus the non-encodable tail. Taking the earliest of the
  // two start points ensures no character is dropped.
  //
  // The unlatch is emitted even when nothing follows, so that padding codewords
  // are interpreted in ASCII mode. Per ISO 16022 an exact fit makes the unlatch
  // redundant, but the symbol size is not known here; encodeAuto() discards
  // C40/Text whenever the extra codeword makes it longer than plain ASCII.
  const asciiFrom = i < values.length ? valueCharIndex[i]! : fallbackFrom
  codewords.push(254) // Unlatch to ASCII
  if (asciiFrom < text.length) {
    codewords.push(...encodeASCII(text.substring(asciiFrom)))
  }

  return codewords
}

// X12 character set: CR=0, *=1, >=2, space=3, 0-9=4-13, A-Z=14-39
function x12Value(ch: number): { set: number; value: number } {
  if (ch === 13) return { set: 0, value: 0 }
  if (ch === 42) return { set: 0, value: 1 }
  if (ch === 62) return { set: 0, value: 2 }
  if (ch === 32) return { set: 0, value: 3 }
  if (ch >= 48 && ch <= 57) return { set: 0, value: ch - 48 + 4 }
  if (ch >= 65 && ch <= 90) return { set: 0, value: ch - 65 + 14 }
  return { set: -1, value: 0 }
}

/**
 * Encode text using X12 mode (ANSI X12 EDI: A-Z, 0-9, space, CR, * and >).
 * 3 characters → 2 codewords. Latch 238.
 *
 * X12 has no shift mechanism, so the whole run must be X12-encodable and the
 * character count must be a multiple of 3; anything else falls back to ASCII.
 */
export function encodeX12(text: string): number[] | undefined {
  if (text.length === 0 || text.length % 3 !== 0) return undefined

  const values: number[] = []
  for (const ch of text) {
    const { set, value } = x12Value(ch.charCodeAt(0))
    if (set === -1) return undefined
    values.push(value)
  }

  const codewords: number[] = [238]
  for (let i = 0; i < values.length; i += 3) {
    const v = values[i]! * 1600 + values[i + 1]! * 40 + values[i + 2]! + 1
    codewords.push(Math.floor(v / 256), v % 256)
  }
  // An exact multiple of 3 needs no unlatch when the symbol ends here, but the
  // symbol size is not known yet, so unlatch and let encodeAuto compare lengths.
  codewords.push(254)
  return codewords
}

/**
 * Encode text using EDIFACT mode (ASCII 32-94, 6 bits per character).
 * 4 characters → 3 codewords. Latch 240, unlatch is the 6-bit value 31.
 */
export function encodeEDIFACT(text: string): number[] | undefined {
  if (text.length === 0) return undefined

  const values: number[] = []
  for (const ch of text) {
    const code = ch.charCodeAt(0)
    if (code < 32 || code > 94) return undefined
    values.push(code & 0x3f)
  }

  // Unlatch so that padding after the segment is read as ASCII
  values.push(31)

  const codewords: number[] = [240]
  for (let i = 0; i < values.length; i += 4) {
    const quad = [values[i] ?? 0, values[i + 1] ?? 0, values[i + 2] ?? 0, values[i + 3] ?? 0]
    const packed = (quad[0]! << 18) | (quad[1]! << 12) | (quad[2]! << 6) | quad[3]!
    codewords.push((packed >> 16) & 0xff, (packed >> 8) & 0xff, packed & 0xff)
  }
  return codewords
}

/**
 * Encode bytes using Base 256 mode (latch 231).
 *
 * The length field and every data byte are randomised with the 255-state
 * algorithm so that binary payloads cannot imitate the finder patterns.
 */
export function encodeBase256(bytes: Uint8Array | number[], startPosition = 1): number[] {
  const data = [...bytes]
  const codewords: number[] = [231]
  // Position of the first length codeword within the whole codeword stream
  let position = startPosition + 1

  if (data.length < 250) {
    codewords.push(randomize255(data.length, position++))
  } else {
    codewords.push(randomize255(Math.floor(data.length / 250) + 249, position++))
    codewords.push(randomize255(data.length % 250, position++))
  }

  for (const byte of data) {
    codewords.push(randomize255(byte, position++))
  }

  return codewords
}

/** 255-state randomisation for Base 256 values */
function randomize255(value: number, position: number): number {
  const pseudoRandom = ((149 * position) % 255) + 1
  const result = value + pseudoRandom
  return result <= 255 ? result : result - 256
}

/**
 * Emit an ECI designator (codeword 241 plus 1-3 value codewords) per ISO 16022.
 */
export function encodeECI(eci: number): number[] {
  if (!Number.isInteger(eci) || eci < 0 || eci > 999_999) {
    throw new InvalidInputError(`Data Matrix ECI assignment number must be 0-999999, got ${eci}`)
  }
  if (eci <= 126) return [241, eci + 1]
  if (eci <= 16_382) {
    const value = eci - 127
    return [241, Math.floor(value / 254) + 128, (value % 254) + 1]
  }
  const value = eci - 16_383
  return [
    241,
    Math.floor(value / 64_516) + 192,
    (Math.floor(value / 254) % 254) + 1,
    (value % 254) + 1,
  ]
}

export interface DataMatrixEncodeOptions {
  /**
   * ECI assignment number declaring the character set.
   * Omit and the encoder declares ECI 26 (UTF-8) by itself as soon as the input
   * contains a character Latin-1 cannot represent.
   */
  eci?: number
}

/**
 * Auto-select the best encoding mode for the given text.
 *
 * Every applicable mode is tried and the shortest codeword stream wins, which
 * is both simpler and better than the old heuristic — it cannot pick a mode
 * that turns out longer.
 */
export function encodeAuto(text: string, options: DataMatrixEncodeOptions = {}): number[] {
  // Anything Latin-1 cannot hold goes out as UTF-8 bytes under an ECI
  // declaration, in Base 256 so no byte is reinterpreted.
  if ([...text].some((ch) => ch.codePointAt(0)! > 0xff)) {
    const eci = encodeECI(options.eci ?? 26)
    return [...eci, ...encodeBase256(new TextEncoder().encode(text), eci.length + 1)]
  }

  const prefix = options.eci === undefined ? [] : encodeECI(options.eci)

  const candidates: number[][] = [encodeASCII(text)]
  const c40 = encodeC40(text)
  if (isLossless(c40)) candidates.push(c40)
  const textMode = encodeTextMode(text)
  if (isLossless(textMode)) candidates.push(textMode)
  const x12 = encodeX12(text)
  if (x12) candidates.push(x12)
  const edifact = encodeEDIFACT(text)
  if (edifact) candidates.push(edifact)

  let best = candidates[0]!
  for (const candidate of candidates) {
    if (candidate.length < best.length) best = candidate
  }
  return prefix.length > 0 ? [...prefix, ...best] : best
}

/**
 * C40/Text encoders fall back to ASCII for characters they cannot represent, so
 * their output is always valid — this only guards against an empty result.
 */
function isLossless(codewords: number[]): boolean {
  return codewords.length > 0
}

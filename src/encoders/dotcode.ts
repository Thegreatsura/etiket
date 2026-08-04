/**
 * DotCode encoder (AIM ISS DotCode)
 *
 * High-speed industrial 2D symbology used for tobacco and pharma marking.
 *
 * Structure:
 * - Rectangular grid of dots; only positions where `(x + y)` is even may be lit
 * - `rows + columns` must be odd
 * - Data is encoded as GF(113) codewords in modes A/B/C/Binary
 * - Reed-Solomon over GF(113) (primitive root 3), interleaved for long symbols
 * - The 9-bit "5 of 9" codeword patterns are laid out along a serpentine walk,
 *   with six fixed corner/edge dots taken from the tail of the bitstream
 * - One of four mask patterns is applied to the codewords; the mask index is
 *   carried in the first two bits of the symbol and as the first RS codeword
 *
 * The encodation, symbol sizing, masking, placement and mask-scoring rules all
 * follow BWIPP's `dotcode` implementation, which is the reference this encoder
 * is verified against module-for-module.
 *
 * Not supported: FNC1/FNC2 (GS1 / ECI) and FNC3 reader programming, since the
 * public entry point takes plain text rather than a pre-parsed message.
 */

import { InvalidInputError } from "../errors"

// ---------------------------------------------------------------------------
// GF(113) prime field
// ---------------------------------------------------------------------------

const GF = 113

/** RSALOG[i] = 3^i mod 113 — 3 is a primitive root of GF(113). */
const RSALOG = (() => {
  const table = Array.from<number>({ length: GF }).fill(0)
  let x = 1
  for (let i = 0; i < GF; i++) {
    table[i] = x
    x = (x * 3) % GF
  }
  return table
})()

const generatorCache = new Map<number, number[]>()

/**
 * Reed-Solomon generator polynomial for `nc` check codewords.
 *
 * Built monic as `(x - 3^1)...(x - 3^nc)` with `coeffs[0]` the leading term,
 * then returned reversed and with the leading 1 dropped, so `g[0]` is the
 * constant term — the layout {@link rsEncode} consumes.
 */
function buildGenerator(nc: number): number[] {
  const cached = generatorCache.get(nc)
  if (cached) return cached

  const coeffs = Array.from<number>({ length: nc + 1 }).fill(0)
  coeffs[0] = 1
  for (let i = 1; i <= nc; i++) {
    for (let j = nc; j >= 1; j--) {
      coeffs[j] = (coeffs[j]! + GF - ((RSALOG[i]! * coeffs[j - 1]!) % GF)) % GF
    }
  }

  const gen = Array.from<number>({ length: nc }).fill(0)
  for (let k = 0; k < nc; k++) gen[k] = coeffs[nc - k]!
  generatorCache.set(nc, gen)
  return gen
}

/**
 * Streaming LFSR Reed-Solomon encoder over GF(113).
 *
 * Returns the check codewords already in the negated form the symbol expects.
 */
function rsEncode(data: number[], nc: number): number[] {
  const coeffs = buildGenerator(nc)
  const lfsr = Array.from<number>({ length: nc }).fill(0)
  for (const d of data) {
    const fb = (d - lfsr[0]! + GF) % GF
    for (let j = 0; j <= nc - 2; j++) {
      lfsr[j] = (lfsr[j + 1]! + coeffs[nc - 1 - j]! * fb) % GF
    }
    lfsr[nc - 1] = (coeffs[0]! * fb) % GF
  }
  return lfsr
}

// ---------------------------------------------------------------------------
// Character maps
// ---------------------------------------------------------------------------

// Non-character control values used inside the encodation tables. They are
// negative so they can never collide with a byte value.
const LAA = -1
const LAB = -2
const LAC = -3
const BIN = -4
const SFA = -5
const SFB = -6
const SB2 = -7
const SB3 = -8
const SB4 = -9
const SB5 = -10
const SB6 = -11
const SC2 = -13
const SC3 = -14
const SC4 = -15
const SC5 = -16
const SC6 = -17
const SC7 = -18
const BSA = -19
const BSB = -20
const TMA = -21
const TMB = -22
const TMC = -23
const FN1 = -25
const CRL = -28
const AIM = -29
const M05 = -30
const M06 = -31
const M12 = -32
const MAC = -33

/** Codeword for a value in Code Set A. */
const A_VALS = new Map<number, number>()
/** Codeword for a value in Code Set B. */
const B_VALS = new Map<number, number>()
/** Codeword for a control value in Code Set C (digit pairs are computed). */
const C_VALS = new Map<number, number>()
/** Codeword for a control value in Binary mode. */
const BIN_VALS = new Map<number, number>()

for (let i = 0; i < 64; i++) A_VALS.set(i + 32, i)
for (let i = 64; i < 96; i++) A_VALS.set(i - 64, i)
for (const [value, cw] of [
  [SFB, 96],
  [SB2, 97],
  [SB3, 98],
  [SB4, 99],
  [SB5, 100],
  [SB6, 101],
  [LAB, 102],
  [SC2, 103],
  [SC3, 104],
  [SC4, 105],
  [LAC, 106],
  [BSA, 110],
  [BSB, 111],
  [BIN, 112],
] as const) {
  A_VALS.set(value, cw)
}

for (let i = 0; i < 96; i++) B_VALS.set(i + 32, i)
for (const [value, cw] of [
  [CRL, 96],
  [9, 97],
  [28, 98],
  [29, 99],
  [30, 100],
  [SFA, 101],
  [LAA, 102],
  [SC2, 103],
  [SC3, 104],
  [SC4, 105],
  [LAC, 106],
  [BSA, 110],
  [BSB, 111],
  [BIN, 112],
  [M05, 97],
  [M06, 98],
  [M12, 99],
  [MAC, 100],
] as const) {
  B_VALS.set(value, cw)
}

for (const [value, cw] of [
  [AIM, 100],
  [LAA, 101],
  [SFB, 102],
  [SB2, 103],
  [SB3, 104],
  [SB4, 105],
  [LAB, 106],
  [FN1, 107],
  [BSA, 110],
  [BSB, 111],
  [BIN, 112],
] as const) {
  C_VALS.set(value, cw)
}

for (const [value, cw] of [
  [SC2, 103],
  [SC3, 104],
  [SC4, 105],
  [SC5, 106],
  [SC6, 107],
  [SC7, 108],
  [TMA, 109],
  [TMB, 110],
  [TMC, 111],
] as const) {
  BIN_VALS.set(value, cw)
}

/** The 113 "5 of 9" dot patterns, one per codeword value. */
const ENCS = [
  "101010101",
  "010101011",
  "010101101",
  "010110101",
  "011010101",
  "101010110",
  "101011010",
  "101101010",
  "110101010",
  "010101110",
  "010110110",
  "010111010",
  "011010110",
  "011011010",
  "011101010",
  "100101011",
  "100101101",
  "100110101",
  "101001011",
  "101001101",
  "101010011",
  "101011001",
  "101100101",
  "101101001",
  "110010101",
  "110100101",
  "110101001",
  "001010111",
  "001011011",
  "001011101",
  "001101011",
  "001101101",
  "001110101",
  "010010111",
  "010011011",
  "010011101",
  "010100111",
  "010110011",
  "010111001",
  "011001011",
  "011001101",
  "011010011",
  "011011001",
  "011100101",
  "011101001",
  "100101110",
  "100110110",
  "100111010",
  "101001110",
  "101011100",
  "101100110",
  "101101100",
  "101110010",
  "101110100",
  "110010110",
  "110011010",
  "110100110",
  "110101100",
  "110110010",
  "110110100",
  "111001010",
  "111010010",
  "111010100",
  "001011110",
  "001101110",
  "001110110",
  "001111010",
  "010011110",
  "010111100",
  "011001110",
  "011011100",
  "011100110",
  "011101100",
  "011110010",
  "011110100",
  "100010111",
  "100011011",
  "100011101",
  "100100111",
  "100110011",
  "100111001",
  "101000111",
  "101100011",
  "101110001",
  "110001011",
  "110001101",
  "110010011",
  "110011001",
  "110100011",
  "110110001",
  "111000101",
  "111001001",
  "111010001",
  "000101111",
  "000110111",
  "000111011",
  "000111101",
  "001001111",
  "001100111",
  "001110011",
  "001111001",
  "010001111",
  "011000111",
  "011100011",
  "011110001",
  "100011110",
  "100111100",
  "101111000",
  "110001110",
  "110011100",
  "110111000",
  "111000110",
  "111001100",
]

/** Value added to codeword `k` for each mask: `(cw + k * MASK_VALS[m]) % 113`. */
const MASK_VALS = [0, 3, 7, 17]

// ---------------------------------------------------------------------------
// Encodation
// ---------------------------------------------------------------------------

const MODE_A = 0
const MODE_B = 1
const MODE_C = 2
const MODE_BIN = 3

/**
 * Repack up to five bytes (base 259) into one more codeword (base 103).
 *
 * This is the binary-mode packing from the specification: five 8-bit values
 * become six GF(113)-range codewords, with shorter tails handled by left
 * padding and trimming the leading output codewords.
 */
function base259to103(input: number[]): number[] {
  const inlen = input.length
  const padded = [...Array.from<number>({ length: 5 - inlen }).fill(0), ...input]

  const msb = padded[0]! * 259 + padded[1]!
  const mscs = [msb % 103, Math.floor(msb / 103) % 103, Math.floor(msb / 10_609)]

  const lsb = padded[2]! * 67_081 + padded[3]! * 259 + padded[4]!
  const lscs = [
    lsb % 103,
    Math.floor(lsb / 103) % 103,
    Math.floor(lsb / 10_609) % 103,
    Math.floor(lsb / 1_092_727),
  ]

  const out = Array.from<number>({ length: 6 }).fill(0)
  let acc = lscs[0]! + mscs[0]! * 42
  out[5] = acc % 103
  acc = Math.floor(acc / 103) + lscs[1]! + mscs[0]! * 68 + mscs[1]! * 42
  out[4] = acc % 103
  acc = Math.floor(acc / 103) + lscs[2]! + mscs[0]! * 92 + mscs[1]! * 68 + mscs[2]! * 42
  out[3] = acc % 103
  acc = Math.floor(acc / 103) + lscs[3]! + mscs[0]! * 15 + mscs[1]! * 92 + mscs[2]! * 68
  out[2] = acc % 103
  acc = Math.floor(acc / 103) + mscs[1]! * 15 + mscs[2]! * 92
  out[1] = acc % 103
  acc = Math.floor(acc / 103) + mscs[2]! * 15
  out[0] = acc % 103

  return out.slice(5 - inlen)
}

/** Result of the encodation stage. */
interface Encodation {
  cws: number[]
  /** Mode the encoder finished in — decides the first pad codeword. */
  mode: number
}

function isDigit(byte: number): boolean {
  return byte >= 48 && byte <= 57
}

/**
 * Turn a message byte array into DotCode codewords, switching between
 * Code Sets A, B, C and Binary mode with the specification's lookahead rules.
 */
function encodeCodewords(msg: number[]): Encodation {
  const msglen = msg.length

  // Per-position properties, computed right to left.
  const nDigits = Array.from<number>({ length: msglen + 1 }).fill(0)
  const seventeenTen = Array.from<boolean>({ length: msglen + 1 }).fill(false)
  const datumA = Array.from<boolean>({ length: msglen + 1 }).fill(false)
  const datumB = Array.from<boolean>({ length: msglen + 1 }).fill(false)
  const datumC = Array.from<boolean>({ length: msglen + 1 }).fill(false)
  const binary = Array.from<boolean>({ length: msglen + 8 }).fill(false)
  const aheadC = Array.from<number>({ length: msglen + 1 }).fill(0)
  const tryC = Array.from<number>({ length: msglen + 1 }).fill(0)
  const aheadA = Array.from<number>({ length: msglen + 1 }).fill(0)
  const aheadB = Array.from<number>({ length: msglen + 1 }).fill(0)
  const untilEndSeg = Array.from<number>({ length: msglen + 1 }).fill(0)

  for (let i = msglen - 1; i >= 0; i--) {
    const byte = msg[i]!
    if (isDigit(byte)) nDigits[i] = nDigits[i + 1]! + 1
    if (A_VALS.has(byte)) datumA[i] = true
    if (B_VALS.has(byte)) datumB[i] = true
    const crlf = byte === 13 && i < msglen - 1 && msg[i + 1] === 10
    if (crlf) datumB[i] = true
    if (nDigits[i]! >= 2) datumC[i] = true
    if (byte >= 128) binary[i] = true
    if (nDigits[i]! >= 10) {
      seventeenTen[i] = msg[i] === 49 && msg[i + 1] === 55 && msg[i + 8] === 49 && msg[i + 9] === 48
    }
    aheadC[i] = nDigits[i]! <= 1 ? 0 : aheadC[i + 2]! + 1
    if (nDigits[i]! > 0 && aheadC[i]! > aheadC[i + 1]!) tryC[i] = aheadC[i]!
    if (datumA[i] && tryC[i]! < 2) aheadA[i] = aheadA[i + 1]! + 1
    if (datumB[i] && tryC[i]! < 2) aheadB[i] = aheadB[i + 1 + (crlf ? 1 : 0)]! + 1
    untilEndSeg[i] = untilEndSeg[i + 1]! + 1
  }

  const cws: number[] = []
  let mode = MODE_C
  let i = 0
  let inmac = 0
  // Segment bounds only move on FNC3, which plain text cannot produce.
  const segstart = 0
  const segend = untilEndSeg[0]!

  // Binary-mode staging buffer: five bytes pack into six codewords.
  const bvals: number[] = []
  const finaliseBIN = () => {
    if (bvals.length > 0) {
      cws.push(...base259to103(bvals))
      bvals.length = 0
    }
  }
  const addToBin = (byte: number) => {
    bvals.push(byte)
    if (bvals.length === 5) finaliseBIN()
  }

  /** Emit `n` digit pairs (or control codewords) starting at the cursor. */
  const emitDigitPairs = (n: number) => {
    for (let k = 0; k < n; k++) {
      cws.push((msg[i]! - 48) * 10 + (msg[i + 1]! - 48))
      i += 2
    }
  }

  /** Emit `n` Code Set B characters, collapsing CRLF into a single codeword. */
  const emitSetB = (n: number) => {
    for (let k = 0; k < n; k++) {
      if (msg[i] === 13) {
        cws.push(B_VALS.get(CRL)!)
        i += 2
      } else {
        cws.push(B_VALS.get(msg[i]!)!)
        i++
      }
    }
  }

  /** Detect the structured-append macro headers recognised at a segment start. */
  const detectMacro = (): number => {
    if (i > segend - 7) return 0
    if (msg[segstart] !== 91 || msg[segstart + 1] !== 41) return 0
    if (msg[segstart + 2] !== 62 || msg[segstart + 3] !== 30) return 0
    if (!isDigit(msg[segstart + 4]!) || !isDigit(msg[segstart + 5]!)) return 0
    if (msg[segend - 1] !== 4) return 0
    const id = (msg[segstart + 4]! - 48) * 10 + (msg[segstart + 5]! - 48)
    if (id !== 5 && id !== 6 && id !== 12) return MAC
    if (msg[segstart + 6] !== 29) return 0
    if (msg[segend - 2] !== 30) return 0
    if (id === 5) return M05
    if (id === 6) return M06
    return M12
  }

  const encC = () => {
    if (i === segstart) {
      inmac = detectMacro()
      if (inmac !== 0) {
        cws.push(C_VALS.get(LAB)!)
        mode = MODE_B
        cws.push(B_VALS.get(inmac)!)
        if (inmac === MAC) {
          cws.push(B_VALS.get(msg[segstart + 4]!)!)
          cws.push(B_VALS.get(msg[segstart + 5]!)!)
          i += 6
        } else {
          i += 7
        }
        return
      }
      // A segment that starts with two digits carries an implied FNC1.
      if (nDigits[i]! >= 2) cws.push(C_VALS.get(FN1)!)
    }
    if (seventeenTen[i]) {
      cws.push(
        C_VALS.get(AIM)!,
        (msg[i + 2]! - 48) * 10 + (msg[i + 3]! - 48),
        (msg[i + 4]! - 48) * 10 + (msg[i + 5]! - 48),
        (msg[i + 6]! - 48) * 10 + (msg[i + 7]! - 48),
      )
      i += 10
      return
    }
    if (datumC[i]) {
      emitDigitPairs(1)
      return
    }
    if (binary[i]) {
      if (nDigits[i + 1]! > 0) {
        if (msg[i]! < 160) {
          cws.push(C_VALS.get(BSA)!, A_VALS.get(msg[i]! - 128)!)
        } else {
          cws.push(C_VALS.get(BSB)!, B_VALS.get(msg[i]! - 128)!)
        }
        i++
        return
      }
      cws.push(C_VALS.get(BIN)!)
      mode = MODE_BIN
      return
    }
    const m = aheadA[i]!
    const n = aheadB[i]!
    if (m > n) {
      cws.push(C_VALS.get(LAA)!)
      mode = MODE_A
      return
    }
    if (i === segstart && (msg[i] === 9 || msg[i] === 28 || msg[i] === 29 || msg[i] === 30)) {
      cws.push(C_VALS.get(LAA)!)
      mode = MODE_A
      return
    }
    if (n > 4) {
      cws.push(C_VALS.get(LAB)!)
      mode = MODE_B
      return
    }
    cws.push(C_VALS.get([SFB, SB2, SB3, SB4][n - 1]!)!)
    emitSetB(n)
  }

  const encB = () => {
    const n = tryC[i]!
    if (n >= 2) {
      if (n > 4) {
        cws.push(B_VALS.get(LAC)!)
        mode = MODE_C
        return
      }
      cws.push(B_VALS.get([0, SC2, SC3, SC4][n - 1]!)!)
      emitDigitPairs(n)
      return
    }
    if (datumB[i]) {
      if (msg[i] === 13 && i < msglen - 1 && msg[i + 1] === 10) {
        cws.push(B_VALS.get(CRL)!)
        i += 2
        return
      }
      cws.push(B_VALS.get(msg[i]!)!)
      i++
      return
    }
    if (binary[i]) {
      if (datumB[i + 1]) {
        if (msg[i]! < 160) {
          cws.push(B_VALS.get(BSA)!, A_VALS.get(msg[i]! - 128)!)
        } else {
          cws.push(B_VALS.get(BSB)!, B_VALS.get(msg[i]! - 128)!)
        }
        i++
        return
      }
      cws.push(B_VALS.get(BIN)!)
      mode = MODE_BIN
      return
    }
    if (aheadA[i] === 1) {
      cws.push(B_VALS.get(SFA)!, A_VALS.get(msg[i]!)!)
      i++
      return
    }
    cws.push(B_VALS.get(LAA)!)
    mode = MODE_A
  }

  const encA = () => {
    const n = tryC[i]!
    if (n >= 2) {
      if (n > 4) {
        cws.push(A_VALS.get(LAC)!)
        mode = MODE_C
        return
      }
      cws.push(A_VALS.get([0, SC2, SC3, SC4][n - 1]!)!)
      emitDigitPairs(n)
      return
    }
    if (datumA[i]) {
      cws.push(A_VALS.get(msg[i]!)!)
      i++
      return
    }
    if (binary[i]) {
      if (datumA[i + 1]) {
        if (msg[i]! < 160) {
          cws.push(A_VALS.get(BSA)!, A_VALS.get(msg[i]! - 128)!)
        } else {
          cws.push(A_VALS.get(BSB)!, B_VALS.get(msg[i]! - 128)!)
        }
        i++
        return
      }
      cws.push(A_VALS.get(BIN)!)
      mode = MODE_BIN
      return
    }
    const n2 = aheadB[i]!
    if (n2 > 6) {
      cws.push(A_VALS.get(LAB)!)
      mode = MODE_B
      return
    }
    cws.push(A_VALS.get([SFB, SB2, SB3, SB4, SB5, SB6][n2 - 1]!)!)
    emitSetB(n2)
  }

  const encBIN = () => {
    const n = tryC[i]!
    if (n >= 2) {
      finaliseBIN()
      if (n > 7) {
        cws.push(BIN_VALS.get(TMC)!)
        mode = MODE_C
        return
      }
      cws.push(BIN_VALS.get([SC2, SC3, SC4, SC5, SC6, SC7][n - 2]!)!)
      emitDigitPairs(n)
      return
    }
    if (binary[i] || binary[i + 1] || binary[i + 2] || binary[i + 3]) {
      addToBin(msg[i]!)
      i++
      if (i === msglen) finaliseBIN()
      return
    }
    finaliseBIN()
    if (aheadA[i]! > aheadB[i]!) {
      cws.push(BIN_VALS.get(TMA)!)
      mode = MODE_A
    } else {
      cws.push(BIN_VALS.get(TMB)!)
      mode = MODE_B
    }
  }

  while (i < msglen) {
    if (inmac !== 0) {
      // Skip the macro trailer, which is implied by the macro codeword.
      if (inmac !== MAC && i === segend - 2) {
        i += 2
        if (i >= msglen) break
      }
      if (inmac === MAC && i === segend - 1) {
        i += 1
        if (i >= msglen) break
      }
    }
    if (mode === MODE_A) encA()
    else if (mode === MODE_B) encB()
    else if (mode === MODE_C) encC()
    else encBIN()
  }

  return { cws, mode }
}

// ---------------------------------------------------------------------------
// Symbol layout
// ---------------------------------------------------------------------------

/** Six fixed edge dot positions, as `[x, y]` pairs. */
function sixEdges(rows: number, columns: number): [number, number][] {
  if (rows % 2 === 0) {
    return [
      [columns - 1, rows - 2],
      [0, rows - 2],
      [columns - 2, rows - 1],
      [1, rows - 1],
      [columns - 1, 0],
      [0, 0],
    ]
  }
  return [
    [columns - 2, 0],
    [columns - 2, rows - 1],
    [columns - 1, 1],
    [columns - 1, rows - 2],
    [0, 0],
    [0, rows - 1],
  ]
}

/**
 * Score a candidate symbol. Higher is better; a symbol with a completely unlit
 * edge is disqualified with a large negative score.
 */
function evalSymbol(pixs: Int8Array, rows: number, columns: number): number {
  const at = (x: number, y: number) => pixs[y * columns + x]!

  // Worst-lit edge: top, bottom, left, right.
  let worst = 9_999_999
  for (const [horizontal, far] of [
    [true, 0],
    [true, 1],
    [false, 0],
    [false, 1],
  ] as const) {
    const span = horizontal ? columns : rows
    const cross = horizontal ? rows : columns
    let sum = 0
    let first = -1
    let last = -1
    for (let d = 0; d < span; d++) {
      const x = horizontal ? d : (cross - 1) * far
      const y = horizontal ? (cross - 1) * far : d
      if (at(x, y) === 1) {
        if (first === -1) first = d
        last = d
        sum++
      }
    }
    const score = (sum + last - first) * cross
    if (score < worst) worst = score
  }

  // Penalise runs of entirely blank interior columns / rows.
  const clearCol = (x: number) => {
    for (let y = x & 1; y < rows; y += 2) if (at(x, y) === 1) return false
    return true
  }
  const clearRow = (y: number) => {
    for (let x = y & 1; x < columns; x += 2) if (at(x, y) === 1) return false
    return true
  }

  let pen = 0
  if (rows % 2 === 1 || rows <= 12) {
    let run = 0
    let p = 0
    for (let x = 1; x <= columns - 2; x++) {
      if (clearCol(x)) {
        run++
        p = run === 1 ? rows : p * rows
      } else {
        run = 0
        pen += p
        p = 0
      }
    }
    pen += p
  }
  if (rows % 2 === 0 || columns <= 12) {
    let run = 0
    let p = 0
    for (let y = 1; y <= rows - 2; y++) {
      if (clearRow(y)) {
        run++
        p = run === 1 ? columns : p * columns
      } else {
        run = 0
        pen += p
        p = 0
      }
    }
    pen += p
  }

  // Count voids and isolated dots on a symbol padded by two on every side.
  const pw = columns + 4
  const ph = rows + 4
  const symp = new Int8Array(pw * ph)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) symp[(y + 2) * pw + (x + 2)] = pixs[y * columns + x]!
  }
  const sat = (x: number, y: number) => symp[y * pw + x]!

  let sum = 0
  for (let y = 2; y <= ph - 3; y++) {
    for (let x = (y & 1) + 2; x <= pw - 3; x += 2) {
      if (sat(x - 1, y - 1) === 1) continue
      if (sat(x + 1, y - 1) === 1) continue
      if (sat(x - 1, y + 1) === 1) continue
      if (sat(x + 1, y + 1) === 1) continue
      if (sat(x, y) === 0) {
        sum++
        continue
      }
      if (sat(x - 2, y) === 1) continue
      if (sat(x, y - 2) === 1) continue
      if (sat(x + 2, y) === 1) continue
      if (sat(x, y + 2) === 1) continue
      sum++
    }
  }

  if (worst === 0) return -99_999
  return worst - sum * sum - pen
}

/** Options for {@link encodeDotCode}. */
export interface DotCodeOptions {
  /** Fixed symbol height in dots (5-200). */
  rows?: number
  /** Fixed symbol width in dots (5-200). */
  columns?: number
  /** Force a mask pattern (0-3) instead of picking the best-scoring one. */
  mask?: number
}

/**
 * Convert a JavaScript string to the message bytes DotCode encodes.
 *
 * Non-ASCII text becomes UTF-8, matching the rest of etiket's 2D encoders, and
 * the resulting high bytes go through DotCode's binary mode.
 */
function toBytes(text: string): number[] {
  return [...new TextEncoder().encode(text)]
}

/**
 * Encode text as a DotCode symbol.
 *
 * @returns A row-major matrix where `true` marks a lit dot.
 */
export function encodeDotCode(text: string, options: DotCodeOptions = {}): boolean[][] {
  if (text.length === 0) {
    throw new InvalidInputError("DotCode input must not be empty")
  }
  if (text.length > 2000) {
    throw new InvalidInputError("DotCode input is too long")
  }

  const fixedRows = options.rows ?? -1
  const fixedColumns = options.columns ?? -1
  const fixedMask = options.mask ?? -1

  if (fixedRows !== -1 && (fixedRows < 5 || fixedRows > 200)) {
    throw new InvalidInputError("DotCode rows must be from 5 to 200")
  }
  if (fixedColumns !== -1 && (fixedColumns < 5 || fixedColumns > 200)) {
    throw new InvalidInputError("DotCode columns must be from 5 to 200")
  }
  if (fixedRows !== -1 && fixedColumns !== -1 && (fixedRows + fixedColumns) % 2 !== 1) {
    throw new InvalidInputError("DotCode rows + columns must be odd")
  }
  if (fixedMask !== -1 && (fixedMask < 0 || fixedMask > 3)) {
    throw new InvalidInputError("DotCode mask must be from 0 to 3")
  }

  const { cws, mode } = encodeCodewords(toBytes(text))

  // ---- Symbol size -------------------------------------------------------
  let nd = cws.length
  const minarea = ((nd + 3 + Math.floor(nd / 2)) * 9 + 2) * 2

  let rows = fixedRows
  let columns = fixedColumns
  if (rows === -1 && columns === -1) {
    // Default 3:2 aspect ratio.
    const ratio = 3 / 2
    const hgt = Math.sqrt(minarea / ratio)
    const wid = Math.sqrt(minarea * ratio)
    let h = Math.trunc(hgt)
    let w = Math.trunc(wid)
    if ((h + w) % 2 === 1) {
      if (h * w < minarea) {
        h++
        w++
      }
    } else if (hgt * w < wid * h) {
      w++
      if (h * w < minarea) {
        w--
        h++
        if (h * w < minarea) w += 2
      }
    } else {
      h++
      if (h * w < minarea) {
        h--
        w++
        if (h * w < minarea) h += 2
      }
    }
    rows = h
    columns = w
  } else if (columns === -1) {
    columns = Math.ceil(minarea / rows)
    if ((columns + rows) % 2 === 0) columns++
    if (columns < 5) columns = 5 + (rows % 2)
  } else if (rows === -1) {
    rows = Math.ceil(minarea / columns)
    if ((rows + columns) % 2 === 0) rows++
    if (rows < 5) rows = 5 + (columns % 2)
  }

  // ---- Padding and error correction sizing -------------------------------
  const ndots = Math.floor((rows * columns) / 2)
  while ((nd + 1 + Math.floor((nd + 1) / 2) + 3) * 9 + 2 <= ndots) nd++
  const nc = Math.floor(nd / 2) + 3
  const nw = nd + nc
  const rembits = ndots - (nw * 9 + 2)

  const padded = cws.slice()
  if (nd > padded.length) {
    padded.push(mode === MODE_BIN ? 109 : 106)
    while (padded.length < nd) padded.push(106)
  }

  if (nw * 9 > ndots - 2) {
    throw new InvalidInputError("DotCode data is too long for the symbol size")
  }

  // ---- Mask evaluation ---------------------------------------------------
  const edges = sixEdges(rows, columns)
  const dmv = (x: number, y: number) => y * columns + x

  const outline = new Int8Array(rows * columns)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) outline[dmv(x, y)] = ((x + y) % 2) - 1
  }
  for (const [x, y] of edges) outline[dmv(x, y)] = 1

  const step = Math.floor(nw / 112) + 1
  const maskList = fixedMask === -1 ? [0, 1, 2, 3] : [fixedMask]
  const litmasks: (Int8Array | undefined)[] = [undefined, undefined, undefined, undefined]

  let bestSym: Int8Array | undefined
  let bestScore = -99_999_999

  for (const mask of maskList) {
    // Interleaved Reed-Solomon over the mask codeword plus the masked data.
    const maskVal = MASK_VALS[mask]!
    const rscws = Array.from<number>({ length: nw + 1 }).fill(0)
    rscws[0] = mask
    for (let k = 0; k < nd; k++) rscws[k + 1] = (padded[k]! + k * maskVal) % GF

    for (let start = 0; start < step; start++) {
      const nDataBlock = Math.ceil((nd + 1 - start) / step)
      const nAllBlock = Math.ceil((nw + 1 - start) / step)
      const nEcBlock = nAllBlock - nDataBlock
      if (nEcBlock <= 0) continue
      const block = Array.from<number>({ length: nDataBlock }).fill(0)
      for (let k = 0; k < nDataBlock; k++) block[k] = rscws[k * step + start]!
      const ec = rsEncode(block, nEcBlock)
      for (let k = 0; k < nEcBlock; k++) rscws[(nDataBlock + k) * step + start] = ec[k]!
    }

    // Bitstream: two mask bits, then one 9-bit pattern per codeword, then 1s.
    const bits = new Uint8Array(ndots)
    bits[0] = (mask >> 1) & 1
    bits[1] = mask & 1
    for (let k = 1; k <= nw; k++) {
      const pattern = ENCS[rscws[k]!]!
      const base = (k - 1) * 9 + 2
      for (let b = 0; b < 9; b++) bits[base + b] = pattern.charCodeAt(b) - 48
    }
    for (let b = 0; b < rembits; b++) bits[nw * 9 + 2 + b] = 1

    // Serpentine walk over the vacant dot positions.
    const pixs = Int8Array.from(outline)
    let posx = 0
    let posy = rows % 2 === 0 ? 0 : rows - 1
    for (let b = 0; b < ndots - 6; b++) {
      while (pixs[dmv(posx, posy)] !== -1) {
        if (rows % 2 === 0) {
          posy++
          if (posy === rows) {
            posy = 0
            posx++
          }
        } else {
          posx++
          if (posx === columns) {
            posx = 0
            posy--
          }
        }
      }
      pixs[dmv(posx, posy)] = bits[b]!
    }
    for (let k = 0; k < 6; k++) {
      const [x, y] = edges[k]!
      pixs[dmv(x, y)] = bits[ndots - 6 + k]!
    }

    const score = evalSymbol(pixs, rows, columns)
    if (score > bestScore) {
      bestSym = pixs
      bestScore = score
    }

    // Keep a variant with the six edge dots forcibly lit, as a fallback.
    const litmask = Int8Array.from(pixs)
    for (const [x, y] of edges) litmask[dmv(x, y)] = 1
    litmasks[mask] = litmask
  }

  // If no mask clears the threshold, re-score the lit-edge variants instead.
  if (bestScore <= ndots) {
    bestScore = -99_999_999
    for (const mask of maskList) {
      const litmask = litmasks[mask]!
      const score = evalSymbol(litmask, rows, columns)
      if (score > bestScore) {
        bestSym = litmask
        bestScore = score
      }
    }
  }

  const sym = bestSym!
  const matrix: boolean[][] = []
  for (let y = 0; y < rows; y++) {
    const row: boolean[] = []
    for (let x = 0; x < columns; x++) row.push(sym[dmv(x, y)] === 1)
    matrix.push(row)
  }
  return matrix
}

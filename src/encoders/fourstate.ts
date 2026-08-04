/**
 * 4-state barcode encoders
 * Shared engine for RM4SCC (Royal Mail), KIX (Dutch), and related postal formats
 *
 * 4-state barcodes use bars with 4 possible states:
 * - Tracker (T): short center bar
 * - Ascender (A): extends above center
 * - Descender (D): extends below center
 * - Full (F): extends both above and below
 */

import { InvalidInputError } from "../errors"

/** Bar state in a 4-state barcode */
export type FourState = "T" | "A" | "D" | "F"

// RM4SCC / KIX bar alphabet.
//
// Every character is 4 bars in which exactly two carry an ascender and exactly
// two carry a descender: the ascender pattern encodes the character's row in a
// 6x6 grid, the descender pattern its column. The 36 patterns below are the
// spec tables, transcribed with 0=Tracker, 1=Descender, 2=Ascender, 3=Full.
//
// RM4SCC and KIX share the same 36 patterns but assign them to characters in a
// different order, so each needs its own alphabet string.

const STATE_BY_DIGIT: Record<string, FourState> = { "0": "T", "1": "D", "2": "A", "3": "F" }

/** RM4SCC character order — the grid position of a character is its index here */
const RM4SCC_CHARS = "ZUVWXY501234B6789AHCDEFGNIJKLMTOPQRS"

// prettier-ignore
const RM4SCC_PATTERNS = [
  "3300", "2211", "2301", "2310", "3201", "3210",
  "1122", "0033", "0123", "0132", "1023", "1032",
  "1302", "0213", "0303", "0312", "1203", "1212",
  "1320", "0231", "0321", "0330", "1221", "1230",
  "3102", "2013", "2103", "2112", "3003", "3012",
  "3120", "2031", "2121", "2130", "3021", "3030",
]

const KIX_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"

// prettier-ignore
const KIX_PATTERNS = [
  "0033", "0123", "0132", "1023", "1032", "1122",
  "0213", "0303", "0312", "1203", "1212", "1302",
  "0231", "0321", "0330", "1221", "1230", "1320",
  "2013", "2103", "2112", "3003", "3012", "3102",
  "2031", "2121", "2130", "3021", "3030", "3120",
  "2211", "2301", "2310", "3201", "3210", "3300",
]

function buildTable(chars: string, patterns: readonly string[]): Record<string, FourState[]> {
  const table: Record<string, FourState[]> = {}
  for (let i = 0; i < chars.length; i++) {
    table[chars[i]!] = [...patterns[i]!].map((d) => STATE_BY_DIGIT[d]!)
  }
  return table
}

const RM4SCC_TABLE = buildTable(RM4SCC_CHARS, RM4SCC_PATTERNS)
const KIX_TABLE = buildTable(KIX_CHARS, KIX_PATTERNS)

/**
 * Calculate the RM4SCC check character.
 *
 * Row and column values come from the character's position in the RM4SCC grid
 * (i.e. its index in `RM4SCC_CHARS`), summed mod 6 each.
 */
function rm4sccCheckDigit(text: string): string {
  let rowSum = 0
  let colSum = 0
  for (const ch of text) {
    const idx = RM4SCC_CHARS.indexOf(ch)
    if (idx === -1) continue
    rowSum += Math.floor(idx / 6)
    colSum += idx % 6
  }
  return RM4SCC_CHARS[(rowSum % 6) * 6 + (colSum % 6)]!
}

/**
 * Encode Royal Mail 4-State Customer Code (RM4SCC)
 * Used by Royal Mail for automated letter sorting
 *
 * @param text - Postcode + Delivery Point Suffix (alphanumeric, A-Z 0-9)
 * @returns Array of FourState values
 */
export function encodeRM4SCC(text: string): FourState[] {
  const upper = text.toUpperCase().replace(/\s/g, "")
  if (!/^[0-9A-Z]+$/.test(upper)) {
    throw new InvalidInputError("RM4SCC only accepts A-Z and 0-9")
  }

  const check = rm4sccCheckDigit(upper)
  const dataWithCheck = upper + check

  const bars: FourState[] = ["A"] // Start: ascender

  for (const ch of dataWithCheck) {
    const pattern = RM4SCC_TABLE[ch]
    if (!pattern) throw new InvalidInputError(`Invalid RM4SCC character: ${ch}`)
    bars.push(...pattern)
  }

  bars.push("F") // Stop: full bar

  return bars
}

/**
 * Encode KIX (Klant Index) barcode — Dutch PostNL
 * Same encoding as RM4SCC but without start/stop bars and no check digit
 *
 * @param text - 6 characters (postcode part)
 * @returns Array of FourState values
 */
export function encodeKIX(text: string): FourState[] {
  const upper = text.toUpperCase().replace(/\s/g, "")
  if (!/^[0-9A-Z]+$/.test(upper)) {
    throw new InvalidInputError("KIX only accepts A-Z and 0-9")
  }

  const bars: FourState[] = []

  for (const ch of upper) {
    const pattern = KIX_TABLE[ch]
    if (!pattern) throw new InvalidInputError(`Invalid KIX character: ${ch}`)
    bars.push(...pattern)
  }

  return bars
}

// Australia Post 4-State barcode
//
// The symbol is a fixed-length frame whose length is chosen by the Format
// Control Code:
//
//   FCC 11/45/87/92 -> 37 bars (Standard Customer Barcode, no customer info)
//   FCC 59          -> 52 bars (Customer Barcode 2)
//   FCC 62          -> 67 bars (Customer Barcode 3)
//
// Layout (bar positions):
//
//   0..1              start frame
//   2..21             FCC (2 digits) + DPID (8 digits), N table, 2 bars each
//   22..len-15        customer information, then filler bars
//   len-14..len-3     12 Reed-Solomon check bars (4 symbols x 3 bars)
//   len-2..len-1      stop frame
//
// Internally the symbol is built as a string of bar-state digits, matching the
// spec tables, and converted to `FourState` at the end.

/** Bar-state digit -> bar: 0 full, 1 ascender, 2 descender, 3 tracker. */
const AUSPOST_STATE_BY_DIGIT: FourState[] = ["F", "A", "D", "T"]

/** Symbol length in bars, by Format Control Code. */
const AUSPOST_FCC_LENGTH: Record<string, number> = {
  "11": 37,
  "45": 37,
  "59": 52,
  "62": 67,
  "87": 37,
  "92": 37,
}

/** Customer information character set — the index into it selects a C table entry. */
const AUSPOST_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz #"

/** C table — 3 bars per character, indexed by position in `AUSPOST_CHARS`. */
// prettier-ignore
const AUSPOST_C_TABLE = [
  "000", "001", "002", "010", "011", "012", "020", "021",
  "022", "100", "101", "102", "110", "111", "112", "120",
  "121", "122", "200", "201", "202", "210", "211", "212",
  "220", "221", "222", "300", "301", "302", "310", "311",
  "312", "320", "321", "322", "023", "030", "031", "032",
  "033", "103", "113", "123", "130", "131", "132", "133",
  "203", "213", "223", "230", "231", "232", "233", "303",
  "313", "323", "330", "331", "332", "333", "003", "013",
]

/** N table — 2 bars per digit, used for the FCC, the DPID and numeric customer info. */
// prettier-ignore
const AUSPOST_N_TABLE = [
  "00", "01", "02", "10", "11", "12", "20", "21", "22", "30",
]

/** Start and stop frame. */
const AUSPOST_FRAME = "13"

/** Filler bar, padding the customer information field out to the frame length. */
const AUSPOST_FILLER = "3"

/** How the customer information field is packed. */
export type AustraliaPostCustInfoEncoding = "character" | "numeric"

export interface AustraliaPostOptions {
  /**
   * Customer information encoding. `"character"` (the default) packs each
   * character into 3 bars via the C table; `"numeric"` packs each digit into 2
   * bars via the N table, fitting more data.
   */
  custInfoEncoding?: AustraliaPostCustInfoEncoding
}

/**
 * Multiply in GF(64), the field the Australia Post Reed-Solomon works over.
 * Irreducible polynomial x⁶ + x + 1 (0x43).
 */
function gf64Mul(a: number, b: number): number {
  let result = 0
  let x = a
  let y = b
  while (y !== 0) {
    if ((y & 1) !== 0) result ^= x
    y >>= 1
    x <<= 1
    if ((x & 64) !== 0) x ^= 67
  }
  return result
}

/**
 * Reed-Solomon generator polynomial (x + α)(x + α²)(x + α³)(x + α⁴) over GF(64),
 * lowest-order coefficient first.
 */
const AUSPOST_RS_POLY = (() => {
  const poly = [1, 0, 0, 0, 0]
  for (let i = 1; i <= 4; i++) {
    const t = 1 << i
    for (let j = i; j >= 1; j--) poly[j] = poly[j - 1]! ^ gf64Mul(poly[j]!, t)
    poly[0] = gf64Mul(poly[0]!, t)
  }
  return poly
})()

/**
 * Compute the 4 Reed-Solomon check symbols for a symbol body.
 *
 * `bars` holds the bar-state digits from position 2 up to (and including) the
 * last filler bar. Every group of 3 bars is one 6-bit GF(64) symbol; the symbols
 * are fed in reverse order (the spec numbers codewords from the right).
 *
 * @returns 12 bar-state digits
 */
function auspostReedSolomon(bars: string): string {
  const dataCount = bars.length / 3
  const codes: number[] = Array.from({ length: dataCount + 4 }, () => 0)

  for (let i = 0; i < dataCount; i++) {
    const triple = bars.slice(i * 3, i * 3 + 3)
    const value = +triple[0]! * 16 + +triple[1]! * 4 + +triple[2]!
    codes[codes.length - 1 - i] = value
  }

  for (let i = codes.length - 5; i >= 0; i--) {
    for (let j = 0; j <= 4; j++) {
      codes[i + j] = codes[i + j]! ^ gf64Mul(AUSPOST_RS_POLY[j]!, codes[i + 4]!)
    }
  }

  let check = ""
  for (let i = 0; i <= 3; i++) {
    check += codes[3 - i]!.toString(4).padStart(3, "0")
  }
  return check
}

/**
 * Encode Australia Post 4-State barcode
 *
 * @param fcc - Format Control Code: "11", "45", "59", "62", "87" or "92"
 * @param dpid - 8-digit Delivery Point Identifier, optionally followed by the
 *   customer information when `custInfo` is not passed separately
 * @param custInfo - Customer information (FCC 59 and 62 only)
 * @param options - Customer information encoding
 */
export function encodeAustraliaPost(
  fcc: string,
  dpid: string,
  custInfo?: string,
  options: AustraliaPostOptions = {},
): FourState[] {
  const length = AUSPOST_FCC_LENGTH[fcc]
  if (length === undefined) {
    throw new InvalidInputError("Australia Post FCC must be one of 11, 45, 59, 62, 87 or 92")
  }

  // Read the 8 DPID digits, tolerating separators. Anything left over is the
  // customer information, unless it was passed separately.
  let sortingCode = ""
  let read = 0
  for (; read < dpid.length && sortingCode.length < 8; read++) {
    const ch = dpid[read]!
    if (ch >= "0" && ch <= "9") sortingCode += ch
    else if (ch !== "-" && !/\s/.test(ch)) break
  }
  if (sortingCode.length !== 8) {
    throw new InvalidInputError("Australia Post DPID must be 8 digits")
  }

  const info = custInfo === undefined ? dpid.slice(read) : custInfo
  const numeric = options.custInfoEncoding === "numeric"

  // Start frame, then the FCC and DPID through the N table.
  let encstr = AUSPOST_FRAME
  for (const ch of fcc + sortingCode) encstr += AUSPOST_N_TABLE[+ch]!

  // Customer information: 3 bars per character, or 2 bars per digit.
  const capacity = length - 36
  if (info.length * (numeric ? 2 : 3) > capacity) {
    throw new InvalidInputError(
      `Australia Post customer information is too long for FCC ${fcc} (max ${Math.floor(capacity / (numeric ? 2 : 3))} characters)`,
    )
  }
  for (const ch of info) {
    if (numeric) {
      if (ch < "0" || ch > "9") {
        throw new InvalidInputError(
          "Australia Post numeric customer information only accepts digits",
        )
      }
      encstr += AUSPOST_N_TABLE[+ch]!
    } else {
      const index = AUSPOST_CHARS.indexOf(ch)
      if (index === -1) {
        throw new InvalidInputError(`Invalid Australia Post customer information character: ${ch}`)
      }
      encstr += AUSPOST_C_TABLE[index]!
    }
  }

  // Pad the customer information field out to the start of the check symbols.
  while (encstr.length < length - 14) encstr += AUSPOST_FILLER

  encstr += auspostReedSolomon(encstr.slice(2))
  encstr += AUSPOST_FRAME

  return [...encstr].map((d) => AUSPOST_STATE_BY_DIGIT[+d]!)
}

// Japan Post 4-State barcode (Kasutama / JP4SCC)
// KASUT_SET defines the order of characters for bar pattern lookup in JAPAN_TABLE
// KASUT_SET: '1','2','3','4','5','6','7','8','9','0','-','a','b','c','d','e','f','g','h'
// CH_KASUT_SET defines the order for check digit calculation (mod 19)
// CH_KASUT_SET: '0','1','2','3','4','5','6','7','8','9','-','a','b','c','d','e','f','g','h'
const KASUT_SET = "1234567890-abcdefgh"
const CH_KASUT_SET = "0123456789-abcdefgh"

// JAPAN_TABLE[i] = bar pattern for KASUT_SET[i]
const JAPAN_TABLE: FourState[][] = [
  ["F", "F", "T"], // '1'
  ["F", "D", "A"], // '2'
  ["D", "F", "A"], // '3'
  ["F", "A", "D"], // '4'
  ["F", "T", "F"], // '5'
  ["D", "A", "F"], // '6'
  ["A", "F", "D"], // '7'
  ["A", "D", "F"], // '8'
  ["T", "F", "F"], // '9'
  ["F", "T", "T"], // '0'
  ["T", "F", "T"], // '-'
  ["D", "A", "T"], // 'a'
  ["D", "T", "A"], // 'b'
  ["A", "D", "T"], // 'c'
  ["T", "D", "A"], // 'd' (also used for padding)
  ["A", "T", "D"], // 'e'
  ["T", "A", "D"], // 'f'
  ["T", "T", "F"], // 'g'
  ["F", "F", "F"], // 'h'
]

// Build lookup from character to bar pattern
const JP_TABLE: Record<string, FourState[]> = {}
for (let i = 0; i < KASUT_SET.length; i++) {
  JP_TABLE[KASUT_SET[i]!] = JAPAN_TABLE[i]!
}

/**
 * Convert an input character to its intermediate representation for Japan Post.
 * Digits and hyphens pass through; letters A-Z are expanded to two-character
 * sequences using internal characters a-h.
 */
function jpExpandChar(c: string): string {
  if ((c >= "0" && c <= "9") || c === "-") return c
  const code = c.charCodeAt(0)
  if (code >= 65 && code <= 74) {
    // A-J → 'a' + digit
    return "a" + CH_KASUT_SET[code - 65]!
  }
  if (code >= 75 && code <= 84) {
    // K-T → 'b' + digit
    return "b" + CH_KASUT_SET[code - 75]!
  }
  if (code >= 85 && code <= 90) {
    // U-Z → 'c' + digit
    return "c" + CH_KASUT_SET[code - 85]!
  }
  throw new InvalidInputError(`Invalid Japan Post character: ${c}`)
}

/**
 * Encode Japan Post 4-State Customer barcode (JP4SCC / Kasutama)
 *
 * @param zipcode - 7-digit Japanese postal code
 * @param address - Optional address characters (digits, dash, A-Z; up to 13 chars)
 */
export function encodeJapanPost(zipcode: string, address?: string): FourState[] {
  const zip = zipcode.replace(/-/g, "")
  if (!/^\d{7}$/.test(zip)) {
    throw new InvalidInputError("Japan Post zipcode must be 7 digits")
  }

  // Build intermediate representation
  let inter = zip // zipcode is always digits
  if (address) {
    const clean = address.toUpperCase().replace(/\s/g, "")
    if (!/^[\dA-Z-]+$/.test(clean)) {
      throw new InvalidInputError("Japan Post address only accepts digits, dash, and A-Z")
    }
    for (const ch of clean) {
      inter += jpExpandChar(ch)
    }
  }

  // Pad to 20 characters with 'd' and truncate
  while (inter.length < 20) inter += "d"
  inter = inter.substring(0, 20)

  // Check digit: sum of CH_KASUT_SET positions, mod 19
  let sum = 0
  for (const ch of inter) {
    const pos = CH_KASUT_SET.indexOf(ch)
    if (pos === -1) throw new InvalidInputError(`Invalid Japan Post character: ${ch}`)
    sum += pos
  }
  let check = 19 - (sum % 19)
  if (check === 19) check = 0
  const checkChar = CH_KASUT_SET[check]!
  inter += checkChar

  const bars: FourState[] = ["F", "D"] // Start

  for (const ch of inter) {
    const pattern = JP_TABLE[ch]
    if (!pattern) throw new InvalidInputError(`Invalid Japan Post character: ${ch}`)
    bars.push(...pattern)
  }

  bars.push("D", "F") // Stop
  return bars
}

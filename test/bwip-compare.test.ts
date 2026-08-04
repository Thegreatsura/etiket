/**
 * bwip-js (BWIPP) cross-verification.
 *
 * Only a handful of etiket's symbologies have a JavaScript decoder, so most of
 * them are asserted structurally and a wrong encoder table looks exactly like a
 * right one. BWIPP is a reference implementation for essentially every format
 * etiket supports, and bwip-js exposes it through `raw()` — the pre-render module
 * data, not a picture. That makes it usable as an oracle:
 *
 * - 1D          -> bar/space width sequence
 * - 2D/stacked  -> module grid
 * - postal      -> per-bar height (2-state) or 4-state bar alphabet
 *
 * Formats that already agree with BWIPP are asserted equal, permanently. Formats
 * that do not are listed in `DIVERGENT` with the issue that tracks them and a
 * description of *how* they differ, and run under `it.fails` — the suite stays
 * green while they are broken, and goes red the moment an encoder is fixed
 * without moving it out of the list.
 *
 * See test/_bwip.ts for the bwip-js plumbing.
 */

import { describe, expect, it } from "vitest"
import {
  bwipBars,
  bwipMatrix,
  bwipStates,
  bwipTallBars,
  bwipText,
  describeDiff,
  trimTrailingSpace,
  widthRanks,
} from "./_bwip"
import type { BwipState } from "./_bwip"
import {
  encodeAustraliaPost,
  encodeCodabar,
  encodeCodablockF,
  encodeCode11,
  encodeCode128,
  encodeCode16K,
  encodeCode39,
  encodeCode93,
  encodeDotCode,
  encodeEAN13,
  encodeGS1Composite,
  encodeHanXin,
  encodeHIBCPrimary,
  encodeIdentcode,
  encodeIMb,
  encodeITF14,
  encodeJapanPost,
  encodeKIX,
  encodeLeitcode,
  encodeMicroPDF417,
  encodeMSI,
  encodePharmacode,
  encodePlessey,
  encodePLANET,
  encodePOSTNET,
  encodeRM4SCC,
} from "../src/index"

// ---------------------------------------------------------------------------
// Known divergences
// ---------------------------------------------------------------------------

/**
 * Formats whose output does not agree with BWIPP yet.
 *
 * Key = the `format` field of the case below. Value = the tracking issue plus a
 * description of the divergence, both of which end up in the test title.
 */
const DIVERGENT: Record<string, string> = {
  plessey:
    "#134 — etiket uses a 2-module bit pitch (bar and space of equal width) " +
    "where BWIPP uses a constant 5-module pitch (wide bar 3 + gap 2, narrow bar 1 + gap 4), " +
    "plus a different start/stop; the symbol is 12 modules short and every element differs",

  "code128 (Code C switching)":
    "#135 — etiket latches to Code C for 2-3 digit runs embedded in " +
    "alphanumeric data, which BWIPP (and ISO/IEC 15417 Annex B) keeps in Code B; etiket " +
    'emits one extra codeword for payloads such as "Test123" and "Hello World 123"',

  "australia-post":
    "#133 — etiket always emits 28 bars regardless of the Format Control " +
    "Code; BWIPP emits the specified 37 bars for FCC 11, 52 for FCC 59 and 67 for FCC 62",

  micropdf417:
    "#136 — symbol variant selection " +
    "differs: etiket picks 1x11 where BWIPP picks 1x14 for the same data; where both pick " +
    "the same variant the module pattern is identical",

  "codablock-f":
    "#100 — etiket emits 3 rows of 101 modules with no row separators; BWIPP emits 5 rows " +
    "of 145 modules (solid separator rows plus row start/stop and K1/K2 check characters)",

  code16k:
    "#99 — etiket emits bare Code 128 rows (2 x 112 modules); BWIPP emits 5 x 81 with the " +
    "Code 16K start/stop pairs, mode character and separator rows",

  dotcode:
    "#101 — no dot-placement or masking algorithm: symbol sizes disagree and, where they " +
    "agree, every row differs (etiket also leaves the last rows completely blank)",

  hanxin:
    "#102 — the symbol size agrees (23x23) but only the fixed finder patterns match; every " +
    "data row differs (no masking, no function information, invented capacity)",

  "gs1-composite":
    "#104 — etiket stuffs the literal AI text into a MicroPDF417 (11 x 54 modules); BWIPP " +
    "emits the real CC-A composite component (3 x 99 modules)",
}

// ---------------------------------------------------------------------------
// Comparison harness
// ---------------------------------------------------------------------------

/** Declare a comparison, routing known-divergent formats through `it.fails`. */
function verify(format: string, run: () => void): void {
  const divergence = DIVERGENT[format]
  if (divergence) {
    it.fails(`${format} — KNOWN DIVERGENCE (${divergence})`, run)
  } else {
    it(`${format} matches bwip-js`, run)
  }
}

/** Assert two module sequences are identical, reporting *how* they differ. */
function expectSame(label: string, actual: readonly unknown[], expected: readonly unknown[]): void {
  expect(actual, `${label}: ${describeDiff(actual, expected)}`).toEqual(expected)
}

interface LinearCase {
  /** Divergence key and test title. */
  format: string
  payloads: readonly string[]
  etiket: (payload: string) => number[]
  bwip: (payload: string) => number[]
  /**
   * Compare the narrow/wide pattern instead of absolute widths. Two-width
   * symbologies allow a range of wide:narrow ratios and etiket and BWIPP
   * legitimately pick different ones.
   */
  ratioAgnostic?: boolean
}

function runLinear(spec: LinearCase): void {
  verify(spec.format, () => {
    for (const payload of spec.payloads) {
      const etiket = trimTrailingSpace(spec.etiket(payload))
      const bwip = spec.bwip(payload)
      if (spec.ratioAgnostic) {
        expectSame(
          `${spec.format} ${payload} (narrow/wide pattern)`,
          widthRanks(etiket),
          widthRanks(bwip),
        )
      } else {
        expectSame(`${spec.format} ${payload}`, etiket, bwip)
      }
    }
  })
}

interface MatrixCase {
  format: string
  payloads: readonly string[]
  etiket: (payload: string) => boolean[][]
  bwip: (payload: string) => boolean[][]
}

/** Render a module grid as strings so failures are readable. */
function rows(matrix: boolean[][]): string[] {
  return matrix.map((row) => row.map((on) => (on ? "#" : ".")).join(""))
}

function runMatrix(spec: MatrixCase): void {
  verify(spec.format, () => {
    for (const payload of spec.payloads) {
      expectSame(`${spec.format} ${payload}`, rows(spec.etiket(payload)), rows(spec.bwip(payload)))
    }
  })
}

interface PostalCase<T> {
  format: string
  payloads: readonly string[]
  etiket: (payload: string) => T[]
  bwip: (payload: string) => T[]
}

function runPostal<T>(spec: PostalCase<T>): void {
  verify(spec.format, () => {
    for (const payload of spec.payloads) {
      expectSame(`${spec.format} ${payload}`, spec.etiket(payload), spec.bwip(payload))
    }
  })
}

// ---------------------------------------------------------------------------
// 1D symbologies
// ---------------------------------------------------------------------------

describe("bwip-js cross-verification: 1D", () => {
  runLinear({
    format: "msi (mod10)",
    payloads: ["1234567", "80523", "9876543210"],
    etiket: (p) => encodeMSI(p),
    bwip: (p) => bwipBars("msi", p, { includecheck: true }),
  })

  runLinear({
    format: "msi (mod11)",
    payloads: ["1234567", "80523", "9876543210"],
    etiket: (p) => encodeMSI(p, { checkDigit: "mod11" }),
    bwip: (p) => bwipBars("msi", p, { includecheck: true, checktype: "mod11" }),
  })

  runLinear({
    format: "msi (no check digit)",
    payloads: ["1234567", "80523", "9876543210"],
    etiket: (p) => encodeMSI(p, { checkDigit: "none" }),
    bwip: (p) => bwipBars("msi", p),
  })

  runLinear({
    format: "plessey",
    payloads: ["1234", "ABCD", "0123456789"],
    etiket: (p) => encodePlessey(p),
    bwip: (p) => bwipBars("plessey", p),
  })

  runLinear({
    format: "code11",
    payloads: ["12345", "123-45", "0123456789012"],
    ratioAgnostic: true,
    etiket: (p) => encodeCode11(p),
    bwip: (p) => bwipBars("code11", p, { includecheck: true }),
  })

  runLinear({
    format: "pharmacode",
    payloads: ["3", "1234", "131070"],
    ratioAgnostic: true,
    etiket: (p) => encodePharmacode(Number(p)),
    bwip: (p) => bwipBars("pharmacode", p),
  })

  runLinear({
    format: "identcode",
    payloads: ["56316778248", "12345678901", "00000000000"],
    ratioAgnostic: true,
    etiket: (p) => encodeIdentcode(p),
    bwip: (p) => bwipBars("identcode", p),
  })

  runLinear({
    format: "leitcode",
    payloads: ["2131234567891", "1234567890123", "0000000000000"],
    ratioAgnostic: true,
    etiket: (p) => encodeLeitcode(p),
    bwip: (p) => bwipBars("leitcode", p),
  })

  runLinear({
    format: "code128",
    // Pure-alphabetic, pure-numeric and long-digit-run payloads, where etiket and
    // BWIPP pick the same charsets. See the "Code C switching" case below.
    payloads: ["Test", "HELLO WORLD", "1234567890", "Test1234", "Test123456", "A12345678"],
    etiket: (p) => encodeCode128(p),
    bwip: (p) => bwipBars("code128", p),
  })

  runLinear({
    format: "code128 (Code C switching)",
    payloads: ["Test123", "Test12345", "Hello World 123"],
    etiket: (p) => encodeCode128(p),
    bwip: (p) => bwipBars("code128", p),
  })

  runLinear({
    format: "ean13",
    payloads: ["5901234123457", "4006381333931", "9780306406157"],
    etiket: (p) => encodeEAN13(p).bars,
    bwip: (p) => bwipBars("ean13", p.slice(0, 12)),
  })

  runLinear({
    format: "itf14",
    payloads: ["15400141288763", "00012345678905", "10012345678902"],
    ratioAgnostic: true,
    etiket: (p) => encodeITF14(p),
    bwip: (p) => bwipBars("itf14", p.slice(0, 13)),
  })

  runLinear({
    format: "code39",
    payloads: ["ABC123", "HELLO", "12345"],
    etiket: (p) => encodeCode39(p),
    bwip: (p) => bwipBars("code39", p),
  })

  runLinear({
    format: "code39 (with check digit)",
    payloads: ["ABC123", "HELLO", "12345"],
    etiket: (p) => encodeCode39(p, { checkDigit: true }),
    bwip: (p) => bwipBars("code39", p, { includecheck: true }),
  })

  runLinear({
    format: "code93",
    // etiket always appends the C and K check characters; BWIPP needs to be asked.
    payloads: ["ABC123", "HELLO", "12345"],
    etiket: (p) => encodeCode93(p),
    bwip: (p) => bwipBars("code93", p, { includecheck: true }),
  })

  runLinear({
    format: "codabar",
    payloads: ["A1234A", "A123456789A", "A-$:/.+A"],
    etiket: (p) => encodeCodabar(p),
    bwip: (p) => bwipBars("rationalizedCodabar", p),
  })
})

// ---------------------------------------------------------------------------
// HIBC
// ---------------------------------------------------------------------------

/** HIBC payloads as `[LIC, product code, unit of measure]`. */
const HIBC_PAYLOADS = [
  ["A999", "1234567890", 0],
  ["ABCD", "XYZ99", 0],
  ["Z234", "ABC", 2],
  ["A123", "12345", 0],
] as const

/** The argument BWIPP's `hibc*` symbologies take: LIC + product code + UoM. */
function hibcInput([lic, product, uom]: readonly [string, string, number]): string {
  return `${lic}${product}${uom}`
}

describe("bwip-js cross-verification: HIBC", () => {
  it("hibc primary data strings match bwip-js", () => {
    for (const payload of HIBC_PAYLOADS) {
      const input = hibcInput(payload)
      // BWIPP reports the human readable text with Code 39 start/stop asterisks.
      const expected = bwipText("hibccode39", input).replaceAll("*", "")
      expect(encodeHIBCPrimary(payload[0], payload[1], payload[2]), `hibc ${input}`).toBe(expected)
    }
  })

  runLinear({
    format: "hibc code 39",
    payloads: HIBC_PAYLOADS.map(hibcInput),
    etiket: (p) => encodeCode39(bwipText("hibccode39", p).replaceAll("*", "")),
    bwip: (p) => bwipBars("hibccode39", p),
  })

  runLinear({
    format: "hibc code 128",
    // "A123" + "12345" is excluded: its HIBC string embeds a 9-digit run that
    // trips the Code C switching divergence noted above, not an HIBC problem.
    payloads: HIBC_PAYLOADS.slice(0, 3).map(hibcInput),
    etiket: (p) => encodeCode128(bwipText("hibccode128", p).replaceAll("*", "")),
    bwip: (p) => bwipBars("hibccode128", p),
  })
})

// ---------------------------------------------------------------------------
// Postal / height-modulated
// ---------------------------------------------------------------------------

describe("bwip-js cross-verification: postal", () => {
  runPostal<number>({
    format: "postnet",
    payloads: ["12345", "123456789", "12345678901"],
    etiket: (p) => encodePOSTNET(p),
    bwip: (p) => bwipTallBars("postnet", p),
  })

  runPostal<number>({
    format: "planet",
    payloads: ["12345678901", "1234567890123", "98765432109"],
    etiket: (p) => encodePLANET(p),
    bwip: (p) => bwipTallBars("planet", p),
  })

  runPostal<BwipState>({
    format: "rm4scc",
    payloads: ["LE28HS", "SN34RD1A", "BX119NH"],
    etiket: (p) => encodeRM4SCC(p),
    bwip: (p) => bwipStates("royalmail", p),
  })

  runPostal<BwipState>({
    format: "kix",
    payloads: ["2500GG11XD", "1231FZ13XHS", "ABC1234"],
    etiket: (p) => encodeKIX(p),
    bwip: (p) => bwipStates("kix", p),
  })

  runPostal<BwipState>({
    format: "australia-post",
    // FCC + sorting code: 37-bar, 52-bar and 67-bar customer barcodes.
    payloads: ["1112345678", "5912345678", "6287654321"],
    etiket: (p) => encodeAustraliaPost(p.slice(0, 2), p.slice(2)),
    bwip: (p) => bwipStates("auspost", p),
  })

  runPostal<BwipState>({
    format: "japan-post",
    payloads: ["1231216", "1060032", "9998877"],
    etiket: (p) => encodeJapanPost(p),
    bwip: (p) => bwipStates("japanpost", p),
  })

  runPostal<BwipState>({
    format: "imb",
    payloads: ["00300999999999999999", "01234567094987654321", "53379777234994544628"],
    etiket: (p) => encodeIMb(p),
    bwip: (p) => bwipStates("onecode", p),
  })
})

// ---------------------------------------------------------------------------
// Stacked / 2D
// ---------------------------------------------------------------------------

describe("bwip-js cross-verification: stacked and 2D", () => {
  runMatrix({
    format: "codablock-f",
    payloads: ["ABCDEF123456", "Hello World", "0123456789"],
    etiket: (p) => encodeCodablockF(p).matrix,
    bwip: (p) => bwipMatrix("codablockf", p),
  })

  runMatrix({
    format: "code16k",
    payloads: ["ABC123", "Hello", "123456789012"],
    etiket: (p) => encodeCode16K(p).matrix,
    bwip: (p) => bwipMatrix("code16k", p),
  })

  runMatrix({
    format: "dotcode",
    payloads: ["ABC123", "Hello", "123456"],
    etiket: (p) => encodeDotCode(p),
    bwip: (p) => bwipMatrix("dotcode", p),
  })

  runMatrix({
    format: "hanxin",
    payloads: ["ABC123", "Hello", "123456"],
    etiket: (p) => encodeHanXin(p),
    bwip: (p) => bwipMatrix("hanxin", p),
  })

  runMatrix({
    format: "micropdf417",
    payloads: ["ABC123", "123456", "Hello"],
    etiket: (p) => encodeMicroPDF417(p).matrix,
    bwip: (p) => bwipMatrix("micropdf417", p),
  })

  runMatrix({
    format: "gs1-composite",
    payloads: ["(17)260101(10)AB", "(10)LOT1", "(21)SERIAL01"],
    etiket: (p) => encodeGS1Composite(p, "CC-A").composite,
    bwip: (p) => bwipMatrix("gs1-cc", p, { ccversion: "a" }),
  })
})

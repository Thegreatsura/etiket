/**
 * Han Xin Code modules verified against bwip-js (BWIPP).
 *
 * There is no JavaScript Han Xin decoder, so the reference implementation's
 * module data is the oracle. BWIPP emits the bare symbol with no quiet zone, so
 * the grids are compared as-is.
 *
 * One caveat: bwip-js 4.11.2's transpiled Han Xin encoder mis-orders two
 * assignments in the numeric-run branch of its segmenter, so it reads the digits
 * from past the end of the run and encodes zeros instead (`raw()` returns an
 * identical symbol for "123456" and "987654"). The PostScript in
 * `node_modules/bwip-js/barcode.ps` is correct and is what etiket implements, so
 * the payloads below stay in byte mode — no run of 8 digits, and no run of 5 at
 * the end of the data. The exception is the all-zero digit strings, which encode
 * to the same bits either way and therefore do exercise numeric mode's structure.
 */

import { describe, expect, it } from "vitest"
import { bwipMatrix } from "./_bwip"
import { encodeHanXin } from "../src/encoders/hanxin"
import { HANXIN_METRICS } from "../src/encoders/hanxin/tables"
import { hanxinTemplate, UNSET } from "../src/encoders/hanxin/placement"

type Options = { ecLevel?: 1 | 2 | 3 | 4; version?: number; mask?: 1 | 2 | 3 | 4 }

function render(matrix: boolean[][]): string[] {
  return matrix.map((row) => row.map((on) => (on ? "#" : ".")).join(""))
}

function bwipOptions(options: Options): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (options.ecLevel !== undefined) out.eclevel = `L${String(options.ecLevel)}`
  if (options.version !== undefined) out.version = String(options.version)
  if (options.mask !== undefined) out.mask = options.mask
  return out
}

function expectSame(text: string, options: Options = {}): void {
  const actual = render(encodeHanXin(text, options))
  const expected = render(bwipMatrix("hanxin", text, bwipOptions(options)))
  expect(actual).toEqual(expected)
}

/** Filler that never produces a digit run long enough to enter numeric mode. */
const FILLER = "The quick brown fox jumps over the lazy dog; 1234 "

function payload(length: number): string {
  let text = ""
  while (text.length < length) text += FILLER
  return text.slice(0, length)
}

describe("Han Xin Code modules match bwip-js", () => {
  it.each([
    ["short text", "Hello"],
    ["single character", "A"],
    ["mixed case with short digit runs", "ABC123"],
    ["punctuation and spaces", "Han Xin Code — ISO/IEC 20830 symbology"],
    ["a sentence", "The quick brown fox jumps over the lazy dog"],
    ["high bytes as UTF-8", "café naïve"],
    ["control characters", "ABC"],
  ])("encodes %s identically", (_name, text) => {
    expectSame(text)
  })

  it.each([1, 2, 3, 4] as const)("agrees at EC level L%i across symbol sizes", (ecLevel) => {
    for (const length of [1, 2, 5, 20, 50, 120, 300, 700, 1500]) {
      expectSame(payload(length), { ecLevel })
    }
  })

  it.each([1, 3, 4, 5, 6, 10, 20, 30, 40, 50, 60, 70, 80, 84])(
    "agrees at an explicit version %i",
    (version) => {
      expectSame(payload(Math.min(20, version * 3)), { version })
    },
  )

  it.each([1, 2, 3, 4] as const)("agrees with mask %i forced", (mask) => {
    for (const text of ["Hello", "The quick brown fox", "x".repeat(200)]) {
      expectSame(text, { mask })
    }
  })

  it("agrees on numeric mode where bwip-js's digit bug is not observable", () => {
    for (const length of [5, 8, 12, 40, 101]) expectSame("0".repeat(length))
  })
})

describe("Han Xin Code symbol geometry", () => {
  it("leaves exactly the standard's module count free in every version", () => {
    for (const metric of HANXIN_METRICS) {
      const template = hanxinTemplate(metric)
      let free = 0
      for (const module of template) if (module === UNSET) free++
      expect({ version: metric.version, free }).toEqual({
        version: metric.version,
        free: metric.modules,
      })
    }
  })

  it("sizes every version as 21 + 2v modules", () => {
    for (const metric of HANXIN_METRICS) {
      expect(metric.size).toBe(21 + 2 * metric.version)
    }
  })
})

/**
 * Code 16K modules verified against bwip-js (BWIPP).
 *
 * There is no JavaScript decoder for Code 16K, so the reference implementation's
 * module data is the oracle. BWIPP renders the full symbol — a 10 module quiet
 * zone, a solid separator above and below every data row, and a trailing white
 * column — so only the quiet zone and the trailing column are trimmed; the
 * separator rows are compared too, since etiket now emits them.
 */

import { describe, expect, it } from "vitest"
import { bwipMatrix } from "./_bwip"
import { encodeCode16K } from "../src/encoders/code16k"

const QUIET_ZONE = 10
const ROW_MODULES = 70

/** Every row of a BWIPP Code 16K symbol, without the quiet zone */
function bwipRows(text: string): string[] {
  return bwipMatrix("code16k", text).map((row) =>
    row
      .slice(QUIET_ZONE, QUIET_ZONE + ROW_MODULES)
      .map((m) => (m ? "1" : "0"))
      .join(""),
  )
}

/** The data rows only, for the assertions that are about the data */
function bwipDataRows(text: string): string[] {
  return bwipRows(text).filter((_, y) => y % 2 === 1)
}

function etiketRows(text: string): string[] {
  return encodeCode16K(text).matrix.map((row) => row.map((m) => (m ? "1" : "0")).join(""))
}

const SAMPLES: [name: string, text: string][] = [
  ["mixed case with a digit run", "Abcd-1234567890-wxyZ"],
  ["uppercase only", "CODE16K"],
  ["multiple rows", "The quick brown fox jumps over the lazy dog 0123456789"],
  ["long digit run", "9876543210987654321098765432109876543210"],
  ["odd digit run", "12345"],
  ["single character", "1"],
  ["digits around a letter", "12X34"],
  ["control characters (set A)", "ABC\x01\x02\x03abc"],
  ["set B only", "abcdefghijklmnopqrstuvwxyz012345"],
  ["maximum numeric capacity", "9".repeat(154)],
]

describe("Code 16K modules match bwip-js", () => {
  it.each(SAMPLES)("encodes %s identically", (_name, text) => {
    expect(etiketRows(text)).toEqual(bwipRows(text))
  })

  it("uses the same symbol size as bwip-js", () => {
    for (const [, text] of SAMPLES) {
      expect(encodeCode16K(text).rows).toBe(bwipDataRows(text).length)
    }
  })

  it("reports which rows are separators", () => {
    for (const [, text] of SAMPLES) {
      const { matrix, rows, separatorRows } = encodeCode16K(text)
      expect(matrix).toHaveLength(2 * rows + 1)
      expect(separatorRows).toEqual(Array.from({ length: rows + 1 }, (_, i) => i * 2))
      // every separator is a solid dark row
      for (const index of separatorRows) {
        expect(matrix[index]!.every(Boolean), `row ${index}`).toBe(true)
      }
    }
  })
})

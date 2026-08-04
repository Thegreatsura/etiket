/**
 * Code 16K modules verified against bwip-js (BWIPP).
 *
 * There is no JavaScript decoder for Code 16K, so the reference implementation's
 * module data is the oracle. BWIPP renders the full symbol — a 10 module quiet
 * zone, a solid separator above and below every data row, and a trailing white
 * column — while etiket returns only the 70 module data rows, so the BWIPP grid
 * is trimmed down to the same view before comparing.
 */

import { describe, expect, it } from "vitest"
import { bwipMatrix } from "./_bwip"
import { encodeCode16K } from "../src/encoders/code16k"

const QUIET_ZONE = 10
const ROW_MODULES = 70

/** Data rows of a BWIPP Code 16K symbol, without quiet zone or separators */
function bwipRows(text: string): string[] {
  const grid = bwipMatrix("code16k", text)
  const rows: string[] = []
  // rows 0, 2, 4, ... are separators; data rows sit at the odd indices
  for (let y = 1; y < grid.length; y += 2) {
    rows.push(
      grid[y]!.slice(QUIET_ZONE, QUIET_ZONE + ROW_MODULES)
        .map((m) => (m ? "1" : "0"))
        .join(""),
    )
  }
  return rows
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
      expect(encodeCode16K(text).rows).toBe(bwipRows(text).length)
    }
  })
})

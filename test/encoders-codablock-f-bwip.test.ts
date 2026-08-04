/**
 * Codablock F modules verified against bwip-js (BWIPP).
 *
 * There is no JavaScript decoder for Codablock F, so the reference
 * implementation's module data is the oracle. BWIPP renders the full symbol,
 * separator rows included, and etiket now emits the same, so the whole grid is
 * compared. There is no quiet zone in BWIPP's raw output for this symbology,
 * and the row width (11 * columns + 57) already matches.
 */

import { describe, expect, it } from "vitest"
import { bwipMatrix } from "./_bwip"
import { encodeCodablockF } from "../src/encoders/codablock-f"

/** Every row of a BWIPP Codablock F symbol, separators included. */
function bwipRows(text: string, columns: number): string[] {
  return bwipMatrix("codablockf", text, { columns }).map((row) =>
    row.map((m) => (m ? "1" : "0")).join(""),
  )
}

/** The data rows only, for the assertions that are about the data. */
function bwipDataRows(text: string, columns: number): string[] {
  return bwipRows(text, columns).filter((_, y) => y % 2 === 1)
}

function etiketRows(text: string, columns: number): string[] {
  return encodeCodablockF(text, { columns }).matrix.map((row) =>
    row.map((m) => (m ? "1" : "0")).join(""),
  )
}

const SAMPLES: [name: string, text: string][] = [
  ["short text", "Hello"],
  ["a single character", "X"],
  ["uppercase with a space", "CODABLOCK F"],
  ["a full numeric payload", "0123456789"],
  ["an odd digit run", "12345"],
  ["digits spanning several rows", "1234567890123456789012345678901234567890"],
  ["mixed letters and digits", "ABCDEF123456"],
  ["digits embedded in text", "CODABLOCK F 34567890123456789010040digit"],
  ["control characters (Code A)", "A\t\nB"],
  ["a lone control character", "abc\x01def"],
  ["Code A and Code B interleaved", "ABC\tdef\tGHI"],
  ["a long numeric run", "9".repeat(101)],
  ["a long mixed payload", "The quick brown fox jumps over the lazy dog 0123456789"],
  ["the Code B upper range", "\x7f{|}~abc"],
  ["digits either side of a letter", "12X34"],
  ["a trailing odd digit", "ABC12345678901234"],
]

const COLUMN_COUNTS = [4, 8, 16, 62]

describe("Codablock F modules match bwip-js", () => {
  for (const columns of COLUMN_COUNTS) {
    it.each(SAMPLES)(`encodes %s identically with ${columns} columns`, (_name, text) => {
      expect(etiketRows(text, columns)).toEqual(bwipRows(text, columns))
    })
  }

  it("reports which rows are separators", () => {
    const { matrix, rows, separatorRows } = encodeCodablockF("ABCDEF123456", { columns: 8 })
    expect(matrix).toHaveLength(2 * rows + 1)
    expect(separatorRows).toEqual(Array.from({ length: rows + 1 }, (_, i) => i * 2))
    // the outermost separators are solid, the inner ones carry the row pattern
    expect(matrix[0]!.every(Boolean)).toBe(true)
    expect(matrix.at(-1)!.every(Boolean)).toBe(true)
    expect(matrix[2]!.every(Boolean)).toBe(false)
  })

  it("uses the same row count as bwip-js", () => {
    for (const columns of COLUMN_COUNTS) {
      for (const [, text] of SAMPLES) {
        expect(encodeCodablockF(text, { columns }).rows).toBe(bwipDataRows(text, columns).length)
      }
    }
  })

  it("defaults to 8 columns like bwip-js", () => {
    expect(etiketRows("CODABLOCK F DEFAULT", 8)).toEqual(
      encodeCodablockF("CODABLOCK F DEFAULT").matrix.map((row) =>
        row.map((m) => (m ? "1" : "0")).join(""),
      ),
    )
  })
})

/**
 * DotCode modules verified against bwip-js (BWIPP).
 *
 * No JavaScript DotCode decoder exists, so the reference implementation's
 * module data is the oracle. BWIPP's raw output is the bare dot grid — no quiet
 * zone — so etiket's matrix is compared to it directly.
 */

import { describe, expect, it } from "vitest"
import { type BwipOptions, bwipMatrix } from "./_bwip"
import { encodeDotCode, type DotCodeOptions } from "../src/encoders/dotcode"

function rows(matrix: boolean[][]): string[] {
  return matrix.map((row) => row.map((m) => (m ? "1" : "0")).join(""))
}

const SAMPLES: [name: string, text: string][] = [
  ["uppercase text", "DOTCODE"],
  ["mixed case", "Hello"],
  ["digits", "123456789012"],
  ["mixed alphanumeric", "Abc-123-XYZ"],
  ["long text needing a larger symbol", "The quick brown fox jumps over the lazy dog 0123456789"],
]

describe("DotCode modules match bwip-js", () => {
  it.each(SAMPLES)("encodes %s identically", (_name, text) => {
    expect(rows(encodeDotCode(text))).toEqual(rows(bwipMatrix("dotcode", text)))
  })
})

const FORCED: [name: string, text: string, options: DotCodeOptions][] = [
  ["forced 5 rows", "DOTCODE", { rows: 5 }],
  ["forced 20 columns", "Hello world", { columns: 20 }],
  ["forced size", "12345678", { rows: 11, columns: 20 }],
  ["forced mask 0", "DotCode Test", { mask: 0 }],
  ["forced mask 1", "DotCode Test", { mask: 1 }],
  ["forced mask 2", "DotCode Test", { mask: 2 }],
  ["forced mask 3", "DotCode Test", { mask: 3 }],
]

describe("DotCode with explicit size or mask matches bwip-js", () => {
  it.each(FORCED)("encodes %s identically", (_name, text, options) => {
    expect(rows(encodeDotCode(text, options))).toEqual(
      rows(bwipMatrix("dotcode", text, options as BwipOptions)),
    )
  })
})

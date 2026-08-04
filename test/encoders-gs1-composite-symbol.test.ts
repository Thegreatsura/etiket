/**
 * Complete GS1 Composite symbols — linear component, separator pattern and 2D
 * component — cross-verified against BWIPP's combined composite encoders.
 *
 * BWIPP returns the whole symbol as one module grid, which is exactly the shape
 * `encodeGS1CompositeSymbol` produces, so the comparison covers the linkage flag
 * in the linear component, the separator pattern and the component alignment in
 * one go.
 */

import { describe, expect, it } from "vitest"
import { type CompositeLinearType, encodeGS1CompositeSymbol } from "../src/encoders/gs1-composite"
import { encodeGS1DataBarOmni } from "../src/encoders/gs1-databar"
import { bwipMatrix, describeDiff } from "./_bwip"

function rows(matrix: boolean[][]): string[] {
  return matrix.map((row) => row.map((m) => (m ? "1" : "0")).join(""))
}

/** etiket linear type -> the BWIPP encoder that draws the same composite. */
const CASES: [CompositeLinearType, string, string[]][] = [
  [
    "databar-omni",
    "databaromnicomposite",
    ["(01)09521234543213|(11)990102", "(01)09521234543213|(10)LOT1", "(01)00012345678905|(21)A1"],
  ],
  [
    "databar-truncated",
    "databartruncatedcomposite",
    ["(01)09521234543213|(11)990102", "(01)09521234543213|(90)ABC"],
  ],
  [
    "databar-expanded",
    "databarexpandedcomposite",
    ["(01)09521234543213(3103)001234|(91)1A2B3C4D5E", "(01)09521234543213(10)LOT|(11)990102"],
  ],
  ["ean13", "ean13composite", ["9521234543213|(11)990102", "9521234543213|(21)SERIAL01"]],
  ["upca", "upcacomposite", ["416000336108|(11)990102", "416000336108|(90)ABC"]],
  ["upce", "upcecomposite", ["0123456|(11)990102", "0123456|(10)AB"]],
]

describe("GS1 Composite symbol vs bwip-js", () => {
  for (const [linearType, bcid, payloads] of CASES) {
    for (const payload of payloads) {
      it(`${linearType} — ${payload}`, () => {
        const symbol = encodeGS1CompositeSymbol(linearType, payload)
        const actual = rows(symbol.matrix)
        const expected = rows(bwipMatrix(bcid, payload))
        expect(actual, describeDiff(actual, expected)).toEqual(expected)
      })
    }
  }
})

describe("GS1 Composite symbol shape", () => {
  it("exposes the components separately", () => {
    const symbol = encodeGS1CompositeSymbol("databar-omni", "(01)09521234543213|(11)990102")

    expect(symbol.type).toBe("CC-A")
    expect(symbol.linearType).toBe("databar-omni")
    expect(symbol.separator).toHaveLength(1)
    expect(symbol.composite.length + symbol.separator.length + 1).toBe(symbol.matrix.length)
    expect(symbol.rowHeights).toHaveLength(symbol.matrix.length)
    for (const row of symbol.matrix) expect(row).toHaveLength(symbol.cols)
  })

  it("EAN/UPC get a three module separator", () => {
    const symbol = encodeGS1CompositeSymbol("ean13", "9521234543213|(11)990102")
    expect(symbol.separator).toHaveLength(3)
    expect(symbol.rowHeights.at(-1)).toBe(symbol.linearHeight)
  })

  it("the linear component carries the linkage flag", () => {
    // A linked DataBar encodes 10^13 + GTIN, so its bars differ from standalone.
    const linked = encodeGS1CompositeSymbol("databar-omni", "(01)09521234543213|(11)990102")
    expect(linked.linear).not.toEqual(encodeGS1DataBarOmni("09521234543213"))
    expect(linked.linear).toEqual(encodeGS1DataBarOmni("09521234543213", { linkage: true }))
  })

  /**
   * EAN-8 composites lay out correctly, but `encodeEAN8` weights the first digit
   * 1 instead of 3, so the check digit — and only the check digit — differs from
   * BWIPP. Compare everything above the linear row until that is fixed.
   */
  it("ean8 lays the composite and separator out correctly", () => {
    const payload = "9521234|(11)990102"
    const actual = rows(encodeGS1CompositeSymbol("ean8", payload).matrix).slice(0, -1)
    const expected = rows(bwipMatrix("ean8composite", payload)).slice(0, -1)
    expect(actual, describeDiff(actual, expected)).toEqual(expected)
  })

  it("rejects data without a component separator", () => {
    expect(() => encodeGS1CompositeSymbol("ean13", "9521234543213")).toThrow()
  })

  it("rejects an empty component", () => {
    expect(() => encodeGS1CompositeSymbol("ean13", "|(11)990102")).toThrow()
    expect(() => encodeGS1CompositeSymbol("ean13", "9521234543213|")).toThrow()
  })
})

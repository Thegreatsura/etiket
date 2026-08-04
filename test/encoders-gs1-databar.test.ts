import { describe, expect, it } from "vitest"
import {
  encodeGS1DataBarOmni,
  encodeGS1DataBarTruncated,
  encodeGS1DataBarLimited,
  encodeGS1DataBarExpanded,
  encodeGS1DataBarStacked,
  encodeGS1DataBarStackedOmni,
  encodeGS1DataBarExpandedStacked,
} from "../src/encoders/gs1-databar"
import { barcode } from "../src/index"

describe("GS1 DataBar Omnidirectional", () => {
  it("encodes 14-digit GTIN", () => {
    const bars = encodeGS1DataBarOmni("01234567890128")
    expect(bars.length).toBeGreaterThan(0)
    for (const b of bars) expect(b).toBeGreaterThanOrEqual(1)
  })

  it("encodes 13-digit GTIN (auto check digit)", () => {
    const bars = encodeGS1DataBarOmni("0123456789012")
    expect(bars.length).toBeGreaterThan(0)
  })

  /**
   * ISO/IEC 24724 counts 46 elements and 96 modules, the first of which is the
   * one-module guard SPACE. etiket returns bar-first arrays like every other 1D
   * encoder, so that leading white module is left to the quiet zone (#138).
   */
  it("produces exactly 45 bar-first elements totaling 95 modules", () => {
    const bars = encodeGS1DataBarOmni("01234567890128")
    expect(bars).toHaveLength(45)
    expect(bars.reduce((a, b) => a + b, 0)).toBe(95)
  })

  it("has correct guard patterns", () => {
    const bars = encodeGS1DataBarOmni("01234567890128")
    expect(bars[0]).toBe(1) // left guard bar
    expect(bars[43]).toBe(1) // right guard space
    expect(bars[44]).toBe(1) // right guard bar
  })

  it("all elements are between 1 and 9", () => {
    const bars = encodeGS1DataBarOmni("5901234123457")
    for (const b of bars) {
      expect(b).toBeGreaterThanOrEqual(1)
      expect(b).toBeLessThanOrEqual(9)
    }
  })

  it("same input produces same output (deterministic)", () => {
    const a = encodeGS1DataBarOmni("01234567890128")
    const b = encodeGS1DataBarOmni("01234567890128")
    expect(a).toEqual(b)
  })

  it("different GTINs produce different output", () => {
    const a = encodeGS1DataBarOmni("01234567890128")
    const b = encodeGS1DataBarOmni("5901234123457")
    expect(a).not.toEqual(b)
  })

  it("13-digit and 14-digit (with check) produce same output", () => {
    const a = encodeGS1DataBarOmni("0123456789012")
    const b = encodeGS1DataBarOmni("01234567890128")
    expect(a).toEqual(b)
  })

  it("throws on non-numeric", () => {
    expect(() => encodeGS1DataBarOmni("ABC")).toThrow()
  })

  it("throws on wrong length", () => {
    expect(() => encodeGS1DataBarOmni("12345")).toThrow()
  })

  it("throws on invalid check digit", () => {
    expect(() => encodeGS1DataBarOmni("01234567890129")).toThrow(/check digit/i)
  })

  it("works via barcode()", () => {
    const svg = barcode("01234567890128", { type: "gs1-databar" })
    expect(svg).toContain("<svg")
  })
})

describe("GS1 DataBar Limited", () => {
  it("encodes GTIN starting with 0", () => {
    const bars = encodeGS1DataBarLimited("01234567890128")
    expect(bars.length).toBeGreaterThan(0)
  })

  it("encodes GTIN starting with 1", () => {
    const bars = encodeGS1DataBarLimited("11234567890125")
    expect(bars.length).toBeGreaterThan(0)
  })

  // 47 ISO elements less the leading guard space (#138)
  it("produces exactly 46 bar-first elements", () => {
    const bars = encodeGS1DataBarLimited("01234567890128")
    expect(bars).toHaveLength(46)
  })

  it("has correct guard patterns and terminator", () => {
    const bars = encodeGS1DataBarLimited("01234567890128")
    expect(bars[0]).toBe(1) // left guard bar
    expect(bars[43]).toBe(1) // right guard space
    expect(bars[44]).toBe(1) // right guard bar
    expect(bars[45]).toBe(5) // 5-module termination space
  })

  it("data pairs each sum to 26 modules", () => {
    const bars = encodeGS1DataBarLimited("01234567890128")
    // Left pair: elements 1-14 (14 elements)
    const leftPairSum = bars.slice(1, 15).reduce((a, b) => a + b, 0)
    expect(leftPairSum).toBe(26)
    // Right pair: elements 29-42 (14 elements)
    const rightPairSum = bars.slice(29, 43).reduce((a, b) => a + b, 0)
    expect(rightPairSum).toBe(26)
  })

  it("all elements are between 1 and 9", () => {
    const bars = encodeGS1DataBarLimited("01234567890128")
    // Skip the 5-module terminator (last element)
    for (let i = 0; i < 45; i++) {
      expect(bars[i]).toBeGreaterThanOrEqual(1)
      expect(bars[i]).toBeLessThanOrEqual(9)
    }
  })

  it("throws on GTIN starting with 2+", () => {
    expect(() => encodeGS1DataBarLimited("21234567890122")).toThrow()
  })

  it("throws on invalid check digit", () => {
    expect(() => encodeGS1DataBarLimited("01234567890121")).toThrow(/check digit/i)
  })

  it("works via barcode()", () => {
    const svg = barcode("01234567890128", { type: "gs1-databar-limited" })
    expect(svg).toContain("<svg")
  })
})

describe("GS1 DataBar Expanded", () => {
  it("encodes AI data", () => {
    const bars = encodeGS1DataBarExpanded("(01)12345678901234")
    expect(bars.length).toBeGreaterThan(0)
  })

  it("encodes plain text", () => {
    const bars = encodeGS1DataBarExpanded("HELLO123")
    expect(bars.length).toBeGreaterThan(0)
  })

  it("has correct guard patterns", () => {
    const bars = encodeGS1DataBarExpanded("(01)12345678901234")
    expect(bars[0]).toBe(1) // left guard bar
    expect(bars[bars.length - 2]).toBe(1) // right guard space
    expect(bars[bars.length - 1]).toBe(1) // right guard bar
  })

  it("all elements are >= 1", () => {
    const bars = encodeGS1DataBarExpanded("(01)12345678901234")
    for (const b of bars) {
      expect(b).toBeGreaterThanOrEqual(1)
    }
  })

  it("longer data produces more elements", () => {
    const short = encodeGS1DataBarExpanded("(01)12345678901234")
    const long = encodeGS1DataBarExpanded("(01)12345678901234(10)ABC123")
    expect(long.length).toBeGreaterThan(short.length)
  })

  it("throws on empty", () => {
    expect(() => encodeGS1DataBarExpanded("")).toThrow()
  })

  it("works via barcode()", () => {
    const svg = barcode("(01)12345678901234", { type: "gs1-databar-expanded" })
    expect(svg).toContain("<svg")
  })

  it("different data produces different output", () => {
    const a = encodeGS1DataBarExpanded("(01)12345678901234")
    const b = encodeGS1DataBarExpanded("(01)98765432109876")
    expect(a).not.toEqual(b)
  })

  it("deterministic encoding", () => {
    const a = encodeGS1DataBarExpanded("(01)12345678901234")
    const b = encodeGS1DataBarExpanded("(01)12345678901234")
    expect(a).toEqual(b)
  })
})

describe("GS1 DataBar Truncated", () => {
  it("encodes a 14-digit GTIN", () => {
    expect(encodeGS1DataBarTruncated("01234567890128")).toHaveLength(45)
  })

  it("encodes a 13-digit GTIN (auto check digit)", () => {
    expect(encodeGS1DataBarTruncated("0123456789012")).toEqual(
      encodeGS1DataBarTruncated("01234567890128"),
    )
  })

  it("throws on an invalid check digit", () => {
    expect(() => encodeGS1DataBarTruncated("01234567890129")).toThrow(/check digit/i)
  })
})

describe("GS1 DataBar Stacked", () => {
  it("produces a 13 x 50 module matrix", () => {
    const matrix = encodeGS1DataBarStacked("01234567890128")
    expect(matrix).toHaveLength(13)
    for (const row of matrix) expect(row).toHaveLength(50)
  })

  it("13-digit and 14-digit GTINs produce the same symbol", () => {
    expect(encodeGS1DataBarStacked("0123456789012")).toEqual(
      encodeGS1DataBarStacked("01234567890128"),
    )
  })

  it("different GTINs produce different symbols", () => {
    expect(encodeGS1DataBarStacked("01234567890128")).not.toEqual(
      encodeGS1DataBarStacked("5901234123457"),
    )
  })

  it("throws on a non-numeric GTIN", () => {
    expect(() => encodeGS1DataBarStacked("ABC")).toThrow()
  })
})

describe("GS1 DataBar Stacked Omnidirectional", () => {
  it("produces a 69 x 50 module matrix", () => {
    const matrix = encodeGS1DataBarStackedOmni("01234567890128")
    expect(matrix).toHaveLength(69)
    for (const row of matrix) expect(row).toHaveLength(50)
  })

  it("differs from the Stacked variant only in the separators", () => {
    const stacked = encodeGS1DataBarStacked("01234567890128")
    const omni = encodeGS1DataBarStackedOmni("01234567890128")
    expect(omni[0]).toEqual(stacked[0])
    expect(omni[68]).toEqual(stacked[12])
  })

  it("throws on wrong length", () => {
    expect(() => encodeGS1DataBarStackedOmni("12345")).toThrow()
  })
})

describe("GS1 DataBar Expanded Stacked", () => {
  it("stacks four symbol characters per row by default", () => {
    const matrix = encodeGS1DataBarExpandedStacked("(01)90012345678908(3103)001750")
    // 5 symbol characters => 2 rows of 34 modules plus 3 separator rows
    expect(matrix).toHaveLength(71)
  })

  it("honours the segments option", () => {
    const two = encodeGS1DataBarExpandedStacked("(01)90012345678908", { segments: 2 })
    const four = encodeGS1DataBarExpandedStacked("(01)90012345678908", { segments: 4 })
    expect(two[0]!.length).toBeLessThan(four[0]!.length)
    expect(two.length).toBeGreaterThan(four.length)
  })

  it("pads every row to the same width", () => {
    const matrix = encodeGS1DataBarExpandedStacked("(01)90012345678908(10)ABC123")
    const width = matrix[0]!.length
    for (const row of matrix) expect(row).toHaveLength(width)
  })

  it("deterministic encoding", () => {
    expect(encodeGS1DataBarExpandedStacked("(10)ABC123")).toEqual(
      encodeGS1DataBarExpandedStacked("(10)ABC123"),
    )
  })

  it("rejects an odd segment count", () => {
    expect(() => encodeGS1DataBarExpandedStacked("(10)ABC", { segments: 5 })).toThrow(/segments/)
  })
})

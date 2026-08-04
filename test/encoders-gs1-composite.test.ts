import { describe, expect, it } from "vitest"
import { encodeGS1Composite, encodeGS1CompositeSymbol } from "../src/encoders/gs1-composite"

function flatten(matrix: boolean[][]): string {
  return matrix.map((row) => row.map((m) => (m ? "1" : "0")).join("")).join("\n")
}

describe("GS1 Composite", () => {
  it("encodes CC-A", () => {
    const result = encodeGS1Composite("(17)260101(10)BATCH01", "CC-A")
    expect(result.type).toBe("CC-A")
    expect(result.rows).toBeGreaterThan(0)
    expect(result.composite.length).toBe(result.rows)
    expect(result.composite[0]).toHaveLength(result.cols)
  })

  it("encodes CC-B", () => {
    const result = encodeGS1Composite("(17)260101(10)BATCH01", "CC-B")
    expect(result.type).toBe("CC-B")
    expect(result.rows).toBeGreaterThan(0)
  })

  it("encodes CC-C", () => {
    const result = encodeGS1Composite("(17)260101(10)BATCH01(21)SERIAL001", "CC-C")
    expect(result.type).toBe("CC-C")
    expect(result.rows).toBeGreaterThanOrEqual(3)
  })

  it("default type is CC-A", () => {
    expect(encodeGS1Composite("(10)LOT123").type).toBe("CC-A")
  })

  it("defaults to two data columns", () => {
    expect(encodeGS1Composite("(10)LOT123").columns).toBe(2)
  })

  it("takes the column count from the linear symbology", () => {
    expect(encodeGS1Composite("(10)LOT123", { linear: "ean13" }).columns).toBe(4)
    expect(encodeGS1Composite("(10)LOT123", { linear: "upce" }).columns).toBe(2)
  })

  it("upgrades CC-A to CC-B when the data overflows", () => {
    const result = encodeGS1Composite("(91)ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", {
      type: "CC-A",
      columns: 4,
    })
    expect(result.type).toBe("CC-B")
  })

  it("produces a boolean matrix", () => {
    for (const row of encodeGS1Composite("(10)TEST").composite) {
      for (const cell of row) expect(typeof cell).toBe("boolean")
    }
  })

  it("different data produces different output", () => {
    expect(flatten(encodeGS1Composite("(10)AAA").composite)).not.toBe(
      flatten(encodeGS1Composite("(10)BBB").composite),
    )
  })

  it("throws on empty data", () => {
    expect(() => encodeGS1Composite("")).toThrow()
  })

  it("throws on data that is not an AI element string", () => {
    expect(() => encodeGS1Composite("BATCH01")).toThrow()
  })

  it("throws on an invalid AI", () => {
    expect(() => encodeGS1Composite("(1)X")).toThrow()
  })

  it("throws on an invalid type", () => {
    expect(() => encodeGS1Composite("(10)LOT", "CC-D" as never)).toThrow()
  })

  it("throws when CC-A/CC-B are asked for an impossible column count", () => {
    expect(() => encodeGS1Composite("(10)LOT", { columns: 5 })).toThrow()
    expect(() => encodeGS1Composite("(10)LOT", { columns: 1 })).toThrow()
  })

  it("throws when the data exceeds CC-B", () => {
    const long = `(91)${"A".repeat(200)}`
    expect(() => encodeGS1Composite(long, { type: "CC-A", columns: 4 })).toThrow()
  })
})

describe("GS1 Composite — encodation methods", () => {
  // Each method drives a different compressed data field, so the symbols differ.
  const byMethod = [
    encodeGS1Composite("(11)990102"), // (11)/(17) date
    encodeGS1Composite("(10)LOT1"), // (10) lot
    encodeGS1Composite("(90)ABC"), // AI (90)
    encodeGS1Composite("(21)ABC"), // general purpose field only
  ].map((r) => flatten(r.composite))

  it("produces a distinct symbol per encodation method", () => {
    expect(new Set(byMethod).size).toBe(byMethod.length)
  })
})

describe("GS1 Composite symbol", () => {
  it("stacks the 2D component, separator and linear component", () => {
    const symbol = encodeGS1CompositeSymbol("databar-omni", "(01)09521234543213|(11)990102")
    expect(symbol.matrix.length).toBe(symbol.composite.length + symbol.separator.length + 1)
    expect(symbol.linearOffset).toBeGreaterThanOrEqual(0)
    expect(symbol.linear.length).toBeGreaterThan(0)
  })

  it("accepts a GTIN with or without its AI", () => {
    const withAI = encodeGS1CompositeSymbol("databar-omni", "(01)09521234543213|(11)990102")
    const without = encodeGS1CompositeSymbol("databar-omni", "09521234543213|(11)990102")
    expect(flatten(withAI.matrix)).toBe(flatten(without.matrix))
  })

  it("rejects an unsupported linear symbology", () => {
    expect(() => encodeGS1CompositeSymbol("gs1-128" as never, "(01)1|(11)990102")).toThrow()
  })
})

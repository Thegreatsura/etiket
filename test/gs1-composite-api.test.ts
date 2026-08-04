/**
 * The complete GS1 Composite symbol through the public API.
 *
 * `encodeGS1CompositeSymbol` returns a matrix plus per-row heights — the 2D
 * component's rows are two modules tall, the separators one, and the linear
 * component takes the last row at its own height. These tests check the render
 * layer honours that, since a composite drawn at uniform row height is not a
 * composite.
 */

import { describe, expect, it } from "vitest"
import {
  encodeGS1CompositeSymbol,
  gs1composite,
  gs1compositePNG,
  gs1compositePNGDataURI,
} from "../src/index"

const LINEAR = "01234567890128"
const COMPOSITE = "(17)260101(10)LOT42"
const DATA = `${LINEAR}|${COMPOSITE}`

describe("encodeGS1CompositeSymbol", () => {
  it("returns the pieces as well as the whole", () => {
    const result = encodeGS1CompositeSymbol("databar-omni", DATA)
    expect(result.matrix.length).toBe(result.rowHeights.length)
    expect(result.composite.length).toBeGreaterThan(0)
    expect(result.separator.length).toBeGreaterThan(0)
    expect(result.linear.length).toBeGreaterThan(0)
    expect(result.linearHeight).toBeGreaterThan(1)
  })

  it("gives every row a width of cols", () => {
    const result = encodeGS1CompositeSymbol("databar-omni", DATA)
    for (const row of result.matrix) {
      expect(row).toHaveLength(result.cols)
    }
  })

  it("uses different heights for the 2D rows, the separator and the linear row", () => {
    const { rowHeights } = encodeGS1CompositeSymbol("databar-omni", DATA)
    expect(new Set(rowHeights).size).toBeGreaterThan(1)
    // the linear component is the tallest row
    expect(Math.max(...rowHeights)).toBe(rowHeights.at(-1))
  })
})

describe("gs1composite()", () => {
  it("renders a single SVG document", () => {
    const svg = gs1composite("databar-omni", DATA)
    expect(svg.match(/<svg/g)).toHaveLength(1)
    expect(svg).toContain("<path")
  })

  it("draws rows at their own heights, not one uniform height", () => {
    const svg = gs1composite("databar-omni", DATA, { margin: 0 })
    const heights = new Set(
      [...svg.matchAll(/M[\d.-]+,[\d.-]+h[\d.]+v([\d.]+)h/g)].map((m) => m[1]),
    )
    expect(heights.size).toBeGreaterThan(1)
  })

  it("works for the EAN and UPC primaries too", () => {
    for (const [linearType, data] of [
      ["ean13", `4006381333931|${COMPOSITE}`],
      ["upca", `036000291452|${COMPOSITE}`],
    ] as const) {
      expect(gs1composite(linearType, data), linearType).toContain("<svg")
    }
  })
})

describe("gs1compositePNG()", () => {
  it("emits a PNG", () => {
    const png = gs1compositePNG("databar-omni", DATA)
    expect(Array.from(png.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  })

  it("emits a data URI", () => {
    expect(gs1compositePNGDataURI("databar-omni", DATA)).toMatch(/^data:image\/png;base64,/)
  })
})

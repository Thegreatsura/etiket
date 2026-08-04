/**
 * `moduleSize` is the one name for "how big is one module", accepted by every
 * renderer. The older names — `barWidth` on the SVG side, `scale` on the PNG
 * side — keep working, because changing that after 1.0 would need a major.
 */

import { describe, expect, it } from "vitest"
import {
  barcode,
  barcodePNG,
  postal,
  postalPNG,
  datamatrix,
  datamatrixPNG,
  qrcode,
} from "../src/index"

/** Width and height an SVG declares */
function svgSize(svg: string): { width: number; height: number } {
  const m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)!
  return { width: Number(m[1]), height: Number(m[2]) }
}

/** Width and height a PNG declares in its IHDR */
function pngSize(png: Uint8Array): { width: number; height: number } {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

describe("1D barcodes", () => {
  it("treats moduleSize and barWidth the same in SVG", () => {
    expect(barcode("HELLO", { type: "code128", moduleSize: 3 })).toBe(
      barcode("HELLO", { type: "code128", barWidth: 3 }),
    )
  })

  it("scales the symbol with moduleSize", () => {
    const narrow = svgSize(barcode("HELLO", { type: "code128", moduleSize: 1 }))
    const wide = svgSize(barcode("HELLO", { type: "code128", moduleSize: 4 }))
    expect(wide.width).toBeGreaterThan(narrow.width)
  })

  it("treats moduleSize and scale the same in PNG", () => {
    expect(barcodePNG("HELLO", { type: "code128", moduleSize: 3 })).toEqual(
      barcodePNG("HELLO", { type: "code128", scale: 3 }),
    )
  })

  it("lets the older name win when both are given", () => {
    // Deliberate: existing code passing barWidth keeps its exact output
    expect(barcode("HELLO", { type: "code128", moduleSize: 9, barWidth: 2 })).toBe(
      barcode("HELLO", { type: "code128", barWidth: 2 }),
    )
  })
})

describe("postal symbols", () => {
  it("treats moduleSize and barWidth the same in SVG", () => {
    expect(postal("12345", { type: "postnet", moduleSize: 3 })).toBe(
      postal("12345", { type: "postnet", barWidth: 3 }),
    )
  })

  it("treats moduleSize and scale the same in PNG", () => {
    expect(postalPNG("12345", { type: "postnet", moduleSize: 3 })).toEqual(
      postalPNG("12345", { type: "postnet", scale: 3 }),
    )
  })
})

describe("matrix symbols", () => {
  it("already used moduleSize for PNG", () => {
    const small = pngSize(datamatrixPNG("HELLO", { moduleSize: 4 }))
    const large = pngSize(datamatrixPNG("HELLO", { moduleSize: 8 }))
    expect(large.width).toBe(small.width * 2)
  })

  it("keeps the SVG size option meaning total size", () => {
    // `size` on a matrix is the whole symbol, not one module — documented, and
    // unchanged
    expect(svgSize(datamatrix("HELLO", { size: 300 })).width).toBe(300)
    expect(svgSize(qrcode("HELLO", { size: 250 })).width).toBe(250)
  })
})

describe("the width option", () => {
  it("derives the module width from a requested total width", () => {
    const svg = barcode("HELLO", { type: "code128", width: 400, margin: 0 })
    expect(svgSize(svg).width).toBeCloseTo(400, 5)
  })

  it("lets an explicit module width win", () => {
    // Both given: moduleSize is the more specific instruction
    expect(barcode("HELLO", { type: "code128", width: 400, moduleSize: 2 })).toBe(
      barcode("HELLO", { type: "code128", moduleSize: 2 }),
    )
  })
})

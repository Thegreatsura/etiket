/**
 * JAB Code PNG output.
 *
 * JAB Code is polychrome, so it needs the true-colour PNG path. There is no
 * decoder for the symbology anywhere (see the caveat on `encodeJABCode`), so
 * these tests check the pixels themselves: the palette reaches the image, the
 * geometry matches the matrix, and the quiet zone is the background colour.
 */

import { describe, expect, it } from "vitest"
import { encodeJABCode, jabcodePNG, jabcodePNGDataURI, JAB_COLORS_4 } from "../src/index"
import { renderColorMatrixRaster } from "../src/renderers/png/rasterize"

/** Read a pixel out of an RGBA buffer */
function pixel(
  rgba: Uint8Array,
  width: number,
  x: number,
  y: number,
): [number, number, number, number] {
  const i = (y * width + x) * 4
  return [rgba[i]!, rgba[i + 1]!, rgba[i + 2]!, rgba[i + 3]!]
}

describe("colour matrix raster", () => {
  it("sizes the image from the matrix, module size and quiet zone", () => {
    const result = encodeJABCode("HELLO")
    const { width, height } = renderColorMatrixRaster(result.matrix, result.palette, {
      moduleSize: 4,
      margin: 2,
    })
    expect(width).toBe((result.matrix[0]!.length + 4) * 4)
    expect(height).toBe((result.matrix.length + 4) * 4)
  })

  it("paints the quiet zone in the background colour", () => {
    const result = encodeJABCode("HELLO")
    const { width, rgba } = renderColorMatrixRaster(result.matrix, result.palette, {
      moduleSize: 4,
      margin: 2,
      background: "#ffffff",
    })
    expect(pixel(rgba, width, 0, 0)).toEqual([255, 255, 255, 255])
  })

  it("paints each module in its palette colour", () => {
    const matrix = [
      [0, 1],
      [2, 3],
    ]
    const { width, rgba } = renderColorMatrixRaster(matrix, JAB_COLORS_4, {
      moduleSize: 2,
      margin: 0,
    })
    expect(pixel(rgba, width, 0, 0)).toEqual([0, 0, 0, 255]) // #000000
    expect(pixel(rgba, width, 2, 0)).toEqual([255, 0, 0, 255]) // #FF0000
    expect(pixel(rgba, width, 0, 2)).toEqual([0, 255, 0, 255]) // #00FF00
    expect(pixel(rgba, width, 2, 2)).toEqual([0, 0, 255, 255]) // #0000FF
  })

  it("honours a palette override", () => {
    const { width, rgba } = renderColorMatrixRaster([[0]], JAB_COLORS_4, {
      moduleSize: 1,
      margin: 0,
      palette: ["#123456"],
    })
    expect(pixel(rgba, width, 0, 0)).toEqual([0x12, 0x34, 0x56, 255])
  })
})

describe("jabcodePNG", () => {
  it("emits a true-colour PNG", () => {
    const png = jabcodePNG("HELLO")
    // PNG signature
    expect([...png.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    // IHDR colour type 6 (RGBA) sits at byte 25
    expect(png[25]).toBe(6)
  })

  it("differs between the 4-colour and 8-colour palettes", () => {
    expect(jabcodePNG("HELLO", { colors: 4 })).not.toEqual(jabcodePNG("HELLO", { colors: 8 }))
  })

  it("emits a data URI", () => {
    expect(jabcodePNGDataURI("HELLO")).toMatch(/^data:image\/png;base64,/)
  })
})

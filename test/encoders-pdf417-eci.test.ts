/**
 * PDF417 non-Latin-1 handling: the payload must survive, declared through ECI,
 * instead of being truncated to its low byte.
 */

import { describe, expect, it } from "vitest"
import { readBarcodes } from "zxing-wasm/reader"
import { encodePDF417 } from "../src/index"
import { encodeData } from "../src/encoders/pdf417/encoder"

function matrixToImageData(matrix: boolean[][], scaleX = 3, scaleY = 8, margin = 4) {
  const rows = matrix.length
  const cols = matrix[0]?.length ?? 0
  const width = cols * scaleX + margin * 2 * scaleX
  const height = rows * scaleY + margin * scaleY
  const data = new Uint8ClampedArray(width * height * 4)
  data.fill(255)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const mr = Math.floor((y - (margin * scaleY) / 2) / scaleY)
      const mc = Math.floor(x / scaleX) - margin
      if (mr >= 0 && mr < rows && mc >= 0 && mc < cols && matrix[mr]![mc]) {
        const idx = (y * width + x) * 4
        data[idx] = 0
        data[idx + 1] = 0
        data[idx + 2] = 0
      }
    }
  }
  return { data, width, height }
}

async function decode(matrix: boolean[][]): Promise<string | null> {
  const results = await readBarcodes(matrixToImageData(matrix) as unknown as ImageData, {
    tryHarder: true,
    formats: ["PDF417"],
  })
  return results.length > 0 ? results[0]!.text : null
}

describe("PDF417 ECI", () => {
  it("round-trips Japanese text instead of truncating it", async () => {
    const text = "日本語テスト"
    expect(await decode(encodePDF417(text).matrix)).toBe(text)
  })

  it("round-trips mixed scripts", async () => {
    const text = "Ürün 日本 — 42€"
    expect(await decode(encodePDF417(text).matrix)).toBe(text)
  })

  it("leaves plain Latin-1 data alone", () => {
    // No ECI codeword: 927/926/925 must not appear for representable text
    const codewords = encodeData("HELLO 123")
    expect(codewords).not.toContain(925)
    expect(codewords).not.toContain(926)
    expect(codewords).not.toContain(927)
  })

  it("declares ECI 26 for non-representable input", () => {
    const codewords = encodeData("日本")
    expect(codewords.slice(0, 2)).toEqual([927, 26])
  })

  it("honours an explicit ECI assignment number", () => {
    expect(encodeData("HELLO", { eci: 3 }).slice(0, 2)).toEqual([927, 3])
    // 900-810899 uses the two-codeword form
    expect(encodeData("HELLO", { eci: 1000 }).slice(0, 3)).toEqual([926, 0, 100])
    // user-defined range
    expect(encodeData("HELLO", { eci: 810_950 }).slice(0, 2)).toEqual([925, 50])
  })

  it("rejects an out-of-range ECI", () => {
    expect(() => encodeData("HELLO", { eci: 900_000 })).toThrow(/ECI assignment number/)
    expect(() => encodeData("HELLO", { eci: -1 })).toThrow(/ECI assignment number/)
  })
})

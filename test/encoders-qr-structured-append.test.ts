/**
 * QR Structured Append and ECI, verified by decoding with zxing-wasm.
 *
 * zxing reports the sequence position and total for Structured Append symbols,
 * so the header is checked against a real reader rather than against our own
 * bit layout.
 */

import { describe, expect, it } from "vitest"
import { readBarcodes } from "zxing-wasm/reader"
import { encodeQR, encodeQRSequence } from "../src/index"

function matrixToImageData(matrix: boolean[][], scale = 6, margin = 6) {
  const rows = matrix.length
  const cols = matrix[0]?.length ?? 0
  const width = (cols + margin * 2) * scale
  const height = (rows + margin * 2) * scale
  const data = new Uint8ClampedArray(width * height * 4)
  data.fill(255)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const mr = Math.floor(y / scale) - margin
      const mc = Math.floor(x / scale) - margin
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

async function read(matrix: boolean[][]) {
  const results = await readBarcodes(matrixToImageData(matrix) as unknown as ImageData, {
    tryHarder: true,
    formats: ["QRCode"],
  })
  return results[0]
}

const LONG_TEXT =
  "etiket structured append: " +
  "the quick brown fox jumps over the lazy dog, ".repeat(12) +
  "0123456789"

describe("QR Structured Append", () => {
  it("splits a long message into a decodable sequence", async () => {
    const symbols = encodeQRSequence(LONG_TEXT, { symbols: 3 })
    expect(symbols).toHaveLength(3)

    let reassembled = ""
    for (const [index, matrix] of symbols.entries()) {
      const result = await read(matrix)
      expect(result, `symbol ${index}`).toBeDefined()
      expect(result!.sequenceIndex).toBe(index)
      expect(result!.sequenceSize).toBe(3)
      reassembled += result!.text
    }
    expect(reassembled).toBe(LONG_TEXT)
  })

  it("gives every symbol in the sequence the same parity", async () => {
    const symbols = encodeQRSequence(LONG_TEXT, { symbols: 4 })
    const parities = new Set<string>()
    for (const matrix of symbols) {
      parities.add((await read(matrix))!.sequenceId)
    }
    expect(parities.size).toBe(1)
  })

  it("returns a single ordinary symbol when the data fits in one", async () => {
    const symbols = encodeQRSequence("SHORT")
    expect(symbols).toHaveLength(1)
    const result = await read(symbols[0]!)
    expect(result!.text).toBe("SHORT")
    // -1 means "not part of a sequence"
    expect(result!.sequenceSize).toBe(-1)
  })

  it("picks the fewest symbols that fit when the count is not given", async () => {
    const symbols = encodeQRSequence("X".repeat(6000), { ecLevel: "L" })
    expect(symbols.length).toBeGreaterThan(1)
    expect(symbols.length).toBeLessThanOrEqual(16)
    expect((await read(symbols[0]!))!.sequenceSize).toBe(symbols.length)
  })

  it("rejects a sequence that cannot hold the data", () => {
    expect(() => encodeQRSequence("X".repeat(8000), { symbols: 2, ecLevel: "H" })).toThrow(
      /does not fit in 2 QR symbols/,
    )
  })

  it("rejects an out-of-range symbol count", () => {
    expect(() => encodeQRSequence("hi", { symbols: 17 })).toThrow(/1 to 16 symbols/)
  })

  it("rejects a malformed header passed directly", () => {
    expect(() => encodeQR("hi", { structuredAppend: { index: 0, total: 1, parity: 0 } })).toThrow(
      /between 2 and 16 symbols/,
    )
    expect(() => encodeQR("hi", { structuredAppend: { index: 3, total: 3, parity: 0 } })).toThrow(
      /outside the sequence/,
    )
  })
})

describe("QR ECI", () => {
  it("declares UTF-8 and still decodes", async () => {
    const text = "Ürün açıklaması — 100% pamuk"
    const result = await read(encodeQR(text, { eci: 26 }))
    expect(result!.text).toBe(text)
  })

  it("accepts the 16-bit and 24-bit designator ranges", async () => {
    for (const eci of [3, 899, 20_000]) {
      const result = await read(encodeQR("ECI TEST", { eci }))
      expect(result, `eci ${eci}`).toBeDefined()
    }
  })

  it("rejects an out-of-range assignment number", () => {
    expect(() => encodeQR("hi", { eci: 1_000_000 })).toThrow(/ECI assignment number/)
  })
})

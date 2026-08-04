/**
 * Multi-segment QR encoding: the symbols must stay decodable, and mixing modes
 * must actually buy something — otherwise the optimiser is just extra risk.
 */

import { describe, expect, it } from "vitest"
import { readBarcodes } from "zxing-wasm/reader"
import { encodeQR } from "../src/index"
import { planEncoding } from "../src/encoders/qr/data"

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

async function decode(matrix: boolean[][]): Promise<string | null> {
  const results = await readBarcodes(matrixToImageData(matrix) as unknown as ImageData, {
    tryHarder: true,
    formats: ["QRCode"],
  })
  return results.length > 0 ? results[0]!.text : null
}

const MIXED = [
  "HTTPS://EXAMPLE.COM/ORDER/1234567890123456789012345",
  "SKU-0099887766554433221100 QTY 480 LOT XY",
  "hello 1234567890123456789012345 world",
  "Ürün 4059100000000 — parti 20260804",
  "ABC123def456",
]

describe("multi-segment QR round-trip", () => {
  it.each(MIXED)("decodes %s", async (text) => {
    expect(await decode(encodeQR(text))).toBe(text)
  })

  it("decodes a long digit run embedded in text", async () => {
    const text = "ORDER" + "9".repeat(120) + "END"
    expect(await decode(encodeQR(text))).toBe(text)
  })
})

describe("segmentation actually pays off", () => {
  it("uses a smaller version than forcing byte mode", () => {
    const text = "HTTPS://EXAMPLE.COM/P/" + "7".repeat(60)
    const optimized = planEncoding(text, "M", {}).version
    const forcedByte = planEncoding(text, "M", { mode: "byte" }).version
    expect(optimized).toBeLessThan(forcedByte)
  })

  it("splits a long digit run out of alphanumeric text", () => {
    const { segments } = planEncoding("ABC" + "1".repeat(40), "M", {})
    expect(segments.map((s) => s.mode)).toEqual(["alphanumeric", "numeric"])
  })

  it("leaves a short digit run inside the alphanumeric segment", () => {
    const { segments } = planEncoding("AB12CD", "M", {})
    expect(segments).toHaveLength(1)
    expect(segments[0]!.mode).toBe("alphanumeric")
  })

  it("still honours an explicitly requested mode", () => {
    const { segments } = planEncoding("12345", "M", { mode: "byte" })
    expect(segments).toHaveLength(1)
    expect(segments[0]!.mode).toBe("byte")
  })

  it("reports a capacity error naming the requested version", () => {
    expect(() => planEncoding("X".repeat(100), "H", { version: 1 })).toThrow(
      /Data too long for QR version 1/,
    )
  })
})

/**
 * Data Matrix Base 256, X12, EDIFACT and ECI, verified by decoding with
 * zxing-wasm. Binary payloads are compared as bytes, because a reader is free
 * to guess a character set for anything it cannot prove is UTF-8.
 */

import { describe, expect, it } from "vitest"
import { readBarcodes } from "zxing-wasm/reader"
import { encodeDataMatrix } from "../src/index"
import {
  encodeASCII,
  encodeAuto,
  encodeBase256,
  encodeECI,
  encodeEDIFACT,
  encodeX12,
} from "../src/encoders/datamatrix/encoder"

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
    formats: ["DataMatrix"],
  })
  return results[0]
}

describe("Data Matrix mode selection", () => {
  it("never picks a mode longer than plain ASCII", () => {
    const samples = [
      "HELLO WORLD",
      "hello world",
      "ABC*>DEF",
      "1234567890",
      "Mixed Case 123",
      "PRODUCT-CODE-99",
      "a",
      "AB",
    ]
    for (const sample of samples) {
      expect(encodeAuto(sample).length, sample).toBeLessThanOrEqual(encodeASCII(sample).length)
    }
  })

  it("uses X12 for EDI-shaped data", () => {
    // 3-character multiple of X12-only characters
    const x12 = encodeX12("ABC*>D 12")
    expect(x12).toBeDefined()
    expect(x12![0]).toBe(238)
  })

  it("rejects X12 for anything outside its character set or misaligned", () => {
    expect(encodeX12("abc")).toBeUndefined()
    expect(encodeX12("ABCD")).toBeUndefined()
  })

  it("uses EDIFACT for upper-case punctuation-heavy data", () => {
    const edifact = encodeEDIFACT("DATA+MOVE:1'")
    expect(edifact).toBeDefined()
    expect(edifact![0]).toBe(240)
  })

  it("rejects EDIFACT for characters outside 32-94", () => {
    expect(encodeEDIFACT("lower")).toBeUndefined()
  })

  it("randomises Base 256 length and data", () => {
    const codewords = encodeBase256([0, 0, 0])
    expect(codewords[0]).toBe(231)
    // Three identical bytes must not produce three identical codewords
    expect(new Set(codewords.slice(2)).size).toBe(3)
  })

  it("uses the two-codeword Base 256 length field past 249 bytes", () => {
    const short = encodeBase256(new Uint8Array(10))
    const long = encodeBase256(new Uint8Array(300))
    expect(short).toHaveLength(1 + 1 + 10)
    expect(long).toHaveLength(1 + 2 + 300)
  })
})

describe("Data Matrix ECI", () => {
  it("uses the three designator forms", () => {
    expect(encodeECI(3)).toEqual([241, 4])
    expect(encodeECI(200)).toEqual([241, 128, 74])
    expect(encodeECI(100_000)).toEqual([241, 193, 76, 52])
  })

  it("rejects an out-of-range assignment number", () => {
    expect(() => encodeECI(1_000_000)).toThrow(/ECI assignment number/)
  })

  it("declares ECI 26 for non-Latin-1 input instead of throwing", () => {
    const codewords = encodeAuto("日本")
    expect(codewords.slice(0, 2)).toEqual([241, 27])
    expect(codewords[2]).toBe(231)
  })
})

describe("Data Matrix round-trip (zxing-wasm)", () => {
  it.each([
    ["ASCII", "HELLO WORLD 123"],
    ["lower case", "hello data matrix"],
    ["X12-shaped", "ABC*>D 123456"],
    ["EDIFACT-shaped", "UNH+1+ORDERS:D:96A'"],
    ["digits", "0123456789012345"],
  ])("decodes %s", async (_label, text) => {
    expect((await read(encodeDataMatrix(text)))!.text).toBe(text)
  })

  it("decodes Japanese text through ECI and Base 256", async () => {
    const text = "日本語テスト"
    const result = await read(encodeDataMatrix(text))
    expect(result).toBeDefined()
    const decoded = new TextDecoder().decode(new Uint8Array(result!.bytes))
    expect(decoded).toBe(text)
  })

  it("decodes a mixed-script payload", async () => {
    const text = "Ürün 日本 42€"
    const result = await read(encodeDataMatrix(text))
    const decoded = new TextDecoder().decode(new Uint8Array(result!.bytes))
    expect(decoded).toBe(text)
  })
})

/**
 * Codablock F structure tests.
 *
 * Every row of a Codablock F symbol is a self-contained Code 128 barcode, so the
 * rows can be handed to a real Code 128 decoder one at a time. That is what
 * `decodeRow` does — it is the only way to show, without trusting the encoder's
 * own tables, that a digit run split across a row boundary is still read as
 * digits and that the row indicators and K1/K2 check characters land where the
 * specification says they do.
 *
 * Module-for-module agreement with the BWIPP reference lives in
 * test/encoders-codablock-f-bwip.test.ts.
 */

import { describe, expect, it } from "vitest"
import { readBarcodes } from "zxing-wasm/reader"
import { encodeCodablockF } from "../src/encoders/codablock-f"

/** Render one row of modules as an image a Code 128 reader can scan. */
function rowToImageData(modules: readonly boolean[]) {
  const barWidth = 4
  const height = 60
  const margin = 40
  const width = modules.length * barWidth + margin * 2
  const imgHeight = height + margin * 2
  const data = new Uint8ClampedArray(width * imgHeight * 4)
  data.fill(255)
  for (let m = 0; m < modules.length; m++) {
    if (!modules[m]) continue
    for (let y = margin; y < margin + height; y++) {
      for (let x = margin + m * barWidth; x < margin + (m + 1) * barWidth; x++) {
        const idx = (y * width + x) * 4
        data[idx] = 0
        data[idx + 1] = 0
        data[idx + 2] = 0
      }
    }
  }
  return { data, width, height: imgHeight }
}

/** Decode a single row as Code 128. Throws if the row is not a valid symbol. */
async function decodeRow(modules: readonly boolean[]): Promise<string> {
  const image = rowToImageData(modules) as unknown as ImageData
  const results = await readBarcodes(image, { formats: ["Code128"] })
  const hit = results[0]
  if (!hit || !hit.isValid) throw new Error("row did not decode as Code 128")
  return hit.text
}

/** Reference K1/K2: a mod-86 running weight over the raw message. */
function symbolCheck(text: string): [number, number] {
  let k1 = 0
  let k2 = 0
  for (let p = 0; p < text.length; p++) {
    const ch = text.charCodeAt(p)
    const t1 = (ch * p) % 86
    k1 = (k1 + ((t1 + ch) % 86)) % 86
    k2 = (k2 + t1) % 86
  }
  return [k1, k2]
}

/** The data rows of a symbol, skipping the separators */
function dataRows(result: { matrix: boolean[][] }): boolean[][] {
  return result.matrix.filter((_, index) => index % 2 === 1)
}

describe("Codablock F", () => {
  it("encodes short text", () => {
    const result = encodeCodablockF("Hello")
    expect(result.matrix.length).toBeGreaterThan(0)
    expect(result.rows).toBeGreaterThan(0)
    expect(result.cols).toBeGreaterThan(0)
  })

  it("produces boolean matrix", () => {
    const result = encodeCodablockF("Test")
    for (const row of result.matrix) {
      for (const cell of row) {
        expect(typeof cell).toBe("boolean")
      }
    }
  })

  it("all rows have same width", () => {
    const result = encodeCodablockF("Hello World Test Data")
    const widths = result.matrix.map((r) => r.length)
    expect(new Set(widths).size).toBe(1)
  })

  it("more data produces more rows", () => {
    const short = encodeCodablockF("Hi")
    const long = encodeCodablockF("Hello World This Is A Longer Text")
    expect(long.rows).toBeGreaterThan(short.rows)
  })

  it("throws on empty input", () => {
    expect(() => encodeCodablockF("")).toThrow(/must not be empty/)
  })

  it("throws on non-encodable characters", () => {
    expect(() => encodeCodablockF("\x80")).toThrow(/unsupported character/i)
  })

  it("encodes control characters via Code A", () => {
    const result = encodeCodablockF("\x01\x02\x03")
    expect(result.matrix.length).toBeGreaterThan(0)
    expect(result.rows).toBeGreaterThan(0)
  })

  it("respects column count", () => {
    const r1 = encodeCodablockF("Hello World", { columns: 4 })
    const r2 = encodeCodablockF("Hello World", { columns: 8 })
    expect(r1.rows).toBeGreaterThan(r2.rows)
  })

  it("rejects a column count outside 4-62", () => {
    expect(() => encodeCodablockF("Hello", { columns: 3 })).toThrow(/columns/)
    expect(() => encodeCodablockF("Hello", { columns: 63 })).toThrow(/columns/)
    expect(() => encodeCodablockF("Hello", { columns: 8.5 })).toThrow(/columns/)
  })

  it("throws once the data no longer fits in 44 rows", () => {
    expect(() => encodeCodablockF("A".repeat(500), { columns: 4 })).toThrow(/44 rows/)
  })
})

describe("Codablock F symbol structure", () => {
  it("uses rows of 11 * columns + 57 modules", () => {
    for (const columns of [4, 8, 16, 62]) {
      const result = encodeCodablockF("CODABLOCK F 12345678", { columns })
      expect(result.cols).toBe(11 * columns + 57)
      expect(result.matrix.every((row) => row.length === result.cols)).toBe(true)
    }
  })

  it("never produces a single-row symbol", () => {
    expect(encodeCodablockF("A").rows).toBe(2)
    expect(encodeCodablockF("1").rows).toBe(2)
  })

  it("reports dimensions consistent with the matrix", () => {
    const result = encodeCodablockF("CODABLOCK")
    expect(result.matrix).toHaveLength(2 * result.rows + 1)
    expect(dataRows(result)).toHaveLength(result.rows)
    expect(result.matrix[0]).toHaveLength(result.cols)
  })
})

describe("Codablock F row decoding", () => {
  // 40 digits split over three rows of 8 data codewords: rows 1 and 2 both start
  // in the middle of the run. Before the row indicator/latch fix this row-start
  // state was thrown away and the continuation decoded as garbage.
  const digits = "1234567890".repeat(4)

  it("carries a digit run across row boundaries", async () => {
    const result = encodeCodablockF(digits, { columns: 8 })
    expect(result.rows).toBe(3)

    const decoded = await Promise.all(dataRows(result).map((row) => decodeRow(row)))

    // Each row is "<row indicator><data>"; the indicator is one Code C pair.
    expect(decoded[0]!.slice(2)).toBe(digits.slice(0, 16))
    expect(decoded[1]!.slice(2)).toBe(digits.slice(16, 32))
    expect(decoded[2]!.slice(2, 10)).toBe(digits.slice(32, 40))

    // Reassembled, the payload survives intact.
    expect(decoded.map((row) => row.slice(2)).join("")).toContain(digits)
  })

  it("encodes the row count in row 0 and the row number afterwards", async () => {
    const result = encodeCodablockF(digits, { columns: 8 })
    const decoded = await Promise.all(dataRows(result).map((row) => decodeRow(row)))

    // Row 0 carries rows - 2, later rows carry their index + 42.
    expect(decoded[0]!.slice(0, 2)).toBe(String(result.rows - 2).padStart(2, "0"))
    expect(decoded[1]!.slice(0, 2)).toBe("43")
    expect(decoded[2]!.slice(0, 2)).toBe("44")
  })

  it("puts the K1/K2 symbol check characters at the end of the last row", async () => {
    const result = encodeCodablockF(digits, { columns: 8 })
    const decoded = await Promise.all(dataRows(result).map((row) => decodeRow(row)))
    const [k1, k2] = symbolCheck(digits)

    const tail = decoded[result.rows - 1]!.slice(10)
    expect(tail).toBe(String(k1).padStart(2, "0") + String(k2).padStart(2, "0"))
  })

  it("keeps every row a valid Code 128 symbol for text payloads", async () => {
    const result = encodeCodablockF("CODABLOCK F TEST DATA 42", { columns: 8 })
    const decoded = await Promise.all(dataRows(result).map((row) => decodeRow(row)))
    expect(decoded).toHaveLength(result.rows)
    // The indicator occupies one character in a Code A/Code B row.
    expect(decoded.map((row) => row.slice(1)).join("")).toContain("CODABLOCK")
  })
})

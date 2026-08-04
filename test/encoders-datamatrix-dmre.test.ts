/**
 * Data Matrix rectangular + DMRE (ISO/IEC 21471) sizes.
 * Every symbol is decoded with zxing-wasm so the placement — including the
 * corner cases that only fire for certain column counts — is verified for real.
 */

import { describe, expect, it } from "vitest"
import { readBarcodes } from "zxing-wasm/reader"
import { encodeDataMatrix, encodeGS1DataMatrix, datamatrix } from "../src/index"
import { SYMBOL_SIZES, selectSymbolSize } from "../src/encoders/datamatrix/tables"

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
  const imageData = matrixToImageData(matrix)
  const results = await readBarcodes(imageData as unknown as ImageData, {
    tryHarder: true,
    formats: ["DataMatrix"],
  })
  return results.length > 0 ? results[0]!.text : null
}

const DMRE_SIZES = SYMBOL_SIZES.filter((s) => s.dmre)

describe("Data Matrix symbol size tables", () => {
  it("exposes the 18 DMRE sizes of ISO/IEC 21471", () => {
    expect(DMRE_SIZES.map((s) => `${s.rows}x${s.cols}`)).toEqual([
      "8x48",
      "8x64",
      "8x80",
      "8x96",
      "8x120",
      "8x144",
      "12x64",
      "12x88",
      "16x64",
      "20x36",
      "20x44",
      "20x64",
      "22x48",
      "24x48",
      "24x64",
      "26x40",
      "26x48",
      "26x64",
    ])
  })

  it("keeps every size internally consistent with its data regions", () => {
    for (const size of SYMBOL_SIZES) {
      const horizontalRegions = size.cols / (size.dataRegionCols + 2)
      const verticalRegions = size.rows / (size.dataRegionRows + 2)
      expect(Number.isInteger(horizontalRegions), `${size.rows}x${size.cols}`).toBe(true)
      expect(Number.isInteger(verticalRegions), `${size.rows}x${size.cols}`).toBe(true)
      const modules =
        size.dataRegionRows * verticalRegions * (size.dataRegionCols * horizontalRegions)
      // Some sizes leave 4 modules over; those carry the fixed corner pattern.
      expect(modules % 8, `${size.rows}x${size.cols}`).oneOf([0, 4])
      expect(size.totalDataCodewords + size.ecCodewords, `${size.rows}x${size.cols}`).toBe(
        Math.floor(modules / 8),
      )
    }
  })

  it("defaults to square symbols and never picks DMRE implicitly", () => {
    for (let cw = 1; cw <= 1558; cw += 37) {
      const size = selectSymbolSize(cw)
      expect(size).toBeDefined()
      expect(size!.rows).toBe(size!.cols)
      expect(size!.dmre).toBeUndefined()
    }
  })

  it("selects rectangular sizes only when asked", () => {
    expect(selectSymbolSize(10, { shape: "rectangle" })).toMatchObject({ rows: 8, cols: 32 })
    expect(selectSymbolSize(60, { shape: "rectangle" })).toBeUndefined()
    expect(selectSymbolSize(60, { shape: "rectangle", dmre: true })).toMatchObject({
      rows: 16,
      cols: 64,
    })
  })

  it("picks the smallest symbol of either shape in auto mode", () => {
    // 49 codewords fit a 16x48 rectangle (49) before a 36x36 square (86)
    expect(selectSymbolSize(49, { shape: "auto" })).toMatchObject({ rows: 16, cols: 48 })
  })

  it("honours an explicit symbol size", () => {
    expect(selectSymbolSize(5, { symbolSize: "26x64" })).toMatchObject({ rows: 26, cols: 64 })
    expect(selectSymbolSize(5, { symbolSize: { rows: 20, cols: 44 } })).toMatchObject({
      rows: 20,
      cols: 44,
    })
    expect(selectSymbolSize(200, { symbolSize: "26x64" })).toBeUndefined()
  })

  it("rejects malformed and unknown sizes", () => {
    expect(() => selectSymbolSize(5, { symbolSize: "big" })).toThrow(/expected a "ROWSxCOLS"/)
    expect(() => selectSymbolSize(5, { symbolSize: "7x7" })).toThrow(/Unknown Data Matrix symbol/)
  })
})

describe("Data Matrix DMRE round-trip (zxing-wasm)", () => {
  it.each(DMRE_SIZES.map((s) => [`${s.rows}x${s.cols}`, s] as const))(
    "encodes and decodes a %s symbol",
    async (label, size) => {
      // Fill roughly the whole symbol so the placement is fully exercised
      const text = "A".repeat(size.totalDataCodewords - 1)
      const matrix = encodeDataMatrix(text, { symbolSize: label })
      expect(matrix.length).toBe(size.rows)
      expect(matrix[0]!.length).toBe(size.cols)
      expect(await decode(matrix)).toBe(text)
    },
  )

  it("decodes an auto-selected DMRE symbol", async () => {
    const text = "DMRE AUTO SELECT 12345"
    const matrix = encodeDataMatrix(text, { shape: "rectangle", dmre: true })
    expect(matrix.length).not.toBe(matrix[0]!.length)
    expect(await decode(matrix)).toBe(text)
  })

  it("decodes the classic rectangular sizes too", async () => {
    for (const size of SYMBOL_SIZES.filter((s) => s.rows !== s.cols && !s.dmre)) {
      const text = "R".repeat(size.totalDataCodewords - 1)
      const matrix = encodeDataMatrix(text, { symbolSize: `${size.rows}x${size.cols}` })
      expect(await decode(matrix), `${size.rows}x${size.cols}`).toBe(text)
    }
  })

  it("decodes a GS1 DataMatrix in a DMRE symbol", async () => {
    const matrix = encodeGS1DataMatrix("(01)09501101020917(10)LOT42", {
      shape: "rectangle",
      dmre: true,
    })
    const decoded = await decode(matrix)
    expect(decoded).toContain("0950110102091")
  })
})

describe("Data Matrix DMRE public API", () => {
  it("renders a DMRE symbol through datamatrix()", () => {
    const svg = datamatrix("WIDE LABEL", { shape: "rectangle", dmre: true, size: 300 })
    expect(svg).toContain("<svg")
    // 8 rows tall, far wider than tall
    expect(svg).toMatch(/viewBox="0 0 \d+ \d+"/)
  })

  it("reports the limit in force when data does not fit", () => {
    expect(() => encodeDataMatrix("X".repeat(500), { shape: "rectangle" })).toThrow(
      /maximum is 49 for rectangle symbols/,
    )
    expect(() => encodeDataMatrix("X".repeat(500), { shape: "rectangle", dmre: true })).toThrow(
      /DMRE enabled/,
    )
    expect(() => encodeDataMatrix("X".repeat(50), { symbolSize: "8x48" })).toThrow(/symbol 8x48/)
  })
})

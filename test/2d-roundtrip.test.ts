/**
 * 2D barcode round-trip tests — encode with etiket, decode with zxing-wasm
 * Verifies that generated 2D barcodes are actually scannable
 */

import { describe, expect, it } from "vitest"
import { readBarcodes } from "zxing-wasm/reader"
import {
  encodeQR,
  encodeMicroQR,
  encodeDataMatrix,
  encodePDF417,
  encodeAztec,
  encodeMicroPDF417,
  encodeRMQR,
  encodeMaxiCode,
} from "../src/index"
import { renderMaxiCodeRaster } from "../src/renderers/png/rasterize"

/**
 * Convert a boolean matrix to a grayscale PNG-like ImageData buffer
 * that zxing-wasm can decode. Uses a simple BMP-style approach.
 */
function matrixToImageData(
  matrix: boolean[][],
  scale = 6,
  margin = 6,
): { data: Uint8ClampedArray; width: number; height: number } {
  const rows = matrix.length
  const cols = matrix[0]?.length ?? 0
  const width = (cols + margin * 2) * scale
  const height = (rows + margin * 2) * scale
  const data = new Uint8ClampedArray(width * height * 4)

  // White background
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
        data[idx + 3] = 255
      }
    }
  }

  return { data, width, height }
}

/**
 * Decode a boolean matrix using zxing-wasm
 */
async function decodeMatrix(matrix: boolean[][], scale = 6, margin = 6): Promise<string | null> {
  const { data, width, height } = matrixToImageData(matrix, scale, margin)
  const imageData = { data, width, height }
  const results = await readBarcodes(imageData as ImageData, { tryHarder: true })
  return results.length > 0 ? results[0]!.text : null
}

/**
 * Rasterize a MaxiCode matrix to an ImageData buffer.
 *
 * MaxiCode modules are hexagons on a staggered grid, so the square-module
 * rasterizer above cannot draw them. This reuses the library's own MaxiCode
 * rasterizer (the one behind `maxicodePNG()`), which fills each module as a
 * disc on the sqrt(3)/2 row pitch.
 */
function maxiCodeToImageData(
  matrix: boolean[][],
  moduleSize = 12,
  margin = 3,
): { data: Uint8ClampedArray; width: number; height: number } {
  const { width, height, rows } = renderMaxiCodeRaster(matrix, { moduleSize, margin })
  const data = new Uint8ClampedArray(width * height * 4)
  data.fill(255)
  for (let y = 0; y < height; y++) {
    const row = rows[y]!
    for (let x = 0; x < width; x++) {
      if (!row[x]) continue
      const idx = (y * width + x) * 4
      data[idx] = 0
      data[idx + 1] = 0
      data[idx + 2] = 0
      data[idx + 3] = 255
    }
  }
  return { data, width, height }
}

/**
 * Decode a MaxiCode matrix, returning the detected symbology and its text
 */
async function decodeMaxiCode(
  matrix: boolean[][],
): Promise<{ format: string; text: string } | null> {
  const imageData = maxiCodeToImageData(matrix)
  const results = await readBarcodes(imageData as ImageData, { tryHarder: true })
  const first = results[0]
  return first ? { format: first.format, text: first.text } : null
}

describe("QR Code round-trip (zxing-wasm)", () => {
  it("decodes simple text", async () => {
    expect(await decodeMatrix(encodeQR("Hello World"))).toBe("Hello World")
  })

  it("decodes URL", async () => {
    expect(await decodeMatrix(encodeQR("https://example.com"))).toBe("https://example.com")
  })

  it("decodes with EC level H", async () => {
    expect(await decodeMatrix(encodeQR("EC-H TEST", { ecLevel: "H" }))).toBe("EC-H TEST")
  })

  it("decodes version 1", async () => {
    expect(await decodeMatrix(encodeQR("V1", { version: 1 }))).toBe("V1")
  })

  it("decodes version 10", async () => {
    const text = "VERSION 10 WITH ENOUGH DATA"
    expect(await decodeMatrix(encodeQR(text, { version: 10 }))).toBe(text)
  })

  it("decodes version 40", async () => {
    const text = "V40 " + "X".repeat(80)
    expect(await decodeMatrix(encodeQR(text, { version: 40 }))).toBe(text)
  })

  it("decodes all 8 mask patterns", async () => {
    for (let mask = 0; mask < 8; mask++) {
      const result = await decodeMatrix(
        encodeQR("MASK" + mask, { mask: mask as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 }),
      )
      expect(result).toBe("MASK" + mask)
    }
  })
})

describe("Micro QR round-trip (zxing-wasm)", () => {
  it("decodes numeric data", async () => {
    expect(await decodeMatrix(encodeMicroQR("12345"))).toBe("12345")
  })

  it("decodes short numeric", async () => {
    expect(await decodeMatrix(encodeMicroQR("0"))).toBe("0")
  })
})

describe("Data Matrix round-trip (zxing-wasm)", () => {
  it("decodes simple text", async () => {
    expect(await decodeMatrix(encodeDataMatrix("Hello World"))).toBe("Hello World")
  })

  it("decodes numeric data", async () => {
    expect(await decodeMatrix(encodeDataMatrix("1234567890"))).toBe("1234567890")
  })

  it("decodes URL", async () => {
    expect(await decodeMatrix(encodeDataMatrix("https://example.com"))).toBe("https://example.com")
  })

  it("decodes special characters", async () => {
    expect(await decodeMatrix(encodeDataMatrix("test@example.com"))).toBe("test@example.com")
  })
})

describe("PDF417 round-trip (zxing-wasm)", () => {
  it("decodes simple text", async () => {
    const matrix = encodePDF417("Hello World")
    expect(await decodeMatrix(matrix.matrix)).toBe("Hello World")
  })

  it("decodes numeric data", async () => {
    const matrix = encodePDF417("1234567890")
    expect(await decodeMatrix(matrix.matrix)).toBe("1234567890")
  })

  it("decodes longer text", async () => {
    const text = "The quick brown fox jumps over the lazy dog"
    const matrix = encodePDF417(text)
    expect(await decodeMatrix(matrix.matrix)).toBe(text)
  })
})

describe("Aztec round-trip (zxing-wasm)", () => {
  it("decodes simple text", async () => {
    expect(await decodeMatrix(encodeAztec("Hello World"))).toBe("Hello World")
  })

  it("decodes numeric data", async () => {
    expect(await decodeMatrix(encodeAztec("1234567890"))).toBe("1234567890")
  })

  it("decodes URL", async () => {
    expect(await decodeMatrix(encodeAztec("https://example.com"))).toBe("https://example.com")
  })
})

describe("MicroPDF417 round-trip (zxing-wasm)", () => {
  it("decodes simple text", async () => {
    expect(await decodeMatrix(encodeMicroPDF417("Hello World").matrix)).toBe("Hello World")
  })

  it("decodes numeric data", async () => {
    expect(await decodeMatrix(encodeMicroPDF417("1234567890").matrix)).toBe("1234567890")
  })

  it("decodes URL", async () => {
    expect(await decodeMatrix(encodeMicroPDF417("https://example.com").matrix)).toBe(
      "https://example.com",
    )
  })

  it("decodes a single-character payload", async () => {
    expect(await decodeMatrix(encodeMicroPDF417("A").matrix)).toBe("A")
  })

  it("decodes longer numeric data", async () => {
    const text = "1234567890123456789012345678901234567890"
    expect(await decodeMatrix(encodeMicroPDF417(text).matrix)).toBe(text)
  })

  // Wide, few-row symbols need a bigger module size before zxing will resolve the
  // rows — 4-column symbols are only 4 rows tall.
  it.each([1, 2, 3, 4] as const)("decodes a %i-column symbol", async (columns) => {
    const result = encodeMicroPDF417("MICRO123", { columns })
    expect(result.cols).toBeGreaterThan(0)
    expect(await decodeMatrix(result.matrix, 10, 8)).toBe("MICRO123")
  })
})

describe("rMQR round-trip (zxing-wasm)", () => {
  it("decodes numeric data", async () => {
    expect(await decodeMatrix(encodeRMQR("12345"))).toBe("12345")
  })

  it("decodes alphanumeric data", async () => {
    expect(await decodeMatrix(encodeRMQR("HELLO WORLD"))).toBe("HELLO WORLD")
  })

  it("decodes byte data", async () => {
    expect(await decodeMatrix(encodeRMQR("Hello, World!"))).toBe("Hello, World!")
  })

  it("decodes URL", async () => {
    expect(await decodeMatrix(encodeRMQR("https://example.com"))).toBe("https://example.com")
  })

  it.each(["M", "H"] as const)("decodes EC level %s", async (ecLevel) => {
    expect(await decodeMatrix(encodeRMQR("EC TEST", { ecLevel }))).toBe("EC TEST")
  })

  // Version indices into RMQR_SIZES that do round-trip at both EC levels
  it.each([0, 1, 2, 3, 5, 16])("decodes version index %i", async (version) => {
    for (const ecLevel of ["M", "H"] as const) {
      expect(await decodeMatrix(encodeRMQR("A1", { version, ecLevel }))).toBe("A1")
    }
  })

  /**
   * Expected divergence — issue #112 (rMQR uses a single Reed-Solomon block).
   *
   * ISO/IEC 23941 splits the larger rMQR symbols into several RS blocks. etiket
   * emits one block for every version, so every symbol from roughly R9x139 upward
   * is undecodable. Failing version indices at EC level M: 9, 14, 15, 19, 20, 21,
   * 24, 25, 26, 28, 29, 30, 31; at EC level H additionally 4, 7, 8, 12, 13, 18,
   * 22, 23, 27.
   */
  it.fails("decodes the larger versions (issue #112)", async () => {
    for (const version of [9, 14, 20, 31]) {
      expect(await decodeMatrix(encodeRMQR("A1", { version }))).toBe("A1")
    }
  })
})

describe("MaxiCode round-trip (zxing-wasm)", () => {
  it("produces a symbol zxing recognises as MaxiCode", async () => {
    const result = await decodeMaxiCode(encodeMaxiCode("THIS IS A TEST"))
    expect(result?.format).toBe("MaxiCode")
  })

  it("produces a recognisable symbol in mode 5", async () => {
    const result = await decodeMaxiCode(encodeMaxiCode("TEST", { mode: 5 }))
    expect(result?.format).toBe("MaxiCode")
  })

  /**
   * Expected divergence — issues #96 and #97.
   *
   * The finder, orientation and error correction are good enough for zxing to
   * locate and decode the symbol, but the payload never survives:
   *
   *   "THIS IS A TEST"                       -> "Test{test"
   *   "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ" -> "TestABCdefghijklmnopqrstuvwxyz"
   *   "A"                                    -> "Test"
   *
   * The nine data codewords carried in the primary message are lost in every mode
   * (issue #96, which describes the mode 2/3 primary layout), and the remainder
   * comes back in the wrong code set (issue #97). A bwip-js MaxiCode rendered and
   * decoded through this same pipeline round-trips exactly, so the failure is in
   * the encoder, not in the rasterizer above.
   */
  it.fails("round-trips mode 4 text (issues #96, #97)", async () => {
    const result = await decodeMaxiCode(encodeMaxiCode("THIS IS A TEST"))
    expect(result?.text).toBe("THIS IS A TEST")
  })

  it.fails("round-trips a mode 2 structured carrier message (issue #96)", async () => {
    const result = await decodeMaxiCode(
      encodeMaxiCode("TESTING", {
        mode: 2,
        postalCode: "152382802",
        countryCode: 840,
        serviceClass: 1,
      }),
    )
    expect(result?.text).toContain("152382802")
  })

  it.fails("round-trips a mode 3 structured carrier message (issue #96)", async () => {
    const result = await decodeMaxiCode(
      encodeMaxiCode("TESTING", {
        mode: 3,
        postalCode: "AB1 2CD",
        countryCode: 826,
        serviceClass: 1,
      }),
    )
    expect(result?.text).toContain("AB1 2CD")
  })
})

/**
 * 1D barcode round-trip tests — encode with etiket, decode with zxing-wasm
 * Verifies that generated 1D barcodes are actually scannable
 */

import { describe, expect, it } from "vitest"
import { readBarcodes } from "zxing-wasm/reader"
import {
  encodeCode128,
  encodeEAN13,
  encodeEAN8,
  encodeUPCA,
  encodeUPCE,
  encodeCode39,
  encodeCode39Extended,
  encodeCode93,
  encodeITF,
  encodeITF14,
  encodeCodabar,
  encodeGS1128,
  encodeGS1DataBarOmni,
  encodeGS1DataBarLimited,
  encodeGS1DataBarExpanded,
} from "../src/index"

/**
 * Convert 1D bar widths to ImageData for zxing-wasm decoding.
 * Renders the bar/space pattern as a pixel image with proper quiet zones.
 */
function barsToImageData(
  bars: number[],
  barWidth = 4,
  height = 100,
  margin = 40,
  spaceFirst = false,
): { data: Uint8ClampedArray; width: number; height: number } {
  let totalModules = 0
  for (const w of bars) totalModules += w
  const imgWidth = totalModules * barWidth + margin * 2
  const imgHeight = height + margin * 2
  const data = new Uint8ClampedArray(imgWidth * imgHeight * 4)
  data.fill(255) // white background

  // Draw bars
  let x = margin
  let isBar = !spaceFirst
  for (const w of bars) {
    if (isBar) {
      const barEnd = x + w * barWidth
      for (let py = margin; py < margin + height; py++) {
        for (let px = x; px < barEnd && px < imgWidth; px++) {
          const idx = (py * imgWidth + px) * 4
          data[idx] = 0
          data[idx + 1] = 0
          data[idx + 2] = 0
          data[idx + 3] = 255
        }
      }
    }
    x += w * barWidth
    isBar = !isBar
  }

  return { data, width: imgWidth, height: imgHeight }
}

/**
 * Decode a 1D barcode bar-width array using zxing-wasm
 */
async function decode1D(bars: number[]): Promise<string | null> {
  const img = barsToImageData(bars)
  const results = await readBarcodes(img as unknown as ImageData, { tryHarder: true })
  return results.length > 0 ? results[0]!.text : null
}

/**
 * Decode a 1D barcode and return the symbology zxing detected alongside the text
 */
async function decode1DResult(
  bars: number[],
  options: { spaceFirst?: boolean; barWidth?: number } = {},
): Promise<{ format: string; text: string } | null> {
  const img = barsToImageData(bars, options.barWidth ?? 4, 100, 40, options.spaceFirst ?? false)
  const results = await readBarcodes(img as unknown as ImageData, { tryHarder: true })
  const first = results[0]
  return first ? { format: first.format, text: first.text } : null
}

/**
 * Decode EAN/UPC which returns { bars, guards }
 */
async function decodeEAN(result: { bars: number[]; guards: number[] }): Promise<string | null> {
  return decode1D(result.bars)
}

describe("Code 128 round-trip", () => {
  it("decodes uppercase", async () => {
    expect(await decode1D(encodeCode128("ABC123"))).toBe("ABC123")
  })

  it("decodes lowercase", async () => {
    expect(await decode1D(encodeCode128("hello"))).toBe("hello")
  })

  it("decodes mixed case", async () => {
    expect(await decode1D(encodeCode128("Hello World"))).toBe("Hello World")
  })

  it("decodes special characters", async () => {
    expect(await decode1D(encodeCode128("test@example.com"))).toBe("test@example.com")
  })

  it("decodes digits-only (Code C)", async () => {
    expect(await decode1D(encodeCode128("1234567890"))).toBe("1234567890")
  })
})

describe("EAN-13 round-trip", () => {
  it("decodes standard EAN-13", async () => {
    expect(await decodeEAN(encodeEAN13("5901234123457"))).toBe("5901234123457")
  })

  it("decodes with auto check digit", async () => {
    const result = await decodeEAN(encodeEAN13("590123412345"))
    expect(result).toBe("5901234123457")
  })
})

describe("EAN-8 round-trip", () => {
  it("decodes standard EAN-8", async () => {
    expect(await decodeEAN(encodeEAN8("96385074"))).toBe("96385074")
  })
})

describe("UPC-A round-trip", () => {
  it("decodes standard UPC-A", async () => {
    const result = await decodeEAN(encodeUPCA("012345678905"))
    // zxing-wasm may decode UPC-A as EAN-13 (with leading 0)
    expect(result).toMatch(/0?12345678905$/)
  })
})

describe("Code 39 round-trip", () => {
  it("decodes uppercase text", async () => {
    expect(await decode1D(encodeCode39("HELLO"))).toBe("HELLO")
  })

  it("decodes digits", async () => {
    expect(await decode1D(encodeCode39("12345"))).toBe("12345")
  })
})

describe("Code 93 round-trip", () => {
  it("decodes text", async () => {
    expect(await decode1D(encodeCode93("TEST"))).toBe("TEST")
  })
})

describe("ITF round-trip", () => {
  it("decodes even-length digits", async () => {
    expect(await decode1D(encodeITF("1234567890"))).toBe("1234567890")
  })
})

describe("Codabar round-trip", () => {
  it("decodes with start/stop", async () => {
    const result = await decode1D(encodeCodabar("A12345B"))
    expect(result).toContain("12345")
  })
})

describe("GS1-128 round-trip", () => {
  it("decodes AI format", async () => {
    const result = await decode1D(encodeGS1128("(01)12345678901231"))
    expect(result).toContain("12345678901231")
  })
})

describe("UPC-E round-trip", () => {
  // zxing reports UPC-E as its expanded 13-digit (EAN-13 style) equivalent
  it("decodes UPC-E with an explicit check digit", async () => {
    const result = await decode1DResult(encodeUPCE("01234565").bars)
    expect(result).toEqual({ format: "UPCE", text: "0012345000065" })
  })

  it("decodes a code that expands through the manufacturer rule", async () => {
    const result = await decode1DResult(encodeUPCE("04252614").bars)
    expect(result).toEqual({ format: "UPCE", text: "0042100005264" })
  })

  it("decodes with an auto-computed check digit", async () => {
    expect((await decode1DResult(encodeUPCE("1234567").bars))?.text).toBe("0123456000070")
  })
})

describe("ITF-14 round-trip", () => {
  it("decodes with an auto-computed check digit", async () => {
    expect(await decode1D(encodeITF14("0012345678905"))).toBe("00123456789050")
  })

  it("decodes with an explicit check digit", async () => {
    expect(await decode1D(encodeITF14("00123456789050"))).toBe("00123456789050")
  })

  it("is read back as an ITF symbol", async () => {
    const result = await decode1DResult(encodeITF14("1234567890123"))
    expect(result).toEqual({ format: "ITF", text: "12345678901231" })
  })
})

describe("Code 39 Extended round-trip", () => {
  it("decodes mixed case", async () => {
    expect(await decode1D(encodeCode39Extended("Hello"))).toBe("Hello")
  })

  it("decodes punctuation", async () => {
    expect(await decode1D(encodeCode39Extended("test@example.com"))).toBe("test@example.com")
  })

  it("decodes shifted symbol characters", async () => {
    expect(await decode1D(encodeCode39Extended("a-b_c"))).toBe("a-b_c")
  })

  it("decodes control characters", async () => {
    expect(await decode1D(encodeCode39Extended("Tab\tEnd"))).toBe("Tab\tEnd")
  })

  it("is read back as a Code 39 Extended symbol", async () => {
    const result = await decode1DResult(encodeCode39Extended("Mixed42"))
    expect(result).toEqual({ format: "Code39Ext", text: "Mixed42" })
  })
})

/**
 * Regression guard for #137: the SPACE entry of the Code 39 pattern table had two
 * wide elements where every character must have exactly three, so any payload
 * containing a space was unscannable.
 */
describe("Code 39 space character", () => {
  it("decodes plain Code 39 containing a space", async () => {
    expect(await decode1D(encodeCode39("HELLO WORLD"))).toBe("HELLO WORLD")
  })

  it("decodes Code 39 Extended containing a space", async () => {
    expect(await decode1D(encodeCode39Extended("lower case"))).toBe("lower case")
  })
})

/**
 * GS1 DataBar round-trip. The encoders return bar-first element arrays like
 * every other 1D encoder (#138). Full coverage — the Expanded encodation
 * methods, Truncated and the stacked variants — lives in
 * test/encoders-gs1-databar-roundtrip.test.ts.
 */
describe("GS1 DataBar round-trip", () => {
  it("decodes Omnidirectional", async () => {
    expect(await decode1DResult(encodeGS1DataBarOmni("01234567890128"))).toEqual({
      format: "DataBarOmni",
      text: "(01)01234567890128",
    })
  })

  it("decodes a second Omnidirectional GTIN", async () => {
    expect((await decode1DResult(encodeGS1DataBarOmni("5901234123457")))?.text).toBe(
      "(01)59012341234576",
    )
  })

  it("decodes Limited", async () => {
    expect(await decode1DResult(encodeGS1DataBarLimited("01234567890128"))).toEqual({
      format: "DataBarLtd",
      text: "(01)01234567890128",
    })
  })

  it("decodes Expanded", async () => {
    expect(await decode1DResult(encodeGS1DataBarExpanded("(01)90012345678908"))).toEqual({
      format: "DataBarExp",
      text: "(01)90012345678908",
    })
  })

  it("round-trips a non-GTIN Expanded payload", async () => {
    expect((await decode1DResult(encodeGS1DataBarExpanded("(10)ABC123")))?.text).toBe("(10)ABC123")
  })
})

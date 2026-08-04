/**
 * GS1 QR Code: FNC1 in the first position, and the application-indicator form
 * for the second. zxing reports the symbology identifier, so the flag itself is
 * checked against a real reader rather than against our own bit layout.
 */

import { describe, expect, it } from "vitest"
import { readBarcodes } from "zxing-wasm/reader"
import { encodeQR, gs1qr, qrcode } from "../src/index"
import { gs1Payload, GROUP_SEPARATOR } from "../src/encoders/qr/gs1"

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

describe("GS1 payload", () => {
  it("strips the parentheses", () => {
    expect(gs1Payload("(01)09501101020917")).toBe("0109501101020917")
  })

  it("separates a variable-length field from what follows", () => {
    // AI 10 is variable length, so it needs a separator before the next field
    const payload = gs1Payload("(10)LOT42(11)260101")
    expect(payload).toContain("%")
    expect(payload.startsWith("10LOT42")).toBe(true)
  })

  it("does not separate after a fixed-length field", () => {
    // AI 01 is 14 digits, so the reader knows where it ends
    expect(gs1Payload("(01)09501101020917(11)260101")).toBe("010950110102091711260101")
  })

  it("omits the separator on the last field", () => {
    expect(gs1Payload("(10)LOT42")).toBe("10LOT42")
  })

  it("falls back to GS when the data is not alphanumeric-safe", () => {
    const payload = gs1Payload("(10)lot42(11)260101")
    expect(payload).toContain(GROUP_SEPARATOR)
    expect(payload).not.toContain("%")
  })

  it("doubles a literal percent in the alphanumeric form", () => {
    expect(gs1Payload("(10)50%OFF")).toBe("1050%%OFF")
  })
})

describe("GS1 QR round-trip (zxing-wasm)", () => {
  it("is reported as a GS1 symbol", async () => {
    const result = await read(encodeQR("(01)09501101020917", { gs1: true }))
    expect(result).toBeDefined()
    // ]Q3 is the symbology identifier for a QR symbol with FNC1 first position
    expect(result!.symbologyIdentifier).toBe("]Q3")
  })

  it("decodes the element string with its AIs intact", async () => {
    const result = await read(encodeQR("(01)09501101020917(10)LOT42", { gs1: true }))
    // zxing re-formats a GS1 payload back into the parenthesised form, which it
    // can only do if the AIs and the separator are where the standard says
    expect(result!.text).toBe("(01)09501101020917(10)LOT42")
  })

  it("keeps a plain symbol plain", async () => {
    const result = await read(encodeQR("(01)09501101020917"))
    expect(result!.symbologyIdentifier).toBe("]Q1")
  })

  it.each(["37", "A", "z", "00"])(
    "declares application indicator %s for FNC1 in the second position",
    async (indicator) => {
      const result = await read(encodeQR("AIMDATA", { applicationIndicator: indicator }))
      expect(result, indicator).toBeDefined()
      expect(result!.symbologyIdentifier).toBe("]Q5")
      expect(result!.text).toContain("AIMDATA")
    },
  )

  it("rejects a malformed application indicator", () => {
    expect(() => encodeQR("data", { applicationIndicator: "abc" })).toThrow(
      /two digits or a single letter/,
    )
  })
})

describe("gs1qr()", () => {
  it("renders an SVG", () => {
    const svg = gs1qr("(01)09501101020917(10)LOT42")
    expect(svg).toContain("<svg")
  })

  it("matches qrcode() with the gs1 flag", () => {
    expect(gs1qr("(01)09501101020917")).toBe(qrcode("(01)09501101020917", { gs1: true }))
  })
})

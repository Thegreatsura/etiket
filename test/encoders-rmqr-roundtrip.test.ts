/**
 * rMQR round-trip sweep — issue #112
 *
 * ISO/IEC 23941 splits the larger rMQR symbols into several Reed-Solomon
 * blocks whose data and EC codewords are interleaved. This file sweeps every
 * one of the 32 symbol sizes at both EC levels and decodes with zxing-wasm,
 * which is the only way to see a blocking/interleaving defect at all.
 */

import { describe, expect, it } from "vitest"
import { readBarcodes } from "zxing-wasm/reader"
import { encodeRMQR } from "../src/encoders/rmqr"

/** All 32 rMQR symbol sizes, in RMQR_SIZES order. */
const RMQR_VERSION_NAMES = [
  "R7x43",
  "R7x59",
  "R7x77",
  "R7x99",
  "R7x139",
  "R9x43",
  "R9x59",
  "R9x77",
  "R9x99",
  "R9x139",
  "R11x27",
  "R11x43",
  "R11x59",
  "R11x77",
  "R11x99",
  "R11x139",
  "R13x27",
  "R13x43",
  "R13x59",
  "R13x77",
  "R13x99",
  "R13x139",
  "R15x43",
  "R15x59",
  "R15x77",
  "R15x99",
  "R15x139",
  "R17x43",
  "R17x59",
  "R17x77",
  "R17x99",
  "R17x139",
] as const

/** Byte capacity at EC level M / H for each version index (ISO/IEC 23941). */
const RMQR_DATA_CW: [number, number][] = [
  [6, 3],
  [12, 7],
  [20, 10],
  [28, 14],
  [44, 24],
  [12, 7],
  [21, 11],
  [31, 17],
  [42, 22],
  [63, 33],
  [7, 5],
  [19, 11],
  [31, 15],
  [43, 23],
  [57, 29],
  [84, 42],
  [12, 7],
  [27, 13],
  [38, 20],
  [53, 29],
  [73, 35],
  [106, 54],
  [33, 15],
  [48, 26],
  [67, 31],
  [88, 48],
  [127, 69],
  [39, 21],
  [56, 28],
  [78, 38],
  [100, 56],
  [152, 76],
]

/**
 * Convert a boolean matrix to an ImageData-shaped buffer zxing-wasm can read.
 * Mirrors the helper in `2d-roundtrip.test.ts`.
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

async function decodeRMQR(matrix: boolean[][]): Promise<{ text: string; format: string } | null> {
  const { data, width, height } = matrixToImageData(matrix)
  const results = await readBarcodes({ data, width, height } as ImageData, {
    tryHarder: true,
    formats: ["RMQRCode"],
  })
  const first = results[0]
  return first ? { text: first.text, format: first.format } : null
}

/** Deterministic filler that stays inside the alphanumeric charset. */
function alnumPayload(length: number): string {
  const charset = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  let out = ""
  for (let i = 0; i < length; i++) out += charset[i % charset.length]
  return out
}

describe("rMQR per-version round-trip at EC M (zxing-wasm)", () => {
  it.each(RMQR_VERSION_NAMES.map((name, version) => [version, name] as const))(
    "decodes version %i (%s)",
    async (version) => {
      const result = await decodeRMQR(encodeRMQR("A1", { version, ecLevel: "M" }))
      expect(result?.format).toBe("RMQRCode")
      expect(result?.text).toBe("A1")
    },
  )
})

describe("rMQR per-version round-trip at EC H (zxing-wasm)", () => {
  it.each(RMQR_VERSION_NAMES.map((name, version) => [version, name] as const))(
    "decodes version %i (%s)",
    async (version) => {
      const result = await decodeRMQR(encodeRMQR("A1", { version, ecLevel: "H" }))
      expect(result?.format).toBe("RMQRCode")
      expect(result?.text).toBe("A1")
    },
  )
})

describe("rMQR round-trip at capacity", () => {
  /**
   * Short payloads leave most of the symbol filled with the 0xEC/0x11 pad
   * pattern, which can mask an interleaving bug. These fill the data region.
   */
  it.each(RMQR_VERSION_NAMES.map((name, version) => [version, name] as const))(
    "decodes a full-capacity payload at EC M for version %i (%s)",
    async (version) => {
      // 3 bits mode + CCI bits + 11 bits per 2 alphanumeric characters.
      // Undershoot slightly so the count fits regardless of the CCI width.
      const capacityBits = RMQR_DATA_CW[version]![0] * 8
      const chars = Math.max(1, Math.floor(((capacityBits - 16) / 11) * 2))
      const text = alnumPayload(chars)
      const result = await decodeRMQR(encodeRMQR(text, { version, ecLevel: "M" }))
      expect(result?.text).toBe(text)
    },
  )

  it.each(RMQR_VERSION_NAMES.map((name, version) => [version, name] as const))(
    "decodes a full-capacity payload at EC H for version %i (%s)",
    async (version) => {
      const capacityBits = RMQR_DATA_CW[version]![1] * 8
      const chars = Math.max(1, Math.floor(((capacityBits - 16) / 11) * 2))
      const text = alnumPayload(chars)
      const result = await decodeRMQR(encodeRMQR(text, { version, ecLevel: "H" }))
      expect(result?.text).toBe(text)
    },
  )
})

describe("rMQR byte-mode round-trip across versions", () => {
  it.each([4, 9, 15, 21, 26, 31])("decodes byte-mode data in version %i", async (version) => {
    const text = "Hello, World! 123 — rMQR"
    const result = await decodeRMQR(encodeRMQR(text, { version, ecLevel: "M" }))
    expect(result?.text).toBe(text)
  })
})

describe("rMQR numeric-mode round-trip across versions", () => {
  it.each([4, 9, 15, 21, 26, 31])("decodes numeric data in version %i", async (version) => {
    const text = "1234567890123456"
    const result = await decodeRMQR(encodeRMQR(text, { version, ecLevel: "H" }))
    expect(result?.text).toBe(text)
  })
})

describe("rMQR explicit version selection", () => {
  it.each(RMQR_VERSION_NAMES.map((name, version) => [version, name] as const))(
    "produces the declared symbol dimensions for version %i (%s)",
    (version, name) => {
      const [rows, cols] = name.slice(1).split("x").map(Number) as [number, number]
      const matrix = encodeRMQR("A1", { version })
      expect(matrix.length).toBe(rows)
      expect(matrix[0]!.length).toBe(cols)
    },
  )

  it("overrides automatic sizing with a larger symbol", () => {
    const auto = encodeRMQR("A1")
    const forced = encodeRMQR("A1", { version: 31 })
    expect(forced.length).toBeGreaterThan(auto.length)
    expect(forced[0]!.length).toBeGreaterThan(auto[0]!.length)
  })

  it("throws CapacityError for a negative version index", () => {
    expect(() => encodeRMQR("A1", { version: -1 })).toThrow("Invalid rMQR version index")
  })

  it("throws CapacityError for a version index past the table", () => {
    expect(() => encodeRMQR("A1", { version: 32 })).toThrow("Invalid rMQR version index")
  })

  it("throws CapacityError for a non-integer version index", () => {
    expect(() => encodeRMQR("A1", { version: 2.5 })).toThrow("Invalid rMQR version index")
  })

  it("throws CapacityError when the data exceeds the requested symbol", () => {
    // R7x43 at EC M holds 6 data codewords.
    expect(() => encodeRMQR(alnumPayload(60), { version: 0, ecLevel: "M" })).toThrow(
      "Data too long for requested rMQR symbol size",
    )
  })

  it("throws CapacityError when the data exceeds the requested symbol at EC H", () => {
    // R7x43 at EC H holds 3 data codewords.
    expect(() => encodeRMQR(alnumPayload(20), { version: 0, ecLevel: "H" })).toThrow(
      "Data too long for requested rMQR symbol size",
    )
  })
})

describe("rMQR ECI", () => {
  it("round-trips a UTF-8 ECI (26) payload", async () => {
    const text = "Grüße"
    const result = await decodeRMQR(encodeRMQR(text, { eci: 26 }))
    expect(result?.text).toBe(text)
  })

  it("round-trips an ISO-8859-1 ECI (3) payload", async () => {
    const result = await decodeRMQR(encodeRMQR("ABC123", { eci: 3 }))
    expect(result?.text).toBe("ABC123")
  })

  it("round-trips a 16-bit ECI designator", async () => {
    const result = await decodeRMQR(encodeRMQR("ABC123", { eci: 899 }))
    expect(result?.text).toBe("ABC123")
  })

  it("grows the symbol to fit the ECI header", () => {
    // R7x43 at EC M holds 48 data bits; 10 digits need 41, the ECI header 11 more.
    const withoutECI = encodeRMQR("0".repeat(10), { version: 0, ecLevel: "M" })
    expect(withoutECI.length).toBe(7)
    expect(() => encodeRMQR("0".repeat(10), { version: 0, ecLevel: "M", eci: 26 })).toThrow(
      "Data too long for requested rMQR symbol size",
    )
  })

  it("rejects an out-of-range ECI designator", () => {
    expect(() => encodeRMQR("A1", { eci: 1_000_000 })).toThrow("rMQR ECI designator")
    expect(() => encodeRMQR("A1", { eci: -1 })).toThrow("rMQR ECI designator")
    expect(() => encodeRMQR("A1", { eci: 1.5 })).toThrow("rMQR ECI designator")
  })
})

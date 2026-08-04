/**
 * MaxiCode round-trip tests — encode with etiket, decode with zxing-wasm.
 *
 * The symbols are rasterized with the library's own hexagonal rasterizer (the
 * one behind `maxicodePNG()`) so the image handed to the decoder has the same
 * geometry a real label would.
 */

import { describe, expect, it } from "vitest"
import { readBarcodes } from "zxing-wasm/reader"
import bwipjs from "bwip-js/generic"
import { encodeMaxiCode } from "../src/encoders/maxicode"
import type { MaxiCodeOptions } from "../src/encoders/maxicode"
import { renderMaxiCodeRaster } from "../src/renderers/png/rasterize"

const GS = ""

function toImageData(matrix: boolean[][]): ImageData {
  const { width, height, rows } = renderMaxiCodeRaster(matrix, { moduleSize: 12, margin: 3 })
  const data = new Uint8ClampedArray(width * height * 4)
  data.fill(255)
  for (let y = 0; y < height; y++) {
    const row = rows[y]!
    for (let x = 0; x < width; x++) {
      if (row[x]) {
        const i = (y * width + x) * 4
        data[i] = 0
        data[i + 1] = 0
        data[i + 2] = 0
      }
    }
  }
  return { data, width, height } as ImageData
}

async function decode(text: string, options?: MaxiCodeOptions): Promise<string | null> {
  const results = await readBarcodes(toImageData(encodeMaxiCode(text, options)), {
    tryHarder: true,
    formats: ["MaxiCode"],
  })
  const first = results[0]
  if (!first) return null
  expect(first.format).toBe("MaxiCode")
  // zxing renders the group separator as "<GS>" in `text`; recover the raw bytes
  return new TextDecoder("latin1").decode(Uint8Array.from(first.bytes))
}

describe("MaxiCode round-trip (zxing-wasm)", () => {
  describe("mode 4 (standard symbol)", () => {
    it("decodes upper-case text (code set A)", async () => {
      expect(await decode("HELLO WORLD")).toBe("HELLO WORLD")
    })

    it("decodes mixed case (code set A/B switching)", async () => {
      expect(await decode("Hello World")).toBe("Hello World")
    })

    it("decodes lower case with punctuation (code set B)", async () => {
      expect(await decode("shipment #42 (fragile)")).toBe("shipment #42 (fragile)")
    })

    it("decodes single, double and triple shifts back to code set A", async () => {
      expect(await decode("abcDefgh")).toBe("abcDefgh")
      expect(await decode("abcDEfgh")).toBe("abcDEfgh")
      expect(await decode("abcDEFgh")).toBe("abcDEFgh")
      expect(await decode("abcDEFGhi")).toBe("abcDEFGhi")
    })

    it("decodes a long numeric run through NS compaction", async () => {
      expect(await decode("ORDER 123456789012345678 END")).toBe("ORDER 123456789012345678 END")
    })

    it("decodes digits only", async () => {
      expect(await decode("0123456789")).toBe("0123456789")
    })

    it("fills the symbol to capacity", async () => {
      const text = "A".repeat(93)
      expect(await decode(text)).toBe(text)
    })
  })

  describe("code sets C, D and E", () => {
    it("decodes accented Latin-1 text (issue #97)", async () => {
      expect(await decode("CAFÉ")).toBe("CAFÉ")
    })

    it("decodes a run of code set C characters", async () => {
      expect(await decode("ÀÁÂÃÄÅ")).toBe("ÀÁÂÃÄÅ")
    })

    it("decodes a run of code set D characters", async () => {
      expect(await decode("àáâãäå")).toBe("àáâãäå")
    })

    it("decodes control characters from code set E", async () => {
      expect(await decode("ABC")).toBe("ABC")
    })

    it("latches back to code set A after a locked code set C run", async () => {
      expect(await decode("ÀÁÂÃABC")).toBe("ÀÁÂÃABC")
    })

    it("latches to code set B after a locked code set D run", async () => {
      expect(await decode("àáâãabc")).toBe("àáâãabc")
    })

    it("decodes text mixing every code set", async () => {
      const text = "AbÀàéZ"
      expect(await decode(text)).toBe(text)
    })

    it("never substitutes a space for an accented character (issue #97)", async () => {
      const decoded = await decode("ÉÈÊË")
      expect(decoded).toBe("ÉÈÊË")
      expect(decoded).not.toContain(" ")
    })
  })

  describe("mode 2 (US structured carrier message, issue #96)", () => {
    it("carries a 9-digit postal code, country and service class", async () => {
      expect(
        await decode("UPS TEST", {
          mode: 2,
          postalCode: "123456789",
          countryCode: 840,
          serviceClass: 1,
        }),
      ).toBe(`123456789${GS}840${GS}001${GS}UPS TEST`)
    })

    it("zero-fills a 5-digit US ZIP to ZIP+4", async () => {
      expect(
        await decode("SHIP", { mode: 2, postalCode: "12345", countryCode: 840, serviceClass: 999 }),
      ).toBe(`123450000${GS}840${GS}999${GS}SHIP`)
    })

    it("keeps a short non-US postal code at its own length", async () => {
      expect(
        await decode("PKG", { mode: 2, postalCode: "1234", countryCode: 250, serviceClass: 42 }),
      ).toBe(`1234${GS}250${GS}042${GS}PKG`)
    })

    it("carries a leading-zero postal code", async () => {
      expect(
        await decode("ZERO", {
          mode: 2,
          postalCode: "001234567",
          countryCode: 840,
          serviceClass: 1,
        }),
      ).toBe(`001234567${GS}840${GS}001${GS}ZERO`)
    })
  })

  describe("mode 3 (international structured carrier message, issue #96)", () => {
    it("carries an alphanumeric postal code through code set A", async () => {
      expect(
        await decode("DHL DATA", {
          mode: 3,
          postalCode: "EC1A1B",
          countryCode: 826,
          serviceClass: 1,
        }),
      ).toBe(`EC1A1B${GS}826${GS}001${GS}DHL DATA`)
    })

    it("space-pads a short postal code to six characters", async () => {
      expect(
        await decode("PARCEL", { mode: 3, postalCode: "AB12", countryCode: 276, serviceClass: 7 }),
      ).toBe(`AB12  ${GS}276${GS}007${GS}PARCEL`)
    })
  })

  describe("mode 5 (enhanced error correction)", () => {
    it("decodes text", async () => {
      expect(await decode("EEC MODE FIVE", { mode: 5 })).toBe("EEC MODE FIVE")
    })
  })
})

// ---------------------------------------------------------------------------
// Codeword-level conformance against BWIPP (bwip-js)
// ---------------------------------------------------------------------------

/**
 * The bullseye rings and orientation marks, repeated here as an independent
 * expectation. BWIPP draws the rings as vector circles rather than modules, so
 * its `raw()` output carries only the data modules plus the 13 fixed
 * orientation modules; everything else below must come from the data.
 */
// prettier-ignore
const FINDER = [
  28,29,280,281,311,343,344,372,376,400,403,404,407,430,432,436,438,457,461,463,
  464,466,488,490,493,495,498,500,521,523,524,526,530,550,552,556,558,580,583,
  584,587,612,616,643,644,670,677,700,707,
]

function bwipDark(text: string, options: Record<string, unknown>): Set<number> {
  const raw = (bwipjs as unknown as { raw: (o: Record<string, unknown>) => { pixs: number[] }[] })
    .raw
  return new Set(raw({ bcid: "maxicode", text, ...options })[0]!.pixs)
}

function ourDark(text: string, options?: MaxiCodeOptions): Set<number> {
  const matrix = encodeMaxiCode(text, options)
  const dark = new Set<number>()
  for (const [row, cells] of matrix.entries()) {
    for (const [col, on] of cells.entries()) if (on) dark.add(row * 30 + col)
  }
  return dark
}

function sorted(set: Iterable<number>): number[] {
  return [...set].sort((a, b) => a - b)
}

describe("MaxiCode modules match bwip-js", () => {
  const cases: [string, string, Record<string, unknown>, string, MaxiCodeOptions][] = [
    ["mode 4 upper case", "HELLO WORLD", { mode: 4 }, "HELLO WORLD", { mode: 4 }],
    ["mode 4 mixed case", "Hello World", { mode: 4 }, "Hello World", { mode: 4 }],
    [
      "mode 4 numeric run",
      "ORDER 123456789012345678 END",
      { mode: 4 },
      "ORDER 123456789012345678 END",
      { mode: 4 },
    ],
    [
      "mode 4 latin-1",
      "CAF^201 CR^200ME",
      { mode: 4, legacyencoder: true, parse: true },
      "CAFÉ CRÈME",
      { mode: 4 },
    ],
    ["mode 5", "EEC MODE FIVE", { mode: 5 }, "EEC MODE FIVE", { mode: 5 }],
    [
      "mode 2",
      `123456789${GS}840${GS}001${GS}UPS TEST`,
      { mode: 2 },
      "UPS TEST",
      { mode: 2, postalCode: "123456789", countryCode: 840, serviceClass: 1 },
    ],
    [
      "mode 2 short postcode",
      `1234${GS}250${GS}042${GS}PKG`,
      { mode: 2 },
      "PKG",
      { mode: 2, postalCode: "1234", countryCode: 250, serviceClass: 42 },
    ],
    [
      "mode 2 zip+4 fill",
      `12345${GS}840${GS}999${GS}SHIP`,
      { mode: 2 },
      "SHIP",
      { mode: 2, postalCode: "12345", countryCode: 840, serviceClass: 999 },
    ],
    [
      "mode 3",
      `EC1A1B${GS}826${GS}001${GS}DHL DATA`,
      { mode: 3 },
      "DHL DATA",
      { mode: 3, postalCode: "EC1A1B", countryCode: 826, serviceClass: 1 },
    ],
    [
      "mode 3 short postcode",
      `AB12${GS}276${GS}007${GS}PARCEL`,
      { mode: 3 },
      "PARCEL",
      { mode: 3, postalCode: "AB12", countryCode: 276, serviceClass: 7 },
    ],
  ]

  for (const [name, bwipText, bwipOptions, text, options] of cases) {
    it(name, () => {
      const expected = new Set([...bwipDark(bwipText, bwipOptions), ...FINDER])
      expect(sorted(ourDark(text, options))).toEqual(sorted(expected))
    })
  }
})

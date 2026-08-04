/**
 * GS1 DataBar round-trip and oracle tests.
 *
 * Every variant is encoded with etiket, rasterised, and decoded with
 * zxing-wasm: the decoded text must be the AI string that went in. The element
 * widths are compared against bwip-js (BWIPP), which implements all seven
 * variants of ISO/IEC 24724.
 *
 * Covers #138 (element polarity), #139 (Expanded general-purpose encodation),
 * #113 (encodation methods 3-14) and #61 (Truncated and the stacked variants).
 */

import { describe, expect, it } from "vitest"
import { readBarcodes } from "zxing-wasm/reader"
import bwipjs from "bwip-js/generic"
import {
  encodeGS1DataBarOmni,
  encodeGS1DataBarTruncated,
  encodeGS1DataBarLimited,
  encodeGS1DataBarExpanded,
  encodeGS1DataBarStacked,
  encodeGS1DataBarStackedOmni,
  encodeGS1DataBarExpandedStacked,
} from "../src/encoders/gs1-databar"

// ---------------------------------------------------------------------------
// bwip-js oracle
// ---------------------------------------------------------------------------

const bwipRaw = (bwipjs as unknown as { raw: (o: Record<string, unknown>) => unknown[] }).raw

/**
 * Element widths BWIPP produces for a DataBar symbol, normalised to etiket's
 * bar-first convention.
 *
 * BWIPP emits the ISO/IEC 24724 layout, which starts with a one-module guard
 * space; it marks that by prefixing a zero-width bar. Dropping the zero-width
 * bar and the guard space leaves the bar-first array etiket returns.
 */
function bwipDataBarWidths(bcid: string, text: string): number[] {
  const part = bwipRaw({ bcid, text, dontlint: true })[0] as { sbs: number[] }
  const sbs = [...part.sbs]
  if (sbs[0] === 0) sbs.shift()
  while (sbs.length > 0 && sbs[sbs.length - 1] === 0) sbs.pop()
  return sbs.slice(1)
}

/** BWIPP module rows for a stacked DataBar symbol. */
function bwipDataBarRows(
  bcid: string,
  text: string,
  options: Record<string, unknown> = {},
): boolean[][] {
  const part = bwipRaw({ bcid, text, dontlint: true, ...options })[0] as {
    pixs: number[]
    pixx: number
  }
  const rows: boolean[][] = []
  for (let y = 0; y < part.pixs.length / part.pixx; y++) {
    const row: boolean[] = []
    for (let x = 0; x < part.pixx; x++) row.push(!!part.pixs[y * part.pixx + x])
    rows.push(row)
  }
  return rows
}

/**
 * Collapse repeated rows so that row heights, which BWIPP reports separately
 * from the module data, do not enter the comparison.
 */
function distinctRows(matrix: boolean[][]): string[] {
  const out: string[] = []
  for (const row of matrix) {
    const text = row.map((module) => (module ? "#" : ".")).join("")
    if (out[out.length - 1] !== text) out.push(text)
  }
  return out
}

// ---------------------------------------------------------------------------
// zxing-wasm decoding
// ---------------------------------------------------------------------------

interface Image {
  data: Uint8ClampedArray
  width: number
  height: number
}

/** One module row from bar-first element widths, element 0 being a bar. */
function barsToRow(bars: number[]): boolean[] {
  const row: boolean[] = []
  let bar = true
  for (const width of bars) {
    for (let i = 0; i < width; i++) row.push(bar)
    bar = !bar
  }
  return row
}

/** Rasterise a module matrix, repeating each row `rowRepeat` times. */
function matrixToImageData(matrix: boolean[][], scale = 4, margin = 40, rowRepeat = 1): Image {
  const width = matrix[0]!.length * scale + margin * 2
  const height = matrix.length * rowRepeat * scale + margin * 2
  const data = new Uint8ClampedArray(width * height * 4)
  data.fill(255)
  for (let y = 0; y < matrix.length * rowRepeat; y++) {
    const row = matrix[Math.trunc(y / rowRepeat)]!
    for (let x = 0; x < row.length; x++) {
      if (!row[x]) continue
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const index = ((margin + y * scale + dy) * width + margin + x * scale + dx) * 4
          data[index] = 0
          data[index + 1] = 0
          data[index + 2] = 0
        }
      }
    }
  }
  return { data, width, height }
}

async function decodeImage(image: Image): Promise<{ format: string; text: string } | null> {
  const results = await readBarcodes(image as unknown as ImageData, { tryHarder: true })
  const first = results[0]
  return first ? { format: first.format, text: first.text } : null
}

const decodeBars = (bars: number[]) => decodeImage(matrixToImageData([barsToRow(bars)], 4, 40, 25))
const decodeMatrix = (matrix: boolean[][]) => decodeImage(matrixToImageData(matrix))

// ---------------------------------------------------------------------------
// Linear variants
// ---------------------------------------------------------------------------

/**
 * #138: the encoders used to return space-first arrays while both renderers
 * draw element 0 as a bar, so every rendered symbol had inverted polarity.
 */
describe("GS1 DataBar polarity (#138)", () => {
  it("decodes Omnidirectional as etiket renders it", async () => {
    expect(await decodeBars(encodeGS1DataBarOmni("01234567890128"))).toEqual({
      format: "DataBarOmni",
      text: "(01)01234567890128",
    })
  })

  it("decodes a second Omnidirectional GTIN", async () => {
    expect((await decodeBars(encodeGS1DataBarOmni("5901234123457")))?.text).toBe(
      "(01)59012341234576",
    )
  })

  it("decodes Limited as etiket renders it", async () => {
    expect(await decodeBars(encodeGS1DataBarLimited("01234567890128"))).toEqual({
      format: "DataBarLtd",
      text: "(01)01234567890128",
    })
  })

  it("decodes Expanded as etiket renders it", async () => {
    expect(await decodeBars(encodeGS1DataBarExpanded("(01)90012345678908"))).toEqual({
      format: "DataBarExp",
      text: "(01)90012345678908",
    })
  })

  it("matches bwip-js element widths for Omnidirectional", () => {
    expect(encodeGS1DataBarOmni("01234567890128")).toEqual(
      bwipDataBarWidths("databaromni", "(01)01234567890128"),
    )
  })

  it("matches bwip-js element widths for Limited", () => {
    expect(encodeGS1DataBarLimited("01234567890128")).toEqual(
      bwipDataBarWidths("databarlimited", "(01)01234567890128"),
    )
  })
})

/**
 * #139: the general-purpose encodation mis-packed the symbol, so the payload
 * came back corrupted even once the polarity was right.
 */
describe("GS1 DataBar Expanded encodation (#139)", () => {
  const payloads = [
    "(01)90012345678908",
    "(01)00012345678905(10)ABC123",
    "(10)ABC123",
    "(10)abc123",
    "(01)90012345678908(10)12345678901234567890",
    "(01)90012345678908(21)A1B2C3D4E5F6G7H8",
    "(01)90012345678908(10)1",
    "(01)90012345678908(10)A",
    "(10)ABCDEFGHIJKLMNOP",
  ]

  for (const payload of payloads) {
    it(`round-trips ${payload}`, async () => {
      expect((await decodeBars(encodeGS1DataBarExpanded(payload)))?.text).toBe(payload)
    })

    it(`matches bwip-js element widths for ${payload}`, () => {
      expect(encodeGS1DataBarExpanded(payload)).toEqual(
        bwipDataBarWidths("databarexpanded", payload),
      )
    })
  }
})

/**
 * #113: the compressed encodation methods pack weight, date, price and currency
 * into a smaller symbol than the general-purpose field would.
 */
describe("GS1 DataBar Expanded encodation methods 3-14 (#113)", () => {
  const payloads: [string, string][] = [
    ["method 3 — (3103) kilogram weight", "(01)90012345678908(3103)001750"],
    ["method 4 — (3202) pound weight", "(01)90012345678908(3202)000123"],
    ["method 4 — (3203) pound weight", "(01)90012345678908(3203)022767"],
    ["method 5 — (310x) with (11) date", "(01)90012345678908(3103)001750(11)200101"],
    ["method 6 — (320x) with (13) date", "(01)90012345678908(3202)001234(13)991231"],
    ["method 7 — (310x) with (15) date", "(01)90012345678908(3103)012233(15)991231"],
    ["method 8 — (310x) with (17) date", "(01)90012345678908(3105)000123(17)250630"],
    ["method 11 — (310x) without a date", "(01)90012345678908(3100)123456"],
    ["method 13 — (392x) price", "(01)90012345678908(3922)795"],
    ["method 13 — (392x) price with more AIs", "(01)90012345678908(3922)795(10)ABC"],
    ["method 14 — (393x) price with currency", "(01)90012345678908(3932)9781234"],
  ]

  for (const [name, payload] of payloads) {
    it(`round-trips ${name}`, async () => {
      expect((await decodeBars(encodeGS1DataBarExpanded(payload)))?.text).toBe(payload)
    })

    it(`matches bwip-js element widths for ${name}`, () => {
      expect(encodeGS1DataBarExpanded(payload)).toEqual(
        bwipDataBarWidths("databarexpanded", payload),
      )
    })
  }

  it("produces a smaller symbol than the general-purpose field would", () => {
    // (3103) qualifies for method 3; (3113) does not, so it falls back to
    // method 1 with the weight in the general purpose field.
    const compressed = encodeGS1DataBarExpanded("(01)90012345678908(3103)001750")
    const general = encodeGS1DataBarExpanded("(01)90012345678908(3113)001750")
    expect(compressed.length).toBeLessThan(general.length)
  })

  it("falls back when the weight is out of range for method 3", () => {
    // 32.768 kg exceeds the 15-bit field of method 3
    const inRange = encodeGS1DataBarExpanded("(01)90012345678908(3103)032767")
    const outOfRange = encodeGS1DataBarExpanded("(01)90012345678908(3103)032768")
    expect(inRange.length).toBeLessThan(outOfRange.length)
    expect(outOfRange).toEqual(
      bwipDataBarWidths("databarexpanded", "(01)90012345678908(3103)032768"),
    )
  })

  it("requires an indicator digit of 9 to compress", () => {
    const compressed = encodeGS1DataBarExpanded("(01)90012345678908(3103)001750")
    const plain = encodeGS1DataBarExpanded("(01)00012345678905(3103)001750")
    expect(plain.length).toBeGreaterThan(compressed.length)
  })
})

// ---------------------------------------------------------------------------
// Missing variants (#61)
// ---------------------------------------------------------------------------

describe("GS1 DataBar Truncated (#61)", () => {
  it("uses the Omnidirectional bar pattern", () => {
    expect(encodeGS1DataBarTruncated("01234567890128")).toEqual(
      encodeGS1DataBarOmni("01234567890128"),
    )
  })

  it("matches bwip-js element widths", () => {
    expect(encodeGS1DataBarTruncated("01234567890128")).toEqual(
      bwipDataBarWidths("databartruncated", "(01)01234567890128"),
    )
  })

  it("decodes", async () => {
    expect((await decodeBars(encodeGS1DataBarTruncated("01234567890128")))?.text).toBe(
      "(01)01234567890128",
    )
  })
})

describe("GS1 DataBar Stacked (#61)", () => {
  it("is 13 module rows of 50 modules", () => {
    const matrix = encodeGS1DataBarStacked("01234567890128")
    expect(matrix).toHaveLength(13)
    for (const row of matrix) expect(row).toHaveLength(50)
  })

  it("matches bwip-js modules", () => {
    expect(distinctRows(encodeGS1DataBarStacked("01234567890128"))).toEqual(
      distinctRows(bwipDataBarRows("databarstacked", "(01)01234567890128")),
    )
  })

  it("decodes", async () => {
    expect(await decodeMatrix(encodeGS1DataBarStacked("01234567890128"))).toEqual({
      format: "DataBarStk",
      text: "(01)01234567890128",
    })
  })

  it("accepts a 13-digit GTIN", async () => {
    expect((await decodeMatrix(encodeGS1DataBarStacked("5901234123457")))?.text).toBe(
      "(01)59012341234576",
    )
  })
})

describe("GS1 DataBar Stacked Omnidirectional (#61)", () => {
  it("is 69 module rows of 50 modules", () => {
    const matrix = encodeGS1DataBarStackedOmni("01234567890128")
    expect(matrix).toHaveLength(69)
    for (const row of matrix) expect(row).toHaveLength(50)
  })

  it("matches bwip-js modules", () => {
    expect(distinctRows(encodeGS1DataBarStackedOmni("01234567890128"))).toEqual(
      distinctRows(bwipDataBarRows("databarstackedomni", "(01)01234567890128")),
    )
  })

  it("decodes", async () => {
    expect((await decodeMatrix(encodeGS1DataBarStackedOmni("01234567890128")))?.text).toBe(
      "(01)01234567890128",
    )
  })

  it("decodes a GTIN whose finder gets the fixed separator", async () => {
    expect((await decodeMatrix(encodeGS1DataBarStackedOmni("5901234123457")))?.text).toBe(
      "(01)59012341234576",
    )
  })
})

describe("GS1 DataBar Expanded Stacked (#61)", () => {
  const payloads = [
    "(01)90012345678908(3103)001750",
    "(01)90012345678908(10)ABC123",
    "(01)90012345678908(10)12345678901234567890",
    "(10)ABC123",
  ]

  for (const payload of payloads) {
    it(`round-trips ${payload}`, async () => {
      expect((await decodeMatrix(encodeGS1DataBarExpandedStacked(payload)))?.text).toBe(payload)
    })

    it(`matches bwip-js modules for ${payload}`, () => {
      expect(distinctRows(encodeGS1DataBarExpandedStacked(payload))).toEqual(
        distinctRows(bwipDataBarRows("databarexpandedstacked", payload)),
      )
    })
  }

  it("is read back as an Expanded Stacked symbol", async () => {
    expect(
      await decodeMatrix(encodeGS1DataBarExpandedStacked("(01)90012345678908(10)ABC123")),
    ).toEqual({
      format: "DataBarExpStk",
      text: "(01)90012345678908(10)ABC123",
    })
  })

  it("matches bwip-js for every legal segment count", () => {
    const payload = "(01)90012345678908(10)ABC123"
    for (let segments = 2; segments <= 22; segments += 2) {
      expect(
        distinctRows(encodeGS1DataBarExpandedStacked(payload, { segments })),
        `${segments}`,
      ).toEqual(distinctRows(bwipDataBarRows("databarexpandedstacked", payload, { segments })))
    }
  })

  it("rows are 34 modules high and separated by three module rows", () => {
    const matrix = encodeGS1DataBarExpandedStacked("(01)90012345678908(3103)001750")
    expect(matrix).toHaveLength(34 * 2 + 3)
  })

  it("rejects an invalid segment count", () => {
    expect(() => encodeGS1DataBarExpandedStacked("(10)ABC", { segments: 3 })).toThrow(/segments/)
    expect(() => encodeGS1DataBarExpandedStacked("(10)ABC", { segments: 24 })).toThrow(/segments/)
  })

  it("rejects empty input", () => {
    expect(() => encodeGS1DataBarExpandedStacked("")).toThrow(/must not be empty/)
  })
})

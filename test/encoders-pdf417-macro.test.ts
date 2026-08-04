/**
 * Macro PDF417 (structured append), verified by decoding with zxing-wasm.
 *
 * zxing reports the segment index, the segment count and the file ID of a
 * macro control block, so the layout is checked against a real reader rather
 * than against our own idea of it.
 */

import { describe, expect, it } from "vitest"
import { readBarcodes } from "zxing-wasm/reader"
import { encodePDF417, encodePDF417Sequence } from "../src/encoders/pdf417/index"
import { buildMacroBlock } from "../src/encoders/pdf417/macro"

function matrixToImageData(matrix: boolean[][], scaleX = 3, scaleY = 8, margin = 4) {
  const rows = matrix.length
  const cols = matrix[0]?.length ?? 0
  const width = cols * scaleX + margin * 2 * scaleX
  const height = rows * scaleY + margin * scaleY
  const data = new Uint8ClampedArray(width * height * 4)
  data.fill(255)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const mr = Math.floor((y - (margin * scaleY) / 2) / scaleY)
      const mc = Math.floor(x / scaleX) - margin
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
    formats: ["PDF417"],
    returnErrors: true,
  })
  return results[0]
}

/** zxing forwards the macro optional fields through the `extra` JSON blob */
async function readExtra(matrix: boolean[][]): Promise<Record<string, unknown>> {
  const result = await read(matrix)
  return JSON.parse(result?.extra ?? "{}") as Record<string, unknown>
}

const LONG_TEXT =
  "etiket macro pdf417: " +
  "the quick brown fox jumps over the lazy dog, ".repeat(30) +
  "0123456789"

describe("Macro PDF417 sequence", () => {
  it("splits a long message into a decodable sequence", async () => {
    const symbols = encodePDF417Sequence(LONG_TEXT, { symbols: 3 })
    expect(symbols).toHaveLength(3)

    let reassembled = ""
    for (const [index, symbol] of symbols.entries()) {
      const result = await read(symbol.matrix)
      expect(result, `symbol ${index}`).toBeDefined()
      expect(result!.error, `symbol ${index}`).toBe("")
      expect(result!.sequenceIndex, `symbol ${index}`).toBe(index)
      expect(result!.sequenceSize, `symbol ${index}`).toBe(3)
      reassembled += result!.text
    }
    expect(reassembled).toBe(LONG_TEXT)
  })

  it("gives every symbol in the sequence the same file ID", async () => {
    const symbols = encodePDF417Sequence(LONG_TEXT, { symbols: 4 })
    const ids = new Set<string>()
    for (const symbol of symbols) {
      ids.add((await read(symbol.matrix))!.sequenceId)
    }
    expect(ids.size).toBe(1)
    expect([...ids][0]).toMatch(/^\d{6}$/)
  })

  it("honours an explicit file ID", async () => {
    const symbols = encodePDF417Sequence(LONG_TEXT, { symbols: 2, fileId: "123456" })
    for (const symbol of symbols) {
      expect((await read(symbol.matrix))!.sequenceId).toBe("123456")
    }
  })

  it("pads a short file ID to whole codewords", async () => {
    const symbols = encodePDF417Sequence(LONG_TEXT, { symbols: 2, fileId: "42" })
    expect((await read(symbols[0]!.matrix))!.sequenceId).toBe("042")
  })

  it("returns a single ordinary symbol when the data fits in one", async () => {
    const symbols = encodePDF417Sequence("SHORT MESSAGE")
    expect(symbols).toHaveLength(1)
    const result = await read(symbols[0]!.matrix)
    expect(result!.text).toBe("SHORT MESSAGE")
    // -1 means "not part of a sequence"
    expect(result!.sequenceSize).toBe(-1)
    expect(result!.sequenceIndex).toBe(-1)
  })

  it("picks the fewest symbols that fit when the count is not given", async () => {
    const symbols = encodePDF417Sequence("X".repeat(4000), { ecLevel: 2 })
    expect(symbols.length).toBeGreaterThan(1)

    let reassembled = ""
    for (const [index, symbol] of symbols.entries()) {
      const result = await read(symbol.matrix)
      expect(result!.sequenceIndex, `symbol ${index}`).toBe(index)
      expect(result!.sequenceSize, `symbol ${index}`).toBe(symbols.length)
      reassembled += result!.text
    }
    expect(reassembled).toBe("X".repeat(4000))
  })

  it("reassembles a message that needs a wide sequence", async () => {
    const text = "SEGMENT DATA 0123456789 ".repeat(400)
    const symbols = encodePDF417Sequence(text, { columns: 6 })
    expect(symbols.length).toBeGreaterThan(2)

    let reassembled = ""
    for (const symbol of symbols) {
      reassembled += (await read(symbol.matrix))!.text
    }
    expect(reassembled).toBe(text)
  })

  it("carries the descriptive optional fields on every segment", async () => {
    const symbols = encodePDF417Sequence(LONG_TEXT, {
      symbols: 2,
      fileId: "000001",
      macro: { fileName: "REPORT.TXT", sender: "ETIKET", addressee: "READER" },
    })
    for (const symbol of symbols) {
      const extra = await readExtra(symbol.matrix)
      expect(extra.FileName).toBe("REPORT.TXT")
      expect(extra.Sender).toBe("ETIKET")
      expect(extra.Addressee).toBe("READER")
    }
  })

  it("reassembles a message that needs an ECI declaration in every segment", async () => {
    const text = "日本語のテキストを複数のシンボルに分割する。".repeat(12)
    const symbols = encodePDF417Sequence(text, { symbols: 3 })

    let reassembled = ""
    for (const [index, symbol] of symbols.entries()) {
      const result = await read(symbol.matrix)
      expect(result!.sequenceIndex, `symbol ${index}`).toBe(index)
      reassembled += result!.text
    }
    expect(reassembled).toBe(text)
  })

  it("rejects an out-of-range symbol count", () => {
    expect(() => encodePDF417Sequence("hi", { symbols: 0 })).toThrow(/1 to 99999 symbols/)
    expect(() => encodePDF417Sequence("hi", { symbols: 100_000 })).toThrow(/1 to 99999 symbols/)
  })

  it("rejects a sequence that cannot hold the data", () => {
    expect(() => encodePDF417Sequence("X".repeat(4000), { symbols: 2, ecLevel: 8 })).toThrow(
      /does not fit in 2 PDF417 symbols/,
    )
  })

  it("rejects empty input", () => {
    expect(() => encodePDF417Sequence("")).toThrow(/must not be empty/)
  })

  it("rejects a file ID that is not decimal digits", () => {
    expect(() => encodePDF417Sequence("hi", { symbols: 2, fileId: "AB" })).toThrow(/decimal digits/)
  })

  it("rejects a file ID group above 899", () => {
    expect(() => encodePDF417Sequence("hi", { symbols: 2, fileId: "900" })).toThrow(/exceeds 899/)
  })
})

describe("Macro PDF417 control block", () => {
  it("reports the segment position of a hand-built block", async () => {
    const result = await read(
      encodePDF417("SEGMENT THREE", {
        macro: { segmentIndex: 2, fileId: "123456", segmentCount: 3, lastSegment: true },
      }).matrix,
    )
    expect(result!.text).toBe("SEGMENT THREE")
    expect(result!.sequenceIndex).toBe(2)
    expect(result!.sequenceSize).toBe(3)
    expect(result!.sequenceId).toBe("123456")
  })

  it("leaves the count unknown when the optional field is omitted", async () => {
    const result = await read(
      encodePDF417("PLAIN MACRO", { macro: { segmentIndex: 1, fileId: "000042" } }).matrix,
    )
    expect(result!.sequenceIndex).toBe(1)
    // 0 means "structured append, total unknown"
    expect(result!.sequenceSize).toBe(0)
  })

  it("round-trips every optional field", async () => {
    const extra = await readExtra(
      encodePDF417("FULL MACRO", {
        macro: {
          segmentIndex: 0,
          fileId: "007",
          segmentCount: 1,
          lastSegment: true,
          fileName: "REPORT.TXT",
          sender: "ETIKET",
          addressee: "READER",
          timestamp: 1_700_000_000,
          fileSize: 4242,
          checksum: 1234,
        },
      }).matrix,
    )
    expect(extra).toMatchObject({
      FileId: "007",
      FileName: "REPORT.TXT",
      Sender: "ETIKET",
      Addressee: "READER",
      Timestamp: 1_700_000_000,
      FileSize: 4242,
      Checksum: 1234,
    })
  })

  it("stays readable for every amount of padding the grid asks for", async () => {
    // The pad codewords have to sit in front of the control block: a reader
    // takes anything after the 928 marker as part of the block and rejects the
    // symbol when it finds a pad there. Walking the data length walks through
    // every pad count the grid produces.
    for (let length = 90; length <= 112; length++) {
      const chunk = LONG_TEXT.slice(0, length)
      const result = await read(
        encodePDF417(chunk, { macro: { segmentIndex: 0, fileId: "123456", segmentCount: 3 } })
          .matrix,
      )
      expect(result!.text, `length ${length}`).toBe(chunk)
    }
  })

  it("opens with 928 and ends with 922 only on the last segment", () => {
    const middle = buildMacroBlock({ segmentIndex: 0, fileId: "000", segmentCount: 2 })
    const last = buildMacroBlock({
      segmentIndex: 1,
      fileId: "000",
      segmentCount: 2,
      lastSegment: true,
    })
    expect(middle[0]).toBe(928)
    expect(middle).not.toContain(922)
    expect(last.at(-1)).toBe(922)
  })

  it("spends exactly two codewords on the segment index", () => {
    for (const segmentIndex of [0, 1, 899, 900, 12_345, 99_998]) {
      const block = buildMacroBlock({ segmentIndex, fileId: "000" })
      // 928 + two index codewords + one file ID codeword
      expect(block, `index ${segmentIndex}`).toHaveLength(4)
    }
  })

  it("rejects a segment index outside the encodable range", () => {
    expect(() => buildMacroBlock({ segmentIndex: -1, fileId: "000" })).toThrow(
      /segment index must be 0-99998/,
    )
    expect(() => buildMacroBlock({ segmentIndex: 99_999, fileId: "000" })).toThrow(
      /segment index must be 0-99998/,
    )
  })

  it("rejects a segment index outside its own sequence", () => {
    expect(() => buildMacroBlock({ segmentIndex: 3, fileId: "000", segmentCount: 3 })).toThrow(
      /outside a sequence of 3/,
    )
  })

  it("rejects negative numeric optional fields", () => {
    expect(() => buildMacroBlock({ segmentIndex: 0, fileId: "000", fileSize: -1 })).toThrow(
      /file size must be a non-negative integer/,
    )
  })

  it("rejects an empty text optional field", () => {
    expect(() => buildMacroBlock({ segmentIndex: 0, fileId: "000", sender: "" })).toThrow(
      /sender must not be empty/,
    )
  })
})

describe("PDF417 reader initialisation", () => {
  it("marks the symbol as a reader initialisation symbol", async () => {
    const result = await read(encodePDF417("PROGRAM ME", { readerInit: true }).matrix)
    expect(result!.text).toBe("PROGRAM ME")
    expect(result!.readerInit).toBe(true)
  })

  it("leaves an ordinary symbol unmarked", async () => {
    const result = await read(encodePDF417("PLAIN").matrix)
    expect(result!.readerInit).toBe(false)
  })

  it("sits in front of the data while the macro block stays behind it", async () => {
    const result = await read(
      encodePDF417("PROGRAM SEGMENT", {
        readerInit: true,
        macro: { segmentIndex: 1, fileId: "000123", segmentCount: 2, lastSegment: true },
      }).matrix,
    )
    expect(result!.text).toBe("PROGRAM SEGMENT")
    expect(result!.readerInit).toBe(true)
    expect(result!.sequenceIndex).toBe(1)
    expect(result!.sequenceSize).toBe(2)
    expect(result!.sequenceId).toBe("000123")
  })
})

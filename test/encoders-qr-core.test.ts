/**
 * encodeQRCore: encodeQR without the Shift-JIS table, so a bundle that uses
 * only it never ships the table.
 */

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { readBarcodes } from "zxing-wasm/reader"
import { encodeQR, encodeQRCore } from "../src/encoders/qr/index"
import { kanjiCodec } from "../src/encoders/qr/kanji"
import { planEncoding } from "../src/encoders/qr/data"
import { InvalidInputError } from "../src/errors"

const SRC = new URL("../src/", import.meta.url)

/** A boolean matrix as RGBA pixels with a four-module quiet zone */
function toImage(matrix: boolean[][], scale = 6): ImageData {
  const size = matrix.length + 8
  const width = size * scale
  const data = new Uint8ClampedArray(width * width * 4).fill(255)
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix.length; x++) {
      if (!matrix[y]![x]) continue
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i = (((y + 4) * scale + dy) * width + (x + 4) * scale + dx) * 4
          data[i] = data[i + 1] = data[i + 2] = 0
        }
      }
    }
  }
  return { data, width, height: width } as ImageData
}

/** The bytes a third-party reader takes off the symbol */
async function decodedBytes(matrix: boolean[][]): Promise<number[] | null> {
  const results = await readBarcodes(toImage(matrix), { formats: ["QRCode"], tryHarder: true })
  return results.length > 0 ? [...results[0]!.bytes] : null
}

describe("encodeQRCore", () => {
  it.each([
    "HELLO WORLD",
    "https://example.com/invite/ABC-2026",
    "01234567890123456789",
    "Mixed 123 text, with punctuation!",
    "é and ü in Latin-1",
  ])("draws the same matrix as encodeQR for %j", (text) => {
    for (const ecLevel of ["L", "M", "Q", "H"] as const) {
      expect(encodeQRCore(text, { ecLevel })).toEqual(encodeQR(text, { ecLevel }))
    }
  })

  it.each(["日本語のテキスト", "ORDER-42 発送済み", "ミオと一緒にイラストを作ろう"])(
    "is encodeQR again when handed the table: %j",
    (text) => {
      expect(encodeQRCore(text, { kanji: kanjiCodec })).toEqual(encodeQR(text))
    },
  )

  it("sends Japanese text as UTF-8 bytes without the table, and a reader takes it back", async () => {
    const text = "日本語のテキスト"
    const { segments } = planEncoding(text, "M", {})
    expect(segments.map((segment) => segment.mode)).not.toContain("kanji")
    expect(planEncoding(text, "M", { kanji: kanjiCodec }).segments.map((s) => s.mode)).toContain(
      "kanji",
    )

    expect(await decodedBytes(encodeQRCore(text))).toEqual([...new TextEncoder().encode(text)])
  })

  it("refuses a forced kanji mode it has no table for", () => {
    expect(() => encodeQRCore("漢字", { mode: "kanji" })).toThrow(InvalidInputError)
    expect(() => encodeQRCore("漢字", { mode: "kanji" })).toThrow(/kanjiCodec/)
    // Too long for any version, and still the table is what it says is missing
    expect(() => encodeQRCore("漢".repeat(1800), { mode: "kanji" })).toThrow(/kanjiCodec/)
    expect(encodeQRCore("漢字", { mode: "kanji", kanji: kanjiCodec })).toEqual(
      encodeQR("漢字", { mode: "kanji" }),
    )
  })

  it("reaches no module that imports the kanji table", () => {
    const seen = new Set<string>()
    const walk = (file: URL) => {
      if (seen.has(file.href)) return
      seen.add(file.href)
      const source = readFileSync(fileURLToPath(file), "utf8")
      const imports = /^\s*(?:import|export)(\s+type)?\b[^"']*?from\s+["'](\.[^"']+)["']/gm
      for (const [, typeOnly, spec] of source.matchAll(imports)) {
        // A type-only import is erased and pulls nothing into a bundle.
        if (typeOnly) continue
        walk(new URL(`${spec}.ts`, file))
      }
    }
    walk(new URL("encoders/qr/data.ts", SRC))

    const reached = [...seen].map((href) => href.slice(SRC.href.length))
    expect(reached).toContain("encoders/qr/segment.ts")
    expect(reached).not.toContain("encoders/qr/kanji.ts")
  })
})

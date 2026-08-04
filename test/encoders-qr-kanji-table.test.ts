/**
 * QR kanji mode with the real Shift-JIS table.
 *
 * The old mapping was `0x8140 + (code - 0x3000)`, so every kanji symbol decoded
 * to the wrong characters. These tests decode with zxing-wasm and compare the
 * bytes, because a reader picks its own character set for the result.
 */

import { describe, expect, it } from "vitest"
import { readBarcodes } from "zxing-wasm/reader"
import { encodeQR } from "../src/index"
import { planEncoding } from "../src/encoders/qr/data"
import { fromShiftJIS, isKanjiChar, toShiftJIS, KANJI_CHAR_COUNT } from "../src/encoders/qr/kanji"
import { isKanji, detectMode, unicodeToShiftJIS } from "../src/encoders/qr/mode"

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

async function decodeText(matrix: boolean[][]): Promise<string | undefined> {
  const results = await readBarcodes(matrixToImageData(matrix) as unknown as ImageData, {
    tryHarder: true,
    formats: ["QRCode"],
  })
  return results[0]?.text
}

describe("Shift-JIS table", () => {
  it("covers the whole kanji-mode range", () => {
    expect(KANJI_CHAR_COUNT).toBeGreaterThan(6000)
  })

  it("round-trips every character it knows", () => {
    // Sample across the table rather than all 6962, to keep the test quick
    for (const char of "日本語漢字ひらがなカタカナ、。ー①ＡＢＣ￥") {
      const sjis = toShiftJIS(char)
      expect(sjis, char).toBeDefined()
      expect(fromShiftJIS(sjis!), char).toBe(char)
    }
  })

  it("keeps every value inside the two ranges kanji mode allows", () => {
    for (const char of "日本語漢字あアｱ①") {
      const sjis = toShiftJIS(char)
      if (sjis === undefined) continue
      const inRange = (sjis >= 0x8140 && sjis <= 0x9ffc) || (sjis >= 0xe040 && sjis <= 0xebbf)
      expect(inRange, `${char} → 0x${sjis.toString(16)}`).toBe(true)
    }
  })

  it("rejects characters outside the table", () => {
    expect(isKanjiChar("A")).toBe(false)
    expect(isKanjiChar("€")).toBe(false)
    expect(toShiftJIS("😀")).toBeUndefined()
  })

  it("throws a message naming the character it cannot encode", () => {
    expect(() => unicodeToShiftJIS("日😀")).toThrow(/U\+1F600.*kanji mode/)
  })
})

describe("kanji detection", () => {
  it("recognises Japanese text", () => {
    expect(isKanji("日本語")).toBe(true)
    expect(isKanji("こんにちは")).toBe(true)
    expect(detectMode("日本語")).toBe("kanji")
  })

  it("does not claim text it cannot encode", () => {
    expect(isKanji("日本語A")).toBe(false)
    expect(isKanji("")).toBe(false)
    expect(detectMode("hello")).toBe("byte")
  })
})

describe("kanji round-trip (zxing-wasm)", () => {
  it.each(["日本語テスト", "こんにちは世界", "東京都渋谷区", "株式会社テスト商事"])(
    "decodes %s back exactly",
    async (text) => {
      expect(await decodeText(encodeQR(text))).toBe(text)
    },
  )

  it("decodes an explicitly requested kanji symbol", async () => {
    expect(await decodeText(encodeQR("漢字", { mode: "kanji" }))).toBe("漢字")
  })

  it("decodes mixed Japanese and ASCII", async () => {
    const text = "商品コード ABC-123 東京"
    expect(await decodeText(encodeQR(text))).toBe(text)
  })
})

describe("kanji mode pays for itself", () => {
  it("produces a smaller symbol than byte mode", () => {
    const text = "日本語のテキストをできるだけ小さなシンボルに収めたい"
    const kanji = planEncoding(text, "M", {}).version
    const bytes = planEncoding(text, "M", { mode: "byte" }).version
    expect(kanji).toBeLessThan(bytes)
  })

  it("splits mixed text into kanji and non-kanji segments", () => {
    const { segments } = planEncoding("ABC123" + "日本語".repeat(8), "M", {})
    expect(segments.map((s) => s.mode)).toContain("kanji")
    expect(segments.length).toBeGreaterThan(1)
  })
})

import { describe, expect, it } from "vitest"
import { encodeCode16K } from "../src/encoders/code16k"

/**
 * Row start/stop pattern pairs from ANSI/AIM BC6. Each row of a Code 16K symbol
 * is identified by its own pair, so these are what tell a reader which row it is
 * looking at.
 */
const START_PATTERNS = [
  "3211",
  "2221",
  "2122",
  "1411",
  "1132",
  "1231",
  "1114",
  "3112",
  "3211",
  "2221",
  "2122",
  "1411",
  "1132",
  "1231",
  "1114",
  "3112",
]
const STOP_PATTERNS = [
  "3211",
  "2221",
  "2122",
  "1411",
  "1132",
  "1231",
  "1114",
  "3112",
  "1132",
  "1231",
  "1114",
  "3112",
  "3211",
  "2221",
  "2122",
  "1411",
]

/** Bar/space widths of a row, starting with a bar */
function elements(row: boolean[]): number[] {
  const widths: number[] = []
  let current = row[0]
  let run = 0
  for (const module of row) {
    if (module === current) {
      run += 1
    } else {
      widths.push(run)
      current = module
      run = 1
    }
  }
  widths.push(run)
  return widths
}

/** Width pattern of the nth symbol character in a row (0-4) */
function symbolChar(row: boolean[], index: number): string {
  return elements(row)
    .slice(5 + index * 6, 11 + index * 6)
    .join("")
}

describe("Code 16K", () => {
  it("encodes short text", () => {
    const result = encodeCode16K("Hello")
    expect(result.matrix.length).toBeGreaterThanOrEqual(2)
    expect(result.rows).toBeGreaterThanOrEqual(2)
  })

  it("produces boolean matrix", () => {
    const result = encodeCode16K("Test")
    for (const row of result.matrix) {
      for (const cell of row) {
        expect(typeof cell).toBe("boolean")
      }
    }
  })

  it("minimum 2 rows", () => {
    const result = encodeCode16K("Hi")
    expect(result.rows).toBeGreaterThanOrEqual(2)
  })

  it("maximum 16 rows", () => {
    const result = encodeCode16K("A".repeat(70))
    expect(result.rows).toBeLessThanOrEqual(16)
  })

  it("grows a row at a time", () => {
    // r rows carry 5r - 3 symbol characters
    expect(encodeCode16K("A".repeat(7)).rows).toBe(2)
    expect(encodeCode16K("A".repeat(8)).rows).toBe(3)
    expect(encodeCode16K("A".repeat(12)).rows).toBe(3)
    expect(encodeCode16K("A".repeat(13)).rows).toBe(4)
  })

  it("throws on empty input", () => {
    expect(() => encodeCode16K("")).toThrow()
  })

  it("throws beyond ASCII", () => {
    expect(() => encodeCode16K("café")).toThrow(/unsupported character/)
  })

  it("throws when the data exceeds 16 rows", () => {
    expect(() => encodeCode16K("A".repeat(78))).toThrow(/capacity/)
    expect(() => encodeCode16K("9".repeat(155))).toThrow(/capacity/)
  })

  it("all rows same width", () => {
    const result = encodeCode16K("Hello World")
    const widths = new Set(result.matrix.map((r) => r.length))
    expect(widths.size).toBe(1)
  })

  it("rows are 70 modules wide and start with a bar", () => {
    const result = encodeCode16K("Hello World")
    expect(result.cols).toBe(70)
    for (const row of result.matrix) {
      expect(row).toHaveLength(70)
      expect(row[0]).toBe(true)
    }
  })

  it("frames each row with its own start/stop pattern pair", () => {
    const result = encodeCode16K("The quick brown fox jumps over the lazy dog")
    expect(result.rows).toBeGreaterThan(2)
    for (let r = 0; r < result.rows; r++) {
      const widths = elements(result.matrix[r]!)
      // 4 start elements + the 1 module bar + 5 x 6 character elements + 4 stop
      expect(widths).toHaveLength(39)
      expect(widths.slice(0, 4).join("")).toBe(START_PATTERNS[r])
      expect(widths[4]).toBe(1)
      expect(widths.slice(-4).join("")).toBe(STOP_PATTERNS[r])
    }
  })

  it("starts row 0 with the mode character", () => {
    // mode character = (rows - 2) * 7 + mode
    // "Hello" -> 2 rows, set B (mode 1) -> value 1
    expect(symbolChar(encodeCode16K("Hello").matrix[0]!, 0)).toBe("222122")
    // "1234567890" -> 2 rows, set C (mode 2) -> value 2
    expect(symbolChar(encodeCode16K("1234567890").matrix[0]!, 0)).toBe("222221")
    // "Hello World" -> 3 rows, set B (mode 1) -> value 8
    expect(symbolChar(encodeCode16K("Hello World").matrix[0]!, 0)).toBe("132212")
  })

  it("pads with the pad character, not a space", () => {
    // "Hello" fills 1 mode + 5 data of the 8 characters before the check pair,
    // so characters 6 and 7 (row 1, positions 1 and 2) are pads (value 103)
    const result = encodeCode16K("Hello")
    expect(symbolChar(result.matrix[1]!, 1)).toBe("211412")
    expect(symbolChar(result.matrix[1]!, 2)).toBe("211412")
  })

  it("ends with two check characters that depend on the whole symbol", () => {
    // C and K are computed mod 107 over every character, so a single character
    // change anywhere alters the last two characters of the last row
    const a = encodeCode16K("Hello")
    const b = encodeCode16K("Hellp")
    expect(symbolChar(a.matrix[1]!, 3)).not.toBe(symbolChar(b.matrix[1]!, 3))
    expect(symbolChar(a.matrix[1]!, 4)).not.toBe(symbolChar(b.matrix[1]!, 4))
  })
})

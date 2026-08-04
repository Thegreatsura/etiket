import { describe, expect, it } from "vitest"
import { encodeDotCode } from "../src/encoders/dotcode"

describe("DotCode", () => {
  it("encodes short text", () => {
    const matrix = encodeDotCode("Hello")
    expect(matrix.length).toBeGreaterThan(0)
    expect(matrix[0]!.length).toBeGreaterThan(0)
  })

  it("height + width is odd (DotCode spec requirement)", () => {
    const matrix = encodeDotCode("Test")
    expect((matrix.length + matrix[0]!.length) % 2).toBe(1)
  })

  it("checkerboard pattern — no adjacent dots", () => {
    const matrix = encodeDotCode("Test data")
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r]!.length; c++) {
        if (matrix[r]![c] && (r + c) % 2 !== 0) {
          // Dots should only appear at even (r+c) positions
          expect(true).toBe(false) // fail
        }
      }
    }
  })

  it("produces boolean matrix", () => {
    const matrix = encodeDotCode("Data")
    for (const row of matrix) {
      for (const cell of row) {
        expect(typeof cell).toBe("boolean")
      }
    }
  })

  it("throws on empty input", () => {
    expect(() => encodeDotCode("")).toThrow()
  })

  it("throws on input beyond the 2000 character limit", () => {
    expect(() => encodeDotCode("A".repeat(2001))).toThrow(/too long/)
  })

  it("larger data produces larger matrix", () => {
    const small = encodeDotCode("Hi")
    const large = encodeDotCode("This is a longer DotCode message for testing purposes")
    const smallArea = small.length * small[0]!.length
    const largeArea = large.length * large[0]!.length
    expect(largeArea).toBeGreaterThan(smallArea)
  })

  it("different data produces different output", () => {
    const a = encodeDotCode("Hello")
    const b = encodeDotCode("World")
    const aStr = a.map((r) => r.map((c) => (c ? "1" : "0")).join("")).join("")
    const bStr = b.map((r) => r.map((c) => (c ? "1" : "0")).join("")).join("")
    expect(aStr).not.toBe(bStr)
  })
})

describe("DotCode symbol sizing", () => {
  it("honours a fixed row count", () => {
    const matrix = encodeDotCode("DOTCODE", { rows: 9 })
    expect(matrix.length).toBe(9)
    expect((matrix.length + matrix[0]!.length) % 2).toBe(1)
  })

  it("honours a fixed column count", () => {
    const matrix = encodeDotCode("DOTCODE", { columns: 20 })
    expect(matrix[0]!.length).toBe(20)
    expect((matrix.length + matrix[0]!.length) % 2).toBe(1)
  })

  it("honours both dimensions", () => {
    const matrix = encodeDotCode("12345678", { rows: 11, columns: 20 })
    expect(matrix.length).toBe(11)
    expect(matrix[0]!.length).toBe(20)
  })

  it("rejects out of range dimensions", () => {
    expect(() => encodeDotCode("A", { rows: 4 })).toThrow(/rows/)
    expect(() => encodeDotCode("A", { rows: 201 })).toThrow(/rows/)
    expect(() => encodeDotCode("A", { columns: 4 })).toThrow(/columns/)
    expect(() => encodeDotCode("A", { columns: 201 })).toThrow(/columns/)
  })

  it("rejects an even rows + columns sum", () => {
    expect(() => encodeDotCode("A", { rows: 10, columns: 20 })).toThrow(/odd/)
  })

  it("rejects data that cannot fit the requested size", () => {
    expect(() => encodeDotCode("A".repeat(200), { rows: 5, columns: 6 })).toThrow(/too long/)
  })
})

describe("DotCode masking", () => {
  it("rejects an out of range mask", () => {
    expect(() => encodeDotCode("A", { mask: 4 })).toThrow(/mask/)
  })

  it("each mask produces a distinct symbol", () => {
    const seen = new Set<string>()
    for (const mask of [0, 1, 2, 3]) {
      const matrix = encodeDotCode("DotCode Test", { mask })
      seen.add(matrix.map((r) => r.map((c) => (c ? "1" : "0")).join("")).join("|"))
    }
    expect(seen.size).toBe(4)
  })

  it("encodes the mask index in the first two dots of the bitstream", () => {
    // The first two bits of the bitstream are the mask index. For an odd-row
    // symbol the walk starts at the bottom-left and runs left to right, and
    // (0, rows - 1) is a fixed edge dot, so they land on the next two vacant
    // positions of the bottom row.
    for (const mask of [0, 1, 2, 3]) {
      const matrix = encodeDotCode("DOTCODE", { mask, rows: 15, columns: 20 })
      const bottom = matrix[matrix.length - 1]!
      expect([bottom[2] ? 1 : 0, bottom[4] ? 1 : 0]).toEqual([(mask >> 1) & 1, mask & 1])
    }
  })
})

describe("DotCode encodation modes", () => {
  it("encodes digits, text, control characters and high bytes", () => {
    for (const text of ["1234567890", "abcdef", "ABC\x01\x02", "café üß", "a\r\nb"]) {
      const matrix = encodeDotCode(text)
      expect(matrix.length).toBeGreaterThan(4)
      expect(matrix.some((row) => row.some(Boolean))).toBe(true)
    }
  })

  it("keeps every dot on an even (r + c) position for all inputs", () => {
    for (const text of ["9".repeat(120), "The quick brown fox", "ÿþý", "17123456101234"]) {
      const matrix = encodeDotCode(text)
      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r]!.length; c++) {
          if ((r + c) % 2 !== 0) expect(matrix[r]![c]).toBe(false)
        }
      }
    }
  })
})

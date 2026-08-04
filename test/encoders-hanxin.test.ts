import { describe, expect, it } from "vitest"
import { encodeHanXin } from "../src/encoders/hanxin"
import { hanxinBitstream, hanxinSegments } from "../src/encoders/hanxin/encoder"
import { hanxinFunctionEC } from "../src/encoders/hanxin/reed-solomon"
import { hanxinFunctionMap } from "../src/encoders/hanxin/tables"

/**
 * Read the 34-bit function information back out of a finished symbol.
 *
 * Every bit is written at two positions, so this also checks that the two copies
 * agree, and it re-derives the Reed-Solomon check nibbles and the fixed tail.
 */
function readFunctionInfo(matrix: boolean[][]): {
  version: number
  ecLevel: number
  mask: number
} {
  const size = matrix.length
  const bits = hanxinFunctionMap(size).map((positions) => {
    const [first, second] = positions.map(([x, y]) => (matrix[y]![x]! ? 1 : 0))
    expect(first).toBe(second)
    return first!
  })

  const nibbles: number[] = []
  for (let i = 0; i < 28; i += 4) {
    nibbles.push((bits[i]! << 3) | (bits[i + 1]! << 2) | (bits[i + 2]! << 1) | bits[i + 3]!)
  }
  expect(nibbles.slice(3)).toEqual(hanxinFunctionEC(nibbles.slice(0, 3), 4))
  expect(bits.slice(28)).toEqual([0, 1, 0, 1, 0, 1])

  const value = (nibbles[0]! << 8) | (nibbles[1]! << 4) | nibbles[2]!
  return { version: (value >> 4) - 20, ecLevel: ((value >> 2) & 3) + 1, mask: (value & 3) + 1 }
}

function bitstring(text: string): string {
  const bytes = new TextEncoder().encode(text)
  return hanxinBitstream(bytes, hanxinSegments(bytes)).join("")
}

describe("Han Xin Code", () => {
  it("produces a square boolean matrix", () => {
    const matrix = encodeHanXin("Hello")
    expect(matrix.length).toBe(23)
    for (const row of matrix) {
      expect(row.length).toBe(23)
      for (const cell of row) expect(typeof cell).toBe("boolean")
    }
  })

  it("has a finder pattern in all four corners", () => {
    const matrix = encodeHanXin("Test")
    const size = matrix.length
    expect(matrix[0]![0]).toBe(true)
    expect(matrix[0]![size - 1]).toBe(true)
    expect(matrix[size - 1]![0]).toBe(true)
    expect(matrix[size - 1]![size - 1]).toBe(true)
  })

  it("gives the bottom-left finder a distinct shape so orientation is recoverable", () => {
    const matrix = encodeHanXin("Test")
    const size = matrix.length
    const corner = (rowFrom: number, colFrom: number, flipRow: boolean, flipCol: boolean) =>
      Array.from({ length: 7 }, (_, r) =>
        Array.from({ length: 7 }, (_, c) => {
          const y = flipRow ? rowFrom - r : rowFrom + r
          const x = flipCol ? colFrom - c : colFrom + c
          return matrix[y]![x] ? 1 : 0
        }).join(""),
      )
    const topLeft = corner(0, 0, false, false)
    expect(corner(0, size - 1, false, true)).toEqual(topLeft)
    expect(corner(size - 1, size - 1, true, true)).toEqual(topLeft)
    expect(corner(size - 1, 0, true, false)).not.toEqual(topLeft)
  })

  it("grows the symbol as the data grows", () => {
    const small = encodeHanXin("Hi")
    const large = encodeHanXin("A".repeat(100))
    expect(large.length).toBeGreaterThan(small.length)
  })

  it("produces different symbols for different data", () => {
    const flatten = (m: boolean[][]) =>
      m.map((r) => r.map((c) => (c ? "1" : "0")).join("")).join("")
    expect(flatten(encodeHanXin("Hello"))).not.toBe(flatten(encodeHanXin("World")))
  })
})

describe("Han Xin Code function information", () => {
  it("encodes the version and EC level that were used", () => {
    for (const version of [1, 2, 5, 12, 40]) {
      for (const ecLevel of [1, 2, 3, 4] as const) {
        const info = readFunctionInfo(encodeHanXin("Hi", { version, ecLevel }))
        expect({ version: info.version, ecLevel: info.ecLevel }).toEqual({ version, ecLevel })
        expect(info.mask).toBeGreaterThanOrEqual(1)
        expect(info.mask).toBeLessThanOrEqual(4)
      }
    }
  })

  it("records the mask that was requested", () => {
    for (const mask of [1, 2, 3, 4] as const) {
      expect(readFunctionInfo(encodeHanXin("Han Xin Code", { mask })).mask).toBe(mask)
    }
  })

  it("defaults to EC level L2", () => {
    expect(readFunctionInfo(encodeHanXin("Han Xin")).ecLevel).toBe(2)
  })

  it("picks the mask by evaluation, not by always taking the first", () => {
    const masks = new Set(
      ["Hello", "The quick brown fox", "x".repeat(200), "0123456789 abcdef", "AAAAAAAAAAAA"].map(
        (text) => readFunctionInfo(encodeHanXin(text)).mask,
      ),
    )
    expect(masks.size).toBeGreaterThan(1)
  })
})

describe("Han Xin Code encodation", () => {
  it("encodes short data in byte mode", () => {
    // 0011, 13-bit length of 1, then the byte itself.
    expect(bitstring("A")).toBe("0011" + "0000000000001" + "01000001")
  })

  it("encodes a trailing digit run of five or more in numeric mode", () => {
    // 0001, then 123 and 456 as 10-bit groups, then the "two spare digits" terminator.
    expect(bitstring("123456")).toBe("0001" + "0001111011" + "0111001000" + "1111111111")
  })

  it("chooses the terminator from the size of the final group", () => {
    expect(bitstring("1234567").endsWith("1111111101")).toBe(true)
    expect(bitstring("12345678").endsWith("1111111110")).toBe(true)
    expect(bitstring("123456789").endsWith("1111111111")).toBe(true)
  })

  it("keeps short digit runs in byte mode", () => {
    expect(hanxinSegments(new TextEncoder().encode("ab1234567cd"))).toEqual([
      { numeric: false, from: 0, to: 11 },
    ])
    expect(hanxinSegments(new TextEncoder().encode("1234"))).toEqual([
      { numeric: false, from: 0, to: 4 },
    ])
  })

  it("breaks out digit runs that pay for the mode switch", () => {
    expect(hanxinSegments(new TextEncoder().encode("ab12345678cd"))).toEqual([
      { numeric: false, from: 0, to: 2 },
      { numeric: true, from: 2, to: 10 },
      { numeric: false, from: 10, to: 12 },
    ])
    // A run that finishes the data needs no switch back, so five digits is enough.
    expect(hanxinSegments(new TextEncoder().encode("ab12345"))).toEqual([
      { numeric: false, from: 0, to: 2 },
      { numeric: true, from: 2, to: 7 },
    ])
  })

  it("encodes non-ASCII text as UTF-8 bytes", () => {
    expect(bitstring("é")).toBe("0011" + "0000000000010" + "11000011" + "10101001")
  })
})

describe("Han Xin Code validation", () => {
  it("rejects empty input", () => {
    expect(() => encodeHanXin("")).toThrow(/must not be empty/)
  })

  it("rejects an out-of-range EC level", () => {
    expect(() => encodeHanXin("Test", { ecLevel: 5 as 1 })).toThrow(/EC level/)
  })

  it("rejects an out-of-range version", () => {
    expect(() => encodeHanXin("Test", { version: 0 })).toThrow(/version/)
    expect(() => encodeHanXin("Test", { version: 85 })).toThrow(/version/)
    expect(() => encodeHanXin("Test", { version: 1.5 })).toThrow(/version/)
  })

  it("rejects an out-of-range mask", () => {
    expect(() => encodeHanXin("Test", { mask: 0 as 1 })).toThrow(/mask/)
  })

  it("rejects data that will not fit the requested version", () => {
    expect(() => encodeHanXin("A".repeat(50), { version: 1 })).toThrow(/Data too long/)
  })

  it("rejects data that will not fit any version", () => {
    expect(() => encodeHanXin("A".repeat(8000), { ecLevel: 4 })).toThrow(/Data too long/)
  })

  it("supports every EC level", () => {
    for (const ecLevel of [1, 2, 3, 4] as const) {
      expect(encodeHanXin("Test", { ecLevel }).length).toBe(23)
    }
  })
})

import { describe, expect, it } from "vitest"
import { encodeMaxiCode } from "../src/encoders/maxicode"
import { CapacityError, InvalidInputError } from "../src/errors"

describe("MaxiCode", () => {
  it("encodes mode 4 (standard)", () => {
    const matrix = encodeMaxiCode("Hello World")
    expect(matrix.length).toBe(33)
    expect(matrix[0]!.length).toBe(30)
  })

  it("encodes mode 2 (US structured carrier)", () => {
    const matrix = encodeMaxiCode("UPS TRACKING DATA", {
      mode: 2,
      postalCode: "123456789",
      countryCode: 840,
      serviceClass: 1,
    })
    expect(matrix.length).toBe(33)
  })

  it("encodes mode 3 (international structured)", () => {
    const matrix = encodeMaxiCode("DHL DATA", {
      mode: 3,
      postalCode: "EC1A1B",
      countryCode: 826,
      serviceClass: 1,
    })
    expect(matrix.length).toBe(33)
  })

  it("produces boolean matrix", () => {
    const matrix = encodeMaxiCode("Test")
    for (const row of matrix) {
      for (const cell of row) {
        expect(typeof cell).toBe("boolean")
      }
    }
  })

  it("has data in matrix", () => {
    const matrix = encodeMaxiCode("Test")
    // Matrix should contain both dark and light modules
    let hasDark = false
    let hasLight = false
    for (const row of matrix) {
      for (const cell of row) {
        if (cell) hasDark = true
        else hasLight = true
      }
    }
    expect(hasDark).toBe(true)
    expect(hasLight).toBe(true)
  })

  it("throws on empty input", () => {
    expect(() => encodeMaxiCode("")).toThrow()
  })

  it("different data produces different matrix", () => {
    const a = encodeMaxiCode("Hello")
    const b = encodeMaxiCode("World")
    const aStr = a.map((r) => r.map((c) => (c ? "1" : "0")).join("")).join("")
    const bStr = b.map((r) => r.map((c) => (c ? "1" : "0")).join("")).join("")
    expect(aStr).not.toBe(bStr)
  })

  it("always 33x30", () => {
    const short = encodeMaxiCode("Hi")
    const long = encodeMaxiCode("This is a longer MaxiCode message for testing")
    expect(short.length).toBe(33)
    expect(short[0]!.length).toBe(30)
    expect(long.length).toBe(33)
    expect(long[0]!.length).toBe(30)
  })
})

describe("MaxiCode finder pattern", () => {
  /** Bullseye rings and orientation marks, expressed as row/column pairs. */
  const finder = (matrix: boolean[][]) => {
    const dark = new Set<number>()
    for (const [row, cells] of matrix.entries()) {
      for (const [col, on] of cells.entries()) if (on) dark.add(row * 30 + col)
    }
    return dark
  }

  it("keeps the bullseye identical across payloads", () => {
    // Both the finder modules and the reserved cells around them must be
    // payload-independent: every difference has to sit on a data module.
    const a = finder(encodeMaxiCode("ONE"))
    const b = finder(encodeMaxiCode("TWO"))
    // Six innermost ring modules (the hexagonal neighbours of row 16, col 14)
    for (const pos of [463, 464, 493, 495, 523, 524]) {
      expect(a.has(pos)).toBe(true)
      expect(b.has(pos)).toBe(true)
    }
    // Orientation marks
    for (const pos of [28, 29, 280, 281, 311, 457, 488, 500, 530, 670, 677, 700, 707]) {
      expect(a.has(pos)).toBe(true)
      expect(b.has(pos)).toBe(true)
    }
    // The centre module is always light
    expect(a.has(16 * 30 + 14)).toBe(false)
    expect(b.has(16 * 30 + 14)).toBe(false)
  })
})

describe("MaxiCode code sets (issue #97)", () => {
  it("encodes Latin-1 characters instead of substituting spaces", () => {
    // "CAFÉ" and "CAFE" must not collapse to the same symbol
    expect(encodeMaxiCode("CAFÉ")).not.toEqual(encodeMaxiCode("CAFE"))
    // Nor may different code set C/D/E characters collapse into each other
    expect(encodeMaxiCode("À")).not.toEqual(encodeMaxiCode("Á"))
    expect(encodeMaxiCode("à")).not.toEqual(encodeMaxiCode("á"))
    expect(encodeMaxiCode("À")).not.toEqual(encodeMaxiCode(" "))
  })

  it("encodes every byte of ISO/IEC 8859-1", () => {
    for (let code = 0; code < 256; code++) {
      expect(() => encodeMaxiCode(String.fromCharCode(code))).not.toThrow()
    }
  })

  it("distinguishes every byte of ISO/IEC 8859-1", () => {
    const seen = new Map<string, number>()
    for (let code = 0; code < 256; code++) {
      const key = encodeMaxiCode(String.fromCharCode(code))
        .map((r) => r.map((c) => (c ? "1" : "0")).join(""))
        .join("")
      expect(seen.has(key), `byte ${code} collides with byte ${seen.get(key)}`).toBe(false)
      seen.set(key, code)
    }
  })

  it("throws instead of dropping characters above U+00FF", () => {
    expect(() => encodeMaxiCode("PRIX 100€")).toThrow(InvalidInputError)
    expect(() => encodeMaxiCode("PRIX 100€")).toThrow(/U\+20AC/)
    expect(() => encodeMaxiCode("日本")).toThrow(/U\+65E5/)
    // Astral plane characters are named by their code point, not by a surrogate
    expect(() => encodeMaxiCode("🚚")).toThrow(/U\+1F69A/)
  })
})

describe("MaxiCode primary message (issue #96)", () => {
  it("rejects a mode 2 postal code that is not 1-9 digits", () => {
    expect(() => encodeMaxiCode("X", { mode: 2, postalCode: "" })).toThrow(InvalidInputError)
    expect(() => encodeMaxiCode("X", { mode: 2, postalCode: "1234567890" })).toThrow(
      /1 to 9 digits/,
    )
    expect(() => encodeMaxiCode("X", { mode: 2, postalCode: "AB123" })).toThrow(/1 to 9 digits/)
    // Modes 2 and 3 have no meaningful postal code default
    expect(() => encodeMaxiCode("X", { mode: 2 })).toThrow(InvalidInputError)
    expect(() => encodeMaxiCode("X", { mode: 3 })).toThrow(InvalidInputError)
  })

  it("rejects a mode 3 postal code that is too long or out of alphabet", () => {
    expect(() => encodeMaxiCode("X", { mode: 3, postalCode: "" })).toThrow(InvalidInputError)
    expect(() => encodeMaxiCode("X", { mode: 3, postalCode: "AB1 2CD" })).toThrow(
      /1 to 6 characters/,
    )
    expect(() => encodeMaxiCode("X", { mode: 3, postalCode: "ab12" })).toThrow(/not allowed/)
  })

  it("rejects out of range country codes and service classes", () => {
    const base = { mode: 2, postalCode: "12345" } as const
    expect(() => encodeMaxiCode("X", { ...base, countryCode: 1000 })).toThrow(/country code/)
    expect(() => encodeMaxiCode("X", { ...base, countryCode: -1 })).toThrow(/country code/)
    expect(() => encodeMaxiCode("X", { ...base, serviceClass: 1000 })).toThrow(/service class/)
  })

  it("varies with the postal code, country and service class", () => {
    const at = (options: Parameters<typeof encodeMaxiCode>[1]) =>
      encodeMaxiCode("X", options)
        .map((r) => r.map((c) => (c ? "1" : "0")).join(""))
        .join("")
    const base = { mode: 2, postalCode: "123456789", countryCode: 840, serviceClass: 1 } as const
    expect(at({ ...base, postalCode: "123456788" })).not.toBe(at(base))
    expect(at({ ...base, countryCode: 826 })).not.toBe(at(base))
    expect(at({ ...base, serviceClass: 2 })).not.toBe(at(base))
    // The length field is part of the primary message, so "012345678" and
    // "12345678" must not produce the same symbol
    expect(at({ ...base, postalCode: "012345678" })).not.toBe(
      at({ ...base, postalCode: "12345678" }),
    )
  })

  it("zero-fills a 5-digit US ZIP to ZIP+4", () => {
    const at = (postalCode: string) =>
      encodeMaxiCode("X", { mode: 2, postalCode, countryCode: 840, serviceClass: 1 })
    expect(at("12345")).toEqual(at("123450000"))
    // Only for country 840
    const nonUS = (postalCode: string) =>
      encodeMaxiCode("X", { mode: 2, postalCode, countryCode: 250, serviceClass: 1 })
    expect(nonUS("12345")).not.toEqual(nonUS("123450000"))
  })
})

describe("MaxiCode capacity", () => {
  it("accepts a message that exactly fills mode 4", () => {
    expect(() => encodeMaxiCode("A".repeat(93))).not.toThrow()
  })

  it("throws instead of truncating an over-long mode 4 message", () => {
    expect(() => encodeMaxiCode("A".repeat(94))).toThrow(CapacityError)
  })

  it("throws instead of truncating an over-long mode 5 message", () => {
    expect(() => encodeMaxiCode("A".repeat(78), { mode: 5 })).toThrow(CapacityError)
  })

  it("throws instead of truncating an over-long mode 2 secondary message", () => {
    expect(() =>
      encodeMaxiCode("A".repeat(85), {
        mode: 2,
        postalCode: "123456789",
        countryCode: 840,
        serviceClass: 1,
      }),
    ).toThrow(CapacityError)
  })

  it("rejects an unknown mode", () => {
    expect(() => encodeMaxiCode("X", { mode: 7 as 6 })).toThrow(/mode must be/)
  })
})

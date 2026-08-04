/**
 * Micro QR error correction, and QR validation of kanji input.
 *
 * Both used to answer quietly wrong: Micro QR downgraded a requested EC level
 * to L rather than saying it could not provide it, and the QR validator
 * skipped its length check entirely for kanji.
 */

import { describe, expect, it } from "vitest"
import { encodeMicroQR, validateQRInput, InvalidInputError, CapacityError } from "../src/index"

describe("Micro QR error correction", () => {
  it("refuses a level the requested version cannot provide", () => {
    // Only M4 offers Q; M2 and M3 offer L and M
    expect(() => encodeMicroQR("HI", { version: 2, ecLevel: "Q" })).toThrow(InvalidInputError)
    expect(() => encodeMicroQR("HI", { version: 3, ecLevel: "Q" })).toThrow(/only M4 offers Q/)
  })

  it("picks a version that can actually provide the requested level", () => {
    // Asking for Q must reach M4, not settle for a smaller symbol at L
    const matrix = encodeMicroQR("HI", { ecLevel: "Q" })
    expect(matrix).toHaveLength(17) // M4 is 17x17
  })

  it("still auto-selects the smallest version when no level is requested", () => {
    expect(encodeMicroQR("1").length).toBeLessThan(17)
  })

  it("reports the level in the capacity error", () => {
    expect(() => encodeMicroQR("X".repeat(40), { ecLevel: "Q" })).toThrow(CapacityError)
    expect(() => encodeMicroQR("X".repeat(40), { ecLevel: "Q" })).toThrow(/EC level Q/)
  })
})

describe("QR validation of kanji", () => {
  it("reports the kanji mode and its capacity", () => {
    const result = validateQRInput("日本語")
    expect(result.valid).toBe(true)
    expect(result.mode).toBe("kanji")
    expect(result.maxCapacity).toBeGreaterThan(0)
    expect(result.version).toBeGreaterThan(0)
  })

  it("rejects kanji input that exceeds the capacity", () => {
    const result = validateQRInput("日".repeat(2000), "H")
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/too long/i)
  })
})

describe("Micro QR capacity with a pinned version", () => {
  it("refuses data that does not fit the requested version", () => {
    // M1 holds 5 numeric characters
    expect(() => encodeMicroQR("123456", { version: 1 })).toThrow(CapacityError)
    expect(() => encodeMicroQR("123456", { version: 1 })).toThrow(/capacity is 5/)
    // M2 at EC M holds 8
    expect(() => encodeMicroQR("123456789", { version: 2, ecLevel: "M" })).toThrow(CapacityError)
  })

  it("refuses a mode the requested version cannot carry", () => {
    // M1 is numeric only; M2 has no byte mode
    expect(() => encodeMicroQR("ABCDE", { version: 1 })).toThrow(/numeric only/)
    expect(() => encodeMicroQR("hello", { version: 2 })).toThrow(InvalidInputError)
  })

  it("still encodes what does fit", () => {
    expect(encodeMicroQR("12345", { version: 1 })).toHaveLength(11)
  })
})

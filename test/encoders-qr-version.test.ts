import { describe, expect, it } from "vitest"
import { getModuleCount, getDataCapacityBits, selectMode } from "../src/encoders/qr/version"
import { planEncoding } from "../src/encoders/qr/data"
import type { ErrorCorrectionLevel, EncodingMode } from "../src/encoders/qr/types"

/** The encoder plans version and segmentation together; this is that decision. */
function selectVersion(
  text: string,
  ecLevel: ErrorCorrectionLevel = "M",
  mode?: EncodingMode,
  version?: number,
): number {
  return planEncoding(text, ecLevel, { mode, version }).version
}

describe("QR version selection", () => {
  it("selects version 1 for short numeric text", () => {
    const v = selectVersion("12345", "M", "numeric")
    expect(v).toBe(1)
    expect(getModuleCount(v)).toBe(21)
  })

  it("selects version 1 for short byte text", () => {
    const v = selectVersion("Hi", "M", "byte")
    expect(v).toBe(1)
  })

  it("selects larger version for longer text", () => {
    const short = selectVersion("Hi", "M")
    const long = selectVersion("This is a much longer string that needs more space", "M")
    expect(long).toBeGreaterThan(short)
  })

  it("selects larger version for higher EC level", () => {
    const text = "Hello World Test String"
    const vL = selectVersion(text, "L")
    const vH = selectVersion(text, "H")
    expect(vH).toBeGreaterThanOrEqual(vL)
  })

  it("respects requested version when sufficient", () => {
    const v = selectVersion("Hi", "M", "byte", 5)
    expect(v).toBe(5)
  })

  it("throws when requested version is too small", () => {
    expect(() => selectVersion("A".repeat(200), "H", "byte", 1)).toThrow()
  })

  it("throws when data exceeds all versions", () => {
    expect(() => selectVersion("A".repeat(10000), "H")).toThrow()
  })

  it("returns correct module count for each version", () => {
    expect(getModuleCount(1)).toBe(21)
    expect(getModuleCount(10)).toBe(57)
    expect(getModuleCount(20)).toBe(97)
    expect(getModuleCount(40)).toBe(177)
  })

  it("data capacity increases with version", () => {
    for (let v = 2; v <= 40; v++) {
      expect(getDataCapacityBits(v, "M")).toBeGreaterThan(getDataCapacityBits(v - 1, "M"))
    }
  })

  it("data capacity decreases with EC level", () => {
    for (let v = 1; v <= 40; v++) {
      const capL = getDataCapacityBits(v, "L")
      const capH = getDataCapacityBits(v, "H")
      expect(capL).toBeGreaterThan(capH)
    }
  })
})

describe("selectMode", () => {
  it("honours a forced mode", () => {
    expect(selectMode("12345", "byte")).toBe("byte")
    expect(selectMode("hello", "kanji")).toBe("kanji")
  })

  it("detects the mode when none is forced", () => {
    expect(selectMode("12345")).toBe("numeric")
    expect(selectMode("HELLO")).toBe("alphanumeric")
    expect(selectMode("hello")).toBe("byte")
    expect(selectMode("12345", "auto")).toBe("numeric")
  })
})

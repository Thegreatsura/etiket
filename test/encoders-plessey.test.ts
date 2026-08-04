import { describe, expect, it } from "vitest"
import { encodePlessey } from "../src/encoders/plessey"
import { barcode } from "../src/index"
import { bwipBars } from "./_bwip"

describe("Plessey", () => {
  it("encodes hex digits", () => {
    const bars = encodePlessey("1234AB")
    expect(bars.length).toBeGreaterThan(0)
    for (const b of bars) expect(b).toBeGreaterThanOrEqual(1)
  })

  it("accepts lowercase hex", () => {
    const a = encodePlessey("abcdef")
    const b = encodePlessey("ABCDEF")
    expect(a).toEqual(b)
  })

  it("throws on non-hex characters", () => {
    expect(() => encodePlessey("GHIJ")).toThrow()
  })

  it("throws on empty input", () => {
    expect(() => encodePlessey("")).toThrow()
  })

  it("different data produces different output", () => {
    const a = encodePlessey("1234")
    const b = encodePlessey("5678")
    expect(a).not.toEqual(b)
  })

  it("works via barcode() function", () => {
    const svg = barcode("1234AB", { type: "plessey" })
    expect(svg).toContain("<svg")
  })
})

describe("Plessey structure (#134)", () => {
  it("uses a constant 5-module bit pitch", () => {
    // Start (8) + 6 encoded characters x 4 bits x 2 elements + stop (9).
    const bars = encodePlessey("1234")
    expect(bars).toHaveLength(8 + 6 * 8 + 9)

    // Every bar/gap pair between the start and the termination bar sums to 5:
    // a wide bar is 3 modules plus a 2-module gap, a narrow bar 1 plus 4.
    const body = bars.slice(8, 8 + 6 * 8)
    for (let i = 0; i < body.length; i += 2) {
      expect(body[i]! + body[i + 1]!).toBe(5)
      expect([1, 3]).toContain(body[i])
      expect([2, 4]).toContain(body[i + 1])
    }
  })

  it("emits the start and stop patterns", () => {
    const bars = encodePlessey("0")
    expect(bars.slice(0, 8)).toEqual([3, 2, 3, 2, 1, 4, 3, 2])
    expect(bars.slice(-9)).toEqual([5, 4, 1, 4, 1, 2, 3, 2, 3])
  })

  it("starts and ends on a bar", () => {
    expect(encodePlessey("ABCD").length % 2).toBe(1)
  })

  it("appends 2 CRC check digits", () => {
    // "0" plus its 2 check digits is 3 encoded characters.
    expect(encodePlessey("0")).toHaveLength(8 + 3 * 8 + 9)
  })
})

describe("Plessey vs bwip-js", () => {
  const payloads = ["0", "F", "1234", "ABCD", "DEADBEEF", "0123456789", "0123456789ABCDEF"]

  for (const payload of payloads) {
    it(`matches BWIPP element widths for "${payload}"`, () => {
      expect(encodePlessey(payload)).toEqual(bwipBars("plessey", payload))
    })
  }
})

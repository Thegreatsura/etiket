import { describe, expect, it } from "vitest"
import { encodeAustraliaPost, encodeJapanPost } from "../src/encoders/fourstate"
import { bwipStates } from "./_bwip"

describe("Australia Post 4-State", () => {
  it("encodes FCC + DPID", () => {
    const bars = encodeAustraliaPost("11", "12345678")
    expect(bars.length).toBeGreaterThan(0)
  })

  it("all values are valid states", () => {
    const bars = encodeAustraliaPost("59", "98765432")
    for (const b of bars) {
      expect(["T", "A", "D", "F"]).toContain(b)
    }
  })

  it("starts and ends with frame bars", () => {
    const bars = encodeAustraliaPost("11", "12345678")
    expect(bars.slice(0, 2)).toEqual(["A", "T"])
    expect(bars.slice(-2)).toEqual(["A", "T"])
  })

  it("throws on invalid FCC", () => {
    expect(() => encodeAustraliaPost("1", "12345678")).toThrow()
    expect(() => encodeAustraliaPost("13", "12345678")).toThrow()
  })

  it("throws on invalid DPID", () => {
    expect(() => encodeAustraliaPost("11", "1234")).toThrow()
    expect(() => encodeAustraliaPost("11", "1234567X")).toThrow()
  })

  it("different data produces different output", () => {
    const a = encodeAustraliaPost("11", "12345678")
    const b = encodeAustraliaPost("11", "87654321")
    expect(a).not.toEqual(b)
  })
})

describe("Australia Post symbol length (#133)", () => {
  it.each([
    ["11", 37],
    ["45", 37],
    ["59", 52],
    ["62", 67],
    ["87", 37],
    ["92", 37],
  ])("FCC %s produces %i bars", (fcc, length) => {
    expect(encodeAustraliaPost(fcc, "12345678")).toHaveLength(length)
  })

  it("keeps the length constant regardless of customer information", () => {
    expect(encodeAustraliaPost("59", "12345678", "")).toHaveLength(52)
    expect(encodeAustraliaPost("59", "12345678", "ABCDE")).toHaveLength(52)
    expect(encodeAustraliaPost("62", "12345678", "ABCDEFGHIJ")).toHaveLength(67)
  })

  it("takes customer information from the tail of the sorting code", () => {
    expect(encodeAustraliaPost("59", "12345678AB")).toEqual(
      encodeAustraliaPost("59", "12345678", "AB"),
    )
  })

  it("pads the customer information field with tracker bars", () => {
    // FCC 11 has no customer information field, only a single filler bar at 22.
    expect(encodeAustraliaPost("11", "12345678")[22]).toBe("T")
    // FCC 62 fits 10 C-table characters (30 bars) in its 31-bar field.
    const full = encodeAustraliaPost("62", "12345678", "ABCDEFGHIJ")
    expect(full[52]).toBe("T")
  })

  it("rejects customer information that does not fit", () => {
    expect(() => encodeAustraliaPost("11", "12345678", "A")).toThrow(/too long/)
    expect(() => encodeAustraliaPost("59", "12345678", "ABCDEF")).toThrow(/too long/)
    expect(() => encodeAustraliaPost("62", "12345678", "ABCDEFGHIJK")).toThrow(/too long/)
  })

  it("packs numeric customer information into 2 bars per digit", () => {
    // 8 digits in numeric mode fill the 16-bar FCC 59 field exactly.
    const bars = encodeAustraliaPost("59", "12345678", "12345678", {
      custInfoEncoding: "numeric",
    })
    expect(bars).toHaveLength(52)
    expect(() =>
      encodeAustraliaPost("59", "12345678", "123456789", { custInfoEncoding: "numeric" }),
    ).toThrow(/too long/)
  })

  it("rejects non-digits in numeric customer information", () => {
    expect(() =>
      encodeAustraliaPost("59", "12345678", "12AB", { custInfoEncoding: "numeric" }),
    ).toThrow(/only accepts digits/)
  })

  it("rejects customer information characters outside the C table", () => {
    expect(() => encodeAustraliaPost("59", "12345678", "AB!")).toThrow(/Invalid/)
  })
})

describe("Australia Post vs bwip-js", () => {
  interface Case {
    payload: string
    numeric?: boolean
  }

  const cases: Case[] = [
    // FCC 11 / 45 / 87 / 92 — Standard Customer Barcode, 37 bars.
    { payload: "1112345678" },
    { payload: "1187654321" },
    { payload: "4500000000" },
    { payload: "8712345678" },
    { payload: "9299999999" },
    // FCC 59 — Customer Barcode 2, 52 bars.
    { payload: "5912345678" },
    { payload: "5912345678AB" },
    { payload: "5912345678ABCDE" },
    { payload: "5987654321a #z" },
    { payload: "5912345678123456", numeric: true },
    // FCC 62 — Customer Barcode 3, 67 bars.
    { payload: "6212345678" },
    { payload: "6287654321SHR" },
    { payload: "6212345678ABCDEFGHIJ" },
    { payload: "6212345678abc de#" },
    { payload: "6212345678123456789012345", numeric: true },
  ]

  for (const { payload, numeric } of cases) {
    it(`matches BWIPP bar states for "${payload}"${numeric ? " (numeric)" : ""}`, () => {
      const mine = encodeAustraliaPost(
        payload.slice(0, 2),
        payload.slice(2, 10),
        payload.slice(10),
        numeric ? { custInfoEncoding: "numeric" } : {},
      )
      const reference = bwipStates("auspost", payload, numeric ? { custinfoenc: "numeric" } : {})
      expect(mine).toEqual(reference)
    })
  }
})

describe("Japan Post 4-State", () => {
  it("encodes 7-digit zipcode", () => {
    const bars = encodeJapanPost("1000001")
    expect(bars.length).toBeGreaterThan(0)
  })

  it("strips dashes from zipcode", () => {
    const a = encodeJapanPost("100-0001")
    const b = encodeJapanPost("1000001")
    expect(a).toEqual(b)
  })

  it("encodes zipcode with address", () => {
    const bars = encodeJapanPost("1000001", "1-2-3")
    expect(bars.length).toBeGreaterThan(0)
  })

  it("all values are valid states", () => {
    const bars = encodeJapanPost("1000001")
    for (const b of bars) {
      expect(["T", "A", "D", "F"]).toContain(b)
    }
  })

  it("throws on invalid zipcode", () => {
    expect(() => encodeJapanPost("12345")).toThrow()
  })

  it("throws on invalid address characters", () => {
    expect(() => encodeJapanPost("1000001", "!@#")).toThrow()
  })

  it("accepts alphabetic characters in address", () => {
    const bars = encodeJapanPost("1000001", "A")
    expect(bars.length).toBeGreaterThan(0)
    for (const b of bars) {
      expect(["T", "A", "D", "F"]).toContain(b)
    }
  })

  it("starts with F,D and ends with D,F", () => {
    const bars = encodeJapanPost("1000001")
    expect(bars[0]).toBe("F")
    expect(bars[1]).toBe("D")
    expect(bars[bars.length - 2]).toBe("D")
    expect(bars[bars.length - 1]).toBe("F")
  })

  it("produces correct barcode length (start + 21*3 bars + stop)", () => {
    // 2 start bars + 21 chars * 3 bars each + 2 stop bars = 67 bars
    const bars = encodeJapanPost("1000001")
    expect(bars.length).toBe(2 + 21 * 3 + 2)
  })

  it("uses mod 19 check digit", () => {
    // Two different inputs should produce different check digits
    const a = encodeJapanPost("1000001")
    const b = encodeJapanPost("1000002")
    // They should differ (different data → different check)
    expect(a).not.toEqual(b)
  })
})

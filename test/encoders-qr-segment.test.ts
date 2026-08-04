import { describe, expect, it } from "vitest"
import { optimizeSegments } from "../src/encoders/qr/segment"

describe("QR segment optimization", () => {
  it("returns empty for empty string", () => {
    expect(optimizeSegments("", 1)).toEqual([])
  })

  it("pure numeric → single numeric segment", () => {
    const segs = optimizeSegments("12345678", 1)
    expect(segs.length).toBe(1)
    expect(segs[0]!.mode).toBe("numeric")
    expect(segs[0]!.charCount).toBe(8)
  })

  it("pure alphanumeric → single alphanumeric segment", () => {
    const segs = optimizeSegments("HELLO WORLD", 1)
    expect(segs.length).toBe(1)
    expect(segs[0]!.mode).toBe("alphanumeric")
  })

  it("pure byte → single byte segment", () => {
    const segs = optimizeSegments("hello world", 1)
    expect(segs.length).toBe(1)
    expect(segs[0]!.mode).toBe("byte")
  })

  it("long numeric run after text switches to numeric", () => {
    // 20 digits is long enough to justify a mode switch
    const segs = optimizeSegments("ABC" + "1".repeat(20), 1)
    expect(segs.length).toBe(2)
    expect(segs[0]!.mode).toBe("alphanumeric")
    expect(segs[1]!.mode).toBe("numeric")
  })

  it("short numeric run in alphanumeric stays alphanumeric", () => {
    // "AB12CD" — the "12" is too short to justify switching to numeric
    const segs = optimizeSegments("AB12CD", 1)
    // Should be 1 or 2 segments, but 12 should NOT be a separate numeric segment
    // because alphanumeric can encode digits too
    const modes = segs.map((s) => s.mode)
    expect(modes).not.toContain("numeric")
  })

  it("preserves all characters", () => {
    const text = "ABC123def456"
    const segs = optimizeSegments(text, 1)
    const reconstructed = segs
      .map((s) => (typeof s.data === "string" ? s.data : new TextDecoder().decode(s.data)))
      .join("")
    expect(reconstructed).toBe(text)
  })

  it("only puts a character in a mode that can encode it", () => {
    for (const seg of optimizeSegments("Hello 123 WORLD-42/ok", 1)) {
      const text = typeof seg.data === "string" ? seg.data : new TextDecoder().decode(seg.data)
      if (seg.mode === "numeric") expect(text).toMatch(/^\d+$/)
      if (seg.mode === "alphanumeric") expect(text).toMatch(/^[\dA-Z $%*+\-./:]+$/)
    }
  })

  it("never costs more than encoding everything as bytes", () => {
    const text = "PRODUCT-12345678901234567890/BATCH-99"
    const segs = optimizeSegments(text, 1)
    const segmentedBits = segs.reduce((sum, s) => {
      const perChar = s.mode === "numeric" ? 10 / 3 : s.mode === "alphanumeric" ? 5.5 : 8
      return sum + 4 + 10 + Math.ceil(s.charCount * perChar)
    }, 0)
    expect(segmentedBits).toBeLessThan(4 + 8 + text.length * 8)
  })

  it("works at higher versions", () => {
    const segs = optimizeSegments("12345ABCDE", 20)
    expect(segs.length).toBeGreaterThanOrEqual(1)
  })

  it("all segments have valid modes", () => {
    const segs = optimizeSegments("Hello 123 World!", 5)
    for (const seg of segs) {
      expect(["numeric", "alphanumeric", "byte"]).toContain(seg.mode)
      expect(seg.charCount).toBeGreaterThan(0)
    }
  })
})

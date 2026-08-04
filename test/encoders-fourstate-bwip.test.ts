/**
 * RM4SCC and KIX bar patterns verified against bwip-js (BWIPP).
 *
 * There is no JavaScript decoder for the 4-state postal symbologies, so the
 * reference implementation's rendered bars are the oracle: each bar's vertical
 * extent tells us whether it is a tracker, ascender, descender or full bar.
 */

import { describe, expect, it } from "vitest"
import { toSVG } from "bwip-js/node"
import { encodeRM4SCC, encodeKIX } from "../src/index"
import type { FourState } from "../src/encoders/fourstate"

/** Read the bar states out of a bwip-js 4-state rendering */
function bwipStates(bcid: string, text: string): FourState[] {
  const svg = toSVG({ bcid, text, includetext: false })
  const path = /<path[^>]*d="([^"]+)"/.exec(svg)![1]!
  const height = Number(/viewBox="0 0 [\d.]+ ([\d.]+)"/.exec(svg)![1])
  const segments = [...path.matchAll(/M([\d.]+) ([\d.]+)L[\d.]+ ([\d.]+)/g)]
  return segments.map(([, , y1, y2]) => {
    // SVG y grows downward: y === 0 is the top of the symbol
    const top = Math.min(Number(y1), Number(y2))
    const bottom = Math.max(Number(y1), Number(y2))
    const hasAscender = top < height * 0.2
    const hasDescender = bottom > height * 0.8
    if (hasAscender && hasDescender) return "F"
    if (hasAscender) return "A"
    if (hasDescender) return "D"
    return "T"
  })
}

const RM4SCC_SAMPLES = ["SN34RD1A", "LE28HS9Z", "BX119NH4", "0123456789", "ABCDEFGHIJ"]
const KIX_SAMPLES = ["1231FZ13XHS", "2500GG11XX", "0123456789", "ABCDEFGHIJ", "ZWOLLE1"]

describe("RM4SCC bars match bwip-js", () => {
  it.each(RM4SCC_SAMPLES)("encodes %s identically", (sample) => {
    expect(encodeRM4SCC(sample)).toEqual(bwipStates("royalmail", sample))
  })

  it("starts with an ascender and ends with a full bar", () => {
    const bars = encodeRM4SCC("SN34RD1A")
    expect(bars[0]).toBe("A")
    expect(bars.at(-1)).toBe("F")
  })

  it("appends the check character", () => {
    // 8 data characters + check, 4 bars each, plus start and stop
    expect(encodeRM4SCC("SN34RD1A")).toHaveLength(9 * 4 + 2)
  })
})

describe("KIX bars match bwip-js", () => {
  it.each(KIX_SAMPLES)("encodes %s identically", (sample) => {
    expect(encodeKIX(sample)).toEqual(bwipStates("kix", sample))
  })

  it("has no start/stop bars and no check character", () => {
    expect(encodeKIX("ABCD")).toHaveLength(4 * 4)
  })
})

describe("4-state alphabet invariants", () => {
  const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"

  it.each([...ALPHABET])(
    "gives %s exactly two ascenders and two descenders in both alphabets",
    (ch) => {
      for (const bars of [encodeKIX(ch), encodeRM4SCC(ch).slice(1, 5)]) {
        expect(bars).toHaveLength(4)
        expect(bars.filter((b) => b === "A" || b === "F")).toHaveLength(2)
        expect(bars.filter((b) => b === "D" || b === "F")).toHaveLength(2)
      }
    },
  )

  it("assigns a distinct pattern to every character", () => {
    const seen = new Set([...ALPHABET].map((ch) => encodeKIX(ch).join("")))
    expect(seen.size).toBe(36)
  })
})

/**
 * GS1 Composite 2D component cross-verified against BWIPP's `gs1-cc` encoder.
 *
 * BWIPP is the reference implementation of ISO/IEC 24723; comparing module for
 * module is the only way to know the composite-specific encodation (encodation
 * method field, compressed data field, general purpose field compaction and the
 * base-928 / byte codeword mapping) is right.
 */

import { describe, expect, it } from "vitest"
import { encodeGS1Composite } from "../src/encoders/gs1-composite"
import { bwipMatrix, describeDiff } from "./_bwip"

/** Flatten a module matrix into one string per row. */
function rows(matrix: boolean[][]): string[] {
  return matrix.map((row) => row.map((m) => (m ? "1" : "0")).join(""))
}

function expectMatches(
  payload: string,
  version: "CC-A" | "CC-B" | "CC-C",
  columns: number,
  extra: Record<string, unknown> = {},
): void {
  const actual = rows(encodeGS1Composite(payload, { type: version, columns }).composite)
  const expected = rows(
    bwipMatrix("gs1-cc", payload, {
      ccversion: version.slice(-1).toLowerCase(),
      cccolumns: columns,
      ...extra,
    }),
  )
  expect(
    actual,
    `${payload} (${version}, ${columns} cols): ${describeDiff(actual, expected)}`,
  ).toEqual(expected)
}

/** Payloads exercising every encodation method and every compaction mode. */
const PAYLOADS = [
  // Method 0 — general purpose field only
  "(21)SERIAL01",
  "(21)12345",
  "(8200)HTTP://A.B",
  "(30)25",
  // Method 10 — (11)/(17) date, with and without a following (10)
  "(17)260101(10)BATCH01",
  "(11)990102",
  "(17)260101",
  "(10)LOT123",
  "(10)AB",
  "(11)990102(10)ABC123",
  // Method 11 — AI (90)
  "(90)ABC",
  "(90)1A2B3C4D5E",
  "(90)12X",
  "(90)9AB(21)SER1",
  "(90)123Z(8004)0123456789",
  // Mixed and lower case (ISO 646 compaction)
  "(21)abc-123",
  "(240)ABC/def_9",
  "(91)1A2B3C4D5E",
]

describe("GS1 Composite — CC-A vs bwip-js", () => {
  for (const payload of PAYLOADS) {
    for (const columns of [2, 3, 4]) {
      it(`${payload} (${columns} columns)`, () => {
        expectMatches(payload, "CC-A", columns)
      })
    }
  }
})

describe("GS1 Composite — CC-B vs bwip-js", () => {
  for (const payload of PAYLOADS) {
    for (const columns of [2, 3, 4]) {
      it(`${payload} (${columns} columns)`, () => {
        expectMatches(payload, "CC-B", columns)
      })
    }
  }
})

describe("GS1 Composite — CC-B for data that overflows CC-A", () => {
  const long = [
    "(10)ABCDEFGHIJKLMNOPQRST",
    "(21)123456789012345678",
    "(17)260101(10)ABCDEFGHIJKLMNOP",
    "(91)ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  ]
  for (const payload of long) {
    for (const columns of [2, 3, 4]) {
      it(`${payload} (${columns} columns)`, () => {
        expectMatches(payload, "CC-B", columns)
      })
    }
  }
})

describe("GS1 Composite — CC-C vs bwip-js", () => {
  const payloads = [
    "(10)ABCDEFGHIJKLMNOPQRST",
    "(21)SERIAL01",
    "(17)260101(10)BATCH01",
    "(91)ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  ]
  for (const payload of payloads) {
    for (const columns of [2, 4]) {
      it(`${payload} (${columns} columns)`, () => {
        expectMatches(payload, "CC-C", columns)
      })
    }
  }
})

describe("GS1 Composite — CC-A upgrades to CC-B", () => {
  it("reports the version it settled on", () => {
    const small = encodeGS1Composite("(10)AB", { type: "CC-A", columns: 4 })
    expect(small.type).toBe("CC-A")

    const large = encodeGS1Composite("(91)ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", {
      type: "CC-A",
      columns: 4,
    })
    expect(large.type).toBe("CC-B")
  })

  it("the upgraded symbol still matches bwip-js", () => {
    const payload = "(91)ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    const actual = rows(encodeGS1Composite(payload, { type: "CC-A", columns: 4 }).composite)
    const expected = rows(bwipMatrix("gs1-cc", payload, { ccversion: "a", cccolumns: 4 }))
    expect(actual).toEqual(expected)
  })
})

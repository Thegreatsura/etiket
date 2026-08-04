/**
 * The error paths.
 *
 * Every guard here was uncovered before: the code rejected bad input, but
 * nothing checked that it rejected the *right* input with a message a caller
 * can act on. A validator that has never been observed rejecting anything is a
 * validator you cannot rely on.
 */

import { describe, expect, it } from "vitest"
import {
  barcodeBase64,
  barcodeDataURI,
  barcodePNG,
  encodeAztec,
  encodeAustraliaPost,
  encodeDataMatrix,
  encodeGS1128,
  encodeHIBCPrimary,
  encodeHIBCSecondary,
  encodeISBT128DIN,
  encodeJapanPost,
  encodeKIX,
  encodePDF417,
  encodeRM4SCC,
  InvalidInputError,
  CapacityError,
} from "../src/index"
import { parseHexColor } from "../src/renderers/png/types"

describe("hex colours", () => {
  it("expands the three-digit shorthand", () => {
    expect(parseHexColor("#f00")).toEqual([255, 0, 0])
    expect(parseHexColor("0f0")).toEqual([0, 255, 0])
  })

  it("accepts both the hashed and bare six-digit forms", () => {
    expect(parseHexColor("#123456")).toEqual([0x12, 0x34, 0x56])
    expect(parseHexColor("123456")).toEqual([0x12, 0x34, 0x56])
  })

  it("rejects anything else", () => {
    expect(() => parseHexColor("#12345")).toThrow(InvalidInputError)
    expect(() => parseHexColor("nope!!")).toThrow(/Invalid hex color/)
    expect(() => parseHexColor("")).toThrow(/Invalid hex color/)
  })

  it("surfaces through the PNG entry points", () => {
    expect(() => barcodePNG("123456", { color: "not-a-colour" })).toThrow(InvalidInputError)
    expect(() => barcodePNG("123456", { background: "#xyz" })).toThrow(InvalidInputError)
  })
})

describe("HIBC validation", () => {
  it("rejects a malformed labeller identification code", () => {
    expect(() => encodeHIBCPrimary("AB", "1234", 0)).toThrow(/LIC must be 4 characters/)
    expect(() => encodeHIBCPrimary("1ABC", "1234", 0)).toThrow(/LIC must be 4 characters/)
  })

  it("rejects a product number of the wrong length", () => {
    expect(() => encodeHIBCPrimary("A123", "", 0)).toThrow(/product number must be 1-18/)
    expect(() => encodeHIBCPrimary("A123", "X".repeat(19), 0)).toThrow(/product number must be/)
  })

  it("rejects a unit of measure outside 0-9", () => {
    expect(() => encodeHIBCPrimary("A123", "1234", 10)).toThrow(/unit of measure must be 0-9/)
    expect(() => encodeHIBCPrimary("A123", "1234", -1)).toThrow(/unit of measure must be 0-9/)
  })

  it("rejects characters outside the HIBC set", () => {
    expect(() => encodeHIBCPrimary("A123", "ab!", 0)).toThrow(/invalid characters/)
  })

  it("requires the secondary to carry something", () => {
    expect(() => encodeHIBCSecondary()).toThrow(/at least expiry or lot/)
  })

  it("rejects an expiry that is not a recognised length", () => {
    expect(() => encodeHIBCSecondary("20260")).toThrow(/YYMM, YYMMDD/)
  })

  it("rejects a lot number outside the HIBC character set", () => {
    expect(() => encodeHIBCSecondary(undefined, "lot!")).toThrow(/invalid characters/)
  })
})

describe("ISBT 128 validation", () => {
  it("rejects a malformed donation identification number", () => {
    expect(() => encodeISBT128DIN("X", "26", "123456")).toThrow(InvalidInputError)
    expect(() => encodeISBT128DIN("A999", "2X", "123456")).toThrow(InvalidInputError)
  })
})

describe("4-state character sets", () => {
  it("rejects characters RM4SCC cannot encode", () => {
    expect(() => encodeRM4SCC("SN34-RD1A")).toThrow(/only accepts A-Z and 0-9/)
  })

  it("rejects characters KIX cannot encode", () => {
    expect(() => encodeKIX("1231fz13xhs!")).toThrow(/only accepts A-Z and 0-9/)
  })

  it("rejects a malformed Australia Post FCC or DPID", () => {
    expect(() => encodeAustraliaPost("1", "12345678")).toThrow(InvalidInputError)
    expect(() => encodeAustraliaPost("11", "1234")).toThrow(InvalidInputError)
  })

  it("rejects a malformed Japan Post postal code", () => {
    expect(() => encodeJapanPost("")).toThrow(InvalidInputError)
  })
})

describe("capacity limits", () => {
  it("reports PDF417 overflow rather than truncating", () => {
    expect(() => encodePDF417("X".repeat(3000))).toThrow(CapacityError)
  })

  it("validates the PDF417 error correction level and column count", () => {
    expect(() => encodePDF417("hi", { ecLevel: -1 })).toThrow(/EC level must be 0-8/)
    expect(() => encodePDF417("hi", { ecLevel: 9 })).toThrow(/EC level must be 0-8/)
    expect(() => encodePDF417("hi", { columns: 0 })).toThrow(/columns must be/)
    expect(() => encodePDF417("hi", { columns: 31 })).toThrow(/columns must be/)
  })

  it("reports Data Matrix overflow", () => {
    expect(() => encodeDataMatrix("X".repeat(5000))).toThrow(CapacityError)
  })

  it("rejects empty input consistently", () => {
    for (const call of [
      () => encodeDataMatrix(""),
      () => encodePDF417(""),
      () => encodeAztec(""),
      () => encodeGS1128(""),
    ]) {
      expect(call).toThrow(InvalidInputError)
    }
  })
})

describe("output helpers actually run", () => {
  it("produces a base64 SVG data URI", () => {
    const encoded = barcodeBase64("HELLO", { type: "code128" })
    expect(encoded).toMatch(/^data:image\/svg\+xml;base64,/)
    // Decoding the payload gets the SVG back
    const payload = encoded.slice(encoded.indexOf(",") + 1)
    expect(Buffer.from(payload, "base64").toString("utf8")).toContain("<svg")
  })

  it("produces a data URI", () => {
    expect(barcodeDataURI("HELLO", { type: "code128" })).toMatch(/^data:image\/svg\+xml/)
  })
})

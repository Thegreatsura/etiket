/**
 * Everything the public API throws must be an EtiketError, otherwise
 * `catch (e) { if (e instanceof EtiketError) … }` — the pattern the docs
 * recommend — silently misses cases.
 */

import { describe, expect, it } from "vitest"
import {
  EtiketError,
  InvalidInputError,
  CapacityError,
  CheckDigitError,
  barcode,
  barcodePNG,
  encodeBars,
  encodeEAN13,
  encodeEAN8,
  encodeUPCA,
  encodeUPCE,
  encodeITF14,
  encodeIdentcode,
  encodeLeitcode,
  encodeQR,
  encodeAztec,
  encodePDF417,
  encodeDataMatrix,
  qrcode,
} from "../src/index"
import type { BarcodeType } from "../src/index"

/** Every call here must throw, and every throw must be an EtiketError */
const THROWING_CALLS: [string, () => unknown][] = [
  ["unknown barcode type", () => encodeBars("123", { type: "nope" as BarcodeType })],
  ["barcode() with a bad type", () => barcode("123", { type: "nope" as BarcodeType })],
  ["EAN-13 with letters", () => encodeEAN13("ABCDEFGHIJKLM")],
  ["EAN-13 wrong check digit", () => encodeEAN13("4006381333932")],
  ["EAN-8 wrong check digit", () => encodeEAN8("96385079")],
  ["UPC-A wrong check digit", () => encodeUPCA("036000291453")],
  ["ITF-14 wrong check digit", () => encodeITF14("00012345678906")],
  ["Identcode with the wrong length", () => encodeIdentcode("12345")],
  ["Leitcode with the wrong length", () => encodeLeitcode("12345")],
  ["QR with no data", () => encodeQR("")],
  ["QR too long for the version", () => encodeQR("X".repeat(200), { version: 1 })],
  ["QR with a bad ECI", () => encodeQR("hi", { eci: -5 })],
  ["Data Matrix with no data", () => encodeDataMatrix("")],
  ["Data Matrix over capacity", () => encodeDataMatrix("X".repeat(5000))],
  ["Data Matrix with an unknown size", () => encodeDataMatrix("hi", { symbolSize: "5x5" })],
  ["PDF417 with no data", () => encodePDF417("")],
  ["PDF417 with a bad EC level", () => encodePDF417("hi", { ecLevel: 99 })],
  ["PDF417 with a bad column count", () => encodePDF417("hi", { columns: 99 })],
  ["PDF417 with a bad ECI", () => encodePDF417("hi", { eci: 9_000_000 })],
  ["Aztec with no data", () => encodeAztec("")],
  ["PNG with a bad colour", () => barcodePNG("123456", { color: "not-a-colour" })],
  ["QR SVG with no data", () => qrcode("")],
]

describe("error hierarchy", () => {
  it.each(THROWING_CALLS)("%s throws an EtiketError", (_label, call) => {
    expect(call).toThrow(EtiketError)
  })

  it("makes CheckDigitError catchable as InvalidInputError", () => {
    // Check-digit failures are a kind of invalid input, so the broader catch
    // must still work for code written before CheckDigitError existed
    expect(() => encodeEAN13("4006381333932")).toThrow(InvalidInputError)
    expect(() => encodeEAN13("4006381333932")).toThrow(CheckDigitError)
    expect(new CheckDigitError("x")).toBeInstanceOf(InvalidInputError)
    expect(new CheckDigitError("x")).toBeInstanceOf(EtiketError)
  })

  it("uses CheckDigitError for every check-digit mismatch", () => {
    // For each symbology, exactly one of the ten possible final digits is
    // correct — the other nine must raise CheckDigitError, nothing else.
    const cases: [string, string, (value: string) => unknown][] = [
      ["EAN-13", "400638133393", (v) => encodeEAN13(v)],
      ["EAN-8", "9638507", (v) => encodeEAN8(v)],
      ["UPC-A", "03600029145", (v) => encodeUPCA(v)],
      ["UPC-E", "0123456", (v) => encodeUPCE(v)],
      ["ITF-14", "0001234567890", (v) => encodeITF14(v)],
      ["Identcode", "56310243031", (v) => encodeIdentcode(v)],
      ["Leitcode", "2134807501650", (v) => encodeLeitcode(v)],
    ]

    for (const [label, prefix, call] of cases) {
      let rejected = 0
      for (let digit = 0; digit <= 9; digit++) {
        try {
          call(prefix + digit)
        } catch (error) {
          expect(error, `${label} with check digit ${digit}`).toBeInstanceOf(CheckDigitError)
          rejected++
        }
      }
      expect(rejected, `${label}: exactly one check digit should be accepted`).toBe(9)
    }
  })

  it("uses CapacityError when data does not fit", () => {
    expect(() => encodeQR("X".repeat(200), { version: 1 })).toThrow(CapacityError)
    expect(() => encodeDataMatrix("X".repeat(5000))).toThrow(CapacityError)
  })

  it("keeps the class name on the instance", () => {
    for (const Cls of [EtiketError, InvalidInputError, CapacityError, CheckDigitError]) {
      expect(new Cls("boom").name).toBe(Cls.name)
      expect(new Cls("boom").message).toBe("boom")
    }
  })
})

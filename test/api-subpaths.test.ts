/**
 * The subpath entries and package.json#exports must stay in step with each
 * other and with the main entry. Drift here is invisible until a user tries the
 * obvious import and it fails, which is how `etiket/qr` ended up without any of
 * the QR helpers.
 */

import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import * as main from "../src/index"
import * as barcodeEntry from "../src/barcode"
import * as qrEntry from "../src/qr"
import * as postalEntry from "../src/postal"
import * as datamatrixEntry from "../src/datamatrix"
import * as pdf417Entry from "../src/pdf417"
import * as aztecEntry from "../src/aztec"
import * as twoDEntry from "../src/2d"
import * as pngEntry from "../src/png"
import * as errorsEntry from "../src/errors"
import * as validatorsEntry from "../src/validators/index"

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
) as {
  exports: Record<string, { types?: string; default?: string } | string>
}

const ENTRIES: Record<string, Record<string, unknown>> = {
  ".": main,
  "./barcode": barcodeEntry,
  "./qr": qrEntry,
  "./postal": postalEntry,
  "./datamatrix": datamatrixEntry,
  "./pdf417": pdf417Entry,
  "./aztec": aztecEntry,
  "./2d": twoDEntry,
  "./png": pngEntry,
  "./errors": errorsEntry,
  "./validators": validatorsEntry,
}

describe("package.json exports", () => {
  it("declares every subpath the source provides, and nothing more", () => {
    const declared = Object.keys(pkg.exports).filter((key) => key !== "./package.json")
    expect(declared.sort()).toEqual(Object.keys(ENTRIES).sort())
  })

  it("points every subpath at a matching dist file", () => {
    for (const [key, value] of Object.entries(pkg.exports)) {
      if (key === "./package.json") continue
      const entry = value as { types: string; default: string }
      expect(entry.types, key).toMatch(/^\.\/dist\/.+\.d\.mts$/)
      expect(entry.default, key).toMatch(/^\.\/dist\/.+\.mjs$/)
      expect(entry.types.replace(/\.d\.mts$/, ""), key).toBe(entry.default.replace(/\.mjs$/, ""))
    }
  })
})

describe("subpath entries", () => {
  it("re-export nothing the main entry does not also export", () => {
    for (const [name, entry] of Object.entries(ENTRIES)) {
      if (name === ".") continue
      const missing = Object.keys(entry).filter((key) => !(key in main))
      expect(missing, `${name} exports symbols missing from the main entry`).toEqual([])
    }
  })

  it("give every export the same identity as the main entry", () => {
    for (const [name, entry] of Object.entries(ENTRIES)) {
      if (name === ".") continue
      for (const [key, value] of Object.entries(entry)) {
        expect(value, `${name} → ${key}`).toBe((main as Record<string, unknown>)[key])
      }
    }
  })
})

describe("the obvious import works", () => {
  it("has the QR payload helpers on etiket/qr", () => {
    for (const helper of [
      "wifi",
      "url",
      "email",
      "sms",
      "geo",
      "phone",
      "vcard",
      "mecard",
      "event",
      "swissQR",
      "gs1DigitalLink",
      "qrcodePNG",
      "validateQRInput",
    ]) {
      expect(qrEntry, `etiket/qr → ${helper}`).toHaveProperty(helper)
    }
  })

  it("has validation, errors and the industry encoders on etiket/barcode", () => {
    for (const name of [
      "validateBarcode",
      "isValidInput",
      "calculateEANCheckDigit",
      "InvalidInputError",
      "encodeGS1Composite",
      "encodeHIBCPrimary",
      "encodeISBT128DIN",
      "barcodePNG",
      "svgToDataURI",
    ]) {
      expect(barcodeEntry, `etiket/barcode → ${name}`).toHaveProperty(name)
    }
  })

  it("has every remaining 2D symbology on etiket/2d", () => {
    for (const name of [
      "maxicode",
      "dotcode",
      "hanxin",
      "micropdf417",
      "codablockf",
      "code16k",
      "jabcode",
      "encodeMaxiCode",
      "encodeDotCode",
      "encodeHanXin",
      "encodeMicroPDF417",
      "encodeCodablockF",
      "encodeCode16K",
      "encodeJABCode",
    ]) {
      expect(twoDEntry, `etiket/2d → ${name}`).toHaveProperty(name)
    }
  })

  it("has the error hierarchy on etiket/errors", () => {
    for (const name of ["EtiketError", "InvalidInputError", "CapacityError", "CheckDigitError"]) {
      expect(errorsEntry, `etiket/errors → ${name}`).toHaveProperty(name)
    }
  })
})

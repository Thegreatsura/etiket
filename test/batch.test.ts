/**
 * Batch generation and label sheets.
 *
 * The sheet is the part that cannot be done with a `map()`, so it gets the most
 * attention here: the grid geometry, the captions, and the fact that each cell
 * still holds a symbol a reader can find.
 */

import { describe, expect, it } from "vitest"
import { barcodes, qrcodes, barcodeSheet, qrcodeSheet, barcode, qrcode } from "../src/index"

describe("barcodes()", () => {
  it("produces one SVG per value", () => {
    const svgs = barcodes(["SKU-001", "SKU-002", "SKU-003"], { type: "code128" })
    expect(svgs).toHaveLength(3)
    for (const svg of svgs) expect(svg).toContain("<svg")
  })

  it("matches barcode() called one at a time", () => {
    const options = { type: "code128", height: 40, showText: true } as const
    expect(barcodes(["A1", "B2"], options)).toEqual([
      barcode("A1", options),
      barcode("B2", options),
    ])
  })

  it("reports progress", () => {
    const seen: [number, number][] = []
    barcodes(["A", "B", "C"], { onProgress: (done, total) => seen.push([done, total]) })
    expect(seen).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ])
  })

  it("returns nothing for an empty list", () => {
    expect(barcodes([])).toEqual([])
  })

  it("propagates an encoding failure rather than skipping the value", () => {
    expect(() => barcodes(["12345", "not-numeric"], { type: "ean13" })).toThrow()
  })
})

describe("qrcodes()", () => {
  it("produces one SVG per value", () => {
    const svgs = qrcodes(["https://example.com/1", "https://example.com/2"], { size: 120 })
    expect(svgs).toHaveLength(2)
    expect(svgs[0]).not.toBe(svgs[1])
  })

  it("matches qrcode() called one at a time", () => {
    expect(qrcodes(["ONE"], { size: 100 })).toEqual([qrcode("ONE", { size: 100 })])
  })
})

describe("barcodeSheet()", () => {
  it("puts every symbol in one document", () => {
    const sheet = barcodeSheet(["SKU-001", "SKU-002", "SKU-003", "SKU-004"], {
      type: "code128",
      columns: 2,
    })
    // One outer <svg> and four groups, not four documents
    expect(sheet.match(/<svg/g)).toHaveLength(1)
    expect(sheet.match(/<g transform="translate\(/g)).toHaveLength(4)
  })

  it("lays out the requested number of columns", () => {
    const four = barcodeSheet(["A", "B", "C", "D"], { type: "code128", columns: 4 })
    const one = barcodeSheet(["A", "B", "C", "D"], { type: "code128", columns: 1 })
    const wide = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(four)!
    const tall = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(one)!
    expect(Number(wide[1])).toBeGreaterThan(Number(tall[1]))
    expect(Number(tall[2])).toBeGreaterThan(Number(wide[2]))
  })

  it("captions each cell with its value by default", () => {
    const sheet = barcodeSheet(["SKU-001", "SKU-002"], { type: "code128" })
    expect(sheet).toContain(">SKU-001<")
    expect(sheet).toContain(">SKU-002<")
  })

  it("accepts explicit captions and drops them on request", () => {
    expect(barcodeSheet(["A", "B"], { labels: ["left", "right"] })).toContain(">left<")
    expect(barcodeSheet(["A", "B"], { labels: false })).not.toContain("<text")
  })

  it("escapes captions", () => {
    const sheet = barcodeSheet(["A"], { labels: ['<script>"&'] })
    expect(sheet).not.toContain("<script>")
    expect(sheet).toContain("&lt;script&gt;")
  })

  it("paints one background for the whole sheet, not one per cell", () => {
    // A cell's own `width="100%"` rect would cover everything drawn before it,
    // so cells are transparent and the sheet paints the background once
    const sheet = barcodeSheet(["A", "B", "C"], { background: "#eee" })
    expect(sheet.match(/<rect width="100%"/g)).toHaveLength(1)
    expect(sheet).toContain('fill="#eee"')
  })

  it("can be transparent", () => {
    expect(barcodeSheet(["A"], { background: "transparent" })).not.toContain('<rect width="100%"')
  })

  it("carries an accessible name", () => {
    expect(barcodeSheet(["A"], { ariaLabel: "Pick list" })).toContain('aria-label="Pick list"')
  })

  it("rejects an empty sheet and a nonsense column count", () => {
    expect(() => barcodeSheet([])).toThrow(/at least one symbol/)
    expect(() => barcodeSheet(["A"], { columns: 0 })).toThrow(/positive integer/)
    expect(() => barcodeSheet(["A"], { columns: 1.5 })).toThrow(/positive integer/)
  })
})

describe("qrcodeSheet()", () => {
  it("arranges QR codes in a grid", () => {
    const sheet = qrcodeSheet(["one", "two", "three"], { columns: 3, size: 100 })
    expect(sheet.match(/<g transform="translate\(/g)).toHaveLength(3)
  })
})

describe("a sheet reuses the single-symbol markup", () => {
  it("embeds exactly what barcode() produces for the same value", () => {
    // Cells are transparent on a sheet, so compare against that form
    const single = barcode("SHEET123", { type: "code128", background: "transparent" })
    const body = single.slice(single.indexOf(">") + 1, single.lastIndexOf("</svg>"))
    const sheet = barcodeSheet(["SHEET123", "OTHER456"], { type: "code128", columns: 1 })
    // If the sheet carries the standalone symbol verbatim, whatever scans on its
    // own scans here — the group only translates it
    expect(sheet).toContain(body)
  })

  it("embeds what qrcode() produces", () => {
    const single = qrcode("SHEET", { size: 100, background: "transparent" })
    const body = single.slice(single.indexOf(">") + 1, single.lastIndexOf("</svg>"))
    expect(qrcodeSheet(["SHEET"], { size: 100 })).toContain(body)
  })
})

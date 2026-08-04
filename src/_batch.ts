/**
 * Batch generation — many symbols from one call, and label sheets.
 *
 * Generating a thousand shipping labels is a loop either way; what a batch API
 * buys is the sheet: one SVG document holding a grid of symbols, which is what
 * print workflows actually need and what a `map()` cannot give you.
 */

import { barcode } from "./_barcode"
import { qrcode } from "./_qrcode"
import { escapeAttr, escapeXml } from "./renderers/svg/utils"
import { InvalidInputError } from "./errors"
import type { BarcodeOptions } from "./_types"
import type { QRCodeSVGOptions } from "./renderers/svg/types"
import type { QRCodeOptions } from "./encoders/qr/types"

/** Called after each symbol, for progress reporting on long batches */
export interface BatchOptions {
  /**
   * Invoked after every symbol with the number produced so far and the total.
   * Useful for a progress bar on a batch of thousands.
   */
  onProgress?: (done: number, total: number) => void
}

/**
 * Generate many barcodes that share the same options.
 *
 * @example
 * ```ts
 * const svgs = barcodes(["SKU-001", "SKU-002"], { type: "code128", height: 50 })
 * ```
 */
export function barcodes(values: string[], options: BarcodeOptions & BatchOptions = {}): string[] {
  const { onProgress, ...barcodeOptions } = options
  return values.map((value, index) => {
    const svg = barcode(value, barcodeOptions)
    onProgress?.(index + 1, values.length)
    return svg
  })
}

/**
 * Generate many QR codes that share the same options.
 *
 * @example
 * ```ts
 * const svgs = qrcodes(["https://example.com/1", "https://example.com/2"], { size: 200 })
 * ```
 */
export function qrcodes(
  values: string[],
  options: QRCodeSVGOptions & QRCodeOptions & BatchOptions = {},
): string[] {
  const { onProgress, ...qrOptions } = options
  return values.map((value, index) => {
    const svg = qrcode(value, qrOptions)
    onProgress?.(index + 1, values.length)
    return svg
  })
}

export interface SheetOptions extends BatchOptions {
  /** Symbols per row (default: 2) */
  columns?: number
  /** Space between cells, in the sheet's units (default: 10) */
  gap?: number
  /** Margin around the whole sheet (default: `gap`) */
  padding?: number
  /** Sheet background; omit for a transparent sheet */
  background?: string
  /** Caption under each symbol — pass `false` to leave them off */
  labels?: string[] | false
  /** Font size for the captions (default: 10) */
  labelSize?: number
  /** Font family for the captions */
  labelFont?: string
  /** Accessible name for the sheet as a whole */
  ariaLabel?: string
}

export type BarcodeSheetOptions = BarcodeOptions & SheetOptions
export type QRCodeSheetOptions = QRCodeSVGOptions & QRCodeOptions & SheetOptions

/**
 * Arrange many barcodes into a single SVG document — a label sheet.
 *
 * @example
 * ```ts
 * const sheet = barcodeSheet(["SKU-001", "SKU-002", "SKU-003", "SKU-004"], {
 *   type: "code128",
 *   columns: 2,
 *   gap: 10,
 * })
 * ```
 */
export function barcodeSheet(values: string[], options: BarcodeSheetOptions = {}): string {
  const { columns, gap, padding, background, labels, labelSize, labelFont, ariaLabel, ...rest } =
    options
  // Each symbol's own background is a `width="100%"` rect, which inside a group
  // covers the whole sheet rather than the cell — so the cells go transparent
  // and the sheet paints the background once.
  return composeSheet(barcodes(values, { ...rest, background: "transparent" }), values, {
    columns,
    gap,
    padding,
    background,
    labels,
    labelSize,
    labelFont,
    ariaLabel,
  })
}

/**
 * Arrange many QR codes into a single SVG document.
 *
 * @example
 * ```ts
 * const sheet = qrcodeSheet(tickets.map((t) => t.url), { columns: 4, labels: tickets.map((t) => t.id) })
 * ```
 */
export function qrcodeSheet(values: string[], options: QRCodeSheetOptions = {}): string {
  const { columns, gap, padding, background, labels, labelSize, labelFont, ariaLabel, ...rest } =
    options
  return composeSheet(qrcodes(values, { ...rest, background: "transparent" }), values, {
    columns,
    gap,
    padding,
    background,
    labels,
    labelSize,
    labelFont,
    ariaLabel,
  })
}

/** Width and height an SVG declares in its opening tag */
function svgSize(svg: string): { width: number; height: number } {
  const viewBox = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg)
  if (viewBox) {
    return { width: Number(viewBox[1]), height: Number(viewBox[2]) }
  }
  const width = /\bwidth="([\d.]+)"/.exec(svg)
  const height = /\bheight="([\d.]+)"/.exec(svg)
  if (!width || !height) {
    throw new InvalidInputError("Cannot place an SVG on a sheet without a viewBox or size")
  }
  return { width: Number(width[1]), height: Number(height[1]) }
}

/** The contents of an SVG, without its own opening and closing tag */
function svgBody(svg: string): string {
  const open = svg.indexOf(">", svg.indexOf("<svg"))
  const close = svg.lastIndexOf("</svg>")
  return svg.slice(open + 1, close)
}

/** Lay symbols out on a grid and wrap them in one SVG document */
function composeSheet(svgs: string[], values: string[], layout: SheetOptions): string {
  if (svgs.length === 0) {
    throw new InvalidInputError("A sheet needs at least one symbol")
  }

  const columns = layout.columns ?? 2
  if (!Number.isInteger(columns) || columns < 1) {
    throw new InvalidInputError(`Sheet columns must be a positive integer, got ${columns}`)
  }
  const gap = layout.gap ?? 10
  const padding = layout.padding ?? gap
  // The cells are transparent, so the sheet carries the background
  const background = layout.background ?? "#fff"
  const labelSize = layout.labelSize ?? 10
  const captions = layout.labels === false ? undefined : (layout.labels ?? values)
  const captionHeight = captions ? labelSize * 1.4 : 0

  const sizes = svgs.map((svg) => svgSize(svg))
  // A uniform grid: symbols of the same type differ in width with their data,
  // and a ragged sheet is harder to cut than a slightly airy one
  const cellWidth = Math.max(...sizes.map((s) => s.width))
  const cellHeight = Math.max(...sizes.map((s) => s.height)) + captionHeight
  const rows = Math.ceil(svgs.length / columns)

  const width = padding * 2 + columns * cellWidth + (columns - 1) * gap
  const height = padding * 2 + rows * cellHeight + (rows - 1) * gap

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img"${
      layout.ariaLabel ? ` aria-label="${escapeAttr(layout.ariaLabel)}"` : ""
    }>`,
  ]

  if (background !== "transparent") {
    parts.push(`<rect width="100%" height="100%" fill="${escapeAttr(background)}"/>`)
  }

  for (const [index, svg] of svgs.entries()) {
    const column = index % columns
    const row = Math.floor(index / columns)
    // Centre each symbol in its cell so a short one does not sit off to the left
    const x = padding + column * (cellWidth + gap) + (cellWidth - sizes[index]!.width) / 2
    const y = padding + row * (cellHeight + gap)

    parts.push(`<g transform="translate(${round(x)},${round(y)})">${svgBody(svg)}</g>`)

    if (captions?.[index] !== undefined) {
      const textX = padding + column * (cellWidth + gap) + cellWidth / 2
      const textY = y + sizes[index]!.height + labelSize
      parts.push(
        `<text x="${round(textX)}" y="${round(textY)}" text-anchor="middle" font-size="${labelSize}"` +
          (layout.labelFont ? ` font-family="${escapeAttr(layout.labelFont)}"` : "") +
          `>${escapeXml(captions[index]!)}</text>`,
      )
    }
  }

  parts.push("</svg>")
  return parts.join("")
}

/** Trim floating point noise out of coordinates */
function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

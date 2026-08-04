# Low-Level Renderers

The high-level functions are two steps glued together: an encoder turns text
into geometry, a renderer turns geometry into an image. Both halves are
exported, so you can substitute either one.

Reach for these when you want to:

- draw the symbol yourself, into canvas, PDF or a plotter
- encode once and render at several sizes without re-encoding
- post-process the geometry — merge bars, snap to a print grid, add your own
  furniture around the symbol
- render a symbol whose data did not come from etiket at all

```ts
import { encodeQR, renderQRCodeSVG, renderText } from "etiket"

const matrix = encodeQR("https://example.com", { ecLevel: "H" })

// One encode, two renders
const small = renderQRCodeSVG(matrix, { size: 120 })
const large = renderQRCodeSVG(matrix, { size: 600, dotType: "rounded" })
const terminal = renderText(matrix, { margin: 1 })

small.length > 0 && large.length > 0 && terminal.length > 0 // true
```

## The Three Geometries

Everything etiket encodes is one of three shapes, and each has its own renderer
family. Picking the wrong one produces an unreadable symbol, not an error.

| Geometry             | Produced by                            | Rendered by                                             |
| :------------------- | :------------------------------------- | :------------------------------------------------------ |
| `number[]` bars      | `encodeBars` and the 1D encoders       | `renderBarcodeSVG`, `renderBarcodePNG`                  |
| `boolean[][]` matrix | the 2D and stacked encoders            | `renderMatrixSVG`, `renderQRCodeSVG`, `renderMatrixPNG` |
| `PostalBar[]`        | `encodePostal` and the postal encoders | `renderPostalSVG`, `renderPostalPNG`                    |

Two special cases sit alongside: MaxiCode is a `boolean[][]` on a **hexagonal**
grid and needs `renderMaxiCodeSVG` / `renderMaxiCodePNG`, and JAB Code is a
`number[][]` of palette indices and needs `renderColorMatrixSVG`.

## SVG Renderers

### renderBarcodeSVG

```
renderBarcodeSVG(bars: number[], options?: BarcodeSVGOptions): string
```

`bars` is alternating bar and space widths in modules, starting with a bar —
`[2, 1, 1, 2, …]` means a 2-module bar, a 1-module space, a 1-module bar, and so
on. Every odd-indexed entry is white.

```ts
import { encodeBars, renderBarcodeSVG } from "etiket"

const bars = encodeBars("SKU-000123", { type: "code128" })

renderBarcodeSVG(bars, {
  moduleSize: 2,
  height: 60,
  margin: 10,
  color: "#0f172a",
  showText: true,
  text: "SKU-000123",
  fontSize: 12,
  textPosition: "bottom",
  ariaLabel: "Code 128 barcode for SKU-000123",
})
```

Note that `renderBarcodeSVG` does not know the data — pass `text` explicitly if
you want a caption. `barcode()` does this for you.

You can hand it bars you built yourself. This draws a 1-2-1-2 pattern with no
symbology behind it at all:

```ts
import { renderBarcodeSVG } from "etiket"

renderBarcodeSVG([1, 2, 1, 2, 3, 1], { height: 40, moduleSize: 4 }).startsWith("<svg") // true
```

### renderMatrixSVG

```
renderMatrixSVG(matrix: boolean[][], options?: MatrixSVGOptions): string
```

The general 2D renderer: `true` is a dark module. `size` is the overall width in
units and `margin` the quiet zone **in modules**, so the module size falls out
of the two.

```ts
import { encodeDataMatrix, encodeAztec, renderMatrixSVG } from "etiket"

renderMatrixSVG(encodeDataMatrix("Hello"), { size: 240, margin: 2 })
renderMatrixSVG(encodeAztec("Hello"), { size: 240, margin: 0, color: "#111" })
```

Stacked symbologies are much wider than they are tall, and their rows are not
all the same height. `rowHeight` scales every row; `rowHeights` sets them
individually, which is how the separator rows of Code 16K and Codablock F stay
one module tall.

```ts
import { encodeCode16K, renderMatrixSVG } from "etiket"

const result = encodeCode16K("Hello")
const separators = new Set(result.separatorRows)

renderMatrixSVG(result.matrix, {
  size: 400,
  rowHeight: 8,
  rowHeights: result.matrix.map((_, index) => (separators.has(index) ? 1 : 8)),
})
```

### renderQRCodeSVG

```
renderQRCodeSVG(matrix: boolean[][], options?: QRCodeSVGOptions): string
```

The QR-aware renderer. It knows where the finder patterns are, so it can style
them separately, and it supports dot shapes, gradients and logo embedding that
`renderMatrixSVG` does not.

```ts
import { encodeQR, renderQRCodeSVG } from "etiket"

renderQRCodeSVG(encodeQR("https://example.com", { ecLevel: "H" }), {
  size: 400,
  margin: 4,
  dotType: "classy-rounded",
  dotSize: 0.9,
  color: {
    type: "linear",
    rotation: 45,
    stops: [
      { offset: 0, color: "#0f172a" },
      { offset: 1, color: "#2563eb" },
    ],
  },
  corners: {
    topLeft: { outerShape: "rounded", innerShape: "dots" },
    topRight: { outerShape: "rounded", innerShape: "dots" },
    bottomLeft: { outerShape: "rounded", innerShape: "dots" },
  },
  background: "transparent",
})
```

Use it for QR, and `renderMatrixSVG` for everything else — the finder-pattern
logic assumes a QR layout.

### renderMaxiCodeSVG

```
renderMaxiCodeSVG(matrix: boolean[][], options?: MatrixSVGOptions): string
```

MaxiCode's modules are hexagons on a staggered grid around a bullseye finder.
Rendering the same matrix through `renderMatrixSVG` produces a square-module
picture that no reader will accept.

```ts
import { encodeMaxiCode, renderMaxiCodeSVG } from "etiket"

const matrix = encodeMaxiCode("Hello", { mode: 4 })
matrix.length // 33 rows
renderMaxiCodeSVG(matrix, { size: 260, margin: 2 })
```

### renderPostalSVG

```
renderPostalSVG(bars: readonly PostalBar[], options?: PostalSVGOptions): string
```

Takes either 4-state letters or POSTNET/PLANET heights and works out which
family it has from the input. `pitch` is the centre-to-centre bar spacing, which
is what postal specifications actually constrain — bars are narrow and the gaps
between them are wide.

```ts
import { encodePostal, renderPostalSVG } from "etiket"

renderPostalSVG(encodePostal("SN34RD1A", { type: "rm4scc" }), {
  height: 45,
  moduleSize: 2,
  pitch: 5,
  trackerRatio: 1 / 3,
})

renderPostalSVG(encodePostal("12345-6789", { type: "postnet" }), {
  height: 40,
  moduleSize: 2,
  pitch: 4,
  shortRatio: 0.4,
})
```

### renderColorMatrixSVG

```
renderColorMatrixSVG(
  matrix: number[][],
  palette: readonly string[],
  options?: ColorMatrixSVGOptions,
): string
```

For polychrome symbols, where each module carries more than one bit. The matrix
holds palette indices rather than booleans. Modules sharing a colour are merged
into one `<path>`, so the output stays compact whatever the palette size.

```ts
import { encodeJABCode, renderColorMatrixSVG, JAB_COLORS_8 } from "etiket"

const jab = encodeJABCode("Hello", { colors: 8 })

renderColorMatrixSVG(jab.matrix, jab.palette, { size: 240 })

// Override the encoder's palette without re-encoding
renderColorMatrixSVG(jab.matrix, jab.palette, { size: 240, palette: JAB_COLORS_8 })
```

### renderText

```
renderText(matrix: boolean[][], options?: TextRenderOptions): string
```

Unicode block characters, for a terminal. `compact: true` (the default) packs
two module rows into one text row using half blocks.

```ts
import { encodeQR, renderText } from "etiket"

const matrix = encodeQR("Hello")

renderText(matrix) // compact, 2 module rows per line
renderText(matrix, { compact: false, margin: 2 })
renderText(matrix, { invert: true }) // for a light-on-dark terminal
renderText(matrix, { compact: false, dark: "██", light: "  " })
```

Only QR-shaped square matrices are worth rendering this way; a PDF417 symbol is
far too wide for a terminal.

### The SVG string converters

```
svgToDataURI(svg: string): string   // data:image/svg+xml,<percent-encoded>
svgToBase64(svg: string): string    // data:image/svg+xml;base64,<base64>
svgToBase64Raw(svg: string): string // <base64>, no data: prefix
```

```ts
import { barcode, svgToDataURI, svgToBase64, svgToBase64Raw } from "etiket"

const svg = barcode("SKU-001")

svgToDataURI(svg).startsWith("data:image/svg+xml,") // true
svgToBase64(svg).startsWith("data:image/svg+xml;base64,") // true
svgToBase64Raw(svg).includes(",") // false — no prefix
```

`svgToDataURI` percent-encodes and is usually the smaller of the two; base64 is
the safer choice when the URI has to survive a CSS or attribute context you do
not control. All three take any SVG string, not just etiket's.

## PNG Renderers and Rasterizers

Each PNG family comes in two depths: a `*PNG` that returns finished bytes, and a
`*Raster` that stops at pixel rows.

```
renderBarcodePNG(bars: number[], options?: BarcodePNGOptions): Uint8Array
renderMatrixPNG(matrix: boolean[][], options?: MatrixPNGOptions): Uint8Array
renderPostalPNG(bars: readonly PostalBar[], options?: PostalPNGOptions): Uint8Array
renderMaxiCodePNG(matrix: boolean[][], options?: MatrixPNGOptions): Uint8Array

renderBarcodeRaster(bars, options?): RasterData
renderMatrixRaster(matrix, options?): RasterData
renderPostalRaster(bars, options?): RasterData
renderMaxiCodeRaster(matrix, options?): RasterData
```

```ts
import {
  encodeBars,
  encodeQR,
  encodePostal,
  encodeMaxiCode,
  renderBarcodePNG,
  renderMatrixPNG,
  renderPostalPNG,
  renderMaxiCodePNG,
} from "etiket"

renderBarcodePNG(encodeBars("SKU-001"), { moduleSize: 3, height: 80 })
renderMatrixPNG(encodeQR("Hello"), { moduleSize: 8, margin: 4 })
renderPostalPNG(encodePostal("12345", { type: "postnet" }), { moduleSize: 2, pitch: 4 })
renderMaxiCodePNG(encodeMaxiCode("Hello", { mode: 4 }), { moduleSize: 6, margin: 2 })
```

### RasterData

```
interface RasterData {
  width: number          // pixels
  height: number         // pixels
  rows: Uint8Array[]     // one row per pixel row; 0 = background, 1 = foreground
}
```

One byte per pixel, one `Uint8Array` per row, values `0` or `1`. That is a
convenient shape to hand to a different imaging library, or to walk yourself.

```ts
import { encodeQR, renderMatrixRaster } from "etiket"

const raster = renderMatrixRaster(encodeQR("Hello"), { moduleSize: 4, margin: 2 })

raster.rows.length === raster.height // true
raster.rows[0]!.length === raster.width // true

// Count dark pixels
let dark = 0
for (const row of raster.rows) {
  for (const pixel of row) dark += pixel
}
dark > 0 // true
```

Rows are shared where they repeat — the rasterizers push the same `Uint8Array`
for every pixel row of a bar. Treat `rows` as read-only; mutating one entry can
change several visible rows at once.

### Converting to something else

Because the raster is one byte per pixel, feeding it to a canvas or an image
library is a short loop:

```ts
import { encodeQR, renderMatrixRaster } from "etiket"

const raster = renderMatrixRaster(encodeQR("Hello"), { moduleSize: 4 })

const rgba = new Uint8ClampedArray(raster.width * raster.height * 4)
let offset = 0
for (const row of raster.rows) {
  for (const pixel of row) {
    const value = pixel === 1 ? 0 : 255
    rgba[offset++] = value
    rgba[offset++] = value
    rgba[offset++] = value
    rgba[offset++] = 255
  }
}

rgba.length === raster.width * raster.height * 4 // true
// In a browser: new ImageData(rgba, raster.width, raster.height)
```

### encodePNG

```
encodePNG(
  width: number,
  height: number,
  rows: Uint8Array[],
  fg: [number, number, number],
  bg: [number, number, number],
  useUpFilter?: boolean,
): Uint8Array
```

The chunk writer underneath every `*PNG` function. It emits a palette PNG
(colour type 3) with two entries — index 0 is `bg`, index 1 is `fg`. Pass it any
rows you like, whether or not etiket produced them.

```ts
import { encodePNG } from "etiket"

// An 8x4 checkerboard
const width = 8
const height = 4
const rows = Array.from(
  { length: height },
  (_, y) => new Uint8Array(Array.from({ length: width }, (_, x) => (x + y) % 2)),
)

const png = encodePNG(width, height, rows, [0, 0, 0], [255, 255, 255], false)
png[0] === 0x89 // true — PNG signature
```

`useUpFilter` selects the PNG "Up" row filter, which compresses matrices — where
consecutive rows are often identical — better than no filter. The matrix and
MaxiCode paths pass `true`; the 1D and postal paths pass `false`. It changes
size, never the decoded pixels.

## Rebuilding a High-Level Function

Putting the halves together, `barcode()` is not much more than this:

```ts
import { encodeBars, renderBarcodeSVG, optimizeSVG } from "etiket"
import type { BarcodeOptions } from "etiket"

function myBarcode(text: string, options: BarcodeOptions = {}): string {
  const bars = encodeBars(text, options)
  const svg = renderBarcodeSVG(bars, { ...options, text, showText: options.showText ?? false })
  return optimizeSVG(svg, { precision: 2 })
}

myBarcode("SKU-000123", { type: "code128", height: 60, showText: true }).startsWith("<svg") // true
```

Which is the point of the split: every decision the wrapper makes is one you can
make differently.

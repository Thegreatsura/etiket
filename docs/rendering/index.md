# Rendering

etiket provides multiple rendering options for different use cases.

## SVG String (Default)

All high-level functions return SVG strings:

```ts
import { barcode, qrcode, datamatrix, pdf417, aztec } from "etiket"

const svg = barcode("Hello")
// '<svg xmlns="http://www.w3.org/2000/svg" ...>...</svg>'
```

## Data URI

For embedding directly in `<img>` tags or CSS:

```ts
import { barcodeDataURI, qrcodeDataURI } from "etiket"

const uri = qrcodeDataURI("Hello")
// 'data:image/svg+xml,...'

// Use in HTML
const html = `<img src="${uri}" alt="QR Code" />`
```

## Base64

```ts
import { barcodeBase64, qrcodeBase64 } from "etiket"

const b64 = qrcodeBase64("Hello")
// 'data:image/svg+xml;base64,...'
```

## Terminal Output

Print QR codes in the terminal using Unicode half-block characters:

```ts
import { qrcodeTerminal } from "etiket"

console.log(qrcodeTerminal("Hello"))
```

Uses `▀`, `▄`, `█` and space characters for compact display (2 rows per line).

## Low-Level Renderers

For custom rendering pipelines:

```ts
import {
  encodeBars,
  encodeQR,
  encodeDataMatrix,
  renderBarcodeSVG,
  renderQRCodeSVG,
  renderMatrixSVG,
  renderText,
  svgToDataURI,
  svgToBase64,
  svgToBase64Raw,
} from "etiket"

// Custom barcode SVG
const bars = encodeBars("CUSTOM", { type: "code128" })
const svg = renderBarcodeSVG(bars, {
  height: 100,
  barWidth: 3,
  color: "#333",
  showText: true,
  text: "CUSTOM",
})

// Custom QR SVG with styling
const matrix = encodeQR("Hello")
const qrSvg = renderQRCodeSVG(matrix, {
  size: 400,
  dotType: "dots",
  color: {
    type: "linear",
    rotation: 45,
    stops: [
      { offset: 0, color: "#ff6b6b" },
      { offset: 1, color: "#4ecdc4" },
    ],
  },
})

// Generic 2D matrix SVG (Data Matrix, Aztec)
const matrixSvg = renderMatrixSVG(encodeDataMatrix("Hello"), { size: 200 })

// Terminal text
const text = renderText(matrix, { compact: true, margin: 2 })

// Convert any SVG
const uri = svgToDataURI(svg)
const b64 = svgToBase64(qrSvg)
const raw = svgToBase64Raw(matrixSvg) // No data: prefix

text.length > 0 && uri.length > 0 && b64.length > 0 && raw.length > 0 // true
```

Postal symbologies and JAB Code have renderers of their own, since their data is
not a boolean matrix of square modules:

```ts
import { encodePostal, encodeJABCode, renderPostalSVG, renderColorMatrixSVG } from "etiket"

// Height-modulated bars — 4-state letters or 2-state heights
renderPostalSVG(encodePostal("SN34RD1A", { type: "rm4scc" }), { height: 40 })

// Palette-indexed matrix
const jab = encodeJABCode("HELLO")
renderColorMatrixSVG(jab.matrix, jab.palette, { size: 200 })
```

## PNG Output

etiket writes PNG files directly — no canvas, no native dependency. The encoder
uses stored DEFLATE blocks wrapped in zlib, so output is valid but uncompressed.

```ts
import { qrcodePNG, barcodePNG, qrcodePNGDataURI } from "etiket"

const png = qrcodePNG("Hello", { moduleSize: 10, margin: 4 })
// Uint8Array — write with fs.writeFileSync('qr.png', png)

const uri = qrcodePNGDataURI("Hello")
// 'data:image/png;base64,...'
```

A dedicated sub-path keeps PNG out of SVG-only bundles:

```ts
import { qrcodePNG } from "etiket/png"
```

### Available PNG Functions

Every function has a matching `*PNGDataURI` variant.

| Family      | Functions                                                                             |
| :---------- | :------------------------------------------------------------------------------------ |
| 1D          | `barcodePNG`                                                                          |
| GS1 DataBar | `gs1databarStackedPNG`, `gs1databarStackedOmniPNG`, `gs1databarExpandedStackedPNG`    |
| Postal      | `postalPNG`                                                                           |
| QR          | `qrcodePNG`, `microqrPNG`, `rmqrPNG`                                                  |
| 2D          | `datamatrixPNG`, `gs1datamatrixPNG`, `pdf417PNG`, `micropdf417PNG`, `aztecPNG`        |
| Other       | `maxicodePNG`, `dotcodePNG`, `hanxinPNG`, `codablockfPNG`, `code16kPNG`, `jabcodePNG` |

### PNG Options

There are three option shapes, one per renderer family. All of them accept
`color` and `background` as hex strings, except the polychrome one, which takes a
`palette`.

**Matrix formats** (`MatrixPNGOptions`):

| Option       | Type       | Default | Description                           |
| :----------- | :--------- | :------ | :------------------------------------ |
| `moduleSize` | `number`   | `10`    | Pixels per module                     |
| `margin`     | `number`   | `4`     | Quiet zone in modules                 |
| `rowHeight`  | `number`   | `1`     | Row height in module widths           |
| `rowHeights` | `number[]` | —       | Per-row heights, mixed-height symbols |

**1D barcodes** (`BarcodePNGOptions`):

| Option       | Type     | Default | Description                                    |
| :----------- | :------- | :------ | :--------------------------------------------- |
| `moduleSize` | `number` | `2`     | Pixels per module                              |
| `scale`      | `number` | —       | Deprecated alias for `moduleSize`; wins if set |
| `height`     | `number` | `80`    | Image height in pixels                         |
| `margin`     | `number` | `10`    | Quiet zone in **pixels**                       |

**Postal** (`PostalPNGOptions`) — the same as 1D, plus the bar geometry that
height-modulated symbologies need:

| Option         | Type     | Default          | Description                                          |
| :------------- | :------- | :--------------- | :--------------------------------------------------- |
| `moduleSize`   | `number` | `2`              | Bar width in pixels                                  |
| `scale`        | `number` | —                | Deprecated alias for `moduleSize`                    |
| `pitch`        | `number` | `moduleSize * 2` | Centre-to-centre bar spacing in pixels               |
| `height`       | `number` | `40`             | Full-bar height in pixels                            |
| `margin`       | `number` | `10`             | Quiet zone in pixels                                 |
| `trackerRatio` | `number` | `1/3`            | Centre tracker band as a fraction of height, 4-state |
| `shortRatio`   | `number` | `0.4`            | Short bar as a fraction of height, POSTNET/PLANET    |

```ts
import { barcodePNG, qrcodePNG, postalPNG, code16kPNG } from "etiket"

barcodePNG("12345", { moduleSize: 3, height: 100, margin: 20, color: "#003049" })
qrcodePNG("Hello", { moduleSize: 8, margin: 2, background: "#f1faee" })
postalPNG("12345", { type: "postnet", moduleSize: 2, pitch: 4, height: 40, shortRatio: 0.4 })
postalPNG("SN34RD1A", { type: "rm4scc", moduleSize: 2, pitch: 4, trackerRatio: 1 / 3 })
code16kPNG("DATA", { moduleSize: 3, rowHeight: 8 })
```

### Low-Level Rasterizers

```ts
import {
  encodeQR,
  encodeBars,
  encodePostal,
  renderBarcodePNG,
  renderMatrixPNG,
  renderPostalPNG,
  renderMatrixRaster,
  encodePNG,
} from "etiket"

renderBarcodePNG(encodeBars("12345"), { moduleSize: 3, height: 80 })
renderPostalPNG(encodePostal("12345", { type: "postnet" }), { moduleSize: 2 })

// Raw pixel rows: { width, height, rows } where each byte is 0 = bg, 1 = fg
const raster = renderMatrixRaster(encodeQR("Hello"), { moduleSize: 4 })
raster.width // pixels

// Assemble a PNG yourself
const png = encodePNG(raster.width, raster.height, raster.rows, [0, 0, 0], [255, 255, 255], true)
png.length > 0 // true

renderMatrixPNG(encodeQR("Hello"), { moduleSize: 4 }).length > 0 // true
```

MaxiCode has its own pair, `renderMaxiCodeRaster` and `renderMaxiCodePNG`, since
its modules are hexagons on a staggered grid. JAB Code goes through a true-colour
path instead of the two-entry palette every other symbology uses; that renderer
is reached through `jabcodePNG()` rather than exported on its own.

## Raw Encoding with `encode()`

`encode()` returns the underlying data for any symbology without rendering,
which is useful when feeding a custom renderer or another imaging library.

```ts
import { encode } from "etiket"

const result = encode("Hello", { type: "qr" })

switch (result.type) {
  case "1d":
    result.bars // number[] — alternating bar/space widths in modules
    break
  case "2d":
    result.matrix // boolean[][] — module grid
    break
  case "postal":
    result.bars // 4-state letters, or 1 (tall) / 0 (short)
    break
}
```

Encoder options are passed per format:

```ts
import { encode } from "etiket"

encode("Hello", { type: "qr", qr: { ecLevel: "H" } })
encode("Hello", { type: "pdf417", pdf417: { columns: 4 } })
encode("Hello", { type: "aztec", aztec: { ecPercent: 33 } })
encode("HELLO", { type: "code39", code39CheckDigit: true })
encode("12345678", { type: "auspost", fcc: "59" })
encode("Hello", { type: "datamatrix", datamatrix: { shape: "rectangle" } })
```

`encode()` shares its 1D dispatch with `barcode()`, so the two can never
disagree about how a given input is encoded.

## Measurement Units

Barcode and postal SVGs accept a `unit` so output can be sized for print:

```ts
import { barcode } from "etiket"

barcode("12345", { unit: "mm", moduleSize: 0.33, height: 25 })
// <svg width="..mm" height="..mm" viewBox="0 0 .. ..">
```

Supported units: `px` (default), `mm`, `cm`, `in`, `pt`. The `viewBox` always
stays unitless, so the symbol scales correctly.

## Accessibility

Every renderer accepts accessibility metadata:

```ts
import { qrcode } from "etiket"

qrcode("https://example.com", {
  ariaLabel: "QR code linking to example.com",
  role: "img",
  title: "Website QR code",
  desc: "Scan to open example.com",
})
```

`title` and `desc` become child elements of the `<svg>`; `role` defaults to
`img`. All values are XML-escaped.

# PNG Output

etiket writes PNG bytes itself. There is no canvas, no `sharp`, no native
addon — the same code runs in Node, Deno, Bun, a browser and a Cloudflare
Worker. Import from `etiket/png` to keep the PNG path out of an SVG-only bundle.

```ts
import { qrcodePNG, qrcodePNGDataURI } from "etiket/png"

const png = qrcodePNG("https://example.com", { moduleSize: 8, margin: 4 })
png instanceof Uint8Array // true
png[0] === 0x89 && png[1] === 0x50 // true — the PNG signature

qrcodePNGDataURI("https://example.com").startsWith("data:image/png;base64,") // true
```

## The Functions

Every symbology has a `*PNG` returning a `Uint8Array` and a `*PNGDataURI`
returning a `data:image/png;base64,…` string. The arguments are identical — the
data URI variant just base64-encodes the bytes.

| Family      | Functions                                                                          |
| :---------- | :--------------------------------------------------------------------------------- |
| 1D          | `barcodePNG`                                                                       |
| Postal      | `postalPNG`                                                                        |
| QR          | `qrcodePNG`, `microqrPNG`, `rmqrPNG`                                               |
| 2D          | `datamatrixPNG`, `gs1datamatrixPNG`, `pdf417PNG`, `micropdf417PNG`, `aztecPNG`     |
| Stacked     | `codablockfPNG`, `code16kPNG`                                                      |
| Other       | `maxicodePNG`, `dotcodePNG`, `hanxinPNG`, `jabcodePNG`                             |
| GS1 DataBar | `gs1databarStackedPNG`, `gs1databarStackedOmniPNG`, `gs1databarExpandedStackedPNG` |
| Composite   | `gs1compositePNG`                                                                  |

Each takes the encoder options of its symbology plus one of the three PNG option
shapes below.

```ts
import {
  barcodePNG,
  postalPNG,
  qrcodePNG,
  microqrPNG,
  rmqrPNG,
  datamatrixPNG,
  gs1datamatrixPNG,
  pdf417PNG,
  micropdf417PNG,
  aztecPNG,
  codablockfPNG,
  code16kPNG,
  maxicodePNG,
  dotcodePNG,
  hanxinPNG,
  jabcodePNG,
  gs1databarStackedPNG,
  gs1databarStackedOmniPNG,
  gs1databarExpandedStackedPNG,
} from "etiket/png"

barcodePNG("SKU-001", { type: "code128", moduleSize: 3, height: 90 })
postalPNG("12345-6789", { type: "postnet", moduleSize: 2, pitch: 4 })
qrcodePNG("Hello", { ecLevel: "H", moduleSize: 8 })
microqrPNG("12345", { version: 2, ecLevel: "L", moduleSize: 10 })
rmqrPNG("Hello", { ecLevel: "M", moduleSize: 6 })
datamatrixPNG("Hello", { shape: "auto", moduleSize: 8 })
gs1datamatrixPNG("(01)09501101020917", { moduleSize: 8 })
pdf417PNG("Hello", { columns: 4, moduleSize: 3, rowHeight: 3 })
micropdf417PNG("Hello", { columns: 2, moduleSize: 3, rowHeight: 2 })
aztecPNG("Hello", { ecPercent: 33, moduleSize: 8 })
codablockfPNG("Hello World", { columns: 8, moduleSize: 3 })
code16kPNG("Hello", { moduleSize: 3 })
maxicodePNG("Hello", { mode: 4, moduleSize: 8 })
dotcodePNG("Hello", { moduleSize: 6 })
hanxinPNG("Hello", { ecLevel: 2, moduleSize: 6 })
jabcodePNG("Hello", { colors: 8, moduleSize: 8 })
gs1databarStackedPNG("0361414199999", { moduleSize: 4 })
gs1databarStackedOmniPNG("0361414199999", { moduleSize: 4 })
gs1databarExpandedStackedPNG("(01)90012345678908(3103)001750", { segments: 4, moduleSize: 4 })
```

`gs1compositePNG` is the exception to the "text first" shape: it takes the
linear symbology, then a `"<linear data>|<composite data>"` string, and sets
`rowHeights` itself so the linear component keeps its own height.

```ts
import { gs1compositePNG, gs1compositePNGDataURI } from "etiket/png"

gs1compositePNG("databar-omni", "(01)09521234543213|(11)990102", { moduleSize: 4 })

const uri = gs1compositePNGDataURI("databar-omni", "(01)09521234543213|(11)990102")
uri.startsWith("data:image/png;base64,") // true
```

## Options

### MatrixPNGOptions

Used by every 2D and stacked format.

| Option       | Type       | Default     | Meaning                                      |
| :----------- | :--------- | :---------- | :------------------------------------------- |
| `moduleSize` | `number`   | `10`        | Pixels per module                            |
| `margin`     | `number`   | `4`         | Quiet zone, in **modules**                   |
| `rowHeight`  | `number`   | `1`         | Row height as a multiple of the module width |
| `rowHeights` | `number[]` | —           | Per-row heights for mixed-height symbols     |
| `color`      | `string`   | `"#000000"` | Foreground, hex                              |
| `background` | `string`   | `"#ffffff"` | Background, hex                              |

Output size is exact and predictable:

```ts
import { encodeQR, qrcodePNG, renderMatrixRaster } from "etiket"

const matrix = encodeQR("Hello")
const moduleSize = 8
const margin = 4

const raster = renderMatrixRaster(matrix, { moduleSize, margin })
raster.width === (matrix[0]!.length + margin * 2) * moduleSize // true
raster.height === (matrix.length + margin * 2) * moduleSize // true

qrcodePNG("Hello", { moduleSize, margin }).length > 0 // true
```

`rowHeight` matters for the stacked symbologies, whose rows are much wider than
they are tall. `codablockfPNG` and `code16kPNG` set `rowHeights` for you so the
1-module separator rows stay 1 module while the data rows take the full height.

### BarcodePNGOptions

Used by `barcodePNG` and `renderBarcodePNG`.

| Option       | Type     | Default     | Meaning                                    |
| :----------- | :------- | :---------- | :----------------------------------------- |
| `moduleSize` | `number` | `2`         | Pixels per module                          |
| `scale`      | `number` | —           | Deprecated alias; **wins** when both given |
| `height`     | `number` | `80`        | Bar height in pixels                       |
| `margin`     | `number` | `10`        | Quiet zone, in **pixels**                  |
| `color`      | `string` | `"#000000"` | Bar colour, hex                            |
| `background` | `string` | `"#ffffff"` | Background, hex                            |

Note the two differences from the matrix options: the margin is in pixels rather
than modules, and the default module size is 2 rather than 10.

```ts
import { encodeBars, renderBarcodeRaster } from "etiket"

const bars = encodeBars("12345", { type: "code128" })
const moduleSize = 3
const margin = 10

const raster = renderBarcodeRaster(bars, { moduleSize, height: 80, margin })
const modules = bars.reduce((sum, width) => sum + width, 0)

raster.width === modules * moduleSize + margin * 2 // true
raster.height === 80 + margin * 2 // true
```

`barcodePNG` renders bars only — it draws no human-readable text. When you need
the caption, render SVG with `showText: true`, or draw the text yourself
alongside the PNG.

### PostalPNGOptions

Used by `postalPNG` and `renderPostalPNG`. The same shape as the 1D options plus
the geometry a height-modulated symbol needs.

| Option         | Type     | Default          | Meaning                                           |
| :------------- | :------- | :--------------- | :------------------------------------------------ |
| `moduleSize`   | `number` | `2`              | Bar width in pixels                               |
| `scale`        | `number` | —                | Deprecated alias; wins when both given            |
| `pitch`        | `number` | `moduleSize * 2` | Centre-to-centre bar spacing in pixels            |
| `height`       | `number` | `40`             | Full-bar height in pixels                         |
| `margin`       | `number` | `10`             | Quiet zone in pixels                              |
| `trackerRatio` | `number` | `1 / 3`          | Tracker band as a fraction of height, 4-state     |
| `shortRatio`   | `number` | `0.4`            | Short bar as a fraction of height, POSTNET/PLANET |
| `color`        | `string` | `"#000000"`      | Bar colour, hex                                   |
| `background`   | `string` | `"#ffffff"`      | Background, hex                                   |

```ts
import { postalPNG } from "etiket/png"

// USPS POSTNET: 0.050in short bars in a 0.125in field → 0.4
postalPNG("12345-6789", { type: "postnet", moduleSize: 2, pitch: 4, height: 40, shortRatio: 0.4 })

// RM4SCC: equal ascender / tracker / descender
postalPNG("SN34RD1A", { type: "rm4scc", moduleSize: 2, pitch: 5, height: 45, trackerRatio: 1 / 3 })
```

`shortRatio` is ignored by the 4-state symbologies and `trackerRatio` by the
2-state ones, so a single geometry object can be reused across both.

### MaxiCode and JAB Code

`maxicodePNG` takes `MatrixPNGOptions` but rasterizes onto a staggered
hexagonal grid, so the width is not simply `cols * moduleSize`. Its quiet zone
also defaults to 2 modules rather than 4.

`jabcodePNG` is polychrome and goes through the true-colour path. It takes
`moduleSize`, `margin`, `background` and `palette` — there is no `color`,
because the palette carries the colours.

```ts
import { maxicodePNG, jabcodePNG } from "etiket/png"
import { JAB_COLORS_8 } from "etiket"

maxicodePNG("Hello", { mode: 4, moduleSize: 8, margin: 2 })
jabcodePNG("Hello", { colors: 8, moduleSize: 10, palette: JAB_COLORS_8 })
```

## What the Bytes Look Like

Two-colour symbols are written as **palette PNGs** (colour type 3) with a
two-entry palette: index 0 is the background, index 1 the foreground. JAB Code
is written as true-colour RGBA.

Compression is stored (uncompressed) DEFLATE inside a valid zlib wrapper. The
files are larger than an optimising encoder would produce and completely valid
everywhere. It also means a test can decode the output and assert on real
pixels without pulling in an inflate implementation.

If size matters — a PNG sent over the wire rather than printed — run the output
through `oxipng`, `pngcrush` or your asset pipeline, or use SVG instead. For a
label that goes to a printer, the difference is irrelevant.

## Writing the Output

In Node:

```ts
import { writeFileSync } from "node:fs"
import { qrcodePNG } from "etiket/png"

const png = qrcodePNG("https://example.com", { moduleSize: 10, margin: 4 })
writeFileSync("qr.png", png)
```

In a browser, wrap the bytes in a `Blob`:

```ts
import { qrcodePNG } from "etiket/png"

const png = qrcodePNG("https://example.com")
const blob = new Blob([new Uint8Array(png)], { type: "image/png" })
blob.size === png.length // true
```

And in an HTTP response. The extra `new Uint8Array(...)` in both snippets is
only there to satisfy TypeScript: `Uint8Array` is generic over its buffer type,
and `BlobPart` / `BodyInit` want the plain `ArrayBuffer` flavour. At runtime the
bytes go straight through.

```ts
import { qrcodePNG } from "etiket/png"

const response = new Response(new Uint8Array(qrcodePNG("https://example.com")), {
  headers: { "content-type": "image/png" },
})
response.headers.get("content-type") // "image/png"
```

## Sizing for Print

PNG has no intrinsic physical size — etiket writes no `pHYs` chunk — so the
printer decides how big a pixel is. Work backwards from the target DPI:

```ts
import { barcodePNG } from "etiket/png"

// A Code 128 label at 300 dpi with a 0.33 mm narrow bar (GS1 minimum for
// general distribution): 0.33 mm ≈ 0.013 in ≈ 3.9 px, so 4 px per module.
const dpi = 300
const narrowBarMm = 0.33
const moduleSize = Math.round((narrowBarMm / 25.4) * dpi)
moduleSize // 4

barcodePNG("SKU-000123", { type: "code128", moduleSize, height: 300, margin: 40 })
```

For a symbol whose physical size must be exact, prefer SVG with `unit: "mm"` —
the units travel with the document, so no rounding to whole pixels is involved.

## Lower Level

`renderBarcodePNG`, `renderMatrixPNG`, `renderPostalPNG` and `renderMaxiCodePNG`
take already-encoded data, and the four `*Raster` functions stop one step
earlier at raw pixel rows. See
[Low-level renderers](/rendering/low-level).

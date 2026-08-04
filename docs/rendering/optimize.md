# Optimizing SVG Output

```
optimizeSVG(svg: string, options?: { precision?: number; responsive?: boolean }): string
```

`optimizeSVG()` post-processes an SVG string etiket has already produced. It
does two things, both cheap and both safe for barcode output:

1. Rounds every decimal number to `precision` places (default 2) and drops the
   trailing zeros that rounding leaves behind.
2. With `responsive: true`, removes the root `width` and `height` attributes so
   the symbol scales to its container, leaving the `viewBox` to carry the
   aspect ratio.

```ts
import { qrcode, optimizeSVG } from "etiket"

const svg = qrcode("https://example.com", { size: 333 })
const smaller = optimizeSVG(svg)

smaller.length <= svg.length // true
```

## Precision

Coordinates come out of the renderers as floating point — `333 / 29` is not a
round number — and the extra digits are noise at any realistic print size.

```ts
import { optimizeSVG } from "etiket"

const svg = '<rect x="11.482758620689655" y="0" width="11.482758620689655" height="4.00"/>'

optimizeSVG(svg)
// '<rect x="11.48" y="0" width="11.48" height="4"/>'

optimizeSVG(svg, { precision: 1 })
// '<rect x="11.5" y="0" width="11.5" height="4"/>'

optimizeSVG(svg, { precision: 0 })
// '<rect x="11" y="0" width="11" height="4"/>'
```

Note `"4.00"` becoming `"4"`: rounding is done through `Number.parseFloat`, so
trailing zeros disappear whatever the precision.

Two decimals is the right default. One is usually fine too — at 300 dpi, 0.01
user units is a hundredth of a pixel. Zero rounds coordinates to whole units and
can visibly shift narrow bars, so reach for it only when the module size is
large.

```ts
import { barcode, optimizeSVG } from "etiket"

const svg = barcode("SKU-000123", { type: "code128", moduleSize: 2, height: 60 })

optimizeSVG(svg, { precision: 1 }).length <= svg.length // true
```

## Responsive Output

```ts
import { qrcode, optimizeSVG } from "etiket"

const svg = qrcode("https://example.com", { size: 300 })
svg.includes('width="300"') // true

const responsive = optimizeSVG(svg, { responsive: true })
responsive.includes('width="300"') // false
responsive.includes("viewBox=") // true
```

Without `width` and `height`, the SVG fills whatever box you put it in, and the
`viewBox` keeps it square:

```html
<div style="width: 100%; max-width: 480px">
  <!-- the optimized SVG goes here and scales with the div -->
</div>
```

This is the shape you want for a symbol embedded in a responsive page. It is
_not_ what you want for print — a document destined for a printer needs its
physical size, which means keeping the attributes and setting `unit`:

```ts
import { barcode } from "etiket"

const forPrint = barcode("SKU-000123", { unit: "mm", moduleSize: 0.33, height: 25 })
forPrint.includes("mm") // true
```

## Caveats

**It is a text transform, not a parser.** `optimizeSVG()` rewrites the string
with regular expressions. That is fine for etiket's own output, whose shape it
knows, and it is not a general-purpose SVG optimizer — do not hand it arbitrary
SVG from elsewhere. For that, use SVGO.

**`responsive` removes the first `width` and the first `height` it finds.** In
etiket output those are the root `<svg>` attributes, which is exactly the
intent. Concatenate two symbols into one document first and you will lose the
wrong pair.

**Numbers in human-readable text are rounded too.** A caption that happens to
contain a decimal is rewritten along with the coordinates:

```ts
import { barcode, optimizeSVG } from "etiket"

const svg = barcode("12345", { type: "code128", showText: true, text: "1.23456" })
optimizeSVG(svg, { precision: 2 }).includes("1.23") // true
optimizeSVG(svg, { precision: 2 }).includes("1.23456") // false
```

If the caption's exact digits matter, skip optimization or render the text
outside the symbol.

**Optimization is not automatic.** The high-level functions return unoptimized
SVG, so the output is exactly what the renderer produced. Call `optimizeSVG()`
when you want it — typically once, on the way into a template or a file.

```ts
import { qrcodes, optimizeSVG } from "etiket"

const sheet = qrcodes(["https://example.com/1", "https://example.com/2"], { size: 200 }).map(
  (svg) => optimizeSVG(svg, { precision: 1, responsive: true }),
)

sheet.length // 2
```

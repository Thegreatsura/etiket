# GS1 DataBar

ISO/IEC 24724, formerly RSS (Reduced Space Symbology). A family of seven
symbologies that carry a GTIN — and, in the Expanded variants, arbitrary
Application Identifier data — in far less space than an EAN-13 or GS1-128.

## When to Use It

- Fresh produce, meat and other variable-weight retail items
- Small items where an EAN-13 does not fit: cosmetics, jewellery, vials
- Coupons and loyalty items that need AI data at point of sale

## The Family

| Variant                 | Shape  | Input                      | API                                   |
| :---------------------- | :----- | :------------------------- | :------------------------------------ |
| Omnidirectional         | Linear | 13/14-digit GTIN           | `barcode(…, { type: "gs1-databar" })` |
| Truncated               | Linear | 13/14-digit GTIN           | `type: "gs1-databar-truncated"`       |
| Limited                 | Linear | GTIN with indicator 0 or 1 | `type: "gs1-databar-limited"`         |
| Expanded                | Linear | AI element string          | `type: "gs1-databar-expanded"`        |
| Stacked                 | Matrix | 13/14-digit GTIN           | `gs1databarStacked()`                 |
| Stacked Omnidirectional | Matrix | 13/14-digit GTIN           | `gs1databarStackedOmni()`             |
| Expanded Stacked        | Matrix | AI element string          | `gs1databarExpandedStacked()`         |

The four linear variants return bar-first element widths and render through the
1D renderer. The three stacked variants return a **module matrix**, one entry per
module row, and render through the matrix renderer — they have their own SVG and
PNG functions rather than a `barcode()` type.

## Linear Variants

```ts
import { barcode, encodeGS1DataBarOmni, encodeGS1DataBarLimited } from "etiket"

barcode("2001234567890", { type: "gs1-databar" })
barcode("2001234567890", { type: "gs1-databar-truncated", height: 26 })
barcode("0001234567890", { type: "gs1-databar-limited" })
barcode("(01)90012345678908(3103)001750", { type: "gs1-databar-expanded" })

// Raw encoders — element widths, alternating bar/space, starting with a bar
const omni = encodeGS1DataBarOmni("2001234567890")
omni.length // 45 elements
omni.reduce((a, b) => a + b, 0) // 95 modules

encodeGS1DataBarLimited("0001234567890").length // 46 elements
```

| Variant         | Elements |  Modules | Height     |
| :-------------- | -------: | -------: | :--------- |
| Omnidirectional |       45 |       95 | 33 modules |
| Truncated       |       45 |       95 | 13 modules |
| Limited         |       46 |       78 | 10 modules |
| Expanded        | variable | variable | 34 modules |

Truncated uses exactly the Omnidirectional bar pattern — only the printed height
differs, which is a rendering choice, so pass `height` accordingly.

The element counts above are the ISO layout minus its leading guard _space_:
every 1D encoder in etiket returns bar-first arrays, and dropping a white module
that sits against the quiet zone changes nothing in the rendered symbol.

## Stacked Variants

```ts
import {
  gs1databarStacked,
  gs1databarStackedOmni,
  gs1databarExpandedStacked,
  encodeGS1DataBarStacked,
} from "etiket"

gs1databarStacked("2001234567890")
gs1databarStackedOmni("2001234567890")
gs1databarExpandedStacked("(01)90012345678908(3103)001750")

// Raw encoder — boolean[][], one entry per module row
const matrix = encodeGS1DataBarStacked("2001234567890")
matrix.length // 13 rows
matrix[0]!.length // 50 modules wide
```

| Variant                 | Layout                                                 |
| :---------------------- | :----------------------------------------------------- |
| Stacked                 | Two 50-module rows, one separator row, 13 modules high |
| Stacked Omnidirectional | Two full-height rows and a 3-module separator, 69 high |
| Expanded Stacked        | Rows of `segments` symbol characters, 34 high, 3 apart |

Stacked is the compact one, for very small items; Stacked Omnidirectional keeps
full-height rows so the symbol still scans omnidirectionally, which is what
supermarket produce labels use.

`gs1databarExpandedStacked()` takes a `segments` option — symbol characters per
row, an **even** number from 2 to 22, default 4:

```ts
import { gs1databarExpandedStacked } from "etiket"

gs1databarExpandedStacked("(01)90012345678908(3103)001750", { segments: 6 })
```

PNG output for the stacked variants:

```ts
import {
  gs1databarStackedPNG,
  gs1databarStackedOmniPNG,
  gs1databarExpandedStackedPNG,
} from "etiket"

gs1databarStackedPNG("2001234567890", { moduleSize: 4 })
gs1databarStackedOmniPNG("2001234567890", { moduleSize: 3 })
gs1databarExpandedStackedPNG("(01)90012345678908", { segments: 4, moduleSize: 3 })
```

## GTIN Input

The four GTIN-based variants accept 13 digits (no check digit) or 14 digits
(check digit included and verified):

```ts
import { encodeGS1DataBarOmni, CheckDigitError } from "etiket"

encodeGS1DataBarOmni("2001234567890") // 13 digits, check digit not needed
encodeGS1DataBarOmni("20012345678909") // 14 digits, check digit verified

try {
  encodeGS1DataBarOmni("20012345678901") // wrong check digit
} catch (error) {
  error instanceof CheckDigitError // true
}
```

Limited additionally requires an indicator digit of 0 or 1 — it is the variant
for items that will never be scanned at a general retail point of sale.

## Expanded Encodation

Expanded and Expanded Stacked take a parenthesised AI string, or a raw element
string. The encoder picks the encodation method from ISO/IEC 24724 Table 9,
preferring the compressed methods 3–14 whenever the AI sequence qualifies, since
they produce the smallest symbol:

| Method | Applies to                                                   |
| :----- | :----------------------------------------------------------- |
| 1      | `(01)` followed by anything else                             |
| 2      | General AI data with no `(01)`                               |
| 3      | `(01)` + `(3103)` kilogram weight below 32.768 kg            |
| 4      | `(01)` + `(3202)`/`(3203)` pound weight                      |
| 5–12   | `(01)` + `(310x)`/`(320x)` weight, optionally with a date AI |
| 13     | `(01)` + `(392x)` price                                      |
| 14     | `(01)` + `(393x)` price with an ISO 4217 currency code       |

The compressed methods all need a `(01)` whose indicator digit is 9 — that is the
variable-measure trade item indicator, which is what makes the compression sound.
Anything else falls back to method 1 or 2 automatically.

```ts
import { encodeGS1DataBarExpanded } from "etiket"

// Method 3: compressed GTIN + weight
encodeGS1DataBarExpanded("(01)90012345678908(3103)001750")

// Method 1: GTIN plus general data
encodeGS1DataBarExpanded("(01)90012345678908(10)LOT42")

// Method 2: no GTIN at all
encodeGS1DataBarExpanded("(10)LOT42(21)SERIAL")
```

The general purpose field switches between numeric, alphanumeric and ISO 646
modes as the data changes.

## Caveats

- The stacked variants are **not** `barcode()` types. `"gs1-databar-stacked"` is
  not part of `BarcodeType`, so TypeScript rejects it and `encodeBars()` throws
  `InvalidInputError` at runtime — use `gs1databarStacked()` and friends.
- A 14-digit GTIN with a wrong check digit raises `CheckDigitError`, which
  extends `InvalidInputError`; any other length raises `InvalidInputError`.
- Limited with an indicator digit other than 0 or 1 raises `InvalidInputError`.
- `segments` must be even and between 2 and 22; anything else raises
  `InvalidInputError`.
- Expanded data too long for a single symbol raises `InvalidInputError` — split
  it across an Expanded Stacked symbol instead.
- GS1 DataBar carries no human-readable text of its own. Print the AI string
  beside the symbol as the General Specifications require.

## CLI

```bash
etiket barcode "2001234567890" --type gs1-databar -o databar.svg
etiket barcode "0001234567890" --type gs1-databar-limited -o limited.svg
etiket barcode "(01)90012345678908(3103)001750" --type gs1-databar-expanded -o exp.svg
```

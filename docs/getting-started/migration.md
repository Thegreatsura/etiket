# Migrating from 0.11 to 1.0

Nothing was renamed and nothing was removed. Existing code compiles and runs
against 1.0 unchanged.

What did change is the **output**. A dozen symbologies produced symbols no
scanner could read, and they now produce correct ones. If you have stored SVG,
stored PNG or printed labels from 0.11, the section below tells you which ones
to regenerate.

```bash
npm install etiket@1
```

## Symbols You Should Regenerate

These formats produced unreadable or wrong output in 0.11. Anything you printed
or cached from them is stale.

| Symbology                  | What was wrong in 0.11                                                            |
| :------------------------- | :-------------------------------------------------------------------------------- |
| RM4SCC, KIX                | An invented bar alphabet — every symbol ever produced was unreadable              |
| Code 39                    | The SPACE pattern was malformed, so any payload with a space failed               |
| MaxiCode                   | The finder overlapped the data map and ~25 data modules were wiped                |
| Code 16K                   | Plain Code 128 rows: no row start/stop, no mode character, no check chars         |
| Codablock F                | Row splitting broke latched digit runs; K1/K2 check characters missing            |
| DotCode                    | No placement algorithm, no masking, a backwards GF(113) generator                 |
| Han Xin                    | Invented capacity, no masking, no function information                            |
| GS1 DataBar                | Inverted polarity; Expanded encoded the wrong data outright                       |
| Australia Post             | 28 bars for every FCC instead of 37/52/67, Reed-Solomon in the wrong field        |
| Plessey                    | A 2-module bit pitch instead of 5, CRC salt reversed                              |
| rMQR                       | A single Reed-Solomon block, making 35 of the version/EC combinations undecodable |
| PDF417 with non-Latin text | Characters outside ISO-8859-15 truncated to their low byte                        |
| QR in kanji mode           | Shift-JIS derived arithmetically, so every kanji symbol decoded wrongly           |

Every symbology is now verified against an implementation that is not this one
— decoded back with zxing-wasm where a decoder exists, compared module for
module with bwip-js where none does.

## The CLI Now Runs

`npx etiket` failed on every install in 0.11: the published `dist/cli.mjs`
imported `citty` and `consola`, both of which were devDependencies, and the
package declared no dependencies at all. The CLI is now a separate bundle entry
with its dependencies inlined, and CI packs the tarball and runs it from a clean
install. The library stays zero-dependency.

## Behavioural Changes

Five changes turn something that used to pass silently into something that
throws or answers differently. All of them replace a wrong result with an
honest one, and each is a small, mechanical fix at the call site.

### CheckDigitError is now thrown, and its parent changed

In 0.11 `CheckDigitError` was exported but never thrown, and it extended
`EtiketError` directly. In 1.0 it is thrown for every check-digit mismatch, and
it extends `InvalidInputError`.

```
0.11:  EtiketError → CheckDigitError
1.0:   EtiketError → InvalidInputError → CheckDigitError
```

If you already catch `InvalidInputError` — or `EtiketError` — nothing changes;
the reparenting is what makes that true. The one case to look at is code that
caught `CheckDigitError` _instead of_ `InvalidInputError`, which will now
receive errors it did not before.

```ts
import { encodeEAN13, CheckDigitError, InvalidInputError } from "etiket"

try {
  encodeEAN13("4006381333932") // last digit should be 1
} catch (error) {
  error instanceof CheckDigitError // true
  error instanceof InvalidInputError // true — this is the compatibility guarantee
}
```

Passing 12 digits and letting etiket compute the check digit is unaffected, and
is the call to prefer. See [Error handling](/getting-started/error-handling).

### validateBarcode rejects unknown types

0.11 answered `{ valid: true }` for any `type` it did not recognise, so a typo
in the symbology name validated cleanly and then failed at encode time.

```ts
import { validateBarcode } from "etiket"

validateBarcode("12345", "code128").valid // true
validateBarcode("12345", "code-128").valid // false in 1.0, true in 0.11
validateBarcode("12345", "code-128").error // "Unknown barcode type: code-128"
```

If you were validating against a user-supplied string, this is the change most
likely to surface a latent bug — which is the point.

### MaxiCode throws on a bad postal code

0.11 stripped non-digits, padded with zeros and truncated to length, so a mode 2
postal code of `"not a code"` silently became `"000000000"` and the label
shipped to the wrong place. 1.0 rejects it.

```ts
import { maxicode, InvalidInputError } from "etiket"

try {
  maxicode("shipment", { mode: 2, postalCode: "not a code" })
} catch (error) {
  error instanceof InvalidInputError // true
}

// Valid: mode 2 takes 1-9 digits, mode 3 takes 1-6 characters
maxicode("shipment", { mode: 2, postalCode: "123456789", countryCode: 840, serviceClass: 1 })
maxicode("shipment", { mode: 3, postalCode: "SW1A1A", countryCode: 826, serviceClass: 1 })
```

### GS1 DataBar element polarity

DataBar symbols rendered with inverted polarity in 0.11 — bars where there
should have been spaces. The bar arrays that `encodeGS1DataBarOmni()` and its
siblings return are therefore different from 0.11's, and any symbol you rendered
or stored from them needs regenerating.

Nothing to change in your code; the API is identical.

```ts
import { encodeGS1DataBarOmni, renderBarcodeSVG } from "etiket"

renderBarcodeSVG(encodeGS1DataBarOmni("0361414199999"), { height: 60 }).startsWith("<svg") // true
```

Expanded had a second, worse defect: it encoded the wrong data outright.
`(01)90012345678908` scanned back as `(01)40049382234908`.

### Code 16K and Codablock F return separator rows

Both symbologies need a 1-module separator above, below and between their data
rows, and 0.11 emitted none — the matrix had one row per data row. In 1.0 the
matrix holds `2 * rows + 1` rows, with `separatorRows` listing which indices are
separators.

```ts
import { encodeCode16K, encodeCodablockF, renderMatrixSVG } from "etiket"

const result = encodeCode16K("Hello")
result.rows // data rows
result.matrix.length === 2 * result.rows + 1 // true — separators included
result.separatorRows.length === result.rows + 1 // true

const codablock = encodeCodablockF("Hello World", { columns: 8 })
codablock.matrix.length === 2 * codablock.rows + 1 // true
```

If you render through `code16k()` / `codablockf()` or `code16kPNG()` /
`codablockfPNG()`, the wrappers set `rowHeights` for you and there is nothing to
do. If you call `renderMatrixSVG()` on the raw matrix yourself, pass
`rowHeights` so the separators stay one module tall rather than eight:

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

## API Changes

### moduleSize is the one name for module width

0.11 had three names for the same idea: `barWidth` on SVG barcodes, `scale` on
PNG barcodes, and `moduleSize` on PNG matrices. Every renderer now accepts
`moduleSize`.

| Old name     | Where                                   | New name     |
| :----------- | :-------------------------------------- | :----------- |
| `barWidth`   | `BarcodeSVGOptions`, `PostalSVGOptions` | `moduleSize` |
| `scale`      | `BarcodePNGOptions`, `PostalPNGOptions` | `moduleSize` |
| `moduleSize` | `MatrixPNGOptions`                      | unchanged    |

The old names still work and are not going away in 1.x — they are marked
deprecated, and they _win_ when both are given, so an existing call keeps its
exact behaviour.

```ts
import { barcode, barcodePNG } from "etiket"

// 0.11 style — still correct
barcode("12345", { barWidth: 3 })
barcodePNG("12345", { scale: 3 })

// 1.0 style — the same output
barcode("12345", { moduleSize: 3 })
barcodePNG("12345", { moduleSize: 3 })
```

### Data Matrix gained shape, dmre and symbolSize

0.11's `datamatrix()` took SVG options only, and its size table listed the
rectangular sizes but never reached them — square sizes came first in the search
and covered every capacity. Rectangular Data Matrix was effectively
unreachable.

1.0 adds `shape`, `dmre` and `symbolSize`. **The default is `shape: "square"`,
which is what 0.11 always produced**, so existing calls are byte-for-byte
unchanged.

```ts
import { datamatrix, encodeDataMatrix } from "etiket"

datamatrix("Hello") // square, exactly as in 0.11
datamatrix("Hello", { shape: "rectangle" }) // ISO 16022 rectangular sizes
datamatrix("Hello", { shape: "rectangle", dmre: true }) // plus the ISO 21471 DMRE sizes
datamatrix("Hello", { shape: "auto" }) // smallest symbol of either shape
datamatrix("Hello", { symbolSize: "16x48" }) // pinned; throws if the data does not fit

encodeDataMatrix("Hello", { shape: "auto", dmre: true }).length // rows
```

`dmre` is off by default because not every reader supports the ISO 21471 sizes.
Turn it on only when you know the scanner does.

### New sub-paths

`etiket/2d`, `etiket/errors` and `etiket/validators` join the existing ones, and
the older sub-paths carry more: `etiket/qr` gained the payload helpers, PNG
output and validation; `etiket/barcode` gained the validators, the error classes
and the industry encoders.

```ts
import { maxicode } from "etiket/2d"
import { InvalidInputError } from "etiket/errors"
import { validateBarcode } from "etiket/validators"

validateBarcode("4006381333931", "ean13").valid // true
new InvalidInputError("x") instanceof Error // true
maxicode("Hello", { mode: 4 }).startsWith("<svg") // true
```

### Option and result types are named

Shapes that were inline anonymous objects in 0.11 are exported interfaces in
1.0 — `Code128Options`, `MSICheckDigitType`, `DotCodeOptions`,
`MicroPDF417Options`, `DataMatrixSizeOptions` and others. Nothing changed
structurally; there is now a name to import. See
[TypeScript types](/getting-started/typescript).

```ts
import type { Code128Options, DotCodeOptions } from "etiket"
import { encodeCode128, encodeDotCode } from "etiket"

const c128: Code128Options = { charset: "C" }
const dot: DotCodeOptions = { columns: 20 }

encodeCode128("12345678", c128)
encodeDotCode("Hello", dot)
```

## New in 1.0

None of this is required, but it is why the major version exists.

**ECI on QR, Data Matrix, PDF417 and Aztec.** Non-Latin-1 input is now encoded
as UTF-8 under an automatic ECI 26 declaration rather than being truncated.

```ts
import { qrcode, encodePDF417 } from "etiket"

qrcode("日本語テキスト") // ECI 26 declared automatically
qrcode("Grüße", { eci: 3 }) // or declare a charset explicitly
encodePDF417("日本語").rows > 0 // true — was mojibake in 0.11
```

**QR Structured Append** — split a message across up to 16 symbols that a reader
reassembles.

```ts
import { encodeQRSequence } from "etiket"

encodeQRSequence("A".repeat(400), { symbols: 3 }).length // 3
```

**GS1 QR Code** with the FNC1 first-position flag, and FNC1 in the second
position.

```ts
import { gs1qr, qrcode } from "etiket"

gs1qr("(01)09501101020917(10)LOT42")
qrcode("A12345", { applicationIndicator: "12" })
```

**More GS1 DataBar**: Truncated, Stacked, Stacked Omnidirectional and Expanded
Stacked, plus the compressed encodation methods 3–14.

```ts
import { gs1databarStacked, gs1databarExpandedStacked } from "etiket"

gs1databarStacked("0361414199999")
gs1databarExpandedStacked("(01)90012345678908(3103)001750", { segments: 4 })
```

**Batch generation and label sheets.**

```ts
import { barcodes, barcodeSheet } from "etiket"

barcodes(["SKU-001", "SKU-002"], { type: "code128" }).length // 2
barcodeSheet(["SKU-001", "SKU-002", "SKU-003", "SKU-004"], { columns: 2 }).startsWith("<svg") // true
```

**Data Matrix Base 256, X12 and EDIFACT** encodation, chosen automatically
whenever they produce a shorter codeword stream.

**JAB Code PNG output**, with an explicit caveat: the encoder is not ISO/IEC
23634 conformant and cannot be verified against a reference implementation.
Treat it as experimental.

**Optimal QR segmentation**, which existed in 0.11 but was never called — mixed
numeric and alphanumeric payloads now use fewer modules.

## Checklist

1. `npm install etiket@1`, then build and test. Nothing should break.
2. Regenerate any stored or printed symbols in the formats listed at the top.
3. Search for `catch (e) { if (e instanceof CheckDigitError)` — that branch can
   now fire where it never did.
4. Search for `validateBarcode(` with a non-literal type — it can now answer
   `false` for a name it used to wave through.
5. Search for `postalCode` on MaxiCode calls — a malformed one now throws.
6. If you call `renderMatrixSVG()` on a raw Code 16K or Codablock F matrix, pass
   `rowHeights`.
7. Optionally, rename `barWidth` / `scale` to `moduleSize`.

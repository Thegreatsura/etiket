# Error Handling

Every reachable throw in etiket is an `EtiketError` subclass. Nothing throws a
bare `Error`, a `TypeError` or a string, so a single `instanceof EtiketError`
catch is enough to separate "this library rejected the input" from "something
else went wrong".

```ts
import { barcode, EtiketError } from "etiket"

try {
  barcode("not digits", { type: "ean13" })
} catch (error) {
  if (error instanceof EtiketError) {
    error.name // "InvalidInputError"
    error.message // "EAN-13 requires 12 or 13 digits"
  } else {
    throw error
  }
}
```

## The Hierarchy

```
Error
└── EtiketError
    ├── InvalidInputError
    │   └── CheckDigitError
    └── CapacityError
```

| Class               | Extends             | Raised when                                              |
| :------------------ | :------------------ | :------------------------------------------------------- |
| `EtiketError`       | `Error`             | Never directly — the base class you catch on             |
| `InvalidInputError` | `EtiketError`       | Wrong characters, wrong length, unsupported option value |
| `CheckDigitError`   | `InvalidInputError` | The supplied check digit disagrees with the data         |
| `CapacityError`     | `EtiketError`       | The data does not fit any symbol of that symbology       |

Every class sets `name` to its own class name, so `error.name` is a usable
discriminator when `instanceof` is not available — across a worker boundary, for
instance, or after a structured clone.

```ts
import { EtiketError, InvalidInputError, CapacityError, CheckDigitError } from "etiket"

new EtiketError("x").name // "EtiketError"
new InvalidInputError("x").name // "InvalidInputError"
new CapacityError("x").name // "CapacityError"
new CheckDigitError("x").name // "CheckDigitError"
```

## CheckDigitError Extends InvalidInputError

This is deliberate. A wrong check digit _is_ invalid input, so code written
against the broader class keeps working; code that wants to single the case out
— to offer "did you mean 4006381333931?" rather than a flat rejection — can.

```ts
import { barcode, CheckDigitError, InvalidInputError } from "etiket"

function render(value: string): string {
  try {
    return barcode(value, { type: "ean13", showText: true })
  } catch (error) {
    if (error instanceof CheckDigitError) {
      // The digits are plausible, the last one is wrong.
      return barcode(value.slice(0, 12), { type: "ean13", showText: true })
    }
    if (error instanceof InvalidInputError) {
      // Wrong length or non-numeric — nothing to salvage.
      return ""
    }
    throw error
  }
}

render("4006381333931").startsWith("<svg") // true — valid to begin with
render("4006381333932").startsWith("<svg") // true — recovered from a bad check digit
render("nonsense") === "" // true
```

Order the branches from most specific to least. `CheckDigitError` first,
`InvalidInputError` second: reversing them makes the `CheckDigitError` branch
dead code.

## Which Operation Raises Which

### CheckDigitError

Only the symbologies that carry a check digit _and_ accept it as part of the
input can raise it — you passed the full code including its check digit, and the
digit does not match what the data implies.

| Symbology           | Input that triggers it                   |
| :------------------ | :--------------------------------------- |
| EAN-13, EAN-8       | 13 or 8 digits with a wrong final digit  |
| UPC-A, UPC-E        | 12 or 8 digits with a wrong final digit  |
| ITF-14              | 14 digits with a wrong final digit       |
| Identcode, Leitcode | 12 or 14 digits with a wrong final digit |
| GS1 DataBar         | A 14-digit GTIN with a wrong final digit |

```ts
import { encodeEAN13, encodeUPCA, encodeITF14, encodeIdentcode, CheckDigitError } from "etiket"

function fails(fn: () => unknown): boolean {
  try {
    fn()
    return false
  } catch (error) {
    return error instanceof CheckDigitError
  }
}

fails(() => encodeEAN13("4006381333932")) // true
fails(() => encodeUPCA("036000291453")) // true
fails(() => encodeITF14("12345678901232")) // true
fails(() => encodeIdentcode("563123000017")) // true
```

Pass the data _without_ its check digit — 12 digits for EAN-13, 11 for UPC-A, 13
for ITF-14 — and etiket computes the digit for you. That is the safer call: it
cannot disagree.

```ts
import { encodeEAN13, calculateEANCheckDigit } from "etiket"

encodeEAN13("400638133393").bars.length > 0 // true — check digit computed
calculateEANCheckDigit([4, 0, 0, 6, 3, 8, 1, 3, 3, 3, 9, 3]) // 1
```

### InvalidInputError

The general "this cannot be encoded" case:

- Characters the symbology has no pattern for — lowercase in Code 39, a letter
  in ITF.
- A length the symbology does not allow — 11 digits for EAN-13.
- An option value outside its range — a Micro QR `version` of 5, an Australia
  Post FCC of `"99"`, `segments: 3` on Expanded Stacked.
- Structural mistakes — a malformed GS1 AI string, a MaxiCode mode 2 postal code
  that is not 1 to 9 digits.
- Asking a function for something it structurally cannot do —
  `encodeBars("12345", { type: "postnet" })`, because POSTNET's data lives in
  bar height, or `barcode()` with a `type` that is not a symbology.
- Rendering inputs that make no sense — a malformed hex colour on a PNG call, a
  sheet with no symbols on it.

```ts
import { encodeBars, barcode, maxicode, qrcodePNG, barcodeSheet, InvalidInputError } from "etiket"

function why(fn: () => unknown): string {
  try {
    fn()
    return ""
  } catch (error) {
    return error instanceof InvalidInputError ? error.name : "unexpected"
  }
}

why(() => encodeBars("12345", { type: "postnet" })) // "InvalidInputError"
why(() => barcode("hello", { type: "code39" })) // "InvalidInputError"
why(() => maxicode("Hi", { mode: 2, postalCode: "not-digits" })) // "InvalidInputError"
why(() => qrcodePNG("Hi", { color: "#nothex" })) // "InvalidInputError"
why(() => barcodeSheet([])) // "InvalidInputError"
```

### CapacityError

The input is well-formed but too big for the symbology, or too big for the
symbol size you pinned it to. Every 2D encoder can raise it: QR, Micro QR, rMQR,
Data Matrix, PDF417, MicroPDF417, Aztec, MaxiCode, Han Xin, JAB Code, Code 16K,
Codablock F and the GS1 composite components.

```ts
import { encodeMicroQR, encodeDataMatrix, encodeAztec, encodeHanXin, CapacityError } from "etiket"

function overflows(fn: () => unknown): boolean {
  try {
    fn()
    return false
  } catch (error) {
    return error instanceof CapacityError
  }
}

overflows(() => encodeMicroQR("A".repeat(60))) // true — beyond M4
overflows(() => encodeDataMatrix("A".repeat(40), { symbolSize: "10x10" })) // true
overflows(() => encodeAztec("A".repeat(200), { layers: 1, compact: true })) // true
overflows(() => encodeHanXin("A".repeat(50), { version: 1 })) // true
```

A `CapacityError` from an _unpinned_ call means the data exceeds the largest
symbol the format defines. A `CapacityError` from a call with `version`,
`layers`, `symbolSize` or `columns` set usually means the pin is too small —
drop it and let the encoder choose.

## Validate Instead of Catching

Where you are checking user input rather than your own, the validators answer
the same question without an exception. They never throw.

```ts
import { validateBarcode, validateQRInput, isValidInput } from "etiket"

const check = validateBarcode("ABC", "ean13")
check.valid // false
check.error // "EAN-13 requires 12 or 13 digits"

validateQRInput("A".repeat(10000), "H").valid // false
isValidInput("HELLO", "code39") // true
```

`validateBarcode()` also rejects a `type` it does not recognise, rather than
waving it through — see [Input validation](/getting-started/validation).

## Importing Only the Errors

The error classes have a sub-path of their own, so a module that only needs to
catch does not pull in an encoder.

```ts
import { EtiketError, InvalidInputError, CapacityError, CheckDigitError } from "etiket/errors"

const hierarchy = new CheckDigitError("x")
hierarchy instanceof InvalidInputError // true
hierarchy instanceof EtiketError // true
hierarchy instanceof Error // true
new CapacityError("x") instanceof InvalidInputError // false
```

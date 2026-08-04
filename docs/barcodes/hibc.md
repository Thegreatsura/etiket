# HIBC

Health Industry Bar Code (ANSI/HIBC 2.6) is not a symbology — it is a **data
format**. It says how to lay out a labeller code, product number, expiry and lot
so that any HIBC reader can parse them, and leaves the choice of carrier to you.

etiket's HIBC functions therefore return **strings**, which you then encode with
[Code 128](/barcodes/code128), [Code 39](/barcodes/code39),
[Data Matrix](/2d-codes/datamatrix) or whatever the labelling standard calls for.

## When to Use It

- Medical device labelling outside the GS1 system
- US healthcare supply chains that mandate HIBC
- Anywhere a Labeler Identification Code has been issued by HIBCC

For GS1-based healthcare labelling, use [GS1-128](/barcodes/gs1-128) or
[GS1 DataMatrix](/2d-codes/datamatrix#gs1-datamatrix) instead.

## Primary Data

`+` `LIC` `product number` `unit of measure` `check character`

```ts
import { encodeHIBCPrimary, barcode } from "etiket"

const primary = encodeHIBCPrimary("A123", "MPN12345", 1)
primary // "+A123MPN123451E"

barcode(primary, { type: "code128", showText: true })
```

| Argument        | Rule                                                 |
| :-------------- | :--------------------------------------------------- |
| `lic`           | 4 characters: a letter followed by 3 alphanumerics   |
| `product`       | 1–18 characters from `0-9 A-Z - . $ / + %` and space |
| `unitOfMeasure` | A digit 0–9, default `0`                             |

## Secondary Data

`+$$` `date indicator` `expiry` `lot` `check character`

```ts
import { encodeHIBCSecondary } from "etiket"

encodeHIBCSecondary("241231", "LOT7") // "+$$3241231LOT71"
encodeHIBCSecondary("2412") // YYMM
encodeHIBCSecondary(undefined, "LOT7") // lot only
```

The date format is inferred from the length, and the indicator digit records
which one was used:

| Expiry length | Format     | Indicator |
| :------------ | :--------- | :-------- |
| 4             | `YYMM`     | `2`       |
| 6             | `YYMMDD`   | `3`       |
| 8             | `YYYYMMDD` | `4`       |

At least one of expiry or lot must be given.

## Concatenated Data

One symbol carrying both halves, joined by `/`, with a single check character
over the whole string:

```ts
import { encodeHIBCConcatenated, barcode } from "etiket"

const data = encodeHIBCConcatenated("A123", "MPN12345", {
  unitOfMeasure: 0,
  expiry: "241231",
  lot: "LOT7",
})
data // "+A123MPN123450/3241231LOT7L"

barcode(data, { type: "code128" })
```

The primary's own check character is dropped and the secondary's `+$$` prefix
removed before the two are joined, so the result is one self-checking string
rather than two concatenated ones.

## Check Character

A modulo 43 sum over the character set `0-9 A-Z - . space $ / + %`, mapped back
to the same set — the same alphabet Code 39 uses, which is why HIBC data drops
straight into a Code 39 symbol.

## Caveats

- These functions **format**; they do not encode. Nothing is drawn until you pass
  the string to `barcode()`, `datamatrix()` or another generator.
- A LIC that is not a letter plus 3 alphanumerics, a product number outside 1–18
  characters, an out-of-charset character, or a unit of measure outside 0–9 each
  raise `InvalidInputError`.
- An expiry that is not 4, 6 or 8 digits raises `InvalidInputError`, as does a
  secondary with neither expiry nor lot.
- Lowercase is not part of the character set. Upper-case your data first.
- The HIBC standard also specifies symbol placement, size and quality grading;
  none of that is etiket's business, and the string being correct does not make
  the label compliant.

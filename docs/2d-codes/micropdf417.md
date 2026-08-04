# MicroPDF417

ISO/IEC 24728 — the compact relative of [PDF417](/2d-codes/pdf417). It keeps the
same compaction modes and Reed-Solomon over GF(929), but drops the start and stop
patterns in favour of Row Address Patterns and limits the symbol to 1–4 data
columns.

## When to Use It

- Small items where PDF417's start/stop overhead dominates the symbol
- The 2D component of a [GS1 Composite](/barcodes/gs1-composite) symbol (CC-A and
  CC-B are MicroPDF417)
- Electronics and healthcare labelling with a short, fixed payload

## Usage

```ts
import { micropdf417, encodeMicroPDF417 } from "etiket"

// Convenience function — returns SVG
micropdf417("MICRO")
micropdf417("MICRO", { columns: 2 })

// Raw encoder — returns { matrix, rows, cols }
const result = encodeMicroPDF417("MICRO", { columns: 2 })
result.rows // 8
result.cols // 55
```

The PDF417 sub-path carries both variants:

```ts
import { micropdf417, encodeMicroPDF417 } from "etiket/pdf417"

micropdf417("MICRO")
encodeMicroPDF417("MICRO")
```

## Capacity and Constraints

| Property     | Range                                      |
| :----------- | :----------------------------------------- |
| Data columns | 1 – 4 (`columns`)                          |
| Rows         | 4 – 44, fixed per column count by the spec |
| Compaction   | Text, Byte and Numeric, as in PDF417       |

The symbol size comes from a fixed table of column/row/EC combinations; the
encoder walks it and takes the first entry that holds the data. Passing `columns`
restricts the search to that column count, so a payload that needs a wider symbol
raises `CapacityError` instead of quietly widening.

A 4-column symbol tops out around 150 bytes, 250 alphanumeric characters or 366
digits.

## Options

| Option      | Type               | Default | Description                      |
| :---------- | :----------------- | :------ | :------------------------------- |
| `columns`   | `1 \| 2 \| 3 \| 4` | auto    | Number of data columns           |
| `rowHeight` | `number`           | `2`     | Data row height in module widths |

Plus the rest of the
[shared matrix rendering options](/2d-codes/#shared-rendering-options).
`micropdf417()` defaults `rowHeight` to `2`, matching the stacked aspect ratio
the specification recommends:

```ts
import { micropdf417 } from "etiket"

micropdf417("MICRO", { rowHeight: 3, size: 300 })
micropdf417("MICRO", { rowHeight: 1 }) // square modules, for inspection
```

## PNG

```ts
import { micropdf417PNG, micropdf417PNGDataURI } from "etiket"

micropdf417PNG("MICRO", { moduleSize: 4, rowHeight: 2 })
micropdf417PNGDataURI("MICRO")
```

## Caveats

- Padding is prepended, not appended: MicroPDF417 fills the symbol with leading
  codeword 900s, matching Zint and bwip-js. This is invisible to a reader but
  surprising if you inspect the codeword stream.
- There is no `ecLevel` option — the error correction count is fixed per symbol
  size by the standard.
- MicroPDF417 has no `compact` variant and no `eci` option; use PDF417 when you
  need to declare a character set.
- Empty input raises `InvalidInputError`.

## CLI

```bash
etiket micropdf417 "MICRO" -o micro.svg
etiket micropdf417 "MICRO" --module-size 4 -o micro.png
```

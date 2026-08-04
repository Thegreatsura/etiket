# rMQR

Rectangular Micro QR Code, ISO/IEC 23941. A QR-family symbol that is deliberately
wide and short — as few as 7 module rows — for surfaces where a square will not
fit. One finder pattern in the top-left corner, alignment patterns along the
symbol, and error correction at level M or H.

## When to Use It

- Cables, tubes and cylindrical items, where a square symbol curves out of view
- Narrow labels: pharmaceutical vials, PCB edges, tickets
- Anywhere the available area is a strip rather than a square

## Usage

```ts
import { rmqr, encodeRMQR } from "etiket"

// Convenience function — returns SVG
rmqr("HELLO")
rmqr("HELLO", { ecLevel: "H" })

// Raw encoder — returns boolean[][], true = dark module
const matrix = encodeRMQR("HELLO")
matrix.length // 7 — an R7x43 symbol
matrix[0]!.length // 43
```

The QR sub-path carries all three QR variants:

```ts
import { rmqr, encodeRMQR } from "etiket/qr"

rmqr("HELLO")
encodeRMQR("HELLO")
```

## Options

| Option    | Type         | Default | Description                            |
| :-------- | :----------- | :------ | :------------------------------------- |
| `version` | `0-31`       | auto    | **Index** into the size table below    |
| `ecLevel` | `"M" \| "H"` | `"M"`   | Error correction level                 |
| `eci`     | `number`     | —       | ECI designator (0–999999) for the data |

Plus the [shared matrix rendering options](/2d-codes/#shared-rendering-options).

`version` is not a size — it is the row index of the size table. `version: 10` is
R11×27, not "version 10" in the QR sense.

## Symbol Sizes

32 sizes, from R7×43 to R17×139. Data capacity is in codewords; a codeword is one
byte in byte mode, and numeric and alphanumeric modes pack tighter.

| Index | Size    | Data CW (M) | Data CW (H) |
| ----: | :------ | ----------: | ----------: |
|     0 | R7×43   |           6 |           3 |
|     1 | R7×59   |          12 |           7 |
|     2 | R7×77   |          20 |          10 |
|     3 | R7×99   |          28 |          14 |
|     4 | R7×139  |          44 |          24 |
|     5 | R9×43   |          12 |           7 |
|     6 | R9×59   |          21 |          11 |
|     7 | R9×77   |          31 |          17 |
|     8 | R9×99   |          42 |          22 |
|     9 | R9×139  |          63 |          33 |
|    10 | R11×27  |           7 |           5 |
|    11 | R11×43  |          19 |          11 |
|    12 | R11×59  |          31 |          15 |
|    13 | R11×77  |          43 |          23 |
|    14 | R11×99  |          57 |          29 |
|    15 | R11×139 |          84 |          42 |
|    16 | R13×27  |          12 |           7 |
|    17 | R13×43  |          27 |          13 |
|    18 | R13×59  |          38 |          20 |
|    19 | R13×77  |          53 |          29 |
|    20 | R13×99  |          73 |          35 |
|    21 | R13×139 |         106 |          54 |
|    22 | R15×43  |          33 |          15 |
|    23 | R15×59  |          48 |          26 |
|    24 | R15×77  |          67 |          31 |
|    25 | R15×99  |          88 |          48 |
|    26 | R15×139 |         127 |          69 |
|    27 | R17×43  |          39 |          21 |
|    28 | R17×59  |          56 |          28 |
|    29 | R17×77  |          78 |          38 |
|    30 | R17×99  |         100 |          56 |
|    31 | R17×139 |         152 |          76 |

The table is ordered by height then width, so the automatic search finds the
shortest symbol that fits rather than the smallest by area. Pin `version` when
you need a specific footprint:

```ts
import { rmqr } from "etiket"

rmqr("HELLO", { version: 10 }) // R11x27 — the narrowest size
rmqr("HELLO", { version: 31, ecLevel: "H" }) // R17x139 at high EC
```

## Character Sets

Numeric, alphanumeric and byte modes, detected from the input. Byte-mode data is
UTF-8. Declare a character set explicitly with `eci`:

```ts
import { rmqr } from "etiket"

rmqr("Grüße", { eci: 26 }) // UTF-8
rmqr("Grüße", { eci: 3 }) // ISO-8859-1
```

## PNG

```ts
import { rmqrPNG, rmqrPNGDataURI } from "etiket"

rmqrPNG("HELLO", { moduleSize: 8, margin: 2 })
rmqrPNGDataURI("HELLO", { moduleSize: 6 })
```

## Caveats

- **Kanji mode is not implemented.** Japanese text goes out as UTF-8 bytes, which
  costs three bytes per character against kanji mode's 13 bits. Use a full
  [QR Code](/qr-code/kanji-mode) when the payload is mostly Japanese.
- Only EC levels M and H exist. There is no L and no Q.
- A `version` index outside 0–31 raises `CapacityError`, as does data too large
  for the requested size or for any size.
- Empty input raises `InvalidInputError`.

## CLI

```bash
etiket rmqr "HELLO" -o rmqr.svg
etiket rmqr "HELLO" --module-size 8 -o rmqr.png
```

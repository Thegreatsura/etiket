# Micro QR Code

The compact form of QR Code, from the same standard (ISO/IEC 18004). One finder
pattern instead of three, a 2-module quiet zone instead of 4, and four sizes:
M1 through M4, 11×11 to 17×17 modules.

## When to Use It

- Small electronic components and PCB marking
- Short payloads — a part number, a serial, a lot code
- Any label where a version 1 QR code (21×21 plus a 4-module quiet zone) is too
  big

For anything longer than about 35 digits, use a full [QR Code](/qr-code/).

## Usage

```ts
import { microqr, encodeMicroQR } from "etiket"

// Convenience function — returns SVG
microqr("12345")
microqr("12345", { version: 3, ecLevel: "M", size: 200 })

// Raw encoder — returns boolean[][], true = dark module
const matrix = encodeMicroQR("12345")
matrix.length // 11 — M1
```

The QR sub-path carries all three QR variants:

```ts
import { microqr, encodeMicroQR } from "etiket/qr"

microqr("12345")
encodeMicroQR("12345")
```

## Versions and Capacity

| Version | Size  | EC levels | Numeric | Alphanumeric | Byte |
| :------ | :---- | :-------- | ------: | -----------: | ---: |
| M1      | 11×11 | none      |       5 |            — |    — |
| M2      | 13×13 | L         |      10 |            6 |    — |
| M2      | 13×13 | M         |       8 |            5 |    — |
| M3      | 15×15 | L         |      23 |           14 |    9 |
| M3      | 15×15 | M         |      18 |           11 |    7 |
| M4      | 17×17 | L         |      35 |           21 |   15 |
| M4      | 17×17 | M         |      30 |           18 |   13 |
| M4      | 17×17 | Q         |      21 |           12 |    9 |

M1 carries error _detection_ only — there is no error correction level to choose
and no recovery from damage. M2 accepts numeric and alphanumeric data only; byte
mode starts at M3.

With no `version` the encoder takes the smallest one that holds the data at the
requested EC level.

## Options

| Option    | Type                | Default | Description                    |
| :-------- | :------------------ | :------ | :----------------------------- |
| `version` | `1 \| 2 \| 3 \| 4`  | auto    | M1 – M4                        |
| `ecLevel` | `"L" \| "M" \| "Q"` | auto    | Error correction (M1 has none) |
| `mask`    | `0 \| 1 \| 2 \| 3`  | auto    | Force a mask pattern           |

Plus the [shared matrix rendering options](/2d-codes/#shared-rendering-options).

Micro QR has four mask patterns, not the eight of full QR; they correspond to
full QR's masks 1, 4, 6 and 7.

## Mode Detection

The mode is detected from the input — all digits gives numeric, the QR
alphanumeric set (`0-9 A-Z $%*+-./: ` and space) gives alphanumeric, anything
else gives byte. There is no `mode` option, and the capacity table above is per
mode, so a single lowercase letter in an otherwise numeric string drops the
symbol from 35 characters of capacity to 15.

## PNG

```ts
import { microqrPNG, microqrPNGDataURI } from "etiket"

microqrPNG("12345", { moduleSize: 10, margin: 2 })
microqrPNGDataURI("12345")
```

## Caveats

- **No ECI, no Structured Append, no kanji mode.** The standard reserves kanji
  mode for M4; etiket does not implement it, and the other two are not part of
  Micro QR at all. Use a full QR code when you need any of them.
- **An EC level a version cannot provide is silently downgraded to `L`.** `Q`
  only exists on M4, and M1 has no error correction at all, so
  `microqr("12345", { version: 2, ecLevel: "Q" })` produces an M2 symbol at
  level L. With no `version`, the same fallback means a short payload with
  `ecLevel: "Q"` lands on a small symbol at L rather than on M4 at Q — pin
  `version: 4` when the level matters more than the size.
- Data past the version's capacity raises `CapacityError`.
- Empty input raises `InvalidInputError`.
- The quiet zone is 2 modules, not 4. Passing a larger `margin` is harmless;
  passing a smaller one produces a symbol that may not scan.

## CLI

```bash
etiket microqr "12345" -o microqr.svg
etiket microqr "12345" --module-size 10 -o microqr.png
```

# Plessey

One of the oldest linear symbologies still in service, developed by the Plessey
Company in the 1970s. Each hexadecimal digit becomes four bits, least significant
first, and every bit occupies a constant 5-module pitch: a `1` is a 3-module bar
and a 2-module gap, a `0` is a 1-module bar and a 4-module gap.

Not to be confused with [MSI Plessey](/barcodes/msi), which is a different
symbology with a similar name.

## When to Use It

- UK library systems — Anker and Sircam catalogues are the classic installations
- Legacy shelf-edge and inventory labelling

There is no reason to choose Plessey for a new system;
[Code 128](/barcodes/code128) is denser, more robust and universally supported.

## Usage

```ts
import { barcode, encodePlessey } from "etiket"

barcode("1234ABCD", { type: "plessey" })
barcode("1234ABCD", { type: "plessey", height: 60, showText: true })

// Raw encoder — element widths, alternating bar/space
const bars = encodePlessey("1234ABCD")
bars.length // 97
```

## Character Set

Hexadecimal only: `0-9` and `A-F`. Lowercase input is upper-cased before
encoding, so `"abc"` and `"ABC"` produce the same symbol.

```ts
import { encodePlessey } from "etiket"

encodePlessey("abcdef").length === encodePlessey("ABCDEF").length // true
```

## Check Digits

Two CRC check digits are **always** appended — there is no option to omit them.
The data bits are shifted through the generator polynomial
`x⁸ + x⁷ + x⁶ + x⁵ + x³ + 1`; the low nibble of the 8-bit remainder is the first
check digit and the high nibble the second.

Because they are appended automatically, do not include them in the input: doing
so encodes them as data and adds two more.

## Structure

| Element | Content                                                     |
| :------ | :---------------------------------------------------------- |
| Start   | The bit pattern `1101` — the same elements as the digit `B` |
| Data    | 4 elements per bit, 5 modules of pitch each                 |
| Check   | Two CRC digits, encoded like data                           |
| Stop    | A 5-module termination bar, then the reversed start pattern |

The reversed stop pattern is what lets a scanner read the symbol from either
direction.

## Caveats

- Any character outside `0-9 A-F` raises `InvalidInputError`; empty input does
  too.
- Plessey is a low-density symbology — 20 modules per hex digit. A 12-character
  payload is already over 240 modules wide, so plan the label width accordingly.
- There is no human-readable text convention. Pass `showText: true` and `text` if
  you want one.

## CLI

```bash
etiket barcode "1234ABCD" --type plessey -o plessey.svg
etiket barcode "1234ABCD" --type plessey --show-text -o plessey.png
```

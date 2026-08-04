# POSTNET and PLANET

The two USPS 2-state symbologies. Each bar is either **tall** (full height) or
**short**, both sitting on a common baseline — the data is in the height, not the
width. POSTNET routes mail to a delivery point; PLANET tracked it on the way.

Both were retired by USPS in favour of
[Intelligent Mail](/postal/imb) in 2013. They remain in the library for archival
work and for the non-USPS systems that copied them.

## Usage

```ts
import { postal, encodePostal } from "etiket"

postal("12345-6789", { type: "postnet" })
postal("12345678901", { type: "planet" })

// Raw encoder — 1 = tall, 0 = short
const bars = encodePostal("12345-6789", { type: "postnet" })
bars.length // 52
```

`barcode()` accepts both types too, and routes them to the postal renderer:

```ts
import { barcode } from "etiket"

barcode("12345", { type: "postnet" })
barcode("12345678901", { type: "planet" })
```

## POSTNET

| Property    | Value                                            |
| :---------- | :----------------------------------------------- |
| Input       | 5 (ZIP), 9 (ZIP+4) or 11 (delivery point) digits |
| Check digit | Automatic — digits summed, then made up to 10    |
| Bars        | 32, 52 or 62, including the frame bars           |
| Encoding    | 5 bars per digit, exactly 2 of them tall         |

```ts
import { encodePOSTNET } from "etiket"

encodePOSTNET("12345").length // 32 — 1 frame + 6 digits x 5 + 1 frame
encodePOSTNET("12345-6789").length // 52
encodePOSTNET("12345678901").length // 62
```

Spaces and hyphens are stripped, so `"12345-6789"` and `"123456789"` are the same
input.

## PLANET

| Property    | Value                                     |
| :---------- | :---------------------------------------- |
| Input       | 11 or 13 digits                           |
| Check digit | Automatic, same rule as POSTNET           |
| Encoding    | POSTNET's patterns inverted — 3 tall bars |

```ts
import { encodePLANET } from "etiket"

encodePLANET("12345678901").length // 62
```

PLANET is POSTNET with tall and short swapped: where POSTNET has 2 tall bars per
digit, PLANET has 3. A reader tells them apart by that ratio.

## Rendering

The short-bar height is a fraction of the full height, set by `shortRatio`. The
default `0.4` matches the USPS specification — 0.050 inch of a 0.125 inch bar:

```ts
import { postal } from "etiket"

postal("12345", {
  type: "postnet",
  height: 40, // full-bar height
  barWidth: 2, // width of one bar
  pitch: 4, // centre-to-centre spacing, default barWidth * 2
  shortRatio: 0.4, // short bar as a fraction of full height
  showText: true,
  text: "12345",
})
```

See [Postal Barcodes](/postal/) for the full option table.

## PNG

```ts
import { postalPNG, postalPNGDataURI } from "etiket"

postalPNG("12345-6789", { type: "postnet", scale: 2, pitch: 4, shortRatio: 0.4 })
postalPNGDataURI("12345678901", { type: "planet" })
```

## Caveats

- **`encodeBars()` throws for these types.** They carry no bar-width information,
  so a width array would be meaningless. Use `encodePostal()`, or `postal()` /
  `barcode()` for a rendered symbol.
- POSTNET accepts only 5, 9 or 11 digits and PLANET only 11 or 13; anything else
  raises `InvalidInputError`, as does a non-digit after separators are stripped.
- Do not include the check digit in the input — it is always appended, so a
  supplied one becomes data and shifts every following digit.
- These are legacy formats. New US mailings should use
  [Intelligent Mail](/postal/imb).

## CLI

```bash
etiket postal "12345-6789" --type postnet -o zip.svg
etiket postal "12345678901" --type planet -o planet.png
```

# Japan Post

The Japan Post 4-State Customer barcode (JP4SCC, カスタマバーコード). A 7-digit
postal code followed by the address portion, encoded with four bar states and a
check character.

## Usage

```ts
import { postal, encodePostal, encodeJapanPost } from "etiket"

// Postal code only
postal("1234567", { type: "jppost" })

// Postal code plus address
postal("1234567", { type: "jppost", routingCode: "1-2-3" })

// Raw encoder — FourState[] of "T" | "A" | "D" | "F"
const bars = encodePostal("1234567", { type: "jppost", routingCode: "1-2-3" })
bars.length // 67

encodeJapanPost("1234567", "1-2-3").length // 67
```

The address goes in `routingCode` — the same option [IMb](/postal/imb) uses for
its routing code, since both symbologies take a second data field.

## Input

| Field       | Rule                                           |
| :---------- | :--------------------------------------------- |
| Postal code | Exactly 7 digits, hyphens allowed and stripped |
| Address     | Digits, `-` and `A-Z`, up to 13 characters     |

The address is the part of the Japanese address that follows the postal code,
reduced to its numeric components — the form Japan Post's own guidance calls for.

Letters are expanded internally to two-character sequences, so an address with
letters uses more of the symbol's fixed length than a purely numeric one.

## Rendering

```ts
import { postal } from "etiket"

postal("1234567", {
  type: "jppost",
  routingCode: "1-2-3",
  height: 40,
  barWidth: 2,
  pitch: 4,
  trackerRatio: 1 / 3,
})
```

See [Postal Barcodes](/postal/) for the full option table.

## PNG

```ts
import { postalPNG } from "etiket"

postalPNG("1234567", { type: "jppost", routingCode: "1-2-3", scale: 2, pitch: 4 })
```

## Caveats

- A postal code that is not 7 digits raises `InvalidInputError`.
- An address character outside digits, `-` and `A-Z` raises `InvalidInputError`.
  Lowercase is not accepted — upper-case first.
- The symbol length is fixed by the specification, so a long address is padded or
  rejected rather than growing the symbol.
- `encodeBars()` throws for postal types — the data is in bar height, not width.

## CLI

```bash
etiket postal "1234567" --type jppost -o jppost.svg
etiket postal "1234567" --type jppost --routing-code "1-2-3" -o jppost.png
```

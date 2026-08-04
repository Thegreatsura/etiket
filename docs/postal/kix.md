# KIX

Klant Index — the Dutch postal barcode, used by PostNL. It shares RM4SCC's four
bar states and character patterns, but drops the start bar, the stop bar and the
check character: PostNL validates the address in its own systems instead.

## Usage

```ts
import { postal, encodePostal, encodeKIX } from "etiket"

postal("2500GG30000", { type: "kix" })

// Raw encoder — FourState[] of "T" | "A" | "D" | "F"
const bars = encodePostal("2500GG30000", { type: "kix" })
bars.length // 44 — exactly 4 bars per character
```

## Structure

Four bars per character, nothing else:

| Element | Bars            |
| :------ | :-------------- |
| Data    | 4 per character |

An 11-character payload therefore gives exactly 44 bars. There is no framing, so
the symbol's length is entirely determined by the input.

## Input

Uppercase `A-Z` and digits `0-9`. The conventional payload is the postcode,
house number and any addition, concatenated with no separators:

```ts
import { encodeKIX } from "etiket"

// Postcode 2500 GG, house number 30000
encodeKIX("2500GG30000").length // 44
```

PostNL specifies the exact composition — postcode, house number, and the addition
padded out — and that composition is the customer's responsibility. etiket
validates the character set only.

## Rendering

Identical to [RM4SCC](/postal/rm4scc): a centre tracker band of `trackerRatio` of
the height, with ascenders and descenders above and below.

```ts
import { postal } from "etiket"

postal("2500GG30000", {
  type: "kix",
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

postalPNG("2500GG30000", { type: "kix", scale: 2, pitch: 4 })
```

## Caveats

- **No check character.** A transcription error in the input produces a
  well-formed barcode carrying the wrong address. Validate upstream.
- Lowercase and punctuation raise `InvalidInputError`.
- Because there is no framing, a KIX symbol and an RM4SCC symbol of the same data
  are not the same barcode, and a reader configured for one may not accept the
  other.
- `encodeBars()` throws for postal types — the data is in bar height, not width.

## CLI

```bash
etiket postal "2500GG30000" --type kix -o kix.svg
etiket postal "2500GG30000" --type kix --bar-width 2 -o kix.png
```

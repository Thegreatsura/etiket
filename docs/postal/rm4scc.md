# RM4SCC

Royal Mail 4-State Customer Code — the barcode Royal Mail's automated letter
sorting reads. Four bar states: Tracker, Ascender, Descender and Full, four bars
per character, with start and stop bars and a check character.

Also known as RM4SCC, CBC (Customer Barcode) or simply "the Royal Mail barcode".

## Usage

```ts
import { postal, encodePostal, encodeRM4SCC } from "etiket"

postal("SN34RD1A", { type: "rm4scc" })

// Raw encoder — FourState[] of "T" | "A" | "D" | "F"
const bars = encodePostal("SN34RD1A", { type: "rm4scc" })
bars.length // 38

encodeRM4SCC("SN34RD1A").join("") // "AFTFTFDTADTAFDTFAFTADTFADTDAFDADAADDAF"
```

## Structure

| Element | Bars            |
| :------ | :-------------- |
| Start   | 1               |
| Data    | 4 per character |
| Check   | 4               |
| Stop    | 1               |

So an 8-character payload gives `1 + 32 + 4 + 1 = 38` bars.

The check character comes from the RM4SCC grid: the row and column values of each
character are summed separately, each modulo 6, and the pair identifies the check
character.

## Input

Uppercase letters `A-Z` and digits `0-9`. In practice the payload is the outward
and inward postcode with the Delivery Point Suffix appended and all spaces
removed:

```ts
import { encodeRM4SCC } from "etiket"

// Postcode SN3 4RD, delivery point suffix 1A
encodeRM4SCC("SN34RD1A").length // 38
```

Royal Mail specifies which postcode formats are valid and how the DPS is derived;
etiket validates the character set, not the postcode.

## Rendering

The four states share a centre "tracker" band whose height is `trackerRatio` of
the total, with ascenders and descenders extending into the space above and
below:

```ts
import { postal } from "etiket"

postal("SN34RD1A", {
  type: "rm4scc",
  height: 40,
  barWidth: 2,
  pitch: 4,
  trackerRatio: 1 / 3, // equal ascender / tracker / descender
})
```

Royal Mail's own specification calls for particular bar dimensions and pitch;
set `height`, `barWidth`, `pitch` and `unit` to match rather than relying on the
defaults, which are pixel-oriented.

See [Postal Barcodes](/postal/) for the full option table.

## PNG

```ts
import { postalPNG } from "etiket"

postalPNG("SN34RD1A", { type: "rm4scc", scale: 2, pitch: 4, trackerRatio: 1 / 3 })
```

## Caveats

- Lowercase and punctuation raise `InvalidInputError`. Strip spaces from the
  postcode before encoding.
- The check character is always appended; do not include one in the input.
- `encodeBars()` throws for postal types — the data is in bar height, not width.
- [KIX](/postal/kix) uses the same four states and the same character patterns
  but omits the start, stop and check bars. The two are not interchangeable.

## CLI

```bash
etiket postal "SN34RD1A" --type rm4scc -o rm4scc.svg
etiket postal "SN34RD1A" --type rm4scc --bar-width 2 --pitch 4 -o rm4scc.png
```

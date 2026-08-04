# Han Xin Code

ISO/IEC 20830 — the Chinese national 2D symbology. Square, 23×23 to 189×189
modules across 84 versions, with a finder pattern in every corner. The
bottom-left finder differs from the other three, which is how a reader recovers
the symbol's orientation.

etiket's encoder is verified module-for-module against the BWIPP reference
encoder.

## When to Use It

- Products and documents for the Chinese market, where Han Xin is the mandated
  or preferred symbology
- Payloads where you want QR-like capacity with four-corner orientation recovery

Outside those cases, QR Code has far broader reader support.

## Usage

```ts
import { hanxin, encodeHanXin } from "etiket"

// Convenience function — returns SVG
hanxin("HELLO")
hanxin("HELLO", { ecLevel: 3, version: 5 })

// Raw encoder — returns boolean[][], true = dark module
const matrix = encodeHanXin("HELLO")
matrix.length // 23 — version 1
```

Available from the `etiket/2d` sub-path as well:

```ts
import { hanxin, encodeHanXin } from "etiket/2d"

hanxin("HELLO")
encodeHanXin("HELLO")
```

## Versions and Error Correction

A version-`v` symbol is `v * 2 + 21` modules square, so version 1 is 23×23 and
version 84 is 189×189.

| EC level | Overhead | Use for                               |
| :------- | :------- | :------------------------------------ |
| `1`      | ~8%      | Clean print, controlled reading       |
| `2`      | ~15%     | General use (default)                 |
| `3`      | ~23%     | Industrial environments               |
| `4`      | ~30%     | Damaged or partially obscured symbols |

## Options

| Option    | Type               | Default | Description                                   |
| :-------- | :----------------- | :------ | :-------------------------------------------- |
| `ecLevel` | `1 \| 2 \| 3 \| 4` | `2`     | Error correction level L1–L4                  |
| `version` | `1-84`             | auto    | Symbol is `version * 2 + 21` modules square   |
| `mask`    | `1 \| 2 \| 3 \| 4` | auto    | Force a mask instead of the spec's evaluation |

Plus the [shared matrix rendering options](/2d-codes/#shared-rendering-options).

## Encoding Modes

Two of the standard's modes are used: **Numeric** for digit runs long enough to
pay for the mode switch, and **Byte** for everything else. That is the same
segmentation BWIPP performs, which is what makes module-for-module comparison
possible.

The standard's Text mode and its four Chinese modes are compaction optimisations
over the same bit stream grammar. Omitting them costs symbol size on some
payloads but never conformance, since a conforming reader must accept Byte mode.

## Caveats

- **Byte-mode data is emitted as UTF-8.** ISO/IEC 20830 leaves byte-mode
  interpretation to the application; readers that default to GB 18030 will read
  ASCII correctly but not other scripts. Test with your target reader before
  putting Chinese text through it.
- The Text and Chinese compaction modes are not implemented, so a Chinese payload
  produces a larger symbol than a fully optimising encoder would.
- A `version` too small for the data raises `CapacityError` naming the version
  and EC level; data too large for version 84 raises it without a version.
- `ecLevel` outside 1–4, `version` outside 1–84 and `mask` outside 1–4 each raise
  `InvalidInputError`. Empty input does too.

## PNG

```ts
import { hanxinPNG, hanxinPNGDataURI } from "etiket"

hanxinPNG("HELLO", { moduleSize: 8, margin: 3 })
hanxinPNGDataURI("HELLO", { moduleSize: 6 })
```

## CLI

```bash
etiket hanxin "HELLO" -o hanxin.svg
etiket hanxin "HELLO" --module-size 8 -o hanxin.png
```

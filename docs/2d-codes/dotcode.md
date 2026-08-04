# DotCode

AIM ISS DotCode. A grid of round dots rather than square modules, designed to be
printed by an inkjet head on a production line running at full speed. Only
positions where `(x + y)` is even may be lit, so a misfiring nozzle damages one
dot rather than a whole module.

## When to Use It

- Tobacco and pharmaceutical track-and-trace marking
- High-speed inkjet or laser marking, where print quality is poor by nature
- Curved or textured surfaces that break up a solid module

## Usage

```ts
import { dotcode, encodeDotCode } from "etiket"

// Convenience function — returns SVG
dotcode("HELLO")
dotcode("HELLO", { size: 300, color: "#111" })

// Raw encoder — returns boolean[][], true = a lit dot
const matrix = encodeDotCode("HELLO")
```

The `etiket/2d` sub-path carries DotCode along with the other symbologies that
have no entry point of their own:

```ts
import { dotcode, encodeDotCode } from "etiket/2d"

dotcode("HELLO")
encodeDotCode("HELLO")
```

## Capacity and Constraints

| Property     | Range                                       |
| :----------- | :------------------------------------------ |
| Input length | 1 – 2000 characters                         |
| Rows         | 5 – 200                                     |
| Columns      | 5 – 200                                     |
| Shape rule   | `rows + columns` must be **odd**            |
| Mask         | 4 patterns, scored and chosen automatically |

With neither `rows` nor `columns` given, the encoder picks a symbol with roughly
a 3:2 aspect ratio that fits the data.

## Options

| Option    | Type    | Default | Description                     |
| :-------- | :------ | :------ | :------------------------------ |
| `rows`    | `5-200` | auto    | Fixed symbol height in dots     |
| `columns` | `5-200` | auto    | Fixed symbol width in dots      |
| `mask`    | `0-3`   | auto    | Force a mask instead of scoring |

Plus the [shared matrix rendering options](/2d-codes/#shared-rendering-options).

```ts
import { dotcode } from "etiket"

// 13 + 18 = 31, odd — accepted
dotcode("HELLO", { rows: 13, columns: 18 })
```

## Encoding

Data is encoded as GF(113) codewords in modes A, B, C and Binary, with
Reed-Solomon error correction over the same field, interleaved for long symbols.
The codewords are laid out along a serpentine walk; six fixed corner and edge
dots come from the tail of the bit stream.

Non-ASCII text is converted to UTF-8 first, and the high bytes go through binary
mode.

## PNG

```ts
import { dotcodePNG, dotcodePNGDataURI } from "etiket"

dotcodePNG("HELLO", { moduleSize: 6 })
dotcodePNGDataURI("HELLO")
```

The PNG rasterizer draws square pixels per dot position, so the output is a
sampled grid rather than round dots. For round dots, render the SVG.

## Caveats

- **No GS1 support.** FNC1 and FNC2 (GS1 and ECI) and FNC3 (reader programming)
  are not implemented, because the public entry point takes plain text rather
  than a pre-parsed message. A GS1 payload must go in a different symbology.
- `rows + columns` must be odd. Giving both with an even sum raises
  `InvalidInputError`.
- Fixing a size too small for the data raises `InvalidInputError` — the encoder
  will not silently grow the symbol you asked for.
- Input over 2000 characters raises `InvalidInputError`; empty input does too.

## CLI

```bash
etiket dotcode "HELLO" -o dotcode.svg
etiket dotcode "HELLO" --module-size 6 -o dotcode.png
```

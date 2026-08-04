# JAB Code

ISO/IEC 23634 — a polychrome symbology. Every module carries a colour index
rather than a black/white bit, so a 4-colour symbol holds 2 bits per module and
an 8-colour symbol 3, against 1 for a monochrome matrix.

> [!WARNING]
> **Experimental — not conformant.** etiket's JAB Code encoder is **not
> ISO/IEC 23634 conformant**. The error correction is an XOR parity scheme rather
> than the standard's LDPC codes, and the metadata and finder patterns do not
> follow the specification either. Symbols are visually plausible and
> self-consistent, but **no conforming reader will decode them**.
>
> It stays in the library because there is no way to fix it responsibly: no
> JavaScript or WebAssembly JAB decoder exists, and neither zxing nor BWIPP
> implements the symbology, so a corrected implementation could not be verified
> against anything. Every other symbology here is checked against a real decoder
> or a reference implementation; this one cannot be, and says so.
>
> Use it for layout experiments and visual mock-ups, not for anything that has to
> scan.

## Usage

```ts
import { jabcode, encodeJABCode } from "etiket"

// Convenience function — returns SVG
jabcode("HELLO")
jabcode("HELLO", { colors: 8, ecPercent: 30 })

// Raw encoder — a matrix of palette indices plus the palette
const result = encodeJABCode("HELLO")
result.matrix // number[][] — each cell is an index into result.palette
result.rows // 21
result.cols // 21
result.palette // readonly string[]
```

Available from the `etiket/2d` sub-path as well:

```ts
import { jabcode, encodeJABCode, JAB_COLORS_4, JAB_COLORS_8 } from "etiket/2d"

jabcode("HELLO")
encodeJABCode("HELLO", { colors: 8 })
JAB_COLORS_4.length // 4
JAB_COLORS_8.length // 8
```

## Options

| Option      | Type     | Default | Description                 |
| :---------- | :------- | :------ | :-------------------------- |
| `colors`    | `4 \| 8` | `4`     | Palette size                |
| `ecPercent` | `number` | `20`    | Error correction percentage |

## Rendering

Because the output is a palette-indexed matrix, JAB Code renders through
`renderColorMatrixSVG`, whose options are **not** the shared matrix options:
there is no single `color`, and there is a `palette` override instead.

| Option                                  | Type       | Default | Description                              |
| :-------------------------------------- | :--------- | :------ | :--------------------------------------- |
| `palette`                               | `string[]` | encoder | Override the encoder's colours           |
| `size`                                  | `number`   | `200`   | SVG size in pixels                       |
| `margin`                                | `number`   | `2`     | Quiet zone in modules                    |
| `background`                            | `string`   | `#fff`  | Background; `transparent` omits the rect |
| `rowHeight`                             | `number`   | `1`     | Row height as a multiple of module width |
| `ariaLabel` / `role` / `title` / `desc` | `string`   | —       | Accessibility metadata                   |

```ts
import { encodeJABCode, renderColorMatrixSVG } from "etiket"

const result = encodeJABCode("HELLO", { colors: 4 })

// The encoder's own palette
renderColorMatrixSVG(result.matrix, result.palette, { size: 240 })

// A custom one — same number of entries as the palette size
renderColorMatrixSVG(result.matrix, result.palette, {
  palette: ["#000000", "#e63946", "#457b9d", "#f1faee"],
})
```

Modules sharing a palette entry are merged into a single `<path>`, so the output
stays compact regardless of palette size.

## PNG

JAB Code is the one symbology that goes through the true-colour PNG path rather
than the two-colour one:

```ts
import { jabcodePNG, jabcodePNGDataURI } from "etiket"

jabcodePNG("HELLO", { moduleSize: 8, margin: 4 })

jabcodePNGDataURI("HELLO", {
  palette: ["#000000", "#e63946", "#457b9d", "#f1faee"],
})
```

The PNG options are `moduleSize` (pixels per module, default 10), `margin`
(quiet zone in modules, default 4), `background` and `palette` — there is no
`color`, for the same reason the SVG renderer has none.

## Caveats

- The output does not conform to ISO/IEC 23634 — see the warning above.
- `encode()` does not accept `"jabcode"`: its result type is a boolean matrix,
  and JAB Code produces palette indices. Call `encodeJABCode()` directly.
- The symbol side is always odd and at least 21 modules; past 85 the encoder
  raises `CapacityError`.
- A custom `palette` must keep the colours distinguishable to a camera. Replacing
  the default primaries with near neighbours produces a symbol that renders but
  could not be read even by a conforming decoder.
- Empty input raises `InvalidInputError`.

## CLI

```bash
etiket jabcode "HELLO" -o jabcode.svg
etiket jabcode "HELLO" --colors 8 --ec-percent 30 -o jabcode.svg
```

The CLI command is SVG-only: asking it for PNG output reports an error rather
than writing a monochrome approximation. Use `jabcodePNG()` from the API for
raster output.

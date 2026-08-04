# Codablock F

A stacked symbology: several rows of Code 128, tied together by row indicators
and separated by 1-module separator rows. It reads on ordinary linear scanning
equipment, which is why it survives in places a true 2D symbology never reached.

## When to Use It

- Healthcare and pharmacy labelling, where Codablock F is entrenched
- Long payloads on hardware that can only scan linear symbologies
- Narrow labels where a single Code 128 row would be too long to fit

## Usage

```ts
import { codablockf, encodeCodablockF } from "etiket"

// Convenience function — returns SVG
codablockf("CODABLOCK F DATA")
codablockf("CODABLOCK F DATA", { columns: 8 })

// Raw encoder
const result = encodeCodablockF("CODABLOCK F DATA")
result.rows // 3 — data rows
result.cols // 145 — modules per row
result.matrix.length // 7 — 2 * rows + 1, separators included
result.separatorRows // [0, 2, 4, 6]
```

Available from the `etiket/2d` sub-path as well:

```ts
import { codablockf, encodeCodablockF } from "etiket/2d"

codablockf("DATA")
encodeCodablockF("DATA")
```

## Matrix Shape

The returned matrix is **not** one row per data row. It interleaves the
separators the specification requires above, below and between the data rows, so
it has `2 * rows + 1` entries:

| Matrix index | Content    |
| :----------- | :--------- |
| 0            | Separator  |
| 1            | Data row 1 |
| 2            | Separator  |
| 3            | Data row 2 |
| …            | …          |
| `2 * rows`   | Separator  |

`separatorRows` lists the separator indices. They render 1 module tall while the
data rows render at the full row height — `codablockf()` wires that up for you
through the renderer's `rowHeights` option:

```ts
import { encodeCodablockF, renderMatrixSVG } from "etiket"

const result = encodeCodablockF("DATA")
const separators = new Set(result.separatorRows)

renderMatrixSVG(result.matrix, {
  rowHeight: 8,
  rowHeights: result.matrix.map((_, i) => (separators.has(i) ? 1 : 8)),
})
```

## Options

| Option      | Type     | Default | Description                      |
| :---------- | :------- | :------ | :------------------------------- |
| `columns`   | `4-62`   | `8`     | Data columns per row             |
| `rowHeight` | `number` | `8`     | Data row height in module widths |

Plus the rest of the
[shared matrix rendering options](/2d-codes/#shared-rendering-options).

## Capacity and Constraints

| Property   | Range                       |
| :--------- | :-------------------------- |
| Data rows  | up to 44                    |
| Columns    | 4 – 62 data columns per row |
| Characters | ASCII 0 – 127               |

More columns means fewer, longer rows; fewer columns means a taller, narrower
symbol. Data that needs more than 44 rows raises `CapacityError`.

## PNG

```ts
import { codablockfPNG, codablockfPNGDataURI } from "etiket"

codablockfPNG("CODABLOCK F DATA", { moduleSize: 3 })
codablockfPNGDataURI("DATA", { columns: 10 })
```

The PNG helper applies the same per-row heights as the SVG one, so separators
stay 1 module tall in raster output too.

## Caveats

- Characters above ASCII 127 raise `InvalidInputError`. Codablock F inherits
  Code 128's character sets A and B only.
- `columns` outside 4–62, or a non-integer, raises `InvalidInputError`.
- Setting `rowHeight: 1` gives square modules but a symbol that no linear scanner
  will read — the tall rows are what make it scannable.
- Empty input raises `InvalidInputError`.

## CLI

```bash
etiket codablockf "CODABLOCK F DATA" -o codablock.svg
etiket codablockf "DATA" --module-size 3 -o codablock.png
```

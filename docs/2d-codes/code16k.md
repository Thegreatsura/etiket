# Code 16K

A stacked symbology built on Code 128's character sets: 2 to 16 rows of exactly
5 symbol characters each, every row 70 modules wide, with 1-module separators
between them. Like [Codablock F](/2d-codes/codablock-f) it reads on linear
scanning equipment.

## When to Use It

- Small-item labelling where the payload is short but a single linear row would
  be too long
- Legacy systems already standardised on Code 16K

For anything new with a free choice of symbology, Data Matrix is denser.

## Usage

```ts
import { code16k, encodeCode16K } from "etiket"

// Convenience function — returns SVG
code16k("CODE 16K DATA")
code16k("CODE 16K DATA", { size: 300 })

// Raw encoder
const result = encodeCode16K("CODE 16K DATA")
result.rows // 4 — data rows
result.cols // 70 — always
result.matrix.length // 9 — 2 * rows + 1, separators included
result.separatorRows // [0, 2, 4, 6, 8]
```

Available from the `etiket/2d` sub-path as well:

```ts
import { code16k, encodeCode16K } from "etiket/2d"

code16k("DATA")
encodeCode16K("DATA")
```

## Matrix Shape

As with Codablock F, the matrix interleaves separator rows, so it holds
`2 * rows + 1` entries and `separatorRows` lists the separator indices. Each row
is 70 modules: a 7-module start pattern, a 1-module separator bar, five 11-module
symbol characters and a 7-module stop pattern.

`code16k()` renders data rows 8 module widths tall and separators 1, via the
renderer's `rowHeights` option. Do it by hand with the raw encoder:

```ts
import { encodeCode16K, renderMatrixSVG } from "etiket"

const result = encodeCode16K("DATA")
const separators = new Set(result.separatorRows)

renderMatrixSVG(result.matrix, {
  rowHeight: 8,
  rowHeights: result.matrix.map((_, i) => (separators.has(i) ? 1 : 8)),
})
```

## Capacity and Constraints

| Property   | Value                             |
| :--------- | :-------------------------------- |
| Rows       | 2 – 16, chosen from the data size |
| Row width  | 70 modules, fixed                 |
| Capacity   | `5 * rows - 3` symbol characters  |
| Characters | ASCII 0 – 127                     |

The three characters subtracted from each row count are the mode character and
the two check characters. A full 16-row symbol therefore holds 77 symbol
characters — more when digit pairs compress two to one, fewer when the data
forces character-set switches.

There is no `columns` option: the row width is fixed by the specification and the
row count follows from the data.

## Options

| Option      | Type     | Default | Description                      |
| :---------- | :------- | :------ | :------------------------------- |
| `rowHeight` | `number` | `8`     | Data row height in module widths |

Plus the rest of the
[shared matrix rendering options](/2d-codes/#shared-rendering-options).

## PNG

```ts
import { code16kPNG, code16kPNGDataURI } from "etiket"

code16kPNG("CODE 16K DATA", { moduleSize: 3 })
code16kPNGDataURI("DATA")
```

## Caveats

- Characters above ASCII 127 raise `InvalidInputError`.
- Data beyond 16 rows raises `CapacityError`.
- Setting `rowHeight: 1` gives square modules but an unscannable symbol.
- Empty input raises `InvalidInputError`.

## CLI

```bash
etiket code16k "CODE 16K DATA" -o code16k.svg
etiket code16k "DATA" --module-size 3 -o code16k.png
```

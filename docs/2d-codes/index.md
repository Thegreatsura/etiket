# 2D Codes

Besides QR Code, etiket supports three additional 2D barcode formats.

## Data Matrix

ECC 200 standard. 24 square sizes (10x10 to 144x144) plus 6 rectangular sizes.

```ts
import { datamatrix, encodeDataMatrix } from "etiket";

// Convenience function — returns SVG
datamatrix("Hello World");
datamatrix("Data", { size: 200, color: "#333" });

// Raw encoder — returns boolean[][]
const matrix = encodeDataMatrix("Hello");
```

Used in: electronics, healthcare, aerospace (small items requiring dense data).

## PDF417

Stacked 2D barcode with 929 possible codeword values and 9 error correction levels.

```ts
import { pdf417, encodePDF417 } from "etiket";

// Convenience function — returns SVG
pdf417("Hello World");
pdf417("Data", { ecLevel: 4, columns: 5, compact: true });

// Raw encoder — returns { matrix, rows, cols }
const result = encodePDF417("Hello", { ecLevel: 2 });
```

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `ecLevel` | `0-8` | `2` | Error correction level |
| `columns` | `1-30` | auto | Number of data columns |
| `compact` | `boolean` | `false` | Compact PDF417 (no right indicator) |

Used in: government IDs, transport tickets, shipping labels.

## Aztec Code

Bullseye-centered barcode. No quiet zone required — ideal for space-constrained applications.

```ts
import { aztec, encodeAztec } from "etiket";

// Convenience function — returns SVG
aztec("Hello World");
aztec("Data", { ecPercent: 33, size: 200 });

// Raw encoder — returns boolean[][]
const matrix = encodeAztec("Hello", { compact: true });
```

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `ecPercent` | `number` | `23` | Error correction percentage |
| `layers` | `number` | auto | Force specific layer count |
| `compact` | `boolean` | auto | Compact (1-4 layers) or full-range (1-32) |

Used in: boarding passes, transport tickets, healthcare.

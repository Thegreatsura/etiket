# 1D Barcodes

etiket supports 18 types of 1D barcodes. All are generated with the `barcode()` function.

```ts
import { barcode } from "etiket";

const svg = barcode("data", { type: "code128" });
```

## Supported Formats

| Format | Type | Characters | Check Digit |
| :--- | :--- | :--- | :--- |
| [Code 128](/barcodes/code128) | `code128` | Full ASCII | Auto (mod 103) |
| [Code 39](/barcodes/code39) | `code39` | 0-9, A-Z, -.$/+% space | Optional (mod 43) |
| [Code 39 Extended](/barcodes/code39) | `code39ext` | Full ASCII | Optional (mod 43) |
| [Code 93](/barcodes/code93) | `code93` | 0-9, A-Z, -.$/+% space | Auto (C + K) |
| [Code 93 Extended](/barcodes/code93) | `code93ext` | Full ASCII | Auto (C + K) |
| [EAN-13](/barcodes/ean) | `ean13` | 0-9 (12-13 digits) | Auto (mod 10) |
| [EAN-8](/barcodes/ean) | `ean8` | 0-9 (7-8 digits) | Auto (mod 10) |
| [EAN-5](/barcodes/ean) | `ean5` | 0-9 (5 digits) | Parity-based |
| [EAN-2](/barcodes/ean) | `ean2` | 0-9 (2 digits) | Parity-based |
| [UPC-A](/barcodes/upc) | `upca` | 0-9 (11-12 digits) | Auto (mod 10) |
| [UPC-E](/barcodes/upc) | `upce` | 0-9 (6-8 digits) | Auto (mod 10) |
| [ITF](/barcodes/itf) | `itf` | 0-9 (even count) | — |
| [ITF-14](/barcodes/itf) | `itf14` | 0-9 (13-14 digits) | Auto (mod 10) |
| [Codabar](/barcodes/codabar) | `codabar` | 0-9, -$:/.+ | — |
| [MSI Plessey](/barcodes/msi) | `msi` | 0-9 | Configurable |
| [Pharmacode](/barcodes/pharmacode) | `pharmacode` | 3-131070 | — |
| [Code 11](/barcodes/code11) | `code11` | 0-9, - | Auto (C + K) |
| [GS1-128](/barcodes/gs1-128) | `gs1-128` | AI-based | Auto |

## Common Options

All barcode types share these rendering options:

```ts
barcode("data", {
  type: "code128",
  height: 80,           // Bar height in pixels
  barWidth: 2,          // Width multiplier per module
  color: "#000",        // Bar color
  background: "#fff",   // Background color ('transparent' supported)
  showText: true,       // Show human-readable text
  text: "custom text",  // Override displayed text
  fontSize: 14,         // Text font size
  fontFamily: "monospace",
  margin: 10,           // Margin around barcode
  textAlign: "center",  // 'center' | 'left' | 'right'
});
```

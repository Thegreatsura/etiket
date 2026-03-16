# Rendering

etiket provides multiple rendering options for different use cases.

## SVG String (Default)

All high-level functions return SVG strings:

```ts
import { barcode, qrcode, datamatrix, pdf417, aztec } from "etiket";

const svg = barcode("Hello");
// '<svg xmlns="http://www.w3.org/2000/svg" ...>...</svg>'
```

## Data URI

For embedding directly in `<img>` tags or CSS:

```ts
import { barcodeDataURI, qrcodeDataURI } from "etiket";

const uri = qrcodeDataURI("Hello");
// 'data:image/svg+xml,...'

// Use in HTML
`<img src="${uri}" alt="QR Code" />`;
```

## Base64

```ts
import { barcodeBase64, qrcodeBase64 } from "etiket";

const b64 = qrcodeBase64("Hello");
// 'data:image/svg+xml;base64,...'
```

## Terminal Output

Print QR codes in the terminal using Unicode half-block characters:

```ts
import { qrcodeTerminal } from "etiket";

console.log(qrcodeTerminal("Hello"));
```

Uses `▀`, `▄`, `█` and space characters for compact display (2 rows per line).

## Low-Level Renderers

For custom rendering pipelines:

```ts
import {
  renderBarcodeSVG,
  renderQRCodeSVG,
  renderMatrixSVG,
  renderText,
  svgToDataURI,
  svgToBase64,
  svgToBase64Raw,
} from "etiket";

// Custom barcode SVG
const svg = renderBarcodeSVG(bars, {
  height: 100,
  barWidth: 3,
  color: "#333",
  showText: true,
  text: "CUSTOM",
});

// Custom QR SVG with styling
const qrSvg = renderQRCodeSVG(matrix, {
  size: 400,
  dotType: "dots",
  color: { type: "linear", rotation: 45, stops: [...] },
});

// Generic 2D matrix SVG (Data Matrix, Aztec)
const matrixSvg = renderMatrixSVG(booleanMatrix, { size: 200 });

// Terminal text
const text = renderText(matrix, { compact: true, margin: 2 });

// Convert any SVG
const uri = svgToDataURI(svg);
const b64 = svgToBase64(svg);
const raw = svgToBase64Raw(svg); // No data: prefix
```

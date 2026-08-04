# Deutsche Post: Identcode and Leitcode

Two German postal symbologies, both [Interleaved 2 of 5](/barcodes/itf) with a
Deutsche Post check digit. **Identcode** identifies a single item; **Leitcode**
identifies where it is going.

## When to Use It

- Parcels and mail handed to Deutsche Post / DHL under a German contract
- Warehouse systems that mirror those numbers internally

## Identcode

12 digits: 11 of data plus a check digit.

| Field           | Digits |
| :-------------- | -----: |
| Mail centre     |      2 |
| Customer ID     |      3 |
| Delivery number |      6 |
| Check digit     |      1 |

```ts
import { barcode, encodeIdentcode } from "etiket"

// 11 digits — the check digit is calculated
barcode("56300000000", { type: "identcode" })

// 12 digits — the check digit is verified
barcode("563000000004", { type: "identcode", showText: true })

const bars = encodeIdentcode("56300000000")
bars.length // 67
```

## Leitcode

14 digits: 13 of data plus a check digit.

| Field        | Digits |
| :----------- | -----: |
| Postal code  |      5 |
| Street ID    |      3 |
| House number |      3 |
| Product code |      2 |
| Check digit  |      1 |

```ts
import { barcode, encodeLeitcode } from "etiket"

// 13 digits — the check digit is calculated
barcode("1234567890123", { type: "leitcode" })

// 14 digits — the check digit is verified
barcode("12345678901236", { type: "leitcode" })

const bars = encodeLeitcode("1234567890123")
bars.length // 77
```

## Check Digit

Both use the same rule: each digit is multiplied by 4 or 9, alternating from the
left, and the check digit is what brings the sum up to the next multiple of 10.

```ts
import { encodeIdentcode, CheckDigitError } from "etiket"

encodeIdentcode("563000000004") // correct check digit — accepted

try {
  encodeIdentcode("563000000009") // wrong check digit
} catch (error) {
  error instanceof CheckDigitError // true
}
```

Supplying the full-length form is the safer habit: it means a transcription error
upstream is caught here rather than at the sorting centre.

## Caveats

- Whitespace is stripped from the input; anything else non-numeric raises
  `InvalidInputError`.
- A length other than 11/12 (Identcode) or 13/14 (Leitcode) raises
  `InvalidInputError`.
- A wrong check digit raises `CheckDigitError`, which extends
  `InvalidInputError` — catch the broader class if you do not need to
  distinguish.
- Both are Interleaved 2 of 5 underneath, which has no self-checking property.
  Print them at the size Deutsche Post specifies and consider bearer bars
  (`bearerBars: true`) to guard against short scans.

## CLI

```bash
etiket barcode "56300000000" --type identcode --show-text -o ident.svg
etiket barcode "1234567890123" --type leitcode -o leit.svg
```

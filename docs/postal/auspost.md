# Australia Post

The Australia Post 4-State Customer Barcode. An 8-digit Delivery Point
Identifier, a Format Control Code that selects the symbol length, optional
customer information, and four Reed-Solomon check symbols over GF(64).

## Usage

```ts
import { postal, encodePostal, encodeAustraliaPost } from "etiket"

// Standard Customer Barcode — FCC 11
postal("12345678", { type: "auspost" })

// Customer Barcode 2 — FCC 59, with customer information
postal("12345678SHR", { type: "auspost", fcc: "59" })

// Raw encoder — FourState[] of "T" | "A" | "D" | "F"
const bars = encodePostal("12345678", { type: "auspost", fcc: "11" })
bars.length // 37

encodeAustraliaPost("59", "12345678", "SHR").length // 52
```

## Format Control Codes

| FCC  | Bars | Customer information |
| :--- | ---: | :------------------- |
| `11` |   37 | none                 |
| `45` |   37 | none                 |
| `59` |   52 | up to 5 characters   |
| `62` |   67 | up to 10 characters  |
| `87` |   37 | none                 |
| `92` |   37 | none                 |

The default is `"11"`. The customer information capacity above is for character
encoding — 3 bars per character. Numeric encoding uses 2 bars per digit, so FCC
59 takes 8 digits and FCC 62 takes 15.

## Customer Information

Through `postal()` and `encodePostal()` there is only one text argument, so the
customer information is appended to the DPID: the encoder reads the first 8
digits as the DPID (tolerating spaces and hyphens) and treats the remainder as
customer information.

```ts
import { postal, encodeAustraliaPost } from "etiket"

// DPID 12345678, customer information "SHR"
postal("12345678SHR", { type: "auspost", fcc: "59" })

// The raw encoder takes them separately, and can switch encoding
encodeAustraliaPost("59", "12345678", "SHR")
encodeAustraliaPost("62", "12345678", "12345678901234", {
  custInfoEncoding: "numeric",
})
```

| Encoding      | Bars per character | Character set                |
| :------------ | -----------------: | :--------------------------- |
| `"character"` |                  3 | `A-Z a-z 0-9`, space and `#` |
| `"numeric"`   |                  2 | `0-9` only                   |

`custInfoEncoding` is only reachable through `encodeAustraliaPost()` — `postal()`
does not forward it.

## Rendering

```ts
import { postal } from "etiket"

postal("12345678", {
  type: "auspost",
  height: 40,
  barWidth: 2,
  pitch: 4,
  trackerRatio: 1 / 3,
})
```

See [Postal Barcodes](/postal/) for the full option table.

## PNG

```ts
import { postalPNG } from "etiket"

postalPNG("12345678", { type: "auspost", fcc: "11", scale: 2, pitch: 4 })
```

## Caveats

- An FCC outside `11`, `45`, `59`, `62`, `87` and `92` raises
  `InvalidInputError`. (`PostalEncodingOptions.fcc` documents only 11, 59 and 62
  in its type comment; the encoder accepts all six.)
- A DPID that is not 8 digits raises `InvalidInputError`.
- Customer information longer than the FCC allows raises `InvalidInputError`
  naming the maximum; an out-of-charset character does too, as does a non-digit
  under `custInfoEncoding: "numeric"`.
- Australia Post assigns DPIDs and controls which FCC a mailer may use. A
  well-formed symbol is not the same as an accepted one.
- `encodeBars()` throws for postal types — the data is in bar height, not width.

## CLI

```bash
etiket postal "12345678" --type auspost -o auspost.svg
etiket postal "12345678SHR" --type auspost --fcc 59 -o auspost2.svg
```

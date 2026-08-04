# Intelligent Mail Barcode

USPS Intelligent Mail (IMb, OneCode, USPS4CB) — the barcode that replaced
[POSTNET and PLANET](/postal/postnet-planet) in 2013. Always 65 bars, always four
states, carrying a 20-digit tracking code and an optional routing code with a
CRC-11 frame check sequence.

## Usage

```ts
import { postal, encodePostal, encodeIMb } from "etiket"

// Tracking code only
postal("01234567094987654321", { type: "imb" })

// With a delivery-point routing code
postal("01234567094987654321", {
  type: "imb",
  routingCode: "01234567891",
})

// Raw encoder — FourState[] of "T" | "A" | "D" | "F"
const bars = encodePostal("01234567094987654321", {
  type: "imb",
  routingCode: "01234567891",
})
bars.length // 65 — always

encodeIMb("01234567094987654321", "01234567891").length // 65
```

## Data Fields

The tracking code is exactly 20 digits:

| Field           | Digits | Meaning                          |
| :-------------- | -----: | :------------------------------- |
| Barcode ID      |      2 | Presort and OEL information      |
| Service Type ID |      3 | Mail class and service requested |
| Mailer ID       |    6/9 | Assigned by USPS                 |
| Serial Number   |    9/6 | Mailer's own sequence            |

The routing code is the destination ZIP, at one of four lengths:

| Routing code | Meaning                   |
| :----------- | :------------------------ |
| 0 digits     | No routing information    |
| 5 digits     | ZIP5                      |
| 9 digits     | ZIP+4                     |
| 11 digits    | ZIP+4 plus delivery point |

A 6-digit Mailer ID is paired with a 9-digit serial and a 9-digit Mailer ID with
a 6-digit serial; either way the tracking code is 20 digits, and etiket checks
the total, not the split.

## Structure

The 31-digit value is converted to a 102-bit binary number, an 11-bit CRC frame
check sequence is computed over it, and the result is spread across 65 bars as
ten 13-bit characters — five with 5 bits set and five with 2 — each bar taking
one ascender bit from one character and one descender bit from another.

That interleaving is what makes IMb robust: no single bar carries a whole
character.

## Rendering

```ts
import { postal } from "etiket"

postal("01234567094987654321", {
  type: "imb",
  routingCode: "01234567891",
  height: 40,
  barWidth: 2,
  pitch: 4,
  trackerRatio: 1 / 3,
})
```

USPS specifies bar dimensions in inches; use `unit: "in"` or `unit: "mm"` with
matching `height`, `barWidth` and `pitch` values when printing for real mail.

See [Postal Barcodes](/postal/) for the full option table.

## PNG

```ts
import { postalPNG, postalPNGDataURI } from "etiket"

postalPNG("01234567094987654321", {
  type: "imb",
  routingCode: "01234567891",
  scale: 2,
  pitch: 4,
})

postalPNGDataURI("01234567094987654321", { type: "imb" })
```

## Caveats

- A tracking code that is not exactly 20 digits raises `InvalidInputError`, as
  does a routing code of any length other than 0, 5, 9 or 11, or one containing a
  non-digit.
- The Service Type ID and Mailer ID are assigned by USPS. A well-formed symbol
  with invented values is not mailable.
- `encodeBars()` throws for postal types — the data is in bar height, not width.
- The symbol is always 65 bars, whatever the routing code: the routing code
  changes the value encoded, not the symbol's length.

## CLI

```bash
etiket postal "01234567094987654321" --type imb -o imb.svg
etiket postal "01234567094987654321" --type imb --routing-code 01234567891 -o imb.png
```

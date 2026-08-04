# ISBT 128

The international standard for labelling blood, cellular therapy and tissue
products. Like [HIBC](/barcodes/hibc) it is a **data format**, not a symbology:
it defines the data structures, and the carrier is Code 128.

etiket's ISBT 128 functions return **strings** to be encoded with
[Code 128](/barcodes/code128).

## When to Use It

- Blood bank and transfusion service labelling
- Cellular therapy and tissue product identification
- Any facility registered with ICCBBA, which issues the facility codes

## Donation Identification Number

The DIN is the unique identifier of a donation: `=` followed by the facility,
year and donation number, then an ISO/IEC 7064 Mod 37-2 check character.

```ts
import { encodeISBT128DIN, barcode } from "etiket"

const din = encodeISBT128DIN("US", "12345", "24", "000001")
din // "=US12345240000016"

barcode(din, { type: "code128", showText: true })
```

| Argument         | Rule                                        |
| :--------------- | :------------------------------------------ |
| `countryCode`    | Exactly 2 uppercase letters                 |
| `facilityNumber` | Up to 5 characters, zero-padded on the left |
| `year`           | Exactly 2 digits                            |
| `donationNumber` | 1–6 alphanumerics, zero-padded on the left  |

## Product Code

The 5-character ICCBBA product description code, prefixed with `=`:

```ts
import { encodeISBT128Component } from "etiket"

encodeISBT128Component("E0791") // "=E0791"
```

## Expiry Date

`&` followed by `YYMMDD`:

```ts
import { encodeISBT128Expiry } from "etiket"

encodeISBT128Expiry("261231") // "&261231"
```

## Blood Group

`%` followed by the ABO/Rh code:

```ts
import { encodeISBT128BloodGroup } from "etiket"

encodeISBT128BloodGroup("51") // "%51" — O Pos
encodeISBT128BloodGroup("55") // "%55" — A Pos
```

## Check Character

The DIN's check character is ISO/IEC 7064 Mod 37-2, over the alphabet
`0-9 A-Z *`. It is exported on its own for the data structures that need one:

```ts
import { iso7064Mod37_2 } from "etiket"

iso7064Mod37_2("US1234524000001") // "6"
```

## A Complete Label

The four structures go into separate symbols on the label, not one concatenated
string:

```ts
import {
  encodeISBT128DIN,
  encodeISBT128Component,
  encodeISBT128Expiry,
  encodeISBT128BloodGroup,
  barcode,
} from "etiket"

const symbols = [
  encodeISBT128DIN("US", "12345", "24", "000001"),
  encodeISBT128Component("E0791"),
  encodeISBT128Expiry("261231"),
  encodeISBT128BloodGroup("51"),
].map((data) => barcode(data, { type: "code128" }))

symbols.length // 4
```

## Caveats

- These functions **format**; they do not encode. Pass the result to `barcode()`
  with `type: "code128"`.
- Only a subset of ISBT 128 is implemented: DIN, product code, expiry date and
  blood group. The standard defines many more data structures.
- Only the DIN carries a check character. The other three structures are returned
  as the standard defines them, with no check character to add.
- A country code that is not 2 uppercase letters, a facility number over 5
  characters, a year that is not 2 digits, or a donation number outside 1–6
  alphanumerics each raise `InvalidInputError`.
- A product code that is not exactly 5 characters, an expiry that is not 6
  digits, or a blood group outside 1–5 characters likewise raise
  `InvalidInputError`.
- `iso7064Mod37_2` raises `InvalidInputError` on any character outside
  `0-9 A-Z *`.

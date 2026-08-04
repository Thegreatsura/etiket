# Input Validation

etiket provides validation utilities to check inputs before encoding.

## Validate Barcode Input

```ts
import { validateBarcode, isValidInput } from "etiket"

// Returns { valid: true } or { valid: false, error: "..." }
validateBarcode("4006381333931", "ean13")
// → { valid: true }

validateBarcode("ABC", "ean13")
// → { valid: false, error: "EAN-13 requires 12 or 13 digits" }

// Boolean shorthand
isValidInput("HELLO", "code39") // true
isValidInput("hello", "code39") // false (lowercase not allowed)
```

## Validate QR Input

`validateQRInput` returns more than a boolean: on success it reports the version
the encoder will actually choose, the mode it detected, and how much of the
capacity the data uses.

```ts
import { validateQRInput } from "etiket"

validateQRInput("Hello World", "M")
// → { valid: true, version: 1, mode: "byte", dataLength: 11, maxCapacity: 2331 }

validateQRInput("A".repeat(10000), "H")
// → { valid: false, error: "Data too long for QR code...",
//     mode: "alphanumeric", dataLength: 10000, maxCapacity: 1852 }
```

| Field         | Type                                    | When                         |
| :------------ | :-------------------------------------- | :--------------------------- |
| `valid`       | `boolean`                               | Always                       |
| `error`       | `string`                                | Only when invalid            |
| `version`     | `number`                                | Only when valid              |
| `mode`        | `"numeric" \| "alphanumeric" \| "byte"` | Whenever a mode was detected |
| `dataLength`  | `number`                                | Whenever a mode was detected |
| `maxCapacity` | `number`                                | Whenever a mode was detected |

`dataLength` is in the detected mode's units — bytes for `byte`, characters
otherwise — and `maxCapacity` is the version 40 limit for that mode and EC level.
The reported `version` comes from planning the encoding exactly as the encoder
would, multi-segment splits included, so it is the version you will get.

The EC level argument defaults to `"M"`.

## Check Digits

```ts
import { calculateEANCheckDigit, verifyEANCheckDigit } from "etiket"

// Calculate check digit for EAN/UPC
calculateEANCheckDigit([4, 0, 0, 6, 3, 8, 1, 3, 3, 3, 9, 3])
// → 1

// Verify an existing check digit
verifyEANCheckDigit("4006381333931") // true
verifyEANCheckDigit("4006381333932") // false
```

## Error Classes

etiket throws typed errors: `InvalidInputError` and `CapacityError`, both
extending `EtiketError`, plus `CheckDigitError` which extends
`InvalidInputError` — a wrong check digit is invalid input, so code catching the
broader class keeps working while callers that care can single the case out.

```ts
import { barcode, CheckDigitError, InvalidInputError } from "etiket"

try {
  barcode("4006381333932", { type: "ean13" })
} catch (e) {
  if (e instanceof CheckDigitError) {
    // the data is right but the check digit is not
  } else if (e instanceof InvalidInputError) {
    // wrong characters or wrong length
  }
}
```

See [Error Handling](/getting-started/error-handling) for the full hierarchy and
which symbologies raise what.

The error classes have a sub-path of their own, for consumers who only need to
catch:

```ts
import { EtiketError, InvalidInputError, CapacityError, CheckDigitError } from "etiket/errors"

const classes = [EtiketError, InvalidInputError, CapacityError, CheckDigitError]
classes.length // 4
```

The validators do too:

```ts
import { validateBarcode, validateQRInput } from "etiket/validators"

validateBarcode("4006381333931", "ean13").valid // true
validateQRInput("Hello").valid // true
```

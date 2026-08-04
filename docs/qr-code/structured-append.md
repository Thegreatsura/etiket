# Structured Append

Structured Append splits one message across up to 16 QR symbols. Each symbol
carries a header saying which position it holds, how many symbols there are, and
a parity byte over the whole original message; a reader collects them in any
order and reassembles the message.

## When to Use It

- A payload too large for a single version 40 symbol
- A label where several small symbols fit but one large one does not
- Print processes with a fixed symbol footprint — split rather than shrink the
  module size

## Usage

```ts
import { encodeQRSequence, renderQRCodeSVG } from "etiket"

const symbols = encodeQRSequence("A".repeat(200), { symbols: 3 })
symbols.length // 3 — each entry is a boolean[][] matrix

const svgs = symbols.map((matrix) => renderQRCodeSVG(matrix, { size: 200 }))
svgs.length // 3
```

Available from the QR sub-path too:

```ts
import { encodeQRSequence } from "etiket/qr"

encodeQRSequence("Hello", { symbols: 2 })
```

## Choosing the Symbol Count

Omit `symbols` and the encoder uses the fewest symbols that hold the data — which
is a single ordinary symbol when the data fits in one, since the standard has no
sequence of one:

```ts
import { encodeQRSequence } from "etiket"

const one = encodeQRSequence("short")
one.length // 1 — a plain QR code, no Structured Append header

const many = encodeQRSequence("A".repeat(3000), { ecLevel: "H" })
many.length > 1 // true
```

Ask for a specific count and it is honoured, or `CapacityError` is raised if the
data does not fit that many symbols:

```ts
import { encodeQRSequence, CapacityError } from "etiket"

try {
  encodeQRSequence("A".repeat(20000), { symbols: 2 })
} catch (error) {
  error instanceof CapacityError // true
}
```

## Options

`QRSequenceOptions` is `QRCodeOptions` without `structuredAppend`, plus:

| Option    | Type   | Default | Description                                |
| :-------- | :----- | :------ | :----------------------------------------- |
| `symbols` | `1-16` | auto    | How many symbols to split the message into |

Every other QR option — `ecLevel`, `version`, `mode`, `mask`, `eci` — applies to
each symbol in the sequence:

```ts
import { encodeQRSequence } from "etiket"

encodeQRSequence("A".repeat(400), { symbols: 4, ecLevel: "Q", mask: 3 })
```

## Driving the Split Yourself

If you need to control where the message is cut — at record boundaries, say —
encode each chunk with `qrcode()` or `encodeQR()` and supply the header directly.
The parity byte is the XOR of every byte of the **complete, unsplit** message,
and every symbol in the sequence must carry the same value:

```ts
import { encodeQR } from "etiket"

const message = "PART-ONE|PART-TWO"
const chunks = message.split("|")

let parity = 0
for (const byte of new TextEncoder().encode(message)) parity ^= byte

const symbols = chunks.map((chunk, index) =>
  encodeQR(chunk, {
    structuredAppend: { index, total: chunks.length, parity },
  }),
)
symbols.length // 2
```

| Field    | Meaning                                |
| :------- | :------------------------------------- |
| `index`  | 0-based position of this symbol        |
| `total`  | Symbols in the sequence, 2–16          |
| `parity` | XOR of every byte of the whole message |

The header costs 20 bits — 4 mode, 4 index, 4 count, 8 parity — out of each
symbol's capacity, and it is written before the ECI and FNC1 headers, as
ISO/IEC 18004 requires.

## Caveats

- **`encodeQRSequence` splits by code point, not by meaning.** A chunk boundary
  can land mid-word or mid-record. Drive the split yourself when the chunks need
  to mean something on their own.
- A sequence of one symbol is not valid QR. `encodeQRSequence` returns a plain
  symbol in that case rather than an invalid header.
- A `total` outside 2–16, or an `index` outside the sequence, raises
  `InvalidInputError` from `encodeQR`.
- `symbols` outside 1–16 raises `InvalidInputError`.
- Reader support is uneven. Many phone apps read only the first symbol and hand
  back the fragment; dedicated scanners and imaging readers do better. Test
  before committing to a split.
- Empty input raises `InvalidInputError`.

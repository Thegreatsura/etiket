# Payload Helpers

A QR code is only ever a string. The awkward part is that the string has to
follow a convention the scanning app recognises — `WIFI:T:WPA;S:…;P:…;;` joins a
network, `BEGIN:VCARD…` opens the contact sheet, a bare URL opens the browser.
The helpers build those strings and hand the result to `qrcode()`, so every one
of them returns a rendered SVG.

Each helper takes the same options as `qrcode()` as its last argument —
`QRCodeSVGOptions & QRCodeOptions` — so styling, EC level and sizing work
exactly as they do everywhere else.

```ts
import { url } from "etiket"

url("https://example.com", { size: 320, ecLevel: "H", dotType: "rounded" })
```

## url

```ts
url(urlString: string, options?): string
```

Encodes the URL verbatim. It exists so intent is readable at the call site;
`qrcode(link)` does the same thing.

```ts
import { url } from "etiket"

url("https://example.com/product/42?utm_source=label")
```

Keep URLs short. Every character costs modules, and a long URL at EC level `H`
pushes the symbol into versions that need a bigger label.

## email

```ts
email(address: string, options?): string
```

Produces `mailto:<address>`.

```ts
import { email } from "etiket"

email("support@example.com", { size: 200 })
```

## phone

```ts
phone(number: string, options?): string
```

Produces `tel:<number>`. Use the full international form — a scanner has no idea
what country the label was printed in.

```ts
import { phone } from "etiket"

phone("+441632960961")
```

## sms

```ts
sms(number: string, body?: string, options?): string
```

Produces `sms:<number>` or `sms:<number>?body=<url-encoded body>`.

```ts
import { sms } from "etiket"

sms("+441632960961")
sms("+441632960961", "ARRIVED 4471")
```

The body is percent-encoded, so punctuation and non-ASCII text survive.

## geo

```ts
geo(lat: number, lng: number, options?): string
```

Produces `geo:<lat>,<lng>`, which opens the device's map application.

```ts
import { geo } from "etiket"

geo(51.5007, -0.1246) // Palace of Westminster
```

## wifi

```ts
wifi(
  ssid: string,
  password: string,
  options?: QROpts & { encryption?: "WPA" | "WEP" | "nopass"; hidden?: boolean },
): string
```

Builds the `WIFI:` join string. `encryption` defaults to `"WPA"`; pass
`"nopass"` for an open network, and `hidden: true` when the SSID is not
broadcast.

```ts
import { wifi } from "etiket"

wifi("Office 5GHz", "correct-horse-battery-staple")
wifi("Guest", "", { encryption: "nopass" })
wifi("Back Office", "s3cr3t;pass", { hidden: true, ecLevel: "Q" })
```

Backslashes, semicolons, commas, colons and quotes in the SSID or password are
escaped for you — the third example above works even though the password
contains a `;`.

## vcard

```ts
vcard(contact: {
  firstName: string
  lastName?: string
  phone?: string
  email?: string
  org?: string
  title?: string
  url?: string
  address?: string
}, options?): string
```

Emits a vCard 3.0 record. Only `firstName` is required; every other field is
omitted from the payload when you leave it out, which keeps the symbol small.

```ts
import { vcard } from "etiket"

vcard({
  firstName: "Ada",
  lastName: "Lovelace",
  org: "Analytical Engines Ltd",
  title: "Chief Mathematician",
  phone: "+441632960961",
  email: "ada@example.com",
  url: "https://example.com/ada",
  address: "12 Marylebone Road, London NW1 5JD",
})
```

vCards get long fast. A full record like the one above needs a mid-size symbol;
if it has to fit on a business card, drop `address` and `url` first.

## mecard

```ts
mecard(contact: {
  name: string
  phone?: string
  email?: string
  url?: string
  address?: string
}, options?): string
```

MeCard is the older, more compact contact format — it originated on Japanese
feature phones and is still read by most scanners. Same information as a vCard
in roughly half the characters, so prefer it when space is tight.

```ts
import { mecard } from "etiket"

mecard({
  name: "Lovelace,Ada",
  phone: "+441632960961",
  email: "ada@example.com",
})
```

The `name` field carries the whole name; the `Last,First` convention is what
most readers expect.

## event

```ts
event(ev: {
  title: string
  start: Date | string
  end?: Date | string
  location?: string
  description?: string
}, options?): string
```

Emits an iCalendar `VEVENT` block. `start` and `end` take a `Date` or anything
`new Date()` parses, and are written out as UTC basic-format timestamps.

```ts
import { event } from "etiket"

event({
  title: "Release retrospective",
  start: new Date("2026-09-14T13:00:00Z"),
  end: new Date("2026-09-14T14:00:00Z"),
  location: "Room 4B",
  description: "Bring the incident timeline",
})

event({ title: "Doors open", start: "2026-09-14T18:30:00Z" })
```

Because the timestamps are UTC, a reader in any timezone lands on the same
instant.

## swissQR

```ts
swissQR(data: {
  iban: string
  creditor: { name; street?; houseNumber?; postalCode; city; country }
  amount?: number
  currency?: "CHF" | "EUR"
  debtor?: { name; street?; houseNumber?; postalCode; city; country }
  reference?: string
  referenceType?: "QRR" | "SCOR" | "NON"
  additionalInfo?: string
}, options?): string
```

Builds the Swiss QR-bill payload (`SPC` version 0200) used on Swiss payment
slips. Spaces in the IBAN are stripped, the amount is formatted to two decimals,
and the record is terminated with `EPD`. EC level defaults to `"M"`, which is
what the specification asks for.

```ts
import { swissQR } from "etiket"

swissQR({
  iban: "CH93 0076 2011 6238 5295 7",
  creditor: {
    name: "Robert Schneider AG",
    street: "Rue du Lac",
    houseNumber: "1268/2/22",
    postalCode: "2501",
    city: "Biel",
    country: "CH",
  },
  amount: 199.95,
  currency: "CHF",
  debtor: {
    name: "Pia-Maria Rutschmann-Schnyder",
    street: "Grosse Marktgasse",
    houseNumber: "28",
    postalCode: "9400",
    city: "Rorschach",
    country: "CH",
  },
  referenceType: "QRR",
  reference: "210000000003139471430009017",
  additionalInfo: "Order 2026-04-12",
})
```

`referenceType` defaults to `"NON"` (no reference). Use `"QRR"` with a QR
reference number and `"SCOR"` with a Creditor Reference.

## gs1DigitalLink

```ts
gs1DigitalLink(data: {
  gtin: string
  batch?: string
  lot?: string
  serial?: string
  expiry?: string
  weight?: string
  [ai: string]: string | undefined
}, options?: QROpts & { domain?: string }): string
```

Builds a GS1 Digital Link URL — the web-resolvable form of GS1 Application
Identifiers. `domain` defaults to `https://id.gs1.org`; point it at your own
resolver in production.

```ts
import { gs1DigitalLink } from "etiket"

gs1DigitalLink({ gtin: "09501101020917" })

gs1DigitalLink(
  {
    gtin: "09501101020917",
    lot: "LOT42",
    serial: "SN-000117",
    expiry: "261231",
  },
  { domain: "https://example.com", size: 280 },
)
```

The named fields map to their AIs — `gtin` → `/01`, `batch` or `lot` → `/10`,
`serial` → `/21`, `expiry` → `/17`, `weight` → `/3103`. Any other key is
appended verbatim as an AI path segment, so an AI the helper does not name can
still be carried:

```ts
import { gs1DigitalLink } from "etiket"

gs1DigitalLink({ gtin: "09501101020917", "8010": "CPID-77" })
```

## gs1qr

```ts
gs1qr(text: string, options?): string
```

A GS1 QR Code: the payload is a parenthesised Application Identifier string and
the symbol carries the FNC1 first-position flag that tells a reader so. This is
what a GS1-conformant scanner expects; a plain `qrcode()` of the same text is
just text.

```ts
import { gs1qr } from "etiket"

gs1qr("(01)09501101020917(10)LOT42(17)261231")
gs1qr("(01)09501101020917(21)SN-000117", { ecLevel: "Q", size: 260 })
```

Under the hood this is `qrcode(text, { ...options, gs1: true })` — the `gs1`
flag is available on `qrcode()` directly if you would rather pass it yourself.

## Choosing Between Them

| You want                              | Use              |
| :------------------------------------ | :--------------- |
| Open a web page                       | `url`            |
| A contact card, maximum compatibility | `vcard`          |
| A contact card, smallest symbol       | `mecard`         |
| Join a network                        | `wifi`           |
| Add to calendar                       | `event`          |
| Swiss payment slip                    | `swissQR`        |
| Retail item that resolves on the web  | `gs1DigitalLink` |
| Retail item read by a GS1 scanner     | `gs1qr`          |
| Anything else                         | `qrcode`         |

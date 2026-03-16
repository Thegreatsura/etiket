#!/usr/bin/env node

import { writeFileSync } from 'node:fs'
import { barcode, qrcode, qrcodeTerminal, datamatrix, pdf417, aztec, wifi } from './index'
import type { BarcodeType } from './index'
import type { DotType } from './renderers/svg/types'
import type { ErrorCorrectionLevel } from './encoders/qr/types'

const VERSION = '0.0.1'

function printHelp(): void {
  const help = `
etiket — Zero-dependency barcode & QR code SVG generator

USAGE
  etiket <command> [data] [options]

COMMANDS
  qr <text>              Generate a QR code
  barcode <text>         Generate a barcode (1D)
  datamatrix <text>      Generate a Data Matrix code
  pdf417 <text>          Generate a PDF417 barcode
  aztec <text>           Generate an Aztec code
  wifi <ssid> <password> Generate a WiFi QR code

GLOBAL OPTIONS
  -o, --output <file>    Write SVG to file (default: stdout)
  --size <n>             Size in pixels (QR/matrix codes)
  --width <n>            Width in pixels (barcodes)
  --height <n>           Height in pixels (barcodes)
  --color <hex>          Foreground color (default: #000000)
  --background <hex>     Background color (default: #ffffff)
  --margin <n>           Margin / quiet zone
  -h, --help             Show this help message
  -v, --version          Show version

QR OPTIONS
  --ec <L|M|Q|H>         Error correction level (default: M)
  --dot-type <type>      Dot style: square, rounded, dots, diamond,
                         classy, classy-rounded, extra-rounded,
                         vertical-line, horizontal-line, small-square,
                         tiny-square
  --dot-size <n>         Dot size 0.1-1 (default: 1)
  --terminal             Print QR code to terminal instead of SVG

BARCODE OPTIONS
  --type <type>          Barcode type: code128 (default), ean13, ean8,
                         code39, code39ext, code93, code93ext, itf,
                         itf14, upca, upce, ean2, ean5, codabar, msi,
                         pharmacode, code11, gs1-128
  --show-text            Show human-readable text below barcode
  --font-size <n>        Font size for text
  --bar-width <n>        Width of individual bars

PDF417 OPTIONS
  --ec-level <n>         Error correction level 0-8
  --columns <n>          Number of data columns
  --compact              Use compact mode

AZTEC OPTIONS
  --ec-percent <n>       Error correction percentage
  --layers <n>           Number of layers
  --compact              Use compact mode

EXAMPLES
  etiket qr "Hello World" -o qr.svg
  etiket qr "Hello" --size 300 --ec H --dot-type dots
  etiket qr "Hello" --terminal
  etiket barcode "Hello" -o barcode.svg
  etiket barcode "4006381333931" --type ean13 --show-text
  etiket datamatrix "Hello" -o dm.svg
  etiket pdf417 "Hello" -o pdf.svg
  etiket aztec "Hello" -o aztec.svg
  etiket wifi "MyNetwork" "secret123" -o wifi.svg
`
  process.stdout.write(`${help.trim()}\n`)
}

function parseArgs(argv: string[]): { command: string; positional: string[]; flags: Record<string, string | boolean> } {
  const args = argv.slice(2)
  const positional: string[] = []
  const flags: Record<string, string | boolean> = {}

  // Determine command: first arg that doesn't start with -
  let command = ''
  let i = 0
  if (args[0] && !args[0].startsWith('-')) {
    command = args[0]
    i = 1
  }

  while (i < args.length) {
    const arg = args[i]!
    if (arg === '--') {
      // Everything after -- is positional
      for (let j = i + 1; j < args.length; j++) {
        positional.push(args[j]!)
      }
      break
    }

    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = args[i + 1]
      // Flags that are always boolean (no value)
      if (key === 'help' || key === 'version' || key === 'terminal' || key === 'show-text' || key === 'compact') {
        flags[key] = true
      }
      else if (next !== undefined && !next.startsWith('-')) {
        flags[key] = next
        i++
      }
      else {
        flags[key] = true
      }
    }
    else if (arg.startsWith('-') && arg.length === 2) {
      const key = arg.slice(1)
      const next = args[i + 1]
      // Short boolean flags
      if (key === 'h') {
        flags.help = true
      }
      else if (key === 'v') {
        flags.version = true
      }
      else if (next !== undefined && !next.startsWith('-')) {
        flags[key] = next
        i++
      }
      else {
        flags[key] = true
      }
    }
    else {
      positional.push(arg)
    }
    i++
  }

  return { command, positional, flags }
}

function num(value: string | boolean | undefined): number | undefined {
  if (typeof value === 'string') {
    const n = Number(value)
    if (!Number.isNaN(n))
      return n
  }
  return undefined
}

function str(value: string | boolean | undefined): string | undefined {
  if (typeof value === 'string')
    return value
  return undefined
}

function bool(value: string | boolean | undefined): boolean {
  return value === true || value === 'true'
}

function output(svg: string, flags: Record<string, string | boolean>): void {
  const file = str(flags.o) ?? str(flags.output)
  if (file) {
    writeFileSync(file, svg, 'utf-8')
    process.stderr.write(`Written to ${file}\n`)
  }
  else {
    process.stdout.write(svg)
  }
}

function fail(message: string): never {
  process.stderr.write(`Error: ${message}\n`)
  process.exit(1)
}

function run(): void {
  const { command, positional, flags } = parseArgs(process.argv)

  if (bool(flags.version) || bool(flags.v)) {
    process.stdout.write(`etiket ${VERSION}\n`)
    process.exit(0)
  }

  if (bool(flags.help) || bool(flags.h) || command === 'help' || command === '') {
    printHelp()
    process.exit(command === '' && !bool(flags.help) && !bool(flags.h) ? 1 : 0)
  }

  const color = str(flags.color)
  const background = str(flags.background)
  const margin = num(flags.margin)
  const size = num(flags.size)

  switch (command) {
    case 'qr': {
      const text = positional[0]
      if (!text)
        fail('Missing text argument. Usage: etiket qr <text>')

      if (bool(flags.terminal)) {
        const ec = str(flags.ec) as ErrorCorrectionLevel | undefined
        const result = qrcodeTerminal(text, { ecLevel: ec })
        process.stdout.write(`${result}\n`)
        return
      }

      const svg = qrcode(text, {
        size,
        margin,
        color: color ?? undefined,
        background: background ?? undefined,
        ecLevel: str(flags.ec) as ErrorCorrectionLevel | undefined,
        dotType: str(flags['dot-type']) as DotType | undefined,
        dotSize: num(flags['dot-size']),
      })
      output(svg, flags)
      break
    }

    case 'barcode': {
      const text = positional[0]
      if (!text)
        fail('Missing text argument. Usage: etiket barcode <text>')

      const svg = barcode(text, {
        type: (str(flags.type) ?? 'code128') as BarcodeType,
        width: num(flags.width),
        height: num(flags.height),
        barWidth: num(flags['bar-width']),
        color: color ?? undefined,
        background: background ?? undefined,
        showText: bool(flags['show-text']) || undefined,
        fontSize: num(flags['font-size']),
        margin,
      })
      output(svg, flags)
      break
    }

    case 'datamatrix': {
      const text = positional[0]
      if (!text)
        fail('Missing text argument. Usage: etiket datamatrix <text>')

      const svg = datamatrix(text, {
        size,
        color: color ?? undefined,
        background: background ?? undefined,
        margin,
      })
      output(svg, flags)
      break
    }

    case 'pdf417': {
      const text = positional[0]
      if (!text)
        fail('Missing text argument. Usage: etiket pdf417 <text>')

      const svg = pdf417(text, {
        ecLevel: num(flags['ec-level']),
        columns: num(flags.columns),
        compact: bool(flags.compact) || undefined,
        width: num(flags.width) ?? size,
        height: num(flags.height),
        color: color ?? undefined,
        background: background ?? undefined,
      })
      output(svg, flags)
      break
    }

    case 'aztec': {
      const text = positional[0]
      if (!text)
        fail('Missing text argument. Usage: etiket aztec <text>')

      const svg = aztec(text, {
        ecPercent: num(flags['ec-percent']),
        layers: num(flags.layers),
        compact: bool(flags.compact) || undefined,
        size,
        color: color ?? undefined,
        background: background ?? undefined,
        margin,
      })
      output(svg, flags)
      break
    }

    case 'wifi': {
      const ssid = positional[0]
      const password = positional[1]
      if (!ssid)
        fail('Missing SSID argument. Usage: etiket wifi <ssid> <password>')
      if (!password)
        fail('Missing password argument. Usage: etiket wifi <ssid> <password>')

      const svg = wifi(ssid, password, {
        size,
        margin,
        color: color ?? undefined,
        background: background ?? undefined,
        ecLevel: str(flags.ec) as ErrorCorrectionLevel | undefined,
        dotType: str(flags['dot-type']) as DotType | undefined,
        dotSize: num(flags['dot-size']),
      })
      output(svg, flags)
      break
    }

    default:
      fail(`Unknown command: ${command}. Run "etiket --help" for usage.`)
  }
}

run()

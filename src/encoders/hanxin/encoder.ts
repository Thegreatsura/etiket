/**
 * Han Xin Code data encodation (ISO/IEC 20830, clause 6).
 *
 * Two of the standard's modes are used: Numeric (mode indicator `0001`) for
 * digit runs long enough to pay for the mode switch, and Byte (`0011`) for
 * everything else. That is the same segmentation the BWIPP reference encoder
 * performs, which is what makes module-for-module comparison against it
 * possible.
 *
 * The remaining modes — Text (`0010`) and the four Chinese modes (`0100`-`0111`)
 * — are compaction optimisations layered on the same bitstream grammar. They are
 * not implemented; see the note in `index.ts`.
 */

import { CapacityError } from "../../errors"

const MODE_NUMERIC = "0001"
const MODE_BYTE = "0011"

/** The 13-bit byte-mode count field caps a single Byte segment at 8191 bytes. */
const MAX_BYTE_SEGMENT = 1 << 13

/** A numeric run is worth its own segment past this many digits. */
const NUMERIC_RUN_MIN = 8

/** …or this many, when the run reaches the end of the data and needs no return switch. */
const NUMERIC_RUN_MIN_TRAILING = 5

/** A half-open run of the byte string, encoded in one mode. */
export interface Segment {
  numeric: boolean
  from: number
  to: number
}

function isDigit(byte: number | undefined): boolean {
  return byte !== undefined && byte >= 0x30 && byte <= 0x39
}

/**
 * Split the byte string into Numeric and Byte segments.
 *
 * A digit run is only broken out when it is long enough that the 4-bit mode
 * indicator plus the 10-bit terminator cost less than encoding the digits as
 * bytes; a run that finishes the data drops the terminator, so it pays off
 * sooner.
 */
export function hanxinSegments(bytes: Uint8Array): Segment[] {
  const length = bytes.length
  const runs = new Int32Array(length + 1)
  for (let i = length - 1; i >= 0; i--) {
    if (isDigit(bytes[i])) runs[i] = runs[i + 1]! + 1
  }

  const segments: Segment[] = []
  let byteStart = -1
  let i = 0
  const flush = (end: number) => {
    if (byteStart !== -1) {
      segments.push({ numeric: false, from: byteStart, to: end })
      byteStart = -1
    }
  }

  while (i < length) {
    const run = runs[i]!
    const minimum = i + run >= length ? NUMERIC_RUN_MIN_TRAILING : NUMERIC_RUN_MIN
    if (run >= minimum) {
      flush(i)
      segments.push({ numeric: true, from: i, to: i + run })
      i += run
    } else {
      if (byteStart === -1) byteStart = i
      i++
    }
  }
  flush(length)

  return segments
}

function pushBits(bits: number[], value: number, count: number): void {
  for (let i = count - 1; i >= 0; i--) bits.push((value >> i) & 1)
}

function pushPattern(bits: number[], pattern: string): void {
  for (const character of pattern) bits.push(character === "1" ? 1 : 0)
}

/** Encode the segments into the symbol bitstream, MSB first. */
export function hanxinBitstream(bytes: Uint8Array, segments: readonly Segment[]): number[] {
  const bits: number[] = []

  for (const segment of segments) {
    if (segment.numeric) {
      const digits = segment.to - segment.from
      pushPattern(bits, MODE_NUMERIC)
      for (let start = 0; start < digits; start += 3) {
        const size = Math.min(3, digits - start)
        let value = 0
        for (let k = 0; k < size; k++)
          value = value * 10 + (bytes[segment.from + start + k]! - 0x30)
        pushBits(bits, value, 10)
      }
      // The terminator also states how many digits the final group carried.
      const remainder = (digits - 1) % 3
      pushPattern(
        bits,
        remainder === 0 ? "1111111101" : remainder === 1 ? "1111111110" : "1111111111",
      )
    } else {
      const length = segment.to - segment.from
      if (length >= MAX_BYTE_SEGMENT) {
        throw new CapacityError("Han Xin Code data is too long for the 13-bit byte count field")
      }
      pushPattern(bits, MODE_BYTE)
      pushBits(bits, length, 13)
      for (let k = segment.from; k < segment.to; k++) pushBits(bits, bytes[k]!, 8)
    }
  }

  return bits
}

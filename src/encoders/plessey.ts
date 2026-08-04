/**
 * Plessey barcode encoder
 * Used in UK library systems (Anker, Sircam)
 *
 * Each hex digit (0-F) is encoded as 4 bits, least significant bit first. Every
 * bit occupies a constant 5-module pitch: a `1` is a 3-module bar followed by a
 * 2-module gap, a `0` is a 1-module bar followed by a 4-module gap.
 */

import { InvalidInputError } from "../errors"

/** Bar + gap widths for a `0` bit — narrow bar, wide gap. */
const NARROW_BIT = [1, 4]
/** Bar + gap widths for a `1` bit — wide bar, narrow gap. */
const WIDE_BIT = [3, 2]

/** Start: the bit pattern 1101 (the same elements as the digit `B`). */
const START_PATTERN = [3, 2, 3, 2, 1, 4, 3, 2]

/**
 * Stop: a 5-module termination bar followed by the reversed start pattern, so
 * the symbol can be read from either direction.
 */
const STOP_PATTERN = [5, 4, 1, 4, 1, 2, 3, 2, 3]

/**
 * The CRC salt, applied at every set bit of the shifted data.
 *
 * This is the generator polynomial x^8 + x^7 + x^6 + x^5 + x^3 + 1 written out
 * low-order-coefficient last, matching the bit order the data is fed in with.
 */
const CHECK_SALT = [1, 1, 1, 1, 0, 1, 0, 0, 1]

/**
 * Calculate the two Plessey CRC check digits.
 *
 * The hex digits are expanded to bits (least significant first), 8 zero bits are
 * appended, and the salt is XORed in wherever a data bit is set. The 8 trailing
 * bits are the remainder: the low nibble is the first check digit, the high
 * nibble the second.
 */
function plesseyCRC(digits: string): [number, number] {
  const bits: number[] = []
  for (const ch of digits) {
    const val = Number.parseInt(ch, 16)
    for (let b = 0; b < 4; b++) bits.push((val >> b) & 1)
  }

  const dataBits = bits.length
  for (let i = 0; i < 8; i++) bits.push(0)

  for (let i = 0; i < dataBits; i++) {
    if (bits[i] === 1) {
      for (let j = 0; j < CHECK_SALT.length; j++) {
        bits[i + j] = bits[i + j]! ^ CHECK_SALT[j]!
      }
    }
  }

  let checkval = 0
  for (let i = 0; i < 8; i++) checkval += bits[dataBits + i]! << i

  return [checkval & 15, checkval >> 4]
}

/**
 * Encode Plessey barcode
 * Character set: 0-9, A-F (hexadecimal)
 *
 * Two CRC check digits are always appended.
 *
 * @param text - Hex digits to encode
 * @returns Array of element widths in modules (alternating bar/space, starting
 *   and ending on a bar)
 */
export function encodePlessey(text: string): number[] {
  const upper = text.toUpperCase()
  if (upper.length === 0) {
    throw new InvalidInputError("Plessey input must not be empty")
  }
  if (!/^[0-9A-F]+$/.test(upper)) {
    throw new InvalidInputError("Plessey only accepts hexadecimal characters (0-9, A-F)")
  }

  const [crc1, crc2] = plesseyCRC(upper)
  const dataWithCheck = upper + crc1.toString(16).toUpperCase() + crc2.toString(16).toUpperCase()

  const bars: number[] = [...START_PATTERN]

  for (const ch of dataWithCheck) {
    const val = Number.parseInt(ch, 16)
    for (let b = 0; b < 4; b++) {
      bars.push(...(((val >> b) & 1) === 1 ? WIDE_BIT : NARROW_BIT))
    }
  }

  bars.push(...STOP_PATTERN)
  return bars
}

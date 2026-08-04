/**
 * Reed-Solomon encoding for Han Xin Code.
 *
 * Two fields are in play: GF(256) with primitive polynomial 355 (0x163) for the
 * data blocks, and GF(16) with primitive polynomial 19 (0x13) for the four
 * check nibbles of the function information.
 *
 * The generator polynomial has roots a^1..a^n — not a^0..a^(n-1) as in QR — and
 * its coefficients are held in ascending order with the leading 1 dropped, so
 * the LFSR below indexes them the same way the standard's encoder does.
 */

/** Log / antilog tables for one binary extension field. */
interface GaloisField {
  order: number
  log: Int16Array
  alog: Int16Array
}

function makeField(order: number, primitive: number): GaloisField {
  const alog = new Int16Array(order)
  const log = new Int16Array(order)
  let x = 1
  for (let i = 0; i < order; i++) {
    alog[i] = x
    x = x * 2
    if (x >= order) x ^= primitive
  }
  // Deliberately starts at 1: a^0 and a^(order-1) are both 1, and the standard's
  // encoder lets the later index win.
  for (let i = 1; i < order; i++) log[alog[i]!] = i
  return { order, log, alog }
}

const GF256 = makeField(256, 355)
const GF16 = makeField(16, 19)

function product(field: GaloisField, a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return field.alog[(field.log[a]! + field.log[b]!) % (field.order - 1)]!
}

const coefficientCache = new Map<string, number[]>()

/** Generator polynomial coefficients for `count` check symbols, ascending order. */
function generatorCoefficients(field: GaloisField, count: number): number[] {
  const key = `${field.order}:${count}`
  const cached = coefficientCache.get(key)
  if (cached) return cached

  const coeffs = Array.from({ length: count + 1 }, () => 0)
  coeffs[0] = 1
  for (let i = 1; i <= count; i++) {
    coeffs[i] = coeffs[i - 1]!
    const ai = field.alog[i]!
    for (let j = i - 1; j >= 1; j--) {
      coeffs[j] = product(field, coeffs[j]!, ai) ^ coeffs[j - 1]!
    }
    coeffs[0] = product(field, coeffs[0]!, ai)
  }

  const result = coeffs.slice(0, count)
  coefficientCache.set(key, result)
  return result
}

function encode(field: GaloisField, data: readonly number[], count: number): number[] {
  const coeffs = generatorCoefficients(field, count)
  const lfsr = Array.from({ length: count }, () => 0)
  for (const value of data) {
    const feedback = value ^ lfsr[0]!
    for (let j = 0; j <= count - 2; j++) {
      lfsr[j] = lfsr[j + 1]! ^ product(field, coeffs[count - 1 - j]!, feedback)
    }
    lfsr[count - 1] = product(field, coeffs[0]!, feedback)
  }
  return lfsr
}

/** EC codewords for a data block, over GF(256). */
export function hanxinDataEC(data: readonly number[], count: number): number[] {
  return encode(GF256, data, count)
}

/** EC nibbles for the function information, over GF(16). */
export function hanxinFunctionEC(data: readonly number[], count: number): number[] {
  return encode(GF16, data, count)
}

/**
 * Han Xin Code symbol construction (ISO/IEC 20830, clause 5 and 7).
 *
 * The module grid is held flat, row-major, as `y * size + x` with `-1` marking a
 * module still free for data — the same representation the BWIPP reference
 * encoder uses, which keeps the alignment-pattern and function-information
 * geometry directly comparable with it.
 */

import {
  HANXIN_FINDER,
  HANXIN_FINDER_BL,
  HANXIN_MASKS,
  hanxinFunctionMap,
  type HanXinMetric,
} from "./tables"

/** Marks a module that is neither a function pattern nor yet filled with data. */
export const UNSET = -1

/**
 * Draw the alignment patterns.
 *
 * They are laid out on a staggered grid anchored at the top-right corner, so the
 * whole construction works in a mirrored coordinate system: `plot(a, b)` writes
 * the module `b` rows down and `a` columns in from the right edge, and each
 * point is plotted at both `(a, b)` and `(b, a)` to keep the grid symmetric
 * about the leading diagonal.
 */
function placeAlignment(pixels: Int8Array, size: number, alignK: number, alignN: number): void {
  const index = (a: number, b: number) => b * size + size - 1 - a
  const plot = (a: number, b: number, value: number) => {
    pixels[index(b, a)] = value
    pixels[index(a, b)] = value
  }

  // Width of the leftover band once the regular patterns are laid out.
  const remainder = size - alignK * alignN

  let row = 0
  let stagger = 0
  while (row < size) {
    for (let column = 0; column < size; column++) {
      const on =
        column + remainder < size
          ? ((Math.floor(column / alignK) + stagger) % 2 === 0 &&
              !(row === 0 && column < alignK)) ||
            column % alignK === 0
          : (alignN + stagger) % 2 === 0
      if (on) {
        plot(column, row, 1)
        if (column + 1 < size && row + 1 < size) plot(column + 1, row + 1, 0)
      }
    }
    row = row + remainder === size ? row + remainder - 1 : row + alignK
    stagger = 1 - stagger
  }

  // Keep the alignment grid clear of the finders and their separators.
  for (let i = alignK; i <= size - 2; i += alignK) {
    if (Math.floor(i / alignK) % 2 !== 0) {
      for (const [a, b] of [
        [0, i - 1],
        [0, i + 1],
        [1, i - 1],
        [1, i],
        [1, i + 1],
        [i - 1, 0],
        [i + 1, 0],
        [i - 1, 1],
        [i, 1],
        [i + 1, 1],
      ] as const) {
        pixels[index(a, b)] = 0
      }
    }
    if (pixels[index(size - 1, i - 1)] !== 1) {
      for (const [a, b] of [
        [size - 1, i - 1],
        [size - 2, i - 1],
        [size - 2, i],
        [size - 2, i + 1],
        [size - 1, i + 1],
        [i - 1, size - 1],
        [i - 1, size - 2],
        [i, size - 2],
        [i + 1, size - 2],
        [i + 1, size - 1],
      ] as const) {
        pixels[index(a, b)] = 0
      }
    }
  }
}

/** Draw the four corner finders, including their separator row and column. */
function placeFinders(pixels: Int8Array, size: number): void {
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const shared = HANXIN_FINDER[y]![x]!
      pixels[y * size + x] = shared
      pixels[y * size + (size - 1 - x)] = shared
      pixels[(size - 1 - y) * size + (size - 1 - x)] = shared
      pixels[(size - 1 - y) * size + x] = HANXIN_FINDER_BL[y]![x]!
    }
  }
}

/**
 * Build the symbol's fixed patterns and reserve the function-information
 * modules, leaving every data module `UNSET`.
 */
export function hanxinTemplate(metric: HanXinMetric): Int8Array {
  const { size, alignK, alignN } = metric
  const pixels = new Int8Array(size * size).fill(UNSET)
  if (alignN !== 0) placeAlignment(pixels, size, alignK, alignN)
  placeFinders(pixels, size)
  for (const positions of hanxinFunctionMap(size)) {
    for (const [x, y] of positions) pixels[y * size + x] = 0
  }
  return pixels
}

/**
 * One layer per mask pattern, set where that pattern inverts a data module.
 * Function modules are never masked, so they are excluded here rather than at
 * apply time.
 */
export function hanxinMaskLayers(template: Int8Array, size: number): Uint8Array[] {
  return HANXIN_MASKS.map((pattern) => {
    const layer = new Uint8Array(size * size)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const index = y * size + x
        layer[index] = pattern(x + 1, y + 1) === 0 && template[index] === UNSET ? 1 : 0
      }
    }
    return layer
  })
}

/**
 * Fill the free modules with the codeword bitstream, MSB first, scanning left to
 * right and top to bottom. Han Xin places data in plain raster order — there is
 * no boustrophedon walk as in QR.
 */
export function hanxinPlaceData(
  pixels: Int8Array,
  size: number,
  codewords: readonly number[],
): void {
  let bit = 0
  for (let index = 0; index < size * size; index++) {
    if (pixels[index] !== UNSET) continue
    pixels[index] = (codewords[bit >> 3]! >> (7 - (bit & 7))) & 1
    bit++
  }
}

/** Run-length encode a scan line, always starting with a light run. */
function runLengths(read: (i: number) => number, count: number): number[] {
  const runs: number[] = []
  let run = 0
  let value = 0
  for (let i = 0; i < count; i++) {
    const module = read(i)
    if (module === value) {
      run++
    } else {
      runs.push(run)
      run = 1
      value = module
    }
  }
  runs.push(run)
  return runs
}

/**
 * Score one scan line: 4 points per module of any run of 3 or more like modules,
 * plus 50 points for every 1:1:1:1:3 or 3:1:1:1:1 finder-like sequence that sits
 * against a wide run or the edge of the symbol.
 */
function scoreLine(runs: readonly number[]): number {
  let score = 0
  for (const run of runs) if (run >= 3) score += 4 * run

  const allEqual = (from: number, value: number) =>
    runs[from] === value &&
    runs[from + 1] === value &&
    runs[from + 2] === value &&
    runs[from + 3] === value

  for (let j = 5; j <= runs.length - 1; j += 2) {
    const dark = runs[j]!
    if (dark % 3 !== 0 || !allEqual(j - 4, dark / 3)) continue
    if (j === 5 || j + 2 >= runs.length) score += 50
    else if (runs[j - 5]! >= 3 || runs[j + 1]! >= 3) score += 50
  }
  for (let j = 1; j <= runs.length - 5; j += 2) {
    const dark = runs[j]!
    if (dark % 3 !== 0 || !allEqual(j + 1, dark / 3)) continue
    if (j === 1 || j + 6 >= runs.length) score += 50
    else if (runs[j - 1]! >= 3 || runs[j + 5]! >= 3) score += 50
  }
  return score
}

/** Total penalty for a masked symbol, summed over every row and column. */
export function hanxinEvaluate(pixels: Int8Array, size: number): number {
  let score = 0
  for (let i = 0; i < size; i++) {
    score += scoreLine(runLengths((k) => pixels[k * size + i]!, size))
    score += scoreLine(runLengths((k) => pixels[i * size + k]!, size))
  }
  return score
}

/**
 * Write the 34-bit function information: version, EC level and mask, protected
 * by four Reed-Solomon check nibbles over GF(16) and closed by a fixed `010101`
 * tail. Every bit appears twice, at opposite corners of the symbol.
 */
export function hanxinPlaceFunctionInfo(
  pixels: Int8Array,
  size: number,
  bits: readonly number[],
): void {
  const map = hanxinFunctionMap(size)
  for (let i = 0; i < map.length; i++) {
    for (const [x, y] of map[i]!) pixels[y * size + x] = bits[i]!
  }
}

/**
 * Aztec Code text encoder
 *
 * Encodes input text into a bit stream using the 5 Aztec encoding modes
 * (Upper, Lower, Mixed, Punctuation, Digit) plus Binary Shift.
 *
 * The encoder starts in Upper mode and switches between modes using
 * latch (permanent) and shift (single character) transitions as needed.
 */

import { InvalidInputError } from '../../errors'
import {
  Mode,
  MODE_BITS,
  CHAR_TABLE,
  PUNCT_PAIRS,
  getLatchSequence,
  SHIFT_TO_PUNCT,
  BINARY_SHIFT,
} from './tables'

// ---------------------------------------------------------------------------
// Bit manipulation helpers
// ---------------------------------------------------------------------------

/** Append a value as `count` bits (MSB first) to a bit array */
function pushBits(bits: number[], value: number, count: number): void {
  for (let i = count - 1; i >= 0; i--) {
    bits.push((value >> i) & 1)
  }
}

// ---------------------------------------------------------------------------
// Character classification
// ---------------------------------------------------------------------------

/**
 * Determine which modes can encode a given character.
 * Returns an array of { mode, value } options.
 */
function charModes(char: string): Array<{ mode: Mode; value: number }> {
  const result: Array<{ mode: Mode; value: number }> = []
  for (let m = 0; m <= 4; m++) {
    const table = CHAR_TABLE[m]!
    const val = table[char]
    if (val !== undefined) {
      result.push({ mode: m as Mode, value: val })
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// High-level encoding
// ---------------------------------------------------------------------------

/**
 * Encode a string into an Aztec bit stream.
 *
 * Strategy:
 * 1. For each character, check if it can be encoded in the current mode.
 * 2. If yes, emit the codeword directly.
 * 3. If no, try a shift first (cheaper for single characters), else latch.
 * 4. Fall back to binary shift for characters not in any text mode.
 *
 * @param text - The input text (ASCII/Latin-1)
 * @returns Array of bits (0/1 values)
 */
export function encodeHighLevel(text: string): number[] {
  if (text.length === 0) {
    return []
  }

  const bits: number[] = []
  let currentMode = Mode.Upper
  let i = 0

  while (i < text.length) {
    const char = text[i]!
    const charCode = text.charCodeAt(i)

    // --- Check for two-character punctuation pairs ---
    if (i + 1 < text.length) {
      const pair = text[i]! + text[i + 1]!
      const punctPairVal = PUNCT_PAIRS.get(pair)
      if (punctPairVal !== undefined) {
        if (currentMode === Mode.Punct) {
          pushBits(bits, punctPairVal, MODE_BITS[Mode.Punct])
        } else {
          // Shift to Punct for the pair
          const shiftCode = SHIFT_TO_PUNCT[currentMode]
          if (shiftCode !== undefined) {
            pushBits(bits, shiftCode, MODE_BITS[currentMode])
            pushBits(bits, punctPairVal, MODE_BITS[Mode.Punct])
          } else {
            // Must latch to a mode that supports shift-to-punct, then shift
            const latch = getLatchSequence(currentMode, Mode.Upper)
            emitLatch(bits, latch)
            currentMode = Mode.Upper
            pushBits(bits, SHIFT_TO_PUNCT[Mode.Upper]!, MODE_BITS[Mode.Upper])
            pushBits(bits, punctPairVal, MODE_BITS[Mode.Punct])
          }
        }
        i += 2
        continue
      }
    }

    // --- Try encoding in the current mode ---
    const currentTable = CHAR_TABLE[currentMode]!
    const directVal = currentTable[char]
    if (directVal !== undefined) {
      pushBits(bits, directVal, MODE_BITS[currentMode])
      i++
      continue
    }

    // --- Character not in current mode — find best alternative ---
    const options = charModes(char)

    if (options.length > 0) {
      // Determine: should we shift or latch?
      const bestOption = selectBestTransition(currentMode, options, text, i)

      if (bestOption.shift) {
        // Emit shift code, then character in the shifted mode
        if (bestOption.mode === Mode.Punct) {
          const shiftCode = SHIFT_TO_PUNCT[currentMode]
          if (shiftCode !== undefined) {
            pushBits(bits, shiftCode, MODE_BITS[currentMode])
            pushBits(bits, bestOption.value, MODE_BITS[Mode.Punct])
            i++
            continue
          }
        }
        // Shift from Lower to Upper
        if (currentMode === Mode.Lower && bestOption.mode === Mode.Upper) {
          pushBits(bits, 28, MODE_BITS[Mode.Lower]) // shift to upper
          pushBits(bits, bestOption.value, MODE_BITS[Mode.Upper])
          i++
          continue
        }
        // No direct shift available — fall through to latch
      }

      // Latch to the target mode
      const latch = getLatchSequence(currentMode, bestOption.mode)
      emitLatch(bits, latch)
      currentMode = bestOption.mode
      pushBits(bits, bestOption.value, MODE_BITS[currentMode])
      i++
      continue
    }

    // --- Character not in any text mode — use binary shift ---
    if (charCode > 255) {
      throw new InvalidInputError(
        `Aztec Code does not support character: "${char}" (U+${charCode.toString(16).padStart(4, '0')})`
      )
    }

    // Collect consecutive bytes that require binary encoding
    const binaryStart = i
    while (i < text.length) {
      const c = text[i]!
      if (charModes(c).length > 0) {
        // Check if it's only in a mode far from current — might be cheaper to stay binary
        // For simplicity, break out and let the text encoder handle it
        break
      }
      if (text.charCodeAt(i) > 255) {
        throw new InvalidInputError(
          `Aztec Code does not support character: "${text[i]}" (U+${text.charCodeAt(i).toString(16).padStart(4, '0')})`
        )
      }
      i++
    }

    const binaryLen = i - binaryStart
    emitBinaryShift(bits, text, binaryStart, binaryLen, currentMode)
    continue
  }

  return bits
}

// ---------------------------------------------------------------------------
// Transition helpers
// ---------------------------------------------------------------------------

interface TransitionChoice {
  mode: Mode
  value: number
  shift: boolean
}

/**
 * Choose the best mode transition for encoding a character.
 * Prefers shifting for isolated characters and latching when the next
 * several characters are also in the target mode.
 */
function selectBestTransition(
  currentMode: Mode,
  options: Array<{ mode: Mode; value: number }>,
  text: string,
  pos: number,
): TransitionChoice {
  // Check if shift to Punct makes sense (single punctuation character)
  const punctOption = options.find(o => o.mode === Mode.Punct)
  if (punctOption && SHIFT_TO_PUNCT[currentMode] !== undefined) {
    // Look ahead: if next char is NOT in Punct mode, shift is better than latch
    const nextChar = pos + 1 < text.length ? text[pos + 1]! : undefined
    const nextInPunct = nextChar !== undefined && CHAR_TABLE[Mode.Punct]![nextChar] !== undefined
    if (!nextInPunct) {
      return { mode: Mode.Punct, value: punctOption.value, shift: true }
    }
  }

  // Check if shift from Lower to Upper makes sense
  if (currentMode === Mode.Lower) {
    const upperOption = options.find(o => o.mode === Mode.Upper)
    if (upperOption) {
      const nextChar = pos + 1 < text.length ? text[pos + 1]! : undefined
      const nextInUpper = nextChar !== undefined && CHAR_TABLE[Mode.Upper]![nextChar] !== undefined
      const nextInLower = nextChar !== undefined && CHAR_TABLE[Mode.Lower]![nextChar] !== undefined
      if (!nextInUpper || nextInLower) {
        return { mode: Mode.Upper, value: upperOption.value, shift: true }
      }
    }
  }

  // Find the option with the cheapest latch
  let bestCost = Infinity
  let best: TransitionChoice = { mode: options[0]!.mode, value: options[0]!.value, shift: false }

  for (const opt of options) {
    const latch = getLatchSequence(currentMode, opt.mode)
    if (latch.totalBits < bestCost) {
      bestCost = latch.totalBits
      best = { mode: opt.mode, value: opt.value, shift: false }
    }
  }

  return best
}

/** Emit latch codes into the bit stream */
function emitLatch(
  bits: number[],
  latch: { codes: number[]; modes: Mode[]; totalBits: number },
): void {
  for (let j = 0; j < latch.codes.length; j++) {
    const code = latch.codes[j]!
    const mode = latch.modes[j]!
    pushBits(bits, code, MODE_BITS[mode])
  }
}

/**
 * Emit a binary shift sequence into the bit stream.
 *
 * Binary shift encoding:
 * 1. Emit BS code in current mode (code 31 for Upper/Lower/Mixed, code 15 for Digit)
 * 2. If length 1-31:  emit 5-bit length
 *    If length 32-62: emit 5-bit 0 followed by 6-bit (length - 31)
 *    (simplified: we cap at 62 and start a new BS for longer runs;
 *     the spec allows up to 2047 via 11-bit extended length but that's rare)
 * 3. Emit each byte as 8 bits
 *
 * After binary shift, the mode returns to the mode before the shift.
 */
function emitBinaryShift(
  bits: number[],
  text: string,
  start: number,
  length: number,
  currentMode: Mode,
): void {
  let remaining = length
  let pos = start

  while (remaining > 0) {
    const chunk = Math.min(remaining, 62)

    // Emit binary shift intro code
    const bs = BINARY_SHIFT[currentMode]
    if (bs) {
      pushBits(bits, bs.code, bs.bits)
    } else {
      // Digit mode: need to latch to Upper first (shouldn't happen in practice
      // since we handle Digit's BS code in the table)
      pushBits(bits, 15, 4)
    }

    // Emit length
    if (chunk <= 31) {
      pushBits(bits, chunk, 5)
    } else {
      // Length 32-62: encode as 0 in 5 bits, then (chunk - 31) in 6 bits
      pushBits(bits, 0, 5)
      pushBits(bits, chunk - 31, 6)
    }

    // Emit raw bytes
    for (let j = 0; j < chunk; j++) {
      pushBits(bits, text.charCodeAt(pos + j), 8)
    }

    pos += chunk
    remaining -= chunk
  }
}

/**
 * Convert a bit stream into codewords of the given word size.
 * Pads the last codeword with 1-bits if necessary (per Aztec spec,
 * padding bits should be 1 to avoid all-zero codewords).
 */
export function bitsToCodewords(bits: number[], wordSize: number): number[] {
  const codewords: number[] = []
  let i = 0

  while (i < bits.length) {
    let value = 0
    for (let b = 0; b < wordSize; b++) {
      value = (value << 1) | (i < bits.length ? bits[i]! : 1)
      i++
    }
    codewords.push(value)
  }

  return codewords
}

/**
 * Stuff bits to avoid all-zero or all-one codewords.
 * In Aztec, if a codeword would be all 0s, the last bit is flipped to 1,
 * and if it would be all 1s, the last bit is flipped to 0.
 * This is done BEFORE Reed-Solomon encoding.
 *
 * Actually the spec uses a different approach: "bit stuffing" inserts an
 * extra complement bit after every (wordSize-1) consecutive same-value bits.
 * For simplicity in this initial implementation, we perform the simpler
 * codeword-level check described above.
 *
 * Full bit-stuffing per the spec: after encoding data bits, scan through in
 * wordSize-bit groups. If the first (wordSize-1) bits of a group are all 0,
 * insert a 1-bit; if all 1, insert a 0-bit. This changes the total length.
 *
 * We implement the full bit-stuffing approach for correctness.
 */
export function stuffBits(bits: number[], wordSize: number): number[] {
  const result: number[] = []
  const mask = (1 << (wordSize - 1)) - 1 // all 1s for (wordSize-1) bits

  let i = 0
  while (i < bits.length) {
    // Read wordSize bits (or fewer at the end)
    let word = 0
    const end = Math.min(i + wordSize, bits.length)
    for (let j = i; j < end; j++) {
      word = (word << 1) | bits[j]!
    }
    // Pad incomplete word with 1-bits for checking
    const bitsRead = end - i
    if (bitsRead < wordSize) {
      word = word << (wordSize - bitsRead)
      word |= (1 << (wordSize - bitsRead)) - 1
    }

    // Check the first (wordSize-1) bits
    const top = word >> 1
    if (top === 0) {
      // First (wordSize-1) bits are all 0 — output them plus a stuff bit of 1
      for (let j = i; j < i + wordSize - 1 && j < bits.length; j++) {
        result.push(bits[j]!)
      }
      result.push(1)
    } else if (top === mask) {
      // First (wordSize-1) bits are all 1 — output them plus a stuff bit of 0
      for (let j = i; j < i + wordSize - 1 && j < bits.length; j++) {
        result.push(bits[j]!)
      }
      result.push(0)
    } else {
      // Normal codeword — output all bits
      for (let j = i; j < end; j++) {
        result.push(bits[j]!)
      }
    }

    i += (top === 0 || top === mask) ? wordSize - 1 : wordSize
  }

  return result
}

/**
 * Pad the bit stream to fill the available capacity.
 * Padding uses 1-bits up to the next codeword boundary,
 * then fills remaining codewords with the pattern specified
 * by the spec (typically alternating high-bit values).
 */
export function padBits(bits: number[], totalBits: number, wordSize: number): number[] {
  const result = [...bits]

  // Pad to codeword boundary with 1s
  while (result.length % wordSize !== 0 && result.length < totalBits) {
    result.push(1)
  }

  // Fill remaining capacity with properly stuffed padding codewords
  // Each padding codeword is all-zeros, but after bit-stuffing it becomes
  // (wordSize-1) zero bits followed by a 1 bit (to avoid all-zero codeword)
  while (result.length + wordSize <= totalBits) {
    for (let i = 0; i < wordSize - 1; i++) {
      result.push(0)
    }
    result.push(1) // stuff bit to avoid all-zero codeword
  }

  // Fill any remaining bits with zeros
  while (result.length < totalBits) {
    result.push(0)
  }

  return result.slice(0, totalBits)
}

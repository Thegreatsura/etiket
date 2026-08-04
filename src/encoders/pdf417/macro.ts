/**
 * Macro PDF417 control block — ISO/IEC 15438 Annex H
 *
 * A payload too large for one symbol is split across several, each carrying a
 * control block that tells the reader which segment it is holding and which
 * file the segment belongs to. The block follows the data codewords:
 *
 *   <data> 928 <segment index: 2 cw> <file ID: n cw> [923 <tag> <value>]... [922]
 *
 * 922 appears on the last segment only.
 */

import { InvalidInputError } from "../../errors"
import { numericToCodewords, textToCodewords } from "./encoder"

/** Opens the macro control block */
export const MACRO_MARKER = 928
/** Opens one optional field, immediately followed by its tag codeword */
export const MACRO_OPTIONAL_FIELD = 923
/** Closes the macro control block of the last segment */
export const MACRO_TERMINATOR = 922
/** Reader initialisation — must be the first data codeword of the symbol */
export const READER_INIT = 921

/** Optional field tags, ISO/IEC 15438 Annex H.6 */
export const MACRO_FIELD_TAG = {
  FILE_NAME: 0,
  SEGMENT_COUNT: 1,
  TIMESTAMP: 2,
  SENDER: 3,
  ADDRESSEE: 4,
  FILE_SIZE: 5,
  CHECKSUM: 6,
} as const

/**
 * The segment index goes out as the numeric compaction of its five-digit
 * decimal form, which is always exactly two codewords.
 */
const MAX_SEGMENT_INDEX = 99_998
/** Digits the segment index is padded to before numeric compaction */
const SEGMENT_INDEX_DIGITS = 5

export interface PDF417MacroOptions {
  /** 0-based position of this symbol in the sequence */
  segmentIndex: number
  /**
   * Identifier shared by every symbol of the same file, as a decimal string.
   * Each group of three digits becomes one codeword, so every group must be
   * 000-899. A string whose length is not a multiple of three is padded on the
   * left with zeros — that is the form readers report back.
   */
  fileId: string
  /** Total number of symbols, emitted as the "segment count" optional field */
  segmentCount?: number
  /** Marks this symbol as the last of the sequence (emits the 922 terminator) */
  lastSegment?: boolean
  /** Optional field: name of the file the sequence carries */
  fileName?: string
  /** Optional field: sender */
  sender?: string
  /** Optional field: addressee */
  addressee?: string
  /** Optional field: time stamp, seconds since 1970-01-01 00:00:00 UTC */
  timestamp?: number
  /** Optional field: size of the complete file in bytes */
  fileSize?: number
  /** Optional field: CCITT-16 checksum of the complete file */
  checksum?: number
}

/**
 * Build the codewords of a macro control block, terminator included.
 *
 * @param macro - Segment position, file identity and any optional fields
 * @returns Codewords to append after the data codewords of the symbol
 */
export function buildMacroBlock(macro: PDF417MacroOptions): number[] {
  const { segmentIndex } = macro

  if (!Number.isInteger(segmentIndex) || segmentIndex < 0 || segmentIndex > MAX_SEGMENT_INDEX) {
    throw new InvalidInputError(
      `Macro PDF417 segment index must be 0-${MAX_SEGMENT_INDEX}, got ${segmentIndex}`,
    )
  }
  if (
    macro.segmentCount !== undefined &&
    (!Number.isInteger(macro.segmentCount) ||
      macro.segmentCount < 1 ||
      segmentIndex >= macro.segmentCount)
  ) {
    throw new InvalidInputError(
      `Macro PDF417 segment index ${segmentIndex} is outside a sequence of ${macro.segmentCount}`,
    )
  }

  const codewords: number[] = [
    MACRO_MARKER,
    // Numeric compaction of the five-digit index — the "1" the routine
    // prepends is what keeps this exactly two codewords even for index 0
    ...numericToCodewords(String(segmentIndex).padStart(SEGMENT_INDEX_DIGITS, "0")),
    ...fileIdCodewords(macro.fileId),
  ]

  // Optional fields, in tag order
  if (macro.fileName !== undefined) {
    pushTextField(codewords, MACRO_FIELD_TAG.FILE_NAME, macro.fileName, "file name")
  }
  if (macro.segmentCount !== undefined) {
    pushCountField(codewords, MACRO_FIELD_TAG.SEGMENT_COUNT, macro.segmentCount, "segment count")
  }
  if (macro.timestamp !== undefined) {
    pushCountField(codewords, MACRO_FIELD_TAG.TIMESTAMP, macro.timestamp, "time stamp")
  }
  if (macro.sender !== undefined) {
    pushTextField(codewords, MACRO_FIELD_TAG.SENDER, macro.sender, "sender")
  }
  if (macro.addressee !== undefined) {
    pushTextField(codewords, MACRO_FIELD_TAG.ADDRESSEE, macro.addressee, "addressee")
  }
  if (macro.fileSize !== undefined) {
    pushCountField(codewords, MACRO_FIELD_TAG.FILE_SIZE, macro.fileSize, "file size")
  }
  if (macro.checksum !== undefined) {
    pushCountField(codewords, MACRO_FIELD_TAG.CHECKSUM, macro.checksum, "checksum")
  }

  if (macro.lastSegment) {
    codewords.push(MACRO_TERMINATOR)
  }

  return codewords
}

/**
 * Normalise a file ID to the decimal string a reader reconstructs from the
 * codewords: every codeword renders as exactly three digits.
 */
export function normalizeFileId(fileId: string): string {
  if (!/^\d+$/.test(fileId)) {
    throw new InvalidInputError(
      `Macro PDF417 file ID must be a string of decimal digits, got ${JSON.stringify(fileId)}`,
    )
  }
  const padded = fileId.padStart(Math.ceil(fileId.length / 3) * 3, "0")
  for (let i = 0; i < padded.length; i += 3) {
    if (Number(padded.slice(i, i + 3)) > 899) {
      throw new InvalidInputError(
        `Macro PDF417 file ID group "${padded.slice(i, i + 3)}" exceeds 899 — each three digits become one codeword`,
      )
    }
  }
  return padded
}

/** File ID: one codeword per group of three decimal digits */
function fileIdCodewords(fileId: string): number[] {
  const padded = normalizeFileId(fileId)
  const codewords: number[] = []
  for (let i = 0; i < padded.length; i += 3) {
    codewords.push(Number(padded.slice(i, i + 3)))
  }
  return codewords
}

/** An optional field holding text, compacted without a mode latch */
function pushTextField(codewords: number[], tag: number, value: string, label: string): void {
  if (value.length === 0) {
    throw new InvalidInputError(`Macro PDF417 ${label} must not be empty`)
  }
  const encoded = textToCodewords(value)
  if (encoded.some((cw) => cw >= 900)) {
    throw new InvalidInputError(
      `Macro PDF417 ${label} contains characters text compaction cannot hold`,
    )
  }
  codewords.push(MACRO_OPTIONAL_FIELD, tag, ...encoded)
}

/** An optional field holding a non-negative integer, in numeric compaction */
function pushCountField(codewords: number[], tag: number, value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new InvalidInputError(
      `Macro PDF417 ${label} must be a non-negative integer, got ${value}`,
    )
  }
  codewords.push(MACRO_OPTIONAL_FIELD, tag, ...numericToCodewords(String(value)))
}

/**
 * GS1 QR Code — Application Identifier data under an FNC1 first-position flag.
 *
 * The FNC1 flag tells a reader the payload is GS1 element strings. Inside the
 * data, a variable-length AI is terminated by an FNC1 separator, and how that
 * separator is written depends on the mode the segment ends up in: alphanumeric
 * mode spells it `%` (so a literal `%` doubles to `%%`), byte mode uses GS
 * (0x1D). Everything else is ordinary QR encoding.
 */

import { parseAIString, isVariableLength } from "../gs1-128"
import { ALPHANUMERIC_CHARS } from "./tables"

/** The GS separator byte, used as the FNC1 separator in byte mode */
export const GROUP_SEPARATOR = ""

/**
 * Turn a parenthesised AI string into the data a GS1 QR symbol carries.
 *
 * @param text - AI string such as `"(01)09501101020917(10)LOT42"`
 * @returns The payload string, with FNC1 separators already written in the form
 *   the chosen mode needs
 *
 * @example
 * ```ts
 * gs1Payload("(01)09501101020917(10)LOT42")
 * // "0109501101020917" + "10LOT42" — no separator, the last field ends the data
 * ```
 */
export function gs1Payload(text: string): string {
  const fields = parseAIString(text)

  // Build with GS first; it is unambiguous, and the alphanumeric form is
  // derived from it below only when every character allows it
  let payload = ""
  for (const [index, field] of fields.entries()) {
    payload += field.ai + field.data
    if (index < fields.length - 1 && isVariableLength(field.ai)) {
      payload += GROUP_SEPARATOR
    }
  }

  return canUseAlphanumeric(payload) ? toAlphanumericForm(payload) : payload
}

/**
 * Whether the payload can be written in the alphanumeric form, which is
 * markedly denser: 5.5 bits per character against 8.
 */
function canUseAlphanumeric(payload: string): boolean {
  for (const char of payload) {
    if (char === GROUP_SEPARATOR) continue
    if (!ALPHANUMERIC_CHARS.includes(char)) return false
  }
  return true
}

/** Write separators as `%`, doubling any literal `%` so it stays literal */
function toAlphanumericForm(payload: string): string {
  let result = ""
  for (const char of payload) {
    if (char === GROUP_SEPARATOR) result += "%"
    else if (char === "%") result += "%%"
    else result += char
  }
  return result
}

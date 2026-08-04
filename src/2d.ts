/**
 * Entry point for the 2D symbologies that do not have a subpath of their own:
 * MaxiCode, DotCode, Han Xin, MicroPDF417, Codablock F, Code 16K and JAB Code.
 *
 * Data Matrix, PDF417, Aztec and the QR family have dedicated entries
 * (`etiket/datamatrix`, `etiket/pdf417`, `etiket/aztec`, `etiket/qr`).
 *
 * @example
 * ```ts
 * import { maxicode, encodeDotCode } from 'etiket/2d'
 * ```
 */

export { maxicode, dotcode, hanxin, micropdf417, codablockf, code16k, jabcode } from "./_2d"
export type { CodablockFSVGOptions } from "./_2d"

export { encodeMaxiCode } from "./encoders/maxicode"
export type { MaxiCodeOptions } from "./encoders/maxicode"
export { encodeDotCode } from "./encoders/dotcode"
export { encodeHanXin } from "./encoders/hanxin"
export type { HanXinOptions } from "./encoders/hanxin"
export { encodeMicroPDF417 } from "./encoders/micropdf417"
export type { MicroPDF417Options } from "./encoders/micropdf417"
export { encodeCodablockF } from "./encoders/codablock-f"
export type { CodablockFResult } from "./encoders/codablock-f"
export { encodeCode16K } from "./encoders/code16k"
export type { Code16KResult } from "./encoders/code16k"
export { encodeJABCode, JAB_COLORS_4, JAB_COLORS_8 } from "./encoders/jabcode"
export type { JABCodeOptions, JABCodeResult } from "./encoders/jabcode"

export {
  maxicodePNG,
  maxicodePNGDataURI,
  dotcodePNG,
  dotcodePNGDataURI,
  hanxinPNG,
  hanxinPNGDataURI,
  micropdf417PNG,
  micropdf417PNGDataURI,
  codablockfPNG,
  codablockfPNGDataURI,
  code16kPNG,
  code16kPNGDataURI,
} from "./_png"

export { renderMatrixSVG, renderMaxiCodeSVG } from "./renderers/svg/matrix"
export type { MatrixSVGOptions } from "./renderers/svg/matrix"
export { renderColorMatrixSVG } from "./renderers/svg/color-matrix"
export type { ColorMatrixSVGOptions } from "./renderers/svg/color-matrix"
export type { MatrixPNGOptions } from "./renderers/png/types"

export { EtiketError, InvalidInputError, CapacityError, CheckDigitError } from "./errors"

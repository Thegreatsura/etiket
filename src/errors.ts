/**
 * Custom error classes for etiket
 */

export class EtiketError extends Error {
  override name = "EtiketError"
}

export class InvalidInputError extends EtiketError {
  override name = "InvalidInputError"
}

export class CapacityError extends EtiketError {
  override name = "CapacityError"
}

/**
 * A provided check digit does not match the one the data implies.
 *
 * Extends {@link InvalidInputError}: a wrong check digit is invalid input, so
 * code catching the broader class keeps working while callers that care can
 * single this case out.
 */
export class CheckDigitError extends InvalidInputError {
  override name = "CheckDigitError"
}

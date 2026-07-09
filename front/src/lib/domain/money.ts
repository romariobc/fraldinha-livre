/**
 * Money domain type: represents currency as integer centavos (cents).
 * All monetary values are stored as integers (e.g., R$ 10,00 = 1000 centavos).
 *
 * RN-01: Money is always centavos inteiros (no floating point).
 * For formatting to display, use formatPrice() from @/lib/utils.
 */
export type Money = number

/**
 * Adds two monetary values.
 * @param a - First Money value in centavos
 * @param b - Second Money value in centavos
 * @returns Sum of a + b in centavos
 * @throws Error if a or b is not an integer
 */
export function addMoney(a: Money, b: Money): Money {
  validateMoney(a, 'addMoney: parameter a')
  validateMoney(b, 'addMoney: parameter b')
  return a + b
}

/**
 * Multiplies a monetary value by a quantity.
 * @param value - Money value in centavos
 * @param qty - Non-negative integer quantity
 * @returns value × qty in centavos
 * @throws Error if qty is negative, non-integer, or value is not an integer
 */
export function multiplyMoney(value: Money, qty: number): Money {
  validateMoney(value, 'multiplyMoney: parameter value')

  if (!Number.isInteger(qty)) {
    throw new Error(`multiplyMoney: quantity must be an integer, got ${qty}`)
  }
  if (qty < 0) {
    throw new Error(`multiplyMoney: quantity must be non-negative, got ${qty}`)
  }

  return value * qty
}

/**
 * Sums an array of monetary values.
 * @param values - Array of Money values in centavos
 * @returns Sum of all values; 0 if array is empty
 * @throws Error if any value is not an integer
 */
export function sumMoney(values: Money[]): Money {
  let total = 0
  for (const value of values) {
    validateMoney(value, `sumMoney: array element`)
    total += value
  }
  return total
}

/**
 * Internal validation: ensures Money is an integer.
 * @param value - Value to validate
 * @param context - Context for error message
 * @throws Error if value is not an integer
 */
function validateMoney(value: Money, context: string): void {
  if (!Number.isInteger(value)) {
    throw new Error(`${context} must be an integer (centavos), got ${value}`)
  }
}

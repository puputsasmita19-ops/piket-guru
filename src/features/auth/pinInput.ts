/** R98: predictable PIN keypad operations even if multiple touch events queue before React renders. */
export const LOGIN_PIN_LENGTH = 6;

export function normalizePinInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, LOGIN_PIN_LENGTH);
}

export function appendPinDigit(previous: string, digit: string): string {
  if (!/^[0-9]$/.test(digit) || previous.length >= LOGIN_PIN_LENGTH) return previous;
  return `${previous}${digit}`;
}

export function removeLastPinDigit(previous: string): string {
  return previous.slice(0, -1);
}

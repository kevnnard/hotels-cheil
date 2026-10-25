export function priceDigits(amount: number): string {
  return Number.isInteger(amount) ? '1.0-0' : '1.2-2';
}

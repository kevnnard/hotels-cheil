import { HotelPricing } from './hotel.models';

export function priceDigits(amount: number): string {
  return Number.isInteger(amount) ? '1.0-0' : '1.2-2';
}

export function discountedNightlyRate(nightlyRate: number, discountPercent: number): number {
  const cents = Math.round(nightlyRate * 100);
  return Math.round((cents * (100 - discountPercent)) / 100) / 100;
}

export function effectiveNightlyRate(pricing: HotelPricing): number {
  const { nightlyRate, discountPercent, discountedNightlyRate } = pricing;
  return discountPercent !== null && discountedNightlyRate !== null ? discountedNightlyRate : nightlyRate;
}

export function previewPricing(nightlyRate: number | null, discountPercent: number | null): HotelPricing | null {
  if (nightlyRate === null) {
    return null;
  }
  return {
    currency: 'USD',
    nightlyRate,
    discountPercent,
    discountedNightlyRate: discountPercent === null ? null : discountedNightlyRate(nightlyRate, discountPercent),
  };
}

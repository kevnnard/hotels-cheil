import { discountedNightlyRate, effectiveNightlyRate, priceDigits, previewPricing } from './hotel-price';
import { HotelPricing } from './hotel.models';

const plain: HotelPricing = { currency: 'USD', nightlyRate: 200, discountPercent: null, discountedNightlyRate: null };

describe('hotel price helpers', () => {
  it('shows whole amounts without decimals and other amounts with two', () => {
    expect(priceDigits(200)).toBe('1.0-0');
    expect(priceDigits(199.5)).toBe('1.2-2');
  });

  it('pays the nightly rate when there is no discount', () => {
    expect(effectiveNightlyRate(plain)).toBe(200);
  });

  it('pays the discounted rate when the hotel has one', () => {
    expect(effectiveNightlyRate({ ...plain, discountPercent: 15, discountedNightlyRate: 170 })).toBe(170);
  });

  it('discounts with two decimals rounding half away from zero like the domain', () => {
    expect(discountedNightlyRate(200, 15)).toBe(170);
    expect(discountedNightlyRate(10.05, 10)).toBe(9.05);
    expect(discountedNightlyRate(0.05, 10)).toBe(0.05);
    expect(discountedNightlyRate(99.99, 33)).toBe(66.99);
    expect(discountedNightlyRate(100000, 90)).toBe(10000);
  });

  it('builds the USD pricing block of a form preview', () => {
    expect(previewPricing(250, 20)).toEqual({
      currency: 'USD',
      nightlyRate: 250,
      discountPercent: 20,
      discountedNightlyRate: 200,
    });
    expect(previewPricing(250, null)).toEqual({
      currency: 'USD',
      nightlyRate: 250,
      discountPercent: null,
      discountedNightlyRate: null,
    });
    expect(previewPricing(null, 20)).toBeNull();
  });
});

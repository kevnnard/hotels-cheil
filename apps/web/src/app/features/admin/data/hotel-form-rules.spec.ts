import { FormControl } from '@angular/forms';
import {
  checkImageFile,
  discountPercentRule,
  hotelEmailRule,
  hotelErrorMessage,
  hotelTextLimits,
  httpWebsiteRule,
  imageUploadLimits,
  nightlyRateRule,
  requiredTextRule,
  toHotelRequest,
} from './hotel-form-rules';

function errorsOf(rule: (control: FormControl) => unknown, value: unknown) {
  return rule(new FormControl(value));
}

describe('hotel form rules', () => {
  it('mirrors the maximum lengths of the domain', () => {
    expect(hotelTextLimits).toEqual({
      name: 200,
      description: 2000,
      street: 200,
      city: 100,
      region: 100,
      country: 100,
      postalCode: 20,
      phone: 30,
      email: 254,
      website: 2048,
    });
  });

  it('requires a name with visible characters', () => {
    expect(errorsOf(requiredTextRule, '')).toEqual({ required: true });
    expect(errorsOf(requiredTextRule, '   ')).toEqual({ required: true });
    expect(errorsOf(requiredTextRule, 'Aurea')).toBeNull();
  });

  it('accepts an empty email and the well formed ones the domain accepts', () => {
    for (const value of ['', '  ', 'stay@aurea.example', 'a@b.co']) {
      expect(errorsOf(hotelEmailRule, value)).toBeNull();
    }
  });

  it('rejects the emails the domain rejects', () => {
    for (const value of ['stay', 'stay@aurea', '@aurea.example', 'a@b@c.co', 'stay@.aurea', 'stay@aurea.', 'st ay@aurea.example']) {
      expect(errorsOf(hotelEmailRule, value)).toEqual({ email: true });
    }
  });

  it('accepts only absolute http and https websites', () => {
    expect(errorsOf(httpWebsiteRule, '')).toBeNull();
    expect(errorsOf(httpWebsiteRule, 'https://aurea.example/stay')).toBeNull();
    expect(errorsOf(httpWebsiteRule, 'http://aurea.example')).toBeNull();
    for (const value of ['aurea.example', 'ftp://aurea.example', 'javascript:alert(1)', '/relative']) {
      expect(errorsOf(httpWebsiteRule, value)).toEqual({ website: true });
    }
  });

  it('accepts an empty price and positive prices up to 100000 with two decimals', () => {
    for (const value of [null, 0.01, 199.99, 100000]) {
      expect(errorsOf(nightlyRateRule, value)).toBeNull();
    }
    expect(errorsOf(nightlyRateRule, 0)).toEqual({ positive: true });
    expect(errorsOf(nightlyRateRule, -5)).toEqual({ positive: true });
    expect(errorsOf(nightlyRateRule, 100000.01)).toEqual({ maxRate: true });
    expect(errorsOf(nightlyRateRule, 10.123)).toEqual({ decimals: true });
  });

  it('accepts whole discounts between 1 and 90', () => {
    for (const value of [null, 1, 45, 90]) {
      expect(errorsOf(discountPercentRule, value)).toBeNull();
    }
    expect(errorsOf(discountPercentRule, 0)).toEqual({ discountRange: true });
    expect(errorsOf(discountPercentRule, 91)).toEqual({ discountRange: true });
    expect(errorsOf(discountPercentRule, 12.5)).toEqual({ integer: true });
  });

  it('explains every rule in plain language and prefers the server message', () => {
    expect(hotelErrorMessage('name', { required: true })).toBe('Enter the hotel name.');
    expect(hotelErrorMessage('city', { maxlength: { requiredLength: 100, actualLength: 101 } })).toBe(
      'Use 100 characters or fewer.',
    );
    expect(hotelErrorMessage('email', { email: true })).toBe('Enter a valid email address, such as stay@example.com.');
    expect(hotelErrorMessage('website', { website: true })).toBe('Enter a full address that starts with http:// or https://.');
    expect(hotelErrorMessage('pricePerNight', { positive: true })).toBe('Enter a price greater than 0.');
    expect(hotelErrorMessage('pricePerNight', { maxRate: true })).toBe('Enter a price of 100,000 or less.');
    expect(hotelErrorMessage('pricePerNight', { decimals: true })).toBe('Use at most two decimals.');
    expect(hotelErrorMessage('discountPercent', { integer: true })).toBe('Enter a whole number.');
    expect(hotelErrorMessage('discountPercent', { discountRange: true })).toBe('Enter a discount between 1 and 90.');
    expect(hotelErrorMessage('name', { server: 'Name cannot exceed 200 characters.', required: true })).toBe(
      'Name cannot exceed 200 characters.',
    );
    expect(hotelErrorMessage('name', null)).toBeNull();
  });

  it('builds the full request with trimmed text, nulls for empty fields and no discount without a price', () => {
    expect(
      toHotelRequest({
        name: '  Aurea Cliff  ',
        description: '',
        street: ' 1 Coast Road ',
        city: 'Positano',
        region: '   ',
        country: 'Italy',
        postalCode: '',
        phone: '',
        email: ' stay@aurea.example ',
        website: '',
        pricePerNight: null,
        discountPercent: 20,
      }),
    ).toEqual({
      name: 'Aurea Cliff',
      description: null,
      street: '1 Coast Road',
      city: 'Positano',
      region: null,
      country: 'Italy',
      postalCode: null,
      phone: null,
      email: 'stay@aurea.example',
      website: null,
      pricePerNight: null,
      discountPercent: null,
    });
  });

  it('mirrors the image types and the input size the API accepts', () => {
    expect(imageUploadLimits.accept).toBe('image/jpeg,image/png,image/webp');
    expect(imageUploadLimits.maximumBytes).toBe(10 * 1024 * 1024);
  });

  it('flags files the API would refuse by type or size and lets unknown types through to the server', () => {
    expect(checkImageFile(new File(['x'], 'a.jpg', { type: 'image/jpeg' }))).toBeNull();
    expect(checkImageFile(new File(['x'], 'a.webp', { type: 'image/webp' }))).toBeNull();
    expect(checkImageFile(new File(['x'], 'a', { type: '' }))).toBeNull();
    expect(checkImageFile(new File(['x'], 'a.gif', { type: 'image/gif' }))).toBe('Choose a JPEG, PNG or WebP image.');
    const large = new File(['x'], 'big.png', { type: 'image/png' });
    Object.defineProperty(large, 'size', { value: 10 * 1024 * 1024 + 1 });
    expect(checkImageFile(large)).toBe('Choose an image of 10 MB or less.');
  });
});

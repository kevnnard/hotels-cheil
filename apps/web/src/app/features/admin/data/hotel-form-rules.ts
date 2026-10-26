import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { HotelField, HotelFormValue, HotelRequest, HotelTextField, hotelTextFields } from './admin-hotel.models';

export const hotelTextLimits: Readonly<Record<HotelTextField, number>> = {
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
};

export const pricingLimits = { maximumNightlyRate: 100_000, minimumDiscount: 1, maximumDiscount: 90 } as const;

export const imageUploadLimits = {
  types: ['image/jpeg', 'image/png', 'image/webp'],
  accept: 'image/jpeg,image/png,image/webp',
  maximumBytes: 10 * 1024 * 1024,
  hint: 'JPEG, PNG or WebP, up to 10 MB. Stored images stay within 400 KB.',
} as const;

function textOf(control: AbstractControl): string {
  return typeof control.value === 'string' ? control.value.trim() : '';
}

function numberOf(control: AbstractControl): number | null {
  const value: unknown = control.value;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export const requiredTextRule: ValidatorFn = (control) => (textOf(control) === '' ? { required: true } : null);

export const hotelEmailRule: ValidatorFn = (control) => {
  const email = textOf(control);
  if (email === '') {
    return null;
  }
  const parts = email.split('@');
  const domain = parts[1] ?? '';
  const wellFormed =
    parts.length === 2 &&
    parts[0].length > 0 &&
    domain.includes('.') &&
    !domain.startsWith('.') &&
    !domain.endsWith('.') &&
    !/\s/.test(email);
  return wellFormed ? null : { email: true };
};

export const httpWebsiteRule: ValidatorFn = (control) => {
  const website = textOf(control);
  if (website === '') {
    return null;
  }
  try {
    const { protocol } = new URL(website);
    return protocol === 'http:' || protocol === 'https:' ? null : { website: true };
  } catch {
    return { website: true };
  }
};

export const nightlyRateRule: ValidatorFn = (control) => {
  const rate = numberOf(control);
  if (rate === null) {
    return null;
  }
  if (rate <= 0) {
    return { positive: true };
  }
  if (rate > pricingLimits.maximumNightlyRate) {
    return { maxRate: true };
  }
  return Math.abs(rate * 100 - Math.round(rate * 100)) > 1e-6 ? { decimals: true } : null;
};

export const discountPercentRule: ValidatorFn = (control) => {
  const discount = numberOf(control);
  if (discount === null) {
    return null;
  }
  if (!Number.isInteger(discount)) {
    return { integer: true };
  }
  return discount < pricingLimits.minimumDiscount || discount > pricingLimits.maximumDiscount
    ? { discountRange: true }
    : null;
};

const ruleMessages: Readonly<Record<string, string>> = {
  email: 'Enter a valid email address, such as stay@example.com.',
  website: 'Enter a full address that starts with http:// or https://.',
  positive: 'Enter a price greater than 0.',
  maxRate: 'Enter a price of 100,000 or less.',
  decimals: 'Use at most two decimals.',
  integer: 'Enter a whole number.',
  discountRange: 'Enter a discount between 1 and 90.',
};

export function hotelErrorMessage(field: HotelField, errors: ValidationErrors | null): string | null {
  if (errors === null) {
    return null;
  }
  const server: unknown = errors['server'];
  if (typeof server === 'string') {
    return server;
  }
  if (errors['required']) {
    return field === 'name' ? 'Enter the hotel name.' : 'Fill in this field.';
  }
  const maxLength: unknown = errors['maxlength'];
  if (typeof maxLength === 'object' && maxLength !== null) {
    return `Use ${(maxLength as { requiredLength: number }).requiredLength} characters or fewer.`;
  }
  const key = Object.keys(errors).find((name) => ruleMessages[name] !== undefined);
  return key === undefined ? null : ruleMessages[key];
}

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function toHotelRequest(value: HotelFormValue): HotelRequest {
  const text = Object.fromEntries(hotelTextFields.map((field) => [field, optionalText(value[field])])) as Record<
    HotelTextField,
    string | null
  >;
  const pricePerNight = value.pricePerNight;
  return {
    ...text,
    name: value.name.trim(),
    pricePerNight,
    discountPercent: pricePerNight === null ? null : value.discountPercent,
  };
}

export function checkImageFile(file: File): string | null {
  if (file.type !== '' && !(imageUploadLimits.types as readonly string[]).includes(file.type)) {
    return 'Choose a JPEG, PNG or WebP image.';
  }
  return file.size > imageUploadLimits.maximumBytes ? 'Choose an image of 10 MB or less.' : null;
}

import { CurrencyPipe } from '@angular/common';
import { Component, ElementRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { outputFromObservable } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { distinctUntilChanged, map } from 'rxjs';
import { effectiveNightlyRate, previewPricing, priceDigits } from '../../hotels/data/hotel-price';
import { Hotel } from '../../hotels/data/hotel.models';
import {
  FormAlert,
  HotelField,
  HotelFieldErrors,
  HotelFormValue,
  HotelRequest,
  HotelTextField,
  hotelFields,
} from '../data/admin-hotel.models';
import {
  discountPercentRule,
  hotelEmailRule,
  hotelErrorMessage,
  hotelTextLimits,
  httpWebsiteRule,
  nightlyRateRule,
  pricingLimits,
  requiredTextRule,
  toHotelRequest,
} from '../data/hotel-form-rules';

interface TextFieldView {
  readonly name: HotelTextField;
  readonly label: string;
  readonly type: 'text' | 'email' | 'tel' | 'url';
  readonly autocomplete: string;
  readonly multiline?: boolean;
  readonly wide?: boolean;
  readonly counter?: boolean;
  readonly required?: boolean;
  readonly placeholder?: string;
}

interface SectionView {
  readonly id: string;
  readonly number: string;
  readonly title: string;
  readonly summary: string;
  readonly fields: readonly TextFieldView[];
}

const sections: readonly SectionView[] = [
  {
    id: 'identity',
    number: '01',
    title: 'Identity',
    summary: 'The name and the story guests read first.',
    fields: [
      { name: 'name', label: 'Name', type: 'text', autocomplete: 'off', wide: true, counter: true, required: true, placeholder: 'e.g. Aurea Cliff House' },
      { name: 'description', label: 'Description', type: 'text', autocomplete: 'off', multiline: true, wide: true, counter: true },
    ],
  },
  {
    id: 'location',
    number: '02',
    title: 'Location',
    summary: 'Where the hotel stands.',
    fields: [
      { name: 'street', label: 'Street', type: 'text', autocomplete: 'off', wide: true },
      { name: 'city', label: 'City', type: 'text', autocomplete: 'off' },
      { name: 'region', label: 'Region', type: 'text', autocomplete: 'off' },
      { name: 'country', label: 'Country', type: 'text', autocomplete: 'off' },
      { name: 'postalCode', label: 'Postal code', type: 'text', autocomplete: 'off' },
    ],
  },
  {
    id: 'contact',
    number: '03',
    title: 'Contact',
    summary: 'How guests reach the hotel.',
    fields: [
      { name: 'phone', label: 'Phone', type: 'tel', autocomplete: 'off' },
      { name: 'email', label: 'Email', type: 'email', autocomplete: 'off', placeholder: 'stay@example.com' },
      { name: 'website', label: 'Website', type: 'url', autocomplete: 'off', wide: true, placeholder: 'https://' },
    ],
  },
];

function textControl(field: HotelTextField, ...validators: ValidatorFn[]): FormControl<string> {
  return new FormControl('', { nonNullable: true, validators: [...validators, Validators.maxLength(hotelTextLimits[field])] });
}

function formValueOf(hotel: Hotel | null): HotelFormValue {
  return {
    name: hotel?.name ?? '',
    description: hotel?.description ?? '',
    street: hotel?.address.street ?? '',
    city: hotel?.address.city ?? '',
    region: hotel?.address.region ?? '',
    country: hotel?.address.country ?? '',
    postalCode: hotel?.address.postalCode ?? '',
    phone: hotel?.contact.phone ?? '',
    email: hotel?.contact.email ?? '',
    website: hotel?.contact.website ?? '',
    pricePerNight: hotel?.pricing?.nightlyRate ?? null,
    discountPercent: hotel?.pricing?.discountPercent ?? null,
  };
}

export function fieldId(field: HotelField): string {
  return `hotel-field-${field}`;
}

@Component({
  selector: 'app-admin-hotel-form',
  imports: [CurrencyPipe, ReactiveFormsModule],
  templateUrl: './admin-hotel-form.html',
})
export class AdminHotelForm {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly revision = signal(0);

  readonly hotel = input<Hotel | null>(null);
  readonly saving = input(false);
  readonly alert = input<FormAlert | null>(null);
  readonly save = output<HotelRequest>();
  readonly cancelRequested = output<void>();

  protected readonly sections = sections;
  protected readonly limits = hotelTextLimits;
  protected readonly pricingLimits = pricingLimits;

  protected readonly form = new FormGroup({
    name: textControl('name', requiredTextRule),
    description: textControl('description'),
    street: textControl('street'),
    city: textControl('city'),
    region: textControl('region'),
    country: textControl('country'),
    postalCode: textControl('postalCode'),
    phone: textControl('phone'),
    email: textControl('email', hotelEmailRule),
    website: textControl('website', httpWebsiteRule),
    pricePerNight: new FormControl<number | null>(null, nightlyRateRule),
    discountPercent: new FormControl<number | null>({ value: null, disabled: true }, discountPercentRule),
  });

  readonly dirtyChange = outputFromObservable(
    this.form.events.pipe(
      map(() => this.form.dirty),
      distinctUntilChanged(),
    ),
  );

  constructor() {
    this.form.controls.pricePerNight.valueChanges.subscribe((price) => this.syncDiscount(price));
    effect(() => {
      const hotel = this.hotel();
      untracked(() => this.load(hotel));
    });
  }

  showServerErrors(errors: HotelFieldErrors): void {
    for (const field of hotelFields) {
      const message = errors[field];
      const control = this.form.controls[field];
      if (message !== undefined && control.enabled) {
        control.setErrors({ ...control.errors, server: message });
        control.markAsTouched();
      }
    }
    this.revision.update((value) => value + 1);
    this.focusFirstInvalidField();
  }

  protected submit(): void {
    if (this.saving()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.revision.update((value) => value + 1);
      this.focusFirstInvalidField();
      return;
    }
    this.save.emit(toHotelRequest(this.form.getRawValue()));
  }

  protected id(field: HotelField): string {
    return fieldId(field);
  }

  protected error(field: HotelField): string | null {
    this.revision();
    const control = this.form.controls[field];
    return control.touched && control.invalid ? hotelErrorMessage(field, control.errors) : null;
  }

  protected length(field: HotelTextField): number {
    return this.form.controls[field].value.length;
  }

  protected describedBy(field: HotelField, ...extras: (string | false)[]): string | null {
    const ids = [...extras.filter((extra): extra is string => extra !== false)];
    if (this.error(field) !== null) {
      ids.push(`${fieldId(field)}-error`);
    }
    return ids.length > 0 ? ids.join(' ') : null;
  }

  protected textField(field: HotelTextField): FormControl<string> {
    return this.form.controls[field];
  }

  protected preview(): { readonly rate: number; readonly digits: string } | 'empty' | 'invalid' {
    const price = this.form.controls.pricePerNight;
    const discount = this.form.controls.discountPercent;
    if (price.value === null) {
      return 'empty';
    }
    if (price.invalid) {
      return 'invalid';
    }
    const percent = discount.enabled && discount.valid ? discount.value : null;
    const pricing = previewPricing(price.value, percent);
    const rate = pricing === null ? price.value : effectiveNightlyRate(pricing);
    return { rate, digits: priceDigits(rate) };
  }

  private load(hotel: Hotel | null): void {
    this.form.reset(formValueOf(hotel));
    this.syncDiscount(this.form.controls.pricePerNight.value);
  }

  private syncDiscount(price: number | null): void {
    const discount = this.form.controls.discountPercent;
    if (price === null) {
      if (discount.value !== null) {
        discount.setValue(null);
      }
      if (discount.enabled) {
        discount.disable();
      }
    } else if (discount.disabled) {
      discount.enable();
    }
  }

  private focusFirstInvalidField(): void {
    const field = hotelFields.find((name) => this.form.controls[name].invalid);
    if (field !== undefined) {
      this.host.nativeElement.querySelector<HTMLElement>(`#${fieldId(field)}`)?.focus();
    }
  }
}

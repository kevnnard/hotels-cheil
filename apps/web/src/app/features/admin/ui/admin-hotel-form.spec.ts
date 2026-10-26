import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Hotel } from '../../hotels/data/hotel.models';
import { FormAlert, HotelRequest } from '../data/admin-hotel.models';
import { AdminHotelForm } from './admin-hotel-form';

const stored: Hotel = {
  id: 'h1',
  name: 'Aurea Cliff',
  description: 'Above the sea.',
  address: { street: '1 Coast Road', city: 'Positano', region: null, country: 'Italy', postalCode: '84017' },
  contact: { phone: '+39 089 000', email: 'stay@aurea.example', website: null },
  isActive: true,
  createdAtUtc: '2026-10-01T00:00:00Z',
  updatedAtUtc: '2026-10-01T00:00:00Z',
  rating: { sum: 9, count: 2, average: 4.5 },
  image: null,
  images: [],
  pricing: { currency: 'USD', nightlyRate: 400, discountPercent: 25, discountedNightlyRate: 300 },
};

@Component({
  imports: [AdminHotelForm],
  template: `
    <app-admin-hotel-form
      [hotel]="hotel()"
      [saving]="saving()"
      [alert]="alert()"
      (save)="saved.push($event)"
      (dirtyChange)="dirty.set($event)"
      (cancelRequested)="cancelled = cancelled + 1"
    >
      <p data-testid="projected-extra">Extra</p>
    </app-admin-hotel-form>
  `,
})
class FormHost {
  readonly form = viewChild.required(AdminHotelForm);
  readonly hotel = signal<Hotel | null>(null);
  readonly saving = signal(false);
  readonly alert = signal<FormAlert | null>(null);
  readonly dirty = signal(false);
  readonly saved: HotelRequest[] = [];
  cancelled = 0;
}

describe('AdminHotelForm', () => {
  async function render(hotel: Hotel | null = null) {
    const fixture = TestBed.createComponent(FormHost);
    fixture.componentInstance.hotel.set(hotel);
    const root = fixture.nativeElement as HTMLElement;
    document.body.appendChild(root);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const find = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>(`[data-testid="${id}"]`);
    const field = <T extends HTMLElement = HTMLInputElement>(name: string) => find<T>(`hotel-field-${name}`) as T;
    const type = async (name: string, value: string) => {
      const input = field<HTMLInputElement | HTMLTextAreaElement>(name);
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    const blur = async (name: string) => {
      field(name).dispatchEvent(new Event('blur'));
      await fixture.whenStable();
    };
    const submit = async () => {
      find('hotel-form-submit')?.click();
      await fixture.whenStable();
    };
    return { fixture, root, host, find, field, type, blur, submit };
  }

  afterEach(() => document.body.replaceChildren());

  it('builds every field of the contract with a visible label in four sections', async () => {
    const { root, field } = await render();

    const names = [
      'name',
      'description',
      'street',
      'city',
      'region',
      'country',
      'postalCode',
      'phone',
      'email',
      'website',
      'pricePerNight',
      'discountPercent',
    ];
    for (const name of names) {
      const control = field(name);
      expect(control, name).toBeTruthy();
      expect(root.querySelector(`label[for="${control.id}"]`)?.textContent?.trim(), name).toBeTruthy();
      expect(control.className, name).toContain('min-h-11');
    }
    expect(Array.from(root.querySelectorAll('h3')).map((heading) => heading.textContent?.trim())).toEqual([
      'Identity',
      'Location',
      'Contact',
      'Pricing',
    ]);
    expect(root.querySelectorAll('h1').length).toBe(0);
    expect(root.querySelector('[data-testid="projected-extra"]')).not.toBeNull();
  });

  it('uses one column on mobile and two from md', async () => {
    const { find } = await render();

    const grid = find('hotel-section-location-fields') as HTMLElement;
    expect(grid.className).toContain('grid-cols-1');
    expect(grid.className).toContain('md:grid-cols-2');
  });

  it('caps every text field at the domain length', async () => {
    const { field } = await render();

    const limits: Record<string, string> = {
      name: '200',
      description: '2000',
      street: '200',
      city: '100',
      region: '100',
      country: '100',
      postalCode: '20',
      phone: '30',
      email: '254',
      website: '2048',
    };
    for (const [name, limit] of Object.entries(limits)) {
      expect(field(name).getAttribute('maxlength'), name).toBe(limit);
    }
  });

  it('counts the characters of the name and the description', async () => {
    const { field, find, type } = await render();

    await type('name', 'Aurea');

    expect(find('hotel-field-name-count')?.textContent?.trim()).toBe('5 / 200');
    expect(find('hotel-field-description-count')?.textContent?.trim()).toBe('0 / 2000');
    expect(field('name').getAttribute('aria-describedby')).toContain('hotel-field-name-count');
  });

  it('waits for the blur before showing a field error and links it with aria-describedby', async () => {
    const { field, find, type, blur } = await render();

    await type('email', 'not-an-email');
    expect(find('hotel-field-email-error')).toBeNull();

    await blur('email');

    const error = find('hotel-field-email-error') as HTMLElement;
    expect(error.textContent?.trim()).toBe('Enter a valid email address, such as stay@example.com.');
    expect(field('email').getAttribute('aria-invalid')).toBe('true');
    expect(field('email').getAttribute('aria-describedby')?.split(' ')).toContain(error.id);
  });

  it('shows the required name on submit, focuses the first invalid field and sends nothing', async () => {
    const { host, field, find, type, blur, submit } = await render();
    await type('website', 'aurea.example');
    await blur('website');

    await submit();

    expect(find('hotel-field-name-error')?.textContent?.trim()).toBe('Enter the hotel name.');
    expect(find('hotel-field-website-error')?.textContent?.trim()).toBe(
      'Enter a full address that starts with http:// or https://.',
    );
    expect(document.activeElement).toBe(field('name'));
    expect(host.saved).toEqual([]);
  });

  it('rejects a price with three decimals and a discount out of range', async () => {
    const { find, type, blur, submit, field } = await render();
    await type('name', 'Aurea');
    await type('pricePerNight', '10.123');
    await blur('pricePerNight');
    await type('discountPercent', '95');

    await submit();

    expect(find('hotel-field-pricePerNight-error')?.textContent?.trim()).toBe('Use at most two decimals.');
    expect(find('hotel-field-discountPercent-error')?.textContent?.trim()).toBe('Enter a discount between 1 and 90.');
    expect(document.activeElement).toBe(field('pricePerNight'));
  });

  it('disables and clears the discount while the price is empty', async () => {
    const { field, find, type } = await render();

    expect((field('discountPercent') as HTMLInputElement).disabled).toBe(true);
    expect(field('discountPercent').getAttribute('aria-describedby')).toContain('hotel-field-discountPercent-hint');
    expect(find('hotel-field-discountPercent-hint')?.textContent?.trim()).toBe('Add a price per night to set a discount.');

    await type('pricePerNight', '200');
    expect((field('discountPercent') as HTMLInputElement).disabled).toBe(false);
    await type('discountPercent', '15');

    await type('pricePerNight', '');

    expect((field('discountPercent') as HTMLInputElement).disabled).toBe(true);
    expect((field('discountPercent') as HTMLInputElement).value).toBe('');
  });

  it('previews the nightly price guests pay in USD with the discount applied', async () => {
    const { find, type } = await render();
    const preview = () => find('hotel-price-preview')?.textContent?.replace(/\s+/g, ' ').trim();

    expect(preview()).toBe('Without a price, guests see Price on request.');
    expect(find('hotel-price-currency')?.textContent?.trim()).toBe('USD');

    await type('pricePerNight', '200');
    expect(preview()).toBe('Guests pay $200 per night');

    await type('discountPercent', '15');
    expect(preview()).toBe('Guests pay $170 per night');

    await type('pricePerNight', '10.05');
    await type('discountPercent', '10');
    expect(preview()).toBe('Guests pay $9.05 per night');
  });

  it('sends the exact request body of a valid new hotel', async () => {
    const { host, type, submit } = await render();
    await type('name', '  Aurea Cliff ');
    await type('city', 'Positano');
    await type('country', 'Italy');
    await type('email', 'stay@aurea.example');
    await type('pricePerNight', '250');
    await type('discountPercent', '20');

    await submit();

    expect(host.saved).toEqual([
      {
        name: 'Aurea Cliff',
        description: null,
        street: null,
        city: 'Positano',
        region: null,
        country: 'Italy',
        postalCode: null,
        phone: null,
        email: 'stay@aurea.example',
        website: null,
        pricePerNight: 250,
        discountPercent: 20,
      },
    ]);
  });

  it('pre-fills every field of a stored hotel, null becoming empty, and stays pristine', async () => {
    const { host, field } = await render(stored);

    expect((field('name') as HTMLInputElement).value).toBe('Aurea Cliff');
    expect((field('description') as HTMLTextAreaElement).value).toBe('Above the sea.');
    expect((field('street') as HTMLInputElement).value).toBe('1 Coast Road');
    expect((field('city') as HTMLInputElement).value).toBe('Positano');
    expect((field('region') as HTMLInputElement).value).toBe('');
    expect((field('country') as HTMLInputElement).value).toBe('Italy');
    expect((field('postalCode') as HTMLInputElement).value).toBe('84017');
    expect((field('phone') as HTMLInputElement).value).toBe('+39 089 000');
    expect((field('email') as HTMLInputElement).value).toBe('stay@aurea.example');
    expect((field('website') as HTMLInputElement).value).toBe('');
    expect((field('pricePerNight') as HTMLInputElement).value).toBe('400');
    expect((field('discountPercent') as HTMLInputElement).value).toBe('25');
    expect((field('discountPercent') as HTMLInputElement).disabled).toBe(false);
    expect(host.dirty()).toBe(false);
  });

  it('labels the submit button by mode', async () => {
    expect((await render()).find('hotel-form-submit')?.textContent?.trim()).toBe('Create hotel');
    document.body.replaceChildren();
    expect((await render(stored)).find('hotel-form-submit')?.textContent?.trim()).toBe('Save changes');
  });

  it('reports the dirty state when a field changes', async () => {
    const { host, type } = await render(stored);

    await type('city', 'Amalfi');

    expect(host.dirty()).toBe(true);
  });

  it('shows the saving state and ignores further submits while saving', async () => {
    const { fixture, host, find, submit } = await render(stored);
    host.saving.set(true);
    await fixture.whenStable();

    const button = find<HTMLButtonElement>('hotel-form-submit') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.textContent?.trim()).toBe('Saving…');
    (find('hotel-form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await submit();

    expect(host.saved).toEqual([]);
  });

  it('puts server errors on their fields and focuses the first one', async () => {
    const { fixture, host, field, find } = await render(stored);

    host.form().showServerErrors({ city: 'City cannot exceed 100 characters.', name: 'Name is required.' });
    await fixture.whenStable();

    expect(find('hotel-field-name-error')?.textContent?.trim()).toBe('Name is required.');
    expect(find('hotel-field-city-error')?.textContent?.trim()).toBe('City cannot exceed 100 characters.');
    expect(document.activeElement).toBe(field('name'));
  });

  it('renders the alert as text with its details and a retry for retryable failures', async () => {
    const { fixture, host, find } = await render(stored);
    const alert = find('hotel-form-alert') as HTMLElement;
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.textContent?.trim()).toBe('');

    host.alert.set({ message: 'The hotel could not be saved.', details: ['<img src=x onerror=alert(1)>'], retryable: false });
    await fixture.whenStable();
    expect(alert.textContent).toContain('The hotel could not be saved.');
    expect(alert.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(alert.querySelector('img')).toBeNull();
    expect(find('hotel-form-retry')).toBeNull();

    host.alert.set({ message: 'We could not reach the server.', details: [], retryable: true });
    await fixture.whenStable();
    find('hotel-form-retry')?.click();
    await fixture.whenStable();

    expect(host.saved.length).toBe(1);
    expect(host.saved[0].name).toBe('Aurea Cliff');
  });

  it('asks the host to cancel', async () => {
    const { host, find } = await render();

    find('hotel-form-cancel')?.click();

    expect(host.cancelled).toBe(1);
    expect(find('hotel-form-cancel')?.className).toContain('min-h-11');
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HotelPricing } from '../data/hotel.models';
import { ReservationCard } from './reservation-card';

const plain: HotelPricing = { currency: 'USD', nightlyRate: 200, discountPercent: null, discountedNightlyRate: null };
const discounted: HotelPricing = { currency: 'USD', nightlyRate: 240, discountPercent: 15, discountedNightlyRate: 204 };

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim();
const line = (query: (selector: string) => HTMLElement | null) => [
  text(query('[data-testid="nights-line"] dt')),
  text(query('[data-testid="nights-line"] dd')),
];

describe('ReservationCard', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function render(pricing: HotelPricing | null) {
    const fixture = TestBed.createComponent(ReservationCard);
    fixture.componentRef.setInput('pricing', pricing);
    fixture.componentRef.setInput('hotelName', 'Aurea Test');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const query = <T extends Element = HTMLElement>(selector: string) => root.querySelector<T>(selector);
    const setNights = (value: string) => {
      const input = query<HTMLInputElement>('[data-testid="nights-input"]') as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };
    return { fixture, root, query, setNights };
  }

  it('shows the nightly price, three nights by default and the estimated total', () => {
    const { query } = render(plain);

    expect(text(query('[data-testid="detail-price"] [data-testid="price-current"]'))).toBe('$200');
    expect(query<HTMLInputElement>('[data-testid="nights-input"]')?.value).toBe('3');
    expect(line(query)).toEqual(['$200 × 3 nights', '$600']);
    expect(text(query('[data-testid="estimated-total"]'))).toBe('$600');
  });

  it('labels the nights input and announces the total politely', () => {
    const { root, query } = render(plain);

    const input = query<HTMLInputElement>('[data-testid="nights-input"]') as HTMLInputElement;
    expect(text(root.querySelector(`label[for="${input.id}"]`))).toBe('Nights');
    expect(input.getAttribute('min')).toBe('1');
    expect(input.getAttribute('max')).toBe('14');
    expect(query('[data-testid="estimated-total"]')?.closest('[aria-live="polite"]')).not.toBeNull();
  });

  it('multiplies the discounted nightly price by the nights', () => {
    const { fixture, query, setNights } = render(discounted);

    expect(text(query('[data-testid="estimated-total"]'))).toBe('$612');
    setNights('5');
    expect(text(query('[data-testid="estimated-total"]'))).toBe('$1,020');
    expect(line(query)).toEqual(['$204 × 5 nights', '$1,020']);
    fixture.destroy();
  });

  it('changes the nights with the stepper buttons and keeps them between one and fourteen', () => {
    const { fixture, query, setNights } = render(plain);
    const decrease = query<HTMLButtonElement>('[data-testid="nights-decrease"]') as HTMLButtonElement;
    const increase = query<HTMLButtonElement>('[data-testid="nights-increase"]') as HTMLButtonElement;

    increase.click();
    fixture.detectChanges();
    expect(text(query('[data-testid="estimated-total"]'))).toBe('$800');

    setNights('1');
    expect(decrease.disabled).toBe(true);
    expect(line(query)).toEqual(['$200 × 1 night', '$200']);

    setNights('40');
    expect(query<HTMLInputElement>('[data-testid="nights-input"]')?.value).toBe('14');
    expect(increase.disabled).toBe(true);
    expect(text(query('[data-testid="estimated-total"]'))).toBe('$2,800');

    setNights('0');
    expect(query<HTMLInputElement>('[data-testid="nights-input"]')?.value).toBe('1');

    setNights('abc');
    expect(query<HTMLInputElement>('[data-testid="nights-input"]')?.value).toBe('1');
  });

  it('rounds a decimal total to cents', () => {
    const { query } = render({ currency: 'USD', nightlyRate: 199.99, discountPercent: 15, discountedNightlyRate: 169.99 });

    expect(text(query('[data-testid="estimated-total"]'))).toBe('$509.97');
  });

  it('offers one to four guests without changing the total', () => {
    const { fixture, root, query } = render(plain);
    const select = query<HTMLSelectElement>('[data-testid="guests-select"]') as HTMLSelectElement;

    expect(text(root.querySelector(`label[for="${select.id}"]`))).toBe('Guests');
    expect([...select.options].map((option) => text(option))).toEqual(['1 guest', '2 guests', '3 guests', '4 guests']);
    select.value = '4';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(text(query('[data-testid="estimated-total"]'))).toBe('$600');
  });

  it('lists the complimentary perks as static rows', () => {
    const { root } = render(plain);

    const perks = [...root.querySelectorAll('[data-testid="reservation-perk"]')].map((row) => text(row));
    expect(perks.length).toBeGreaterThan(0);
    expect(perks.every((perk) => /Complimentary|Included/.test(perk ?? ''))).toBe(true);
  });

  it('shows the price on request without nights or total when there is no pricing', () => {
    const { root, query } = render(null);

    expect(text(query('[data-testid="price-on-request"]'))).toBe('Price on request');
    expect(query('[data-testid="nights-input"]')).toBeNull();
    expect(query('[data-testid="estimated-total"]')).toBeNull();
    expect(query('[data-testid="nights-line"]')).toBeNull();
    expect(root.textContent).not.toContain('$');
    expect(query('[data-testid="request-dossier"]')).not.toBeNull();
    expect(query('[data-testid="ask-concierge"]')).not.toBeNull();
  });

  for (const testId of ['request-dossier', 'ask-concierge']) {
    it(`keeps the ${testId} button inert with a demo message and no request`, () => {
      const { fixture, query } = render(discounted);
      const status = query('[data-testid="reservation-feedback"]') as HTMLElement;

      expect(status.getAttribute('role')).toBe('status');
      expect(text(status)).toBe('');
      const button = query<HTMLButtonElement>(`[data-testid="${testId}"]`) as HTMLButtonElement;
      expect(button.getAttribute('type')).toBe('button');
      button.click();
      fixture.detectChanges();

      expect(text(status)).toBe('Demo only: nothing was sent.');
      http.expectNone(() => true);
    });
  }

  it('shows the guarantee line and uses no booking or inventory wording', () => {
    const { root, query } = render(discounted);

    expect(query('[data-testid="reservation-guarantee"] svg')).not.toBeNull();
    const content = root.textContent ?? '';
    for (const forbidden of ['Book', 'book', 'Reserv', 'reserv', 'remaining', 'available', 'confirmed']) {
      expect(content).not.toContain(forbidden);
    }
    expect(text(query('[data-testid="request-dossier"]'))).toBe('Request a dossier');
    expect(text(query('[data-testid="ask-concierge"]'))).toBe('Ask the concierge');
  });
});

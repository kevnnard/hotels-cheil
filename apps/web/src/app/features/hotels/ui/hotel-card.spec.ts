import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Hotel } from '../data/hotel.models';
import { HotelCard } from './hotel-card';

const hotel: Hotel = {
  id: 'h1',
  name: 'Aurea Palace',
  description: 'A quiet place by the sea.',
  address: { street: 'Calle 1', city: 'Lima', region: 'Lima', country: 'Peru', postalCode: '15001' },
  contact: { phone: null, email: null, website: null },
  isActive: true,
  createdAtUtc: '2026-10-01T00:00:00Z',
  updatedAtUtc: '2026-10-02T00:00:00Z',
  rating: { sum: 14, count: 3, average: 4.666 },
  image: null,
  images: [],
  pricing: null,
};

describe('HotelCard rating', () => {
  function badge(rating: Hotel['rating']): HTMLElement | null {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(HotelCard);
    fixture.componentRef.setInput('hotel', { ...hotel, rating });
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('[data-testid="card-rating"]');
  }

  it('shows the average with two decimals', () => {
    expect(badge({ sum: 14, count: 3, average: 4.666 })?.textContent?.trim()).toBe('4.67');
  });

  it('keeps trailing zeros so every average has two decimals', () => {
    expect(badge({ sum: 9, count: 2, average: 4.5 })?.textContent?.trim()).toBe('4.50');
  });

  it('announces the two decimal average to assistive technology', () => {
    expect(badge({ sum: 14, count: 3, average: 4.666 })?.getAttribute('aria-label')).toBe('Rating 4.67 out of 5');
  });

  it('shows no badge without ratings', () => {
    expect(badge({ sum: 0, count: 0, average: null })).toBeNull();
  });
});

describe('HotelCard price', () => {
  function render(pricing: Hotel['pricing']): HTMLElement {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(HotelCard);
    fixture.componentRef.setInput('hotel', { ...hotel, pricing });
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim();

  it('shows the nightly rate in USD without decimals for a whole amount, followed by per night', () => {
    const root = render({ currency: 'USD', nightlyRate: 400, discountPercent: null, discountedNightlyRate: null });

    const row = root.querySelector('[data-testid="card-price"]');
    expect(text(row?.querySelector('[data-testid="price-current"]'))).toBe('$400');
    expect(text(row)).toBe('$400 per night');
    expect(row?.querySelector('s')).toBeNull();
    expect(row?.querySelector('[data-testid="price-discount"]')).toBeNull();
  });

  it('shows two decimals when the amount is not whole', () => {
    const root = render({ currency: 'USD', nightlyRate: 199.5, discountPercent: null, discountedNightlyRate: null });

    expect(text(root.querySelector('[data-testid="price-current"]'))).toBe('$199.50');
  });

  it('strikes the original rate through and emphasises the discounted rate without the percentage badge in the price block', () => {
    const root = render({ currency: 'USD', nightlyRate: 200, discountPercent: 15, discountedNightlyRate: 170 });

    const row = root.querySelector('[data-testid="card-price"]') as HTMLElement;
    const original = row.querySelector('s[data-testid="price-original"]');
    expect(original).not.toBeNull();
    expect(text(original?.querySelector('.sr-only'))).toBe('Original price');
    expect(text(original)).toBe('Original price $200');
    const current = row.querySelector('[data-testid="price-current"]');
    expect(text(current?.querySelector('.sr-only'))).toBe('Discounted price');
    expect(text(current)).toBe('Discounted price $170');
    expect(current?.closest('s')).toBeNull();
    expect(row.querySelector('[data-testid="price-discount"]')).toBeNull();
    expect(text(row)).toContain('per night');
  });

  it('formats a discounted rate with cents using two decimals', () => {
    const root = render({ currency: 'USD', nightlyRate: 199.99, discountPercent: 15, discountedNightlyRate: 169.99 });

    expect(text(root.querySelector('[data-testid="price-original"]'))).toBe('Original price $199.99');
    expect(text(root.querySelector('[data-testid="price-current"]'))).toBe('Discounted price $169.99');
  });

  it('places the price and the Explore action in one footer row below the title', () => {
    const root = render({ currency: 'USD', nightlyRate: 400, discountPercent: null, discountedNightlyRate: null });

    const footer = root.querySelector('[data-testid="card-footer"]') as HTMLElement;
    const row = root.querySelector('[data-testid="card-price"]') as HTMLElement;
    const explore = root.querySelector('[data-testid="card-explore"]') as HTMLElement;
    for (const token of ['flex', 'flex-wrap', 'items-baseline', 'justify-between', 'border-t']) {
      expect(footer.classList.contains(token)).toBe(true);
    }
    expect(footer.classList.contains('flex-col')).toBe(false);
    expect(row.parentElement).toBe(footer);
    expect(explore.parentElement).toBe(footer);
    expect(row.compareDocumentPosition(explore) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(row.compareDocumentPosition(root.querySelector('h3') as Node) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it('shows no price row when the hotel has no pricing and keeps Explore aligned right', () => {
    const root = render(null);

    expect(root.querySelector('[data-testid="card-price"]')).toBeNull();
    expect(root.textContent).not.toContain('per night');
    expect(root.textContent).not.toContain('$');
    const explore = root.querySelector('[data-testid="card-explore"]') as HTMLElement;
    expect(explore.parentElement).toBe(root.querySelector('[data-testid="card-footer"]'));
    expect(explore.classList.contains('ml-auto')).toBe(true);
  });

  it('uses no booking, reservation or total wording', () => {
    const root = render({ currency: 'USD', nightlyRate: 200, discountPercent: 15, discountedNightlyRate: 170 });

    for (const forbidden of ['Book', 'book', 'Reserv', 'reserv', 'Total', 'total']) {
      expect(root.textContent).not.toContain(forbidden);
    }
  });
});

describe('HotelCard image badges', () => {
  const discount = { currency: 'USD' as const, nightlyRate: 200, discountPercent: 15, discountedNightlyRate: 170 };
  const noRating = { sum: 0, count: 0, average: null };

  function render(overrides: Partial<Hotel>): HTMLElement {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(HotelCard);
    fixture.componentRef.setInput('hotel', { ...hotel, ...overrides });
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function pills(root: HTMLElement): string[] {
    return Array.from(root.querySelectorAll('[data-testid="card-badges"] > *')).map((pill) => pill.getAttribute('data-testid') ?? '');
  }

  it('shows the discount pill in the top-right group of the image with the percentage and an accessible label', () => {
    const root = render({ rating: noRating, pricing: discount });

    const group = root.querySelector('[data-testid="card-badges"]') as HTMLElement;
    const pill = root.querySelector('[data-testid="card-discount"]') as HTMLElement;
    expect(group.parentElement).toBe(root.querySelector('[data-testid="card-media"]'));
    for (const token of ['absolute', 'top-2.5', 'right-2.5', 'flex', 'justify-end']) {
      expect(group.classList.contains(token)).toBe(true);
    }
    expect(group.contains(pill)).toBe(true);
    expect(pill.textContent?.trim()).toBe('-15%');
    expect(pill.getAttribute('aria-label')).toBe('15 percent discount');
    expect(pill.classList.contains('bg-secondary-container')).toBe(true);
    expect(pill.classList.contains('text-primary')).toBe(true);
  });

  it('shows no discount pill for an undiscounted price', () => {
    const root = render({ rating: noRating, pricing: { ...discount, discountPercent: null, discountedNightlyRate: null } });

    expect(root.querySelector('[data-testid="card-discount"]')).toBeNull();
    expect(root.querySelector('[data-testid="card-badges"]')).toBeNull();
  });

  it('shows no discount pill without pricing', () => {
    const root = render({ rating: noRating, pricing: null });

    expect(root.querySelector('[data-testid="card-discount"]')).toBeNull();
  });

  it('shows the rating first and the discount second when both apply', () => {
    expect(pills(render({ pricing: discount }))).toEqual(['card-rating', 'card-discount']);
  });

  it('shows only the rating pill in the group when there is no discount', () => {
    expect(pills(render({ pricing: null }))).toEqual(['card-rating']);
  });

  it('shows only the discount pill in the group when there are no ratings', () => {
    expect(pills(render({ rating: noRating, pricing: discount }))).toEqual(['card-discount']);
  });
});

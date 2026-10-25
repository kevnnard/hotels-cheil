import { TestBed } from '@angular/core/testing';
import { HotelPricing } from '../data/hotel.models';
import { HotelPrice } from './hotel-price';

const discounted: HotelPricing = { currency: 'USD', nightlyRate: 200, discountPercent: 15, discountedNightlyRate: 170 };

describe('HotelPrice', () => {
  function render(inputs: Record<string, unknown>): HTMLElement {
    const fixture = TestBed.createComponent(HotelPrice);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim();

  it('shows the percentage badge by default for a discounted price', () => {
    const root = render({ pricing: discounted });

    expect(text(root.querySelector('[data-testid="price-discount"]'))).toBe('-15%');
  });

  it('hides the percentage badge when showBadge is false and keeps both prices', () => {
    const root = render({ pricing: discounted, showBadge: false });

    expect(root.querySelector('[data-testid="price-discount"]')).toBeNull();
    expect(text(root.querySelector('s[data-testid="price-original"]'))).toBe('Original price $200');
    expect(text(root.querySelector('[data-testid="price-current"]'))).toBe('Discounted price $170');
    expect(text(root)).toContain('per night');
  });

  it('shows the plain amount in the serif headline size at the default size', () => {
    const root = render({ pricing: { ...discounted, discountPercent: null, discountedNightlyRate: null } });

    const current = root.querySelector('[data-testid="price-current"]') as HTMLElement;
    expect(current.classList.contains('font-serif')).toBe(true);
    expect(current.classList.contains('text-headline-sm')).toBe(true);
  });

  it('keeps the large serif amount at the large size', () => {
    const root = render({ pricing: discounted, size: 'lg' });

    expect((root.querySelector('[data-testid="price-current"]') as HTMLElement).classList.contains('text-headline-md')).toBe(true);
  });
});

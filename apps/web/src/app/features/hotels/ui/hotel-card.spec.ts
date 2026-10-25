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

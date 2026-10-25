import { TestBed } from '@angular/core/testing';
import { HotelRating } from '../data/hotel.models';
import { RatingSummary } from './rating-summary';

describe('RatingSummary', () => {
  function render(rating: HotelRating): HTMLElement | null {
    const fixture = TestBed.createComponent(RatingSummary);
    fixture.componentRef.setInput('rating', rating);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('[data-testid="rating-summary"]');
  }

  it('shows the average with two decimals and the count', () => {
    const text = render({ sum: 14, count: 3, average: 4.666 })?.textContent;

    expect(text).toContain('4.67');
    expect(text).toContain('3 ratings');
  });

  it('keeps trailing zeros so every average has two decimals', () => {
    expect(render({ sum: 5, count: 1, average: 5 })?.textContent).toContain('5.00');
  });

  it('renders nothing without ratings', () => {
    expect(render({ sum: 0, count: 0, average: null })).toBeNull();
  });
});

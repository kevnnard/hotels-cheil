import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Hotel } from '../data/hotel.models';
import { FeaturedHotel } from './featured-hotel';

function hotel(overrides: Partial<Hotel> & { id: string; name: string }): Hotel {
  return {
    description: null,
    address: { street: null, city: 'Lima', region: null, country: 'Peru', postalCode: null },
    contact: { phone: null, email: null, website: null },
    isActive: true,
    createdAtUtc: '2026-10-01T00:00:00Z',
    updatedAtUtc: '2026-10-01T00:00:00Z',
    rating: { sum: 9, count: 2, average: 4.5 },
    image: null,
    ...overrides,
  };
}

const image = { contentType: 'image/webp', width: 800, height: 600, sizeBytes: 120000 };

describe('FeaturedHotel', () => {
  function render(hotels: Hotel[]) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(FeaturedHotel);
    fixture.componentRef.setInput('hotels', hotels);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      root,
      stage: () => root.querySelector('[data-testid="featured-hotel"]') as HTMLElement,
      press: (testId: string) => {
        (root.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement).click();
        fixture.detectChanges();
      },
    };
  }

  const alpha = hotel({ id: 'a', name: 'Alpha', description: 'First quiet place', image });
  const beta = hotel({ id: 'b', name: 'Beta', description: 'Second quiet place' });
  const gamma = hotel({ id: 'c', name: 'Gamma', image });

  it('shows the first hotel name, description and a View details link to its detail', () => {
    const { stage } = render([alpha, beta]);

    expect(stage().textContent).toContain('Alpha');
    expect(stage().textContent).toContain('First quiet place');
    const action = stage().querySelector('a');
    expect(action?.textContent).toContain('View details');
    expect(action?.getAttribute('href')).toBe('/hotels/a');
    expect(stage().querySelector('img')?.getAttribute('src')).toBe('/api/public/hotels/a/image');
  });

  it('moves to the next and previous hotel and wraps around', () => {
    const { stage, press } = render([alpha, beta, gamma]);

    press('featured-next');
    expect(stage().textContent).toContain('Beta');
    expect(stage().querySelector('a')?.getAttribute('href')).toBe('/hotels/b');

    press('featured-next');
    press('featured-next');
    expect(stage().textContent).toContain('Alpha');

    press('featured-previous');
    expect(stage().textContent).toContain('Gamma');
    expect(stage().querySelector('a')?.getAttribute('href')).toBe('/hotels/c');
  });

  it('shows the placeholder with the same stage size when the featured hotel has no image', () => {
    const { stage, press } = render([alpha, beta]);
    const imageClasses = stage().className;

    press('featured-next');

    const placeholder = stage().querySelector('[data-testid="image-placeholder"]');
    expect(placeholder?.textContent?.trim()).toBe('No image available');
    expect(stage().querySelector('img')).toBeNull();
    expect(stage().className).toBe(imageClasses);
    expect(stage().className).toContain('h-130');
  });

  it('hides the controls with a single hotel', () => {
    const { root } = render([alpha]);

    expect(root.querySelector('[data-testid="featured-next"]')).toBeNull();
    expect(root.querySelector('[data-testid="featured-previous"]')).toBeNull();
  });

  it('returns to the first hotel when the list changes', () => {
    const { fixture, stage, press } = render([alpha, beta]);
    press('featured-next');

    fixture.componentRef.setInput('hotels', [gamma, alpha]);
    fixture.detectChanges();

    expect(stage().textContent).toContain('Gamma');
  });

  it('renders no stage without hotels', () => {
    const { stage } = render([]);

    expect(stage()).toBeNull();
  });
});

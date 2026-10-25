import { TestBed } from '@angular/core/testing';
import { HotelImageView } from './hotel-image-view';

describe('HotelImageView', () => {
  function render(hasImage: boolean) {
    const fixture = TestBed.createComponent(HotelImageView);
    fixture.componentRef.setInput('hotelId', 'abc');
    fixture.componentRef.setInput('hotelName', 'Aurea Test');
    fixture.componentRef.setInput('hasImage', hasImage);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('loads the public image of a hotel that has one', () => {
    const image = render(true).querySelector('img');

    expect(image?.getAttribute('src')).toBe('/api/public/hotels/abc/image');
    expect(image?.getAttribute('alt')).toBe('Aurea Test');
  });

  it('loads the image stored at an explicit position with the given alternative text', () => {
    const fixture = TestBed.createComponent(HotelImageView);
    fixture.componentRef.setInput('hotelId', 'abc');
    fixture.componentRef.setInput('hotelName', 'Aurea Test');
    fixture.componentRef.setInput('hasImage', true);
    fixture.componentRef.setInput('position', 2);
    fixture.componentRef.setInput('alt', 'Aurea Test, photo 3');
    fixture.detectChanges();
    const image = (fixture.nativeElement as HTMLElement).querySelector('img');

    expect(image?.getAttribute('src')).toBe('/api/public/hotels/abc/images/2');
    expect(image?.getAttribute('alt')).toBe('Aurea Test, photo 3');
  });

  it('shows the placeholder and no image element when the hotel has no image', () => {
    const root = render(false);

    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('[data-testid="image-placeholder"]')).not.toBeNull();
  });

  it('labels the placeholder with a calm forest-green panel and a local icon', () => {
    const placeholder = render(false).querySelector('[data-testid="image-placeholder"]') as HTMLElement;

    expect(placeholder.textContent?.trim()).toBe('No image available');
    expect(placeholder.classList.contains('from-primary-container')).toBe(true);
    expect(placeholder.classList.contains('to-primary')).toBe(true);
    expect(placeholder.querySelector('svg')).not.toBeNull();
    expect(placeholder.classList.contains('h-full')).toBe(true);
  });

  it('falls back to the placeholder when the image fails to load', () => {
    const fixture = TestBed.createComponent(HotelImageView);
    fixture.componentRef.setInput('hotelId', 'abc');
    fixture.componentRef.setInput('hotelName', 'Aurea Test');
    fixture.componentRef.setInput('hasImage', true);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    root.querySelector('img')?.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('[data-testid="image-placeholder"]')).not.toBeNull();
  });
});

import { TestBed } from '@angular/core/testing';
import { HotelGalleryImage } from '../data/hotel.models';
import { HotelGallery } from './hotel-gallery';

const image = (position: number): HotelGalleryImage => ({
  position,
  contentType: 'image/jpeg',
  width: 900,
  height: 600,
  sizeBytes: 1000,
});

const dialogPrototype = HTMLDialogElement.prototype as Partial<Pick<HTMLDialogElement, 'showModal' | 'close'>>;

describe('HotelGallery', () => {
  beforeEach(() => {
    Object.defineProperty(dialogPrototype, 'showModal', {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute('open', '');
      },
    });
    Object.defineProperty(dialogPrototype, 'close', {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute('open');
        this.dispatchEvent(new Event('close'));
      },
    });
  });

  afterEach(() => {
    delete dialogPrototype.showModal;
    delete dialogPrototype.close;
    document.body.classList.remove('overflow-hidden');
  });

  function render(images: HotelGalleryImage[]) {
    const fixture = TestBed.createComponent(HotelGallery);
    fixture.componentRef.setInput('hotelId', 'abc');
    fixture.componentRef.setInput('hotelName', 'Aurea Test');
    fixture.componentRef.setInput('images', images);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const tile = (position: number) => root.querySelector<HTMLElement>(`[data-testid="gallery-tile"][data-position="${position}"]`) as HTMLElement;
    const dialog = () => root.querySelector('dialog') as HTMLDialogElement;
    return { fixture, root, tile, dialog };
  }

  it('shows three placeholders, no image and no gallery button when the hotel has no images', () => {
    const { root, tile } = render([]);

    expect(root.querySelectorAll('img').length).toBe(0);
    for (const position of [0, 1, 2]) {
      expect(tile(position).querySelector('[data-testid="image-placeholder"]')?.textContent?.trim()).toBe('No image available');
      expect(tile(position).querySelector('button')).toBeNull();
    }
    expect(root.querySelector('[data-testid="gallery-view-all"]')).toBeNull();
  });

  it('places the first image in the large tile and placeholders in the two others', () => {
    const { root, tile } = render([image(0)]);

    expect(root.querySelectorAll('[data-testid="gallery-mosaic"] img').length).toBe(1);
    expect(tile(0).querySelector('img')?.getAttribute('src')).toBe('/api/public/hotels/abc/images/0');
    expect(tile(0).querySelector('img')?.getAttribute('alt')).toBe('Aurea Test, photo 1');
    expect(tile(1).querySelector('img')).toBeNull();
    expect(tile(2).querySelector('img')).toBeNull();
    expect(tile(1).querySelector('[data-testid="image-placeholder"]')).not.toBeNull();
    expect(tile(2).querySelector('[data-testid="image-placeholder"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="gallery-count"]')?.textContent?.trim()).toBe('1');
  });

  it('uses the explicit position of each image rather than its index', () => {
    const { tile } = render([image(2)]);

    expect(tile(0).querySelector('img')).toBeNull();
    expect(tile(1).querySelector('img')).toBeNull();
    expect(tile(2).querySelector('img')?.getAttribute('src')).toBe('/api/public/hotels/abc/images/2');
    expect(tile(2).querySelector('img')?.getAttribute('alt')).toBe('Aurea Test, photo 3');
  });

  it('keeps a placeholder for a missing middle position', () => {
    const { root, tile } = render([image(0), image(2)]);

    expect(tile(0).querySelector('img')).not.toBeNull();
    expect(tile(1).querySelector('img')).toBeNull();
    expect(tile(1).querySelector('[data-testid="image-placeholder"]')).not.toBeNull();
    expect(tile(2).querySelector('img')).not.toBeNull();
    expect(root.querySelector('[data-testid="gallery-count"]')?.textContent?.trim()).toBe('2');
  });

  it('shows the second and third images in the two right tiles', () => {
    const { root, tile } = render([image(0), image(1)]);

    expect(tile(1).querySelector('img')?.getAttribute('src')).toBe('/api/public/hotels/abc/images/1');
    expect(tile(2).querySelector('img')).toBeNull();
    expect(root.querySelectorAll('[data-testid="gallery-mosaic"] img').length).toBe(2);
  });

  it('lays out a large tile and two stacked tiles on a twelve column grid', () => {
    const { root, tile } = render([image(0), image(1), image(2)]);

    const mosaic = root.querySelector('[data-testid="gallery-mosaic"]') as HTMLElement;
    expect(mosaic.classList).toContain('md:grid-cols-12');
    expect(tile(0).classList).toContain('md:col-span-8');
    expect(tile(0).classList).toContain('h-95');
    expect(tile(0).classList).toContain('sm:h-120');
    expect(tile(0).classList).toContain('lg:h-155');
    const side = root.querySelector('[data-testid="gallery-side"]') as HTMLElement;
    expect(side.classList).toContain('md:col-span-4');
    expect(side.classList).toContain('grid-cols-2');
    expect(side.classList).toContain('md:grid-cols-1');
    expect(side.contains(tile(1))).toBe(true);
    expect(side.contains(tile(2))).toBe(true);
    expect(root.querySelectorAll('[data-testid="gallery-mosaic"] img').length).toBe(3);
    expect(root.querySelector('[data-testid="gallery-count"]')?.textContent?.trim()).toBe('3');
  });

  it('makes every tile with an image a button that opens the gallery dialog', () => {
    const { fixture, root, tile, dialog } = render([image(0), image(1), image(2)]);

    expect(dialog().open).toBe(false);
    const opener = tile(1).querySelector('button') as HTMLButtonElement;
    expect(opener.getAttribute('type')).toBe('button');
    opener.focus();
    opener.click();
    fixture.detectChanges();

    expect(dialog().open).toBe(true);
    expect(dialog().querySelectorAll('img').length).toBe(3);
    expect(document.body.classList).toContain('overflow-hidden');
    const labelledBy = dialog().getAttribute('aria-labelledby') as string;
    expect(root.querySelector(`#${labelledBy}`)?.textContent?.trim()).toBe('Photo gallery');
    expect(root.querySelector('[data-testid="gallery-view-all"]')?.textContent).toContain('View all photos');
  });

  it('shows only the images that exist in the dialog', () => {
    const { fixture, root, dialog } = render([image(0), image(2)]);

    (root.querySelector('[data-testid="gallery-view-all"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const sources = [...dialog().querySelectorAll('img')].map((element) => element.getAttribute('src'));
    expect(sources).toEqual(['/api/public/hotels/abc/images/0', '/api/public/hotels/abc/images/2']);
  });

  it('closes with the close button, unlocks the page and returns focus to the opener', () => {
    const { fixture, root, dialog } = render([image(0)]);
    const opener = root.querySelector('[data-testid="gallery-view-all"]') as HTMLButtonElement;
    opener.focus();
    opener.click();
    fixture.detectChanges();

    (dialog().querySelector('[data-testid="gallery-close"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(dialog().open).toBe(false);
    expect(document.body.classList).not.toContain('overflow-hidden');
    expect(document.activeElement).toBe(opener);
  });

  it('returns focus when the browser closes the dialog after Escape', () => {
    const { fixture, root, dialog } = render([image(0)]);
    const opener = root.querySelector('[data-testid="gallery-view-all"]') as HTMLButtonElement;
    opener.focus();
    opener.click();
    fixture.detectChanges();

    dialog().dispatchEvent(new Event('cancel'));
    dialog().close();
    fixture.detectChanges();

    expect(document.activeElement).toBe(opener);
    expect(document.body.classList).not.toContain('overflow-hidden');
  });

  it('closes on a backdrop click but not on a click inside the content', () => {
    const { fixture, root, dialog } = render([image(0)]);
    (root.querySelector('[data-testid="gallery-view-all"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    (dialog().querySelector('img') as HTMLElement).click();
    fixture.detectChanges();
    expect(dialog().open).toBe(true);

    dialog().click();
    fixture.detectChanges();
    expect(dialog().open).toBe(false);
  });

  it('unlocks the page when it is destroyed while open', () => {
    const { fixture, root } = render([image(0)]);
    (root.querySelector('[data-testid="gallery-view-all"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    fixture.destroy();

    expect(document.body.classList).not.toContain('overflow-hidden');
  });
});

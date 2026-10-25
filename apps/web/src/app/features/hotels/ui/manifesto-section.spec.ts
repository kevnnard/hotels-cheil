import { TestBed } from '@angular/core/testing';
import { manifesto } from '../data/manifesto';
import { ManifestoSection } from './manifesto-section';

describe('ManifestoSection', () => {
  function render(): HTMLElement {
    const fixture = TestBed.createComponent(ManifestoSection);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the eyebrow and the three heading lines in the serif font', () => {
    const root = render();
    const heading = root.querySelector('h2') as HTMLElement;

    expect(root.querySelector('[data-testid="manifesto-eyebrow"]')?.textContent?.trim()).toBe('Brand manifesto');
    expect(manifesto.headingLines).toEqual(['Discover.', 'Experience.', 'Transcend.']);
    const lines = Array.from(heading.querySelectorAll('[data-testid="manifesto-heading-line"]')).map((line) =>
      line.textContent?.trim(),
    );
    expect(lines).toEqual(['Discover.', 'Experience.', 'Transcend.']);
    expect(heading.classList.contains('font-serif')).toBe(true);
  });

  it('renders the intro paragraph', () => {
    expect(render().querySelector('[data-testid="manifesto-intro"]')?.textContent?.trim()).toBe(manifesto.intro);
  });

  it('renders the three principles as a numbered list', () => {
    const list = render().querySelector('ol[data-testid="manifesto-principles"]') as HTMLElement;
    const items = list.querySelectorAll('li');

    expect(manifesto.principles.length).toBe(3);
    expect(items.length).toBe(3);
    manifesto.principles.forEach((principle, index) => {
      expect(items[index].querySelector('[data-testid="principle-number"]')?.textContent?.trim()).toBe(
        `0${index + 1}`,
      );
      expect(items[index].querySelector('h3')?.textContent?.trim()).toBe(principle.title);
      expect(items[index].textContent).toContain(principle.text);
    });
  });

  it('renders the four tiles from the constant', () => {
    const tiles = render().querySelectorAll('[data-testid="manifesto-tile"]');

    expect(manifesto.tiles.map((tile) => tile.headline)).toEqual([
      'Raw material',
      '18 dB',
      '100%',
      'Digital detox protocol',
    ]);
    expect(tiles.length).toBe(4);
    manifesto.tiles.forEach((tile, index) => {
      expect(tiles[index].querySelector('[data-testid="tile-headline"]')?.textContent?.trim()).toBe(tile.headline);
      expect(tiles[index].querySelector('[data-testid="tile-text"]')?.textContent?.trim()).toBe(tile.text);
    });
  });

  it('keeps a local svg on photo tiles and the forest-green placeholder only without an image', () => {
    const root = render();
    const photos = root.querySelectorAll('[data-testid="manifesto-tile"][data-kind="photo"]');

    expect(photos.length).toBe(2);
    photos.forEach((photo) => {
      expect(photo.querySelector('svg')).not.toBeNull();
      expect(photo.querySelector('img')).not.toBeNull();
      expect(photo.className).not.toContain('from-primary-container');
    });
    root.querySelectorAll('[data-testid="manifesto-tile"][data-kind="stat"]').forEach((stat) => {
      expect(stat.querySelector('img')).toBeNull();
    });
  });

  it('overlays the text on a dark gradient over each image', () => {
    const root = render();

    root.querySelectorAll('img').forEach((image) => {
      const tile = image.closest('[data-testid="manifesto-tile"]') as HTMLElement;
      expect(tile.querySelector('[data-testid="tile-overlay"]')?.className).toContain('bg-linear-to-t');
      expect(tile.querySelector('[data-testid="tile-headline"]')).not.toBeNull();
    });
  });

  it('uses the dark forest-green background', () => {
    expect((render().querySelector('section') as HTMLElement).classList.contains('bg-primary')).toBe(true);
  });

  it('renders exactly two local images with alt text on the photo tiles', () => {
    const root = render();
    const images = Array.from(root.querySelectorAll('img'));

    expect(images.map((image) => image.getAttribute('src'))).toEqual([
      '/manifesto/raw-material.jpg',
      '/manifesto/digital-detox.jpg',
    ]);
    expect(manifesto.tiles.filter((tile) => tile.image).map((tile) => tile.image?.src)).toEqual([
      '/manifesto/raw-material.jpg',
      '/manifesto/digital-detox.jpg',
    ]);
    images.forEach((image) => {
      expect(image.closest('[data-testid="manifesto-tile"]')?.getAttribute('data-kind')).toBe('photo');
      expect((image.getAttribute('alt') ?? '').trim().length).toBeGreaterThan(0);
      expect(image.getAttribute('loading')).toBe('lazy');
      expect(image.getAttribute('width')).not.toBeNull();
      expect(image.getAttribute('height')).not.toBeNull();
      expect(image.classList.contains('object-cover')).toBe(true);
    });
  });

  it('uses only local /manifesto/ image paths, no link, button or remote url', () => {
    const root = render();
    const markup = root.innerHTML;

    root.querySelectorAll('img').forEach((image) => {
      expect(image.getAttribute('src')).toMatch(/^\/manifesto\/[a-z-]+\.jpg$/);
    });
    expect(root.querySelector('a')).toBeNull();
    expect(root.querySelector('button')).toBeNull();
    expect(markup).not.toContain('http');
  });

  it('lays out one column below lg and two columns from lg', () => {
    const root = render();
    const grids = [
      root.querySelector('[data-testid="manifesto-layout"]') as HTMLElement,
      root.querySelector('[data-testid="manifesto-tiles"]') as HTMLElement,
    ];

    for (const grid of grids) {
      expect(grid.classList.contains('grid-cols-1')).toBe(true);
      expect(grid.classList.contains('lg:grid-cols-2')).toBe(true);
      expect(grid.className).not.toMatch(/(^|\s)(sm|md):grid-cols/);
    }
  });

  it('shows no price or currency', () => {
    const text = render().textContent ?? '';

    for (const forbidden of ['$', '€', 'EUR', 'USD']) {
      expect(text).not.toContain(forbidden);
    }
  });
});

import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ImagePosition, ImageSlotState, emptyImageSlots } from '../data/admin-hotel.models';
import { AdminImageSlots, ImageChoice } from './admin-image-slots';

@Component({
  imports: [AdminImageSlots],
  template: `
    <app-admin-image-slots
      [hotelId]="hotelId()"
      hotelName="Aurea Cliff"
      [slots]="slots()"
      [disabled]="disabled()"
      (fileChosen)="chosen.push($event)"
      (removeConfirmed)="removed.push($event)"
      (pendingCleared)="cleared.push($event)"
    />
  `,
})
class SlotsHost {
  readonly hotelId = signal<string | null>('h1');
  readonly slots = signal<readonly ImageSlotState[]>(emptyImageSlots());
  readonly disabled = signal(false);
  readonly chosen: ImageChoice[] = [];
  readonly removed: ImagePosition[] = [];
  readonly cleared: ImagePosition[] = [];
}

function withSlot(position: ImagePosition, change: Partial<ImageSlotState>): readonly ImageSlotState[] {
  return emptyImageSlots().map((slot) => (slot.position === position ? { ...slot, ...change } : slot));
}

describe('AdminImageSlots', () => {
  async function render(hotelId: string | null = 'h1', slots: readonly ImageSlotState[] = emptyImageSlots()) {
    const fixture = TestBed.createComponent(SlotsHost);
    fixture.componentInstance.hotelId.set(hotelId);
    fixture.componentInstance.slots.set(slots);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const find = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>(`[data-testid="${id}"]`);
    return { fixture, root, host: fixture.componentInstance, find };
  }

  function choose(input: HTMLInputElement, file: File) {
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change'));
  }

  it('shows three slots with the first one as the main image and placeholders when empty', async () => {
    const { root, find } = await render();

    expect(root.querySelectorAll('[data-testid^="image-slot-"][data-position]').length).toBe(3);
    expect(find('image-slot-0')?.textContent).toContain('Main image');
    expect(find('image-slot-1')?.textContent).toContain('Image 2');
    expect(find('image-slot-2')?.textContent).toContain('Image 3');
    expect(root.querySelectorAll('[data-testid="image-placeholder"]').length).toBe(3);
    expect(find('image-slot-0-upload')?.textContent?.trim()).toBe('Upload');
    expect(find('image-slot-0-upload')?.getAttribute('aria-label')).toBe('Upload main image');
    expect(find('image-slot-0-remove')).toBeNull();
  });

  it('shows the stored image with its version and offers Replace and Remove', async () => {
    const { find } = await render('h1', withSlot(1, { hasImage: true, version: 3 }));

    expect(find('image-slot-1')?.querySelector('img')?.getAttribute('src')).toBe('/api/public/hotels/h1/images/1?v=3');
    expect(find('image-slot-1-upload')?.textContent?.trim()).toBe('Replace');
    expect(find('image-slot-1-upload')?.getAttribute('aria-label')).toBe('Replace image 2');
    expect(find('image-slot-1-remove')?.getAttribute('aria-label')).toBe('Remove image 2');
    expect(find('image-slot-1-upload')?.className).toContain('min-h-11');
  });

  it('accepts only the types the API takes and hands the chosen file over with its position', async () => {
    const { host, find } = await render();
    const input = find<HTMLInputElement>('image-slot-2-input') as HTMLInputElement;

    expect(input.getAttribute('accept')).toBe('image/jpeg,image/png,image/webp');
    expect(find('image-slot-hint')?.textContent).toContain('JPEG, PNG or WebP, up to 10 MB');
    const file = new File(['x'], 'pool.png', { type: 'image/png' });
    choose(input, file);

    expect(host.chosen).toEqual([{ position: 2, file }]);
    expect(input.value).toBe('');
  });

  it('asks inline before removing and removes only after the confirmation', async () => {
    const { fixture, host, find } = await render('h1', withSlot(0, { hasImage: true, version: 0 }));

    find('image-slot-0-remove')?.click();
    await fixture.whenStable();
    expect(find('image-slot-0-confirm')?.textContent).toContain('Remove this image?');
    expect(document.activeElement).toBe(find('image-slot-0-keep'));
    find('image-slot-0-keep')?.click();
    await fixture.whenStable();
    expect(find('image-slot-0-confirm')).toBeNull();
    expect(host.removed).toEqual([]);

    find('image-slot-0-remove')?.click();
    await fixture.whenStable();
    find('image-slot-0-confirm-remove')?.click();
    await fixture.whenStable();

    expect(host.removed).toEqual([0]);
    expect(find('image-slot-0-confirm')).toBeNull();
  });

  it('shows the uploading state of one slot and keeps its buttons disabled', async () => {
    const { find } = await render('h1', withSlot(1, { hasImage: true, status: 'uploading' }));

    const upload = find<HTMLButtonElement>('image-slot-1-upload') as HTMLButtonElement;
    expect(upload.disabled).toBe(true);
    expect(upload.textContent?.trim()).toBe('Uploading…');
    expect(find('image-slot-1')?.getAttribute('aria-busy')).toBe('true');
    expect((find<HTMLButtonElement>('image-slot-1-remove') as HTMLButtonElement).disabled).toBe(true);
    expect((find<HTMLButtonElement>('image-slot-0-upload') as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows the error of a slot in an alert as plain text and the last result in a status', async () => {
    const { fixture, host, find } = await render('h1', withSlot(2, { error: '<b>Only static JPEG</b>' }));

    const error = find('image-slot-2-error') as HTMLElement;
    expect(error.getAttribute('role')).toBe('alert');
    expect(error.textContent?.trim()).toBe('<b>Only static JPEG</b>');
    expect(error.querySelector('b')).toBeNull();

    host.slots.set(withSlot(2, { message: 'Image uploaded.' }));
    await fixture.whenStable();
    const status = find('image-slot-2-status') as HTMLElement;
    expect(status.getAttribute('role')).toBe('status');
    expect(status.textContent?.trim()).toBe('Image uploaded.');
    expect(find('image-slot-2-error')?.textContent?.trim()).toBe('');
  });

  it('lets a new hotel pick files before saving and clear them', async () => {
    const file = new File(['x'], 'lobby.jpg', { type: 'image/jpeg' });
    const { fixture, host, find } = await render(null);

    expect(find('image-slot-0-upload')?.textContent?.trim()).toBe('Choose image');
    expect(find('image-slot-0-upload')?.getAttribute('aria-label')).toBe('Choose main image');
    expect(find('image-slots-note')?.textContent).toContain('uploaded after the hotel is created');

    host.slots.set(withSlot(0, { pendingFile: file }));
    await fixture.whenStable();
    expect(find('image-slot-0-file')?.textContent).toContain('lobby.jpg');
    expect(find('image-slot-0-upload')?.textContent?.trim()).toBe('Change image');
    find('image-slot-0-clear')?.click();

    expect(host.cleared).toEqual([0]);
  });

  it('disables every action while the whole section is busy', async () => {
    const { fixture, host, root } = await render();
    host.disabled.set(true);
    await fixture.whenStable();

    for (const button of Array.from(root.querySelectorAll('button'))) {
      expect(button.disabled).toBe(true);
    }
  });
});

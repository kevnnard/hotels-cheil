import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { HotelCatalogService } from '../data/hotel-catalog.service';

@Component({
  selector: 'app-hotel-image-view',
  host: { class: 'block' },
  template: `
    @if (showImage()) {
      <img
        class="h-full w-full object-cover"
        loading="lazy"
        [src]="source()"
        [alt]="alt() ?? hotelName()"
        (error)="failed.set(true)"
      />
    } @else {
      <div
        data-testid="image-placeholder"
        class="flex h-full w-full flex-col items-center justify-center gap-space-sm bg-linear-to-br from-primary-container to-primary text-on-primary-container"
      >
        <svg viewBox="0 0 24 24" [class]="compact() ? 'h-6 w-6' : 'h-10 w-10'" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h.01M12 10h.01M15 10h.01" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span [class]="compact() ? 'sr-only' : 'text-label-md uppercase'">No image available</span>
      </div>
    }
  `,
})
export class HotelImageView {
  private readonly catalog = inject(HotelCatalogService);

  readonly hotelId = input.required<string>();
  readonly hotelName = input.required<string>();
  readonly hasImage = input.required<boolean>();
  readonly position = input<number | null>(null);
  readonly alt = input<string | null>(null);
  readonly compact = input(false);
  readonly version = input(0);

  protected readonly source = computed(() => {
    const position = this.position();
    const address =
      position === null ? this.catalog.imageUrl(this.hotelId()) : this.catalog.imagePositionUrl(this.hotelId(), position);
    const version = this.version();
    return version > 0 ? `${address}?v=${version}` : address;
  });
  protected readonly failed = linkedSignal({ source: this.source, computation: () => false });
  protected readonly showImage = computed(() => this.hasImage() && !this.failed());
}

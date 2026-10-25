import { Component, computed, input, linkedSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Hotel } from '../data/hotel.models';
import { HotelImageView } from './hotel-image-view';

@Component({
  selector: 'app-featured-hotel',
  imports: [RouterLink, HotelImageView],
  template: `
    @if (hotel(); as current) {
      <section
        data-testid="featured-hotel"
        aria-label="Featured hotel"
        class="relative h-130 w-full overflow-hidden rounded-xl bg-primary shadow-2xl md:h-155"
      >
        <app-hotel-image-view
          class="absolute inset-0"
          [hotelId]="current.id"
          [hotelName]="current.name"
          [hasImage]="current.image !== null"
        />
        <div class="absolute inset-0 bg-linear-to-t from-primary via-primary/30 to-transparent"></div>
        <div class="absolute inset-0 bg-linear-to-r from-primary/80 via-primary/20 to-transparent"></div>
        <div class="absolute bottom-0 left-0 max-w-2xl p-space-md text-surface md:p-space-xl">
          <h2 class="mb-space-xs font-serif text-display-md-mobile tracking-tight text-surface md:text-display-md">{{ current.name }}</h2>
          @if (current.description; as description) {
            <p class="mb-space-md line-clamp-3 max-w-xl text-body-md font-light text-surface/80">{{ description }}</p>
          }
          <a
            [routerLink]="['/hotels', current.id]"
            class="inline-flex min-h-11 items-center gap-space-xs rounded-lg bg-surface px-space-md py-space-sm text-label-lg uppercase text-primary shadow-lg transition-colors hover:bg-secondary-container hover:text-on-secondary-fixed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-surface"
          >
            View details
            <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M7 17 17 7M8 7h9v9" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </a>
        </div>
        @if (hotels().length > 1) {
          <div class="absolute right-space-md top-space-md flex gap-space-xs md:bottom-space-xl md:right-space-xl md:top-auto">
            <button
              type="button"
              data-testid="featured-previous"
              aria-label="Previous hotel"
              class="flex h-11 w-11 items-center justify-center rounded-full bg-surface/15 text-surface backdrop-blur-md transition-colors hover:bg-surface/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-surface"
              (click)="step(-1)"
            >
              <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M19 12H5m6-7-7 7 7 7" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              data-testid="featured-next"
              aria-label="Next hotel"
              class="flex h-11 w-11 items-center justify-center rounded-full bg-surface/15 text-surface backdrop-blur-md transition-colors hover:bg-surface/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-surface"
              (click)="step(1)"
            >
              <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M5 12h14m-6-7 7 7-7 7" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        }
      </section>
    }
  `,
})
export class FeaturedHotel {
  readonly hotels = input.required<Hotel[]>();

  private readonly index = linkedSignal<Hotel[], number>({
    source: this.hotels,
    computation: () => 0,
  });

  protected readonly hotel = computed(() => this.hotels()[this.index()] ?? null);

  protected step(direction: 1 | -1): void {
    const total = this.hotels().length;
    this.index.update((current) => (current + direction + total) % total);
  }
}

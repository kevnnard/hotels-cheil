import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Hotel } from '../data/hotel.models';
import { formatLocation } from '../data/hotel-location';
import { HotelImageView } from './hotel-image-view';
import { HotelPrice } from './hotel-price';

@Component({
  selector: 'app-hotel-card',
  imports: [RouterLink, HotelImageView, HotelPrice],
  template: `
    <article
      data-testid="hotel-card"
      class="group relative flex h-full flex-col justify-between gap-space-sm rounded-xl bg-surface-container-lowest p-space-sm shadow-sm transition-all duration-500 hover:-translate-y-1.5 hover:shadow-xl"
    >
      <div class="flex flex-col">
        <div data-testid="card-media" class="relative mb-space-sm aspect-4/3 w-full overflow-hidden rounded-lg bg-surface-container-high">
          <app-hotel-image-view
            class="h-full w-full transition-transform duration-700 group-hover:scale-105"
            [hotelId]="hotel().id"
            [hotelName]="hotel().name"
            [hasImage]="hotel().image !== null"
          />
          @if (rating() || discount()) {
            <div data-testid="card-badges" class="absolute right-2.5 top-2.5 z-10 flex items-center justify-end gap-1">
              @if (rating(); as average) {
                <span
                  data-testid="card-rating"
                  class="inline-flex items-center gap-1 rounded bg-primary/80 px-2 py-0.5 text-label-sm font-bold text-secondary-container backdrop-blur-md"
                  [attr.aria-label]="'Rating ' + average + ' out of 5'"
                >
                  <svg viewBox="0 0 24 24" class="h-3 w-3 text-secondary-fixed" fill="currentColor" aria-hidden="true">
                    <path d="m12 2.5 2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8Z" />
                  </svg>
                  {{ average }}
                </span>
              }
              @if (discount(); as percent) {
                <span
                  data-testid="card-discount"
                  class="inline-flex items-center rounded bg-secondary-container px-2 py-0.5 text-label-sm font-bold text-primary backdrop-blur-md"
                  [attr.aria-label]="percent + ' percent discount'"
                >
                  -{{ percent }}%
                </span>
              }
            </div>
          }
        </div>
        @if (location(); as place) {
          <p data-testid="card-location" class="mb-1 flex items-center gap-1 text-label-md text-on-surface-variant">
            <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            {{ place }}
          </p>
        }
        <h3 class="mb-space-xs font-serif text-headline-sm tracking-tight text-primary transition-colors group-hover:text-primary-container">
          {{ hotel().name }}
        </h3>
        @if (hotel().description; as description) {
          <p data-testid="card-description" class="line-clamp-2 text-body-sm text-on-surface-variant">{{ description }}</p>
        }
      </div>
      <div data-testid="card-footer" class="flex flex-wrap items-baseline justify-between gap-x-space-sm gap-y-space-xs border-t border-surface-container pt-space-sm">
        @if (hotel().pricing; as pricing) {
          <app-hotel-price data-testid="card-price" [pricing]="pricing" [showBadge]="false" />
        }
        <a
          data-testid="card-explore"
          [routerLink]="['/hotels', hotel().id]"
          class="ml-auto inline-flex min-h-11 items-center gap-1 text-label-sm uppercase text-primary transition-transform after:absolute after:inset-0 group-hover:translate-x-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Explore
          <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M5 12h14m-6-7 7 7-7 7" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </a>
      </div>
    </article>
  `,
})
export class HotelCard {
  readonly hotel = input.required<Hotel>();

  protected readonly location = computed(() => formatLocation(this.hotel().address));
  protected readonly rating = computed(() => {
    const { average, count } = this.hotel().rating;
    return average !== null && count > 0 ? average.toFixed(2) : null;
  });
  protected readonly discount = computed(() => {
    const pricing = this.hotel().pricing;
    return pricing && pricing.discountPercent !== null && pricing.discountedNightlyRate !== null ? pricing.discountPercent : null;
  });
}

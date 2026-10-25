import { Component, computed, input } from '@angular/core';
import { HotelRating } from '../data/hotel.models';

@Component({
  selector: 'app-rating-summary',
  template: `
    @if (average(); as value) {
      <div data-testid="rating-summary" class="flex items-center gap-space-md rounded-lg bg-surface-container-low px-space-md py-space-sm shadow-sm">
        <span class="flex items-center gap-1 text-primary">
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="currentColor" aria-hidden="true">
            <path d="m12 2.5 2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8Z" />
          </svg>
          <span class="text-title-md">{{ value }}</span>
        </span>
        <span class="h-5 w-px bg-outline-variant"></span>
        <span class="text-body-sm text-on-surface-variant">{{ countLabel() }}</span>
      </div>
    }
  `,
})
export class RatingSummary {
  readonly rating = input.required<HotelRating>();

  protected readonly average = computed(() => {
    const { average, count } = this.rating();
    return average !== null && count > 0 ? average.toFixed(2) : null;
  });

  protected readonly countLabel = computed(() => {
    const { count } = this.rating();
    return `${count} ${count === 1 ? 'rating' : 'ratings'}`;
  });
}

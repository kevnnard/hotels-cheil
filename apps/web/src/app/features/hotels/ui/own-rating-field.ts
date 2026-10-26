import { Component, input } from '@angular/core';
import { OwnRating } from '../data/own-rating';
import { RatingControl } from './rating-control';

@Component({
  selector: 'app-own-rating-field',
  imports: [RatingControl],
  host: { class: 'flex min-w-0 flex-col gap-space-xs' },
  template: `
    @let rating = state();
    @if (rating.ownScore.isLoading()) {
      <p data-testid="own-rating-loading" aria-busy="true" class="text-body-sm text-on-surface-variant">Loading your rating…</p>
    } @else if (rating.ownScore.error()) {
      <div data-testid="own-rating-error" role="alert" class="flex flex-wrap items-center gap-space-sm">
        <p class="text-body-sm text-error">We could not load your rating.</p>
        <button
          type="button"
          data-testid="own-rating-retry"
          class="inline-flex min-h-11 items-center justify-center rounded-lg bg-surface-container-lowest px-space-md text-label-lg uppercase text-primary shadow-sm transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          (click)="rating.ownScore.reload()"
        >
          Try again
        </button>
      </div>
    } @else if (rating.ownScore.hasValue()) {
      <app-rating-control [score]="rating.score()" [saving]="rating.saving()" (rated)="rating.rate($event)" />
    }
    <p data-testid="rating-status" role="status" class="text-body-sm text-primary">{{ rating.savedNotice() }}</p>
    <div data-testid="rating-error" role="alert">
      @if (rating.failure(); as message) {
        <p class="rounded-lg bg-error-container px-space-md py-space-sm text-body-sm text-on-error-container">{{ message }}</p>
      }
    </div>
  `,
})
export class OwnRatingField {
  readonly state = input.required<OwnRating>();
}

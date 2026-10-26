import { Component, DestroyRef, inject, input, output } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthState } from '../../../core/auth/auth-state.service';
import { resolveVisitorReturnUrl } from '../../../core/auth/return-url';
import { HotelRating } from '../data/hotel.models';
import { createOwnRating } from '../data/own-rating';
import { OwnRatingField } from '../ui/own-rating-field';

const linkClasses =
  'inline-flex min-h-11 items-center justify-center rounded-lg px-space-md text-label-lg uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

@Component({
  selector: 'app-hotel-rating-panel',
  imports: [OwnRatingField, RouterLink],
  host: { class: 'block' },
  template: `
    <section
      data-testid="rating-panel"
      aria-labelledby="rating-panel-heading"
      class="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md md:flex-row md:items-center md:justify-between md:gap-space-lg"
    >
      <h2 id="rating-panel-heading" class="font-serif text-headline-sm text-primary">Rate this hotel</h2>
      <div class="flex min-w-0 flex-col gap-space-xs md:items-end">
        @if (!authState.isSettled()) {
          <p data-testid="own-rating-loading" aria-busy="true" class="text-body-sm text-on-surface-variant">Loading your rating…</p>
        } @else if (!authState.isAuthenticated()) {
          <div class="flex flex-col gap-space-xs sm:flex-row sm:items-center sm:gap-space-sm">
            <p data-testid="rating-panel-anonymous" class="text-body-md text-on-surface-variant">Sign in to rate this hotel.</p>
            <div class="flex flex-wrap gap-space-xs">
              <a
                data-testid="rating-sign-in"
                routerLink="/account/sign-in"
                [queryParams]="returnQuery()"
                [class]="linkClasses + ' bg-primary-container text-on-primary hover:bg-primary'"
              >Sign in</a>
              <a
                data-testid="rating-register"
                routerLink="/account/register"
                [queryParams]="returnQuery()"
                [class]="linkClasses + ' text-primary hover:bg-surface-container'"
              >Create an account</a>
            </div>
          </div>
        }
        <app-own-rating-field class="md:items-end" [state]="rating" />
      </div>
    </section>
  `,
})
export class HotelRatingPanel {
  readonly hotelId = input.required<string>();
  readonly summaryChange = output<HotelRating>();

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly authState = inject(AuthState);
  protected readonly linkClasses = linkClasses;
  protected readonly rating = createOwnRating({
    hotelId: () => this.hotelId(),
    saved: (summary) => {
      if (!this.destroyRef.destroyed) {
        this.summaryChange.emit(summary);
      }
    },
  });

  protected returnQuery(): Record<string, string> {
    const current = this.router.url;
    return resolveVisitorReturnUrl(current) === current ? { returnUrl: current } : {};
  }
}

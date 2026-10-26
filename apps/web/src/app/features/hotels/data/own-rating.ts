import { inject, linkedSignal, ResourceRef, signal, Signal, WritableSignal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AuthState } from '../../../core/auth/auth-state.service';
import { describeRatingFailure } from './hotel-rating-failure';
import { HotelRatingService } from './hotel-rating.service';
import { HotelRating } from './hotel.models';

const savedMessage = 'Thanks, your rating was saved.';

export interface OwnRatingOptions {
  readonly hotelId: () => string | undefined;
  readonly saved: (summary: HotelRating) => void;
}

export interface OwnRating {
  readonly ownScore: ResourceRef<number | null | undefined>;
  readonly score: Signal<number | null>;
  readonly saving: Signal<boolean>;
  readonly savedNotice: Signal<string>;
  readonly failure: Signal<string | null>;
  rate(score: number): void;
}

export function createOwnRating({ hotelId, saved }: OwnRatingOptions): OwnRating {
  const ratings = inject(HotelRatingService);
  const authState = inject(AuthState);

  const ownScore = rxResource({
    params: () => {
      const id = hotelId();
      const session = authState.session();
      return id === undefined || session === null || !authState.isSettled() ? undefined : { hotelId: id, session };
    },
    stream: ({ params }) => ratings.ownScore(params.hotelId),
  });
  const score: WritableSignal<number | null> = linkedSignal(() => (ownScore.hasValue() ? ownScore.value() : null));
  const saving = signal(false);
  const savedNotice = signal('');
  const failure = signal<string | null>(null);

  function rate(value: number): void {
    const id = hotelId();
    if (saving() || id === undefined) {
      return;
    }
    saving.set(true);
    savedNotice.set('');
    failure.set(null);
    ratings
      .rate(id, value)
      .pipe(finalize(() => saving.set(false)))
      .subscribe({
        next: (summary) => {
          score.set(value);
          savedNotice.set(savedMessage);
          saved(summary);
        },
        error: (error: unknown) => failure.set(describeRatingFailure(error)),
      });
  }

  return {
    ownScore,
    score: score.asReadonly(),
    saving: saving.asReadonly(),
    savedNotice: savedNotice.asReadonly(),
    failure: failure.asReadonly(),
    rate,
  };
}

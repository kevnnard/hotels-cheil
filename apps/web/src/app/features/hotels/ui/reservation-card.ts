import { CurrencyPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import { sampleGuestOptions, sampleReservationPerks } from '../data/hotel-detail-content';
import { effectiveNightlyRate, priceDigits } from '../data/hotel-price';
import { HotelPricing } from '../data/hotel.models';
import { HotelPrice } from './hotel-price';

const minNights = 1;
const maxNights = 14;
const defaultNights = 3;
const defaultGuests = 2;

function clampNights(value: number): number {
  return Math.min(maxNights, Math.max(minNights, value));
}

@Component({
  selector: 'app-reservation-card',
  imports: [CurrencyPipe, HotelPrice],
  host: { class: 'block' },
  template: `
    <section
      data-testid="reservation-card"
      aria-labelledby="reservation-card-heading"
      class="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-xl"
    >
      <h2 id="reservation-card-heading" class="sr-only">Plan a stay at {{ hotelName() }}</h2>
      @if (pricing(); as price) {
        <div data-testid="detail-price" class="flex flex-col gap-space-xs">
          <span class="text-label-sm uppercase text-on-surface-variant">Nightly price</span>
          <app-hotel-price size="lg" [pricing]="price" />
        </div>
      } @else {
        <p data-testid="price-on-request" class="font-serif text-headline-md text-primary">Price on request</p>
      }

      <div class="flex flex-col gap-space-xs rounded-lg bg-surface-container-low p-space-sm">
        @if (nightlyRate() !== null) {
          <div class="flex items-center justify-between gap-space-sm rounded bg-surface-container-lowest px-space-sm py-space-xs">
            <label for="reservation-card-nights" class="text-label-sm uppercase text-on-surface-variant">Nights</label>
            <div class="flex items-center gap-space-xs">
              <button
                type="button"
                data-testid="nights-decrease"
                aria-label="One night less"
                aria-controls="reservation-card-nights"
                class="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-primary transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40"
                [disabled]="nights() <= minNights"
                (click)="changeNights(nights() - 1, nightsInput)"
              >
                <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M5 12h14" stroke-linecap="round" />
                </svg>
              </button>
              <input
                #nightsInput
                id="reservation-card-nights"
                data-testid="nights-input"
                type="number"
                inputmode="numeric"
                step="1"
                [attr.min]="minNights"
                [attr.max]="maxNights"
                [value]="nights()"
                (change)="changeNights(nightsInput.valueAsNumber, nightsInput)"
                class="h-11 w-14 rounded-lg bg-transparent text-center text-title-md text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
              <button
                type="button"
                data-testid="nights-increase"
                aria-label="One night more"
                aria-controls="reservation-card-nights"
                class="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-primary transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40"
                [disabled]="nights() >= maxNights"
                (click)="changeNights(nights() + 1, nightsInput)"
              >
                <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" stroke-linecap="round" />
                </svg>
              </button>
            </div>
          </div>
        }
        <div class="flex items-center justify-between gap-space-sm rounded bg-surface-container-lowest px-space-sm py-space-xs">
          <label for="reservation-card-guests" class="text-label-sm uppercase text-on-surface-variant">Guests</label>
          <select
            id="reservation-card-guests"
            data-testid="guests-select"
            class="min-h-11 cursor-pointer rounded-lg bg-transparent px-space-sm text-title-md text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            @for (option of guestOptions; track option) {
              <option [value]="option" [selected]="option === defaultGuests">{{ option }} {{ option === 1 ? 'guest' : 'guests' }}</option>
            }
          </select>
        </div>
      </div>

      <dl class="flex flex-col gap-space-xs text-body-sm text-on-surface-variant">
        @if (pricing(); as price) {
          @let rate = nightlyRate() ?? 0;
          @let amount = total() ?? 0;
          <div data-testid="nights-line" class="flex items-baseline justify-between gap-space-sm">
            <dt>{{ rate | currency: price.currency : 'symbol' : digits(rate) }} × {{ nights() }} {{ nights() === 1 ? 'night' : 'nights' }}</dt>
            <dd class="text-title-md text-primary">{{ amount | currency: price.currency : 'symbol' : digits(amount) }}</dd>
          </div>
        }
        @for (perk of perks; track perk.label) {
          <div data-testid="reservation-perk" class="flex items-baseline justify-between gap-space-sm">
            <dt>{{ perk.label }}</dt>
            <dd class="text-label-sm font-semibold uppercase text-surface-tint">{{ perk.value }}</dd>
          </div>
        }
        @if (pricing(); as price) {
          @let amount = total() ?? 0;
          <div class="mt-space-xs flex items-baseline justify-between gap-space-sm border-t border-outline-variant/40 pt-space-sm text-title-md font-bold text-primary">
            <dt>Estimated total</dt>
            <dd aria-live="polite" aria-atomic="true">
              <span data-testid="estimated-total" class="font-serif text-headline-sm text-primary">{{
                amount | currency: price.currency : 'symbol' : digits(amount)
              }}</span>
            </dd>
          </div>
        }
      </dl>
      @if (pricing()) {
        <p class="text-center text-label-sm text-on-surface-variant/70">Indicative estimate based on the nightly price.</p>
      }

      <div class="flex flex-col gap-space-sm">
        <button
          type="button"
          data-testid="request-dossier"
          class="flex min-h-11 w-full cursor-pointer items-center justify-center gap-space-xs rounded-lg bg-primary px-space-md py-space-md text-label-lg uppercase text-on-primary shadow-md transition-colors hover:bg-primary-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:active:scale-[0.98]"
          (click)="showDemoNotice()"
        >
          <svg viewBox="0 0 24 24" class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Zm-3.5 9 2.5 2.5 4.5-5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>Request a dossier</span>
        </button>
        <button
          type="button"
          data-testid="ask-concierge"
          class="flex min-h-11 w-full cursor-pointer items-center justify-center gap-space-xs rounded-lg bg-surface-container px-space-md py-space-sm text-label-md uppercase text-primary transition-colors hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          (click)="showDemoNotice()"
        >
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M4 5h16v11H9l-5 4V5Z" stroke-linejoin="round" />
          </svg>
          <span>Ask the concierge</span>
        </button>
        <p data-testid="reservation-feedback" role="status" class="min-h-5 text-center text-body-sm text-primary">
          @if (demoNoticeShown()) {
            Demo only: nothing was sent.
          }
        </p>
      </div>

      <p data-testid="reservation-guarantee" class="flex items-center gap-space-xs text-label-sm text-on-surface-variant">
        <svg viewBox="0 0 24 24" class="h-[18px] w-[18px] shrink-0 text-secondary" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M6 11h12v10H6V11Zm2 0V8a4 4 0 0 1 8 0v3" stroke-linejoin="round" />
        </svg>
        <span>Nothing is charged on this page and your details stay private.</span>
      </p>
    </section>
  `,
})
export class ReservationCard {
  readonly pricing = input.required<HotelPricing | null>();
  readonly hotelName = input.required<string>();

  protected readonly minNights = minNights;
  protected readonly maxNights = maxNights;
  protected readonly defaultGuests = defaultGuests;
  protected readonly guestOptions = sampleGuestOptions;
  protected readonly perks = sampleReservationPerks;

  protected readonly nights = signal(defaultNights);
  protected readonly demoNoticeShown = signal(false);

  protected readonly nightlyRate = computed(() => {
    const pricing = this.pricing();
    return pricing ? effectiveNightlyRate(pricing) : null;
  });

  protected readonly total = computed(() => {
    const rate = this.nightlyRate();
    return rate === null ? null : Math.round(rate * 100 * this.nights()) / 100;
  });

  protected changeNights(value: number, field: HTMLInputElement): void {
    const nights = Number.isFinite(value) ? clampNights(Math.trunc(value)) : minNights;
    this.nights.set(nights);
    field.value = String(nights);
  }

  protected showDemoNotice(): void {
    this.demoNoticeShown.set(true);
  }

  protected digits(amount: number): string {
    return priceDigits(amount);
  }
}

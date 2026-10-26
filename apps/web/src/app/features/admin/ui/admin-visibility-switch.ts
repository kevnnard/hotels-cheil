import { Component, input, output } from '@angular/core';
import { VisibilityFailure } from '../data/admin-hotel.models';

@Component({
  selector: 'app-admin-visibility-switch',
  template: `
    <section
      data-testid="hotel-visibility"
      aria-labelledby="hotel-section-visibility"
      class="flex flex-col gap-space-sm rounded-xl bg-surface-container-low/70 p-space-md md:p-space-lg"
    >
      <h3 id="hotel-section-visibility" class="font-serif text-headline-sm text-primary">Visibility</h3>
      <div class="flex items-center justify-between gap-space-md">
        <div class="flex flex-col gap-0.5">
          <span id="hotel-visibility-label" class="text-label-lg uppercase text-on-surface">Visible on the public site</span>
          <p id="hotel-visibility-help" class="text-body-sm text-on-surface-variant">
            Inactive hotels are hidden from the public catalogue. Their data and ratings are kept.
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-space-sm">
          <span data-testid="hotel-visibility-state" class="text-label-sm uppercase text-on-surface-variant" aria-hidden="true">
            {{ saving() ? 'Saving…' : active() ? 'Visible' : 'Hidden' }}
          </span>
          <button
            type="button"
            role="switch"
            data-testid="hotel-visibility-switch"
            aria-labelledby="hotel-visibility-label"
            aria-describedby="hotel-visibility-help"
            [attr.aria-checked]="active()"
            [attr.aria-busy]="saving()"
            [attr.aria-disabled]="saving() || disabled()"
            class="relative inline-flex h-11 w-16 shrink-0 items-center rounded-full p-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-disabled:cursor-wait aria-disabled:opacity-70"
            [class.bg-primary-container]="active()"
            [class.bg-surface-container-high]="!active()"
            (click)="requestToggle()"
          >
            <span
              aria-hidden="true"
              class="h-9 w-9 rounded-full bg-surface-container-lowest shadow-sm transition-transform motion-reduce:transition-none"
              [class.translate-x-5]="active()"
            ></span>
          </button>
        </div>
      </div>
      <div data-testid="hotel-visibility-error" role="alert" class="flex flex-wrap items-center gap-space-sm text-body-sm text-error empty:hidden">
        @if (failure(); as current) {
          <span>{{ current.message }}</span>
          @if (current.retryable) {
            <button
              type="button"
              data-testid="hotel-visibility-retry"
              class="inline-flex min-h-11 items-center justify-center rounded-lg bg-surface-container-lowest px-space-md text-label-lg uppercase text-on-surface shadow-sm transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              (click)="requestToggle()"
            >
              Try again
            </button>
          }
        }
      </div>
      <p data-testid="hotel-visibility-status" role="status" class="text-body-sm text-primary empty:hidden">{{ message() }}</p>
    </section>
  `,
})
export class AdminVisibilitySwitch {
  readonly active = input.required<boolean>();
  readonly saving = input(false);
  readonly disabled = input(false);
  readonly message = input<string | null>(null);
  readonly failure = input<VisibilityFailure | null>(null);
  readonly toggled = output<void>();

  protected requestToggle(): void {
    if (!this.saving() && !this.disabled()) {
      this.toggled.emit();
    }
  }
}

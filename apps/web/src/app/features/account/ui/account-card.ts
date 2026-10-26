import { Component, input } from '@angular/core';

@Component({
  selector: 'app-account-card',
  host: { class: 'block' },
  template: `
    <section
      aria-labelledby="account-heading"
      class="flex flex-col gap-space-lg rounded-xl bg-surface-container-lowest p-space-lg shadow-[0_4px_24px_rgba(14,39,32,0.08)] md:p-space-xl"
    >
      <header class="flex flex-col gap-space-sm">
        <span class="font-serif text-headline-sm uppercase tracking-widest text-primary">AUREA</span>
        <h1 id="account-heading" class="mt-space-sm font-serif text-headline-lg-mobile text-primary md:text-headline-lg">
          {{ heading() }}
        </h1>
        <p class="text-body-md text-on-surface-variant">{{ intro() }}</p>
        <div data-testid="account-error" role="alert" aria-live="assertive">
          @if (error(); as message) {
            <p class="mt-space-sm rounded-lg bg-error-container px-space-md py-space-sm text-body-sm text-on-error-container">
              {{ message }}
            </p>
          }
        </div>
      </header>
      <ng-content />
    </section>
  `,
})
export class AccountCard {
  readonly heading = input.required<string>();
  readonly intro = input.required<string>();
  readonly error = input<string | null>(null);
}

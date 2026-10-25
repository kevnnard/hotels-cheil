import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-state-panel',
  template: `
    <div
      class="flex flex-col items-center gap-space-sm rounded-xl bg-surface-container-low px-space-md py-space-xl text-center"
      [attr.role]="tone() === 'error' ? 'alert' : 'status'"
    >
      <h2 class="font-serif text-headline-md text-primary">{{ heading() }}</h2>
      <p class="max-w-lg text-body-md text-on-surface-variant">{{ message() }}</p>
      @if (actionLabel(); as label) {
        <button
          type="button"
          [attr.data-testid]="actionTestId()"
          class="mt-space-sm min-h-11 rounded-lg bg-primary-container px-space-md py-space-sm text-label-lg uppercase text-on-primary shadow-md transition-colors hover:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          (click)="action.emit()"
        >
          {{ label }}
        </button>
      }
    </div>
  `,
})
export class StatePanel {
  readonly heading = input.required<string>();
  readonly message = input.required<string>();
  readonly tone = input<'neutral' | 'error'>('neutral');
  readonly actionLabel = input<string | null>(null);
  readonly actionTestId = input<string | null>(null);
  readonly action = output<void>();
}

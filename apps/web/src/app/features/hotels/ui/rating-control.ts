import { Component, ElementRef, computed, input, output, signal, viewChildren } from '@angular/core';

const maximumScore = 5;
const scores: readonly number[] = [1, 2, 3, 4, 5];

let nextControlId = 0;

@Component({
  selector: 'app-rating-control',
  host: { class: 'flex flex-col gap-space-xs' },
  template: `
    <span [id]="labelId" class="text-label-sm uppercase tracking-widest text-on-surface-variant">Your rating</span>
    <div class="flex flex-wrap items-center gap-space-sm">
      <div
        role="radiogroup"
        [attr.aria-labelledby]="labelId"
        [attr.aria-readonly]="readonly() || null"
        [attr.aria-disabled]="disabled() || null"
        [attr.aria-busy]="saving()"
        class="flex items-center"
        (mouseleave)="hovered.set(null)"
      >
        @for (value of scores; track value) {
          @let isFilled = value <= (preview() ?? 0);
          <button
            #star
            type="button"
            role="radio"
            [attr.aria-checked]="score() === value"
            [attr.aria-label]="value === 1 ? '1 star' : value + ' stars'"
            [attr.aria-disabled]="saving() || null"
            [attr.data-filled]="isFilled"
            [tabIndex]="tabStop() === value ? 0 : -1"
            [disabled]="disabled()"
            class="flex h-11 w-11 items-center justify-center rounded-lg text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 aria-disabled:cursor-wait motion-safe:transition-transform motion-safe:duration-150 motion-safe:hover:scale-110"
            [class.text-outline]="!isFilled"
            (click)="choose(value)"
            (keydown)="onKeydown($event, value)"
            (keyup)="onKeyup($event)"
            (mouseenter)="hover(value)"
            (blur)="focused.set(null)"
          >
            <svg
              viewBox="0 0 24 24"
              class="h-7 w-7"
              [attr.fill]="isFilled ? 'currentColor' : 'none'"
              stroke="currentColor"
              stroke-width="1.5"
              aria-hidden="true"
            >
              <path d="m12 2.5 2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8Z" stroke-linejoin="round" />
            </svg>
          </button>
        }
      </div>
      <span data-testid="rating-control-value" class="text-body-sm text-on-surface-variant">{{ valueText() }}</span>
    </div>
  `,
})
export class RatingControl {
  readonly score = input<number | null>(null);
  readonly disabled = input(false);
  readonly saving = input(false);
  readonly readonly = input(false);
  readonly rated = output<number>();

  private readonly stars = viewChildren<ElementRef<HTMLButtonElement>>('star');

  protected readonly labelId = `rating-control-label-${nextControlId++}`;
  protected readonly scores = scores;
  protected readonly hovered = signal<number | null>(null);
  protected readonly focused = signal<number | null>(null);

  protected readonly preview = computed(() => this.hovered() ?? this.focused() ?? this.score());
  protected readonly tabStop = computed(() => this.focused() ?? this.score() ?? 1);
  protected readonly valueText = computed(() => {
    const score = this.score();
    return score === null ? 'Not rated yet' : `${score} of ${maximumScore}`;
  });

  private get interactive(): boolean {
    return !this.readonly() && !this.disabled() && !this.saving();
  }

  protected choose(value: number): void {
    if (this.interactive) {
      this.rated.emit(value);
    }
  }

  protected hover(value: number): void {
    if (this.interactive) {
      this.hovered.set(value);
    }
  }

  protected onKeydown(event: KeyboardEvent, value: number): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.choose(value);
      return;
    }
    const target = this.targetOf(event.key, value);
    if (target === null || this.readonly()) {
      return;
    }
    event.preventDefault();
    this.stars()[target - 1]?.nativeElement.focus();
    this.focused.set(target);
  }

  protected onKeyup(event: KeyboardEvent): void {
    if (event.key === ' ') {
      event.preventDefault();
    }
  }

  private targetOf(key: string, value: number): number | null {
    switch (key) {
      case 'ArrowRight':
      case 'ArrowUp':
        return Math.min(maximumScore, value + 1);
      case 'ArrowLeft':
      case 'ArrowDown':
        return Math.max(1, value - 1);
      case 'Home':
        return 1;
      case 'End':
        return maximumScore;
      default:
        return null;
    }
  }
}

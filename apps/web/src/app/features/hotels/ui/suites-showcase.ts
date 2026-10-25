import { Component, ElementRef, signal, viewChildren } from '@angular/core';
import { sampleSuites } from '../data/hotel-detail-content';

@Component({
  selector: 'app-suites-showcase',
  host: { class: 'block' },
  template: `
    <section aria-labelledby="suites-heading" class="flex flex-col gap-space-md">
      <div class="flex flex-col justify-between gap-space-sm sm:flex-row sm:items-end">
        <div>
          <span class="text-label-sm uppercase text-secondary">Select stays</span>
          <h2 id="suites-heading" class="mt-1 font-serif text-headline-md text-primary">Suites collection</h2>
        </div>
        <div
          role="tablist"
          aria-label="Suites"
          class="flex flex-wrap gap-1 rounded-lg bg-surface-container-high p-1"
        >
          @for (suite of suites; track suite.id; let index = $index) {
            <button
              #tab
              type="button"
              role="tab"
              [id]="'suite-tab-' + suite.id"
              [attr.aria-selected]="index === selectedIndex()"
              [attr.aria-controls]="'suite-panel-' + suite.id"
              [attr.tabindex]="index === selectedIndex() ? 0 : -1"
              class="min-h-11 cursor-pointer rounded px-space-md py-space-xs text-label-md uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              [class]="index === selectedIndex() ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-primary'"
              (click)="select(index)"
              (keydown)="onKeydown($event)"
            >
              {{ suite.name }}
            </button>
          }
        </div>
      </div>

      @for (suite of suites; track suite.id; let index = $index) {
        <div
          role="tabpanel"
          tabindex="0"
          [id]="'suite-panel-' + suite.id"
          [attr.aria-labelledby]="'suite-tab-' + suite.id"
          [hidden]="index !== selectedIndex()"
          class="rounded-xl bg-surface-container-low p-space-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <div class="grid grid-cols-1 items-center gap-space-md md:grid-cols-12">
            <div
              data-testid="image-placeholder"
              class="flex h-64 flex-col items-center justify-center gap-space-sm rounded-lg bg-linear-to-br from-primary-container to-primary text-on-primary-container md:col-span-5 md:h-72"
            >
              <svg viewBox="0 0 24 24" class="h-10 w-10" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h.01M12 10h.01M15 10h.01" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span class="text-label-md uppercase">No image available</span>
            </div>
            <div class="flex flex-col gap-space-sm md:col-span-7">
              <h3 class="font-serif text-headline-md text-primary">{{ suite.name }}</h3>
              <p class="text-body-md text-on-surface-variant">{{ suite.description }}</p>
              <ul class="grid grid-cols-2 gap-space-xs pt-space-xs text-body-sm text-on-surface-variant">
                @for (feature of suite.features; track feature) {
                  <li class="flex items-center gap-space-xs">
                    <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0 text-surface-tint" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                      <path d="m5 12 5 5 9-10" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                    <span>{{ feature }}</span>
                  </li>
                }
              </ul>
            </div>
          </div>
        </div>
      }
    </section>
  `,
})
export class SuitesShowcase {
  private readonly tabs = viewChildren<ElementRef<HTMLButtonElement>>('tab');

  protected readonly suites = sampleSuites;
  protected readonly selectedIndex = signal(0);

  protected select(index: number): void {
    this.selectedIndex.set(index);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const last = this.suites.length - 1;
    const current = this.selectedIndex();
    const targets: Record<string, number> = {
      ArrowRight: current === last ? 0 : current + 1,
      ArrowLeft: current === 0 ? last : current - 1,
      Home: 0,
      End: last,
    };
    const next = targets[event.key];
    if (next === undefined) {
      return;
    }
    event.preventDefault();
    this.select(next);
    this.tabs()[next]?.nativeElement.focus();
  }
}

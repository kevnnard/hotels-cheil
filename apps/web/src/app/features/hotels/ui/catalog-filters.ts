import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ratingOptions } from '../data/catalog-query';

@Component({
  selector: 'app-catalog-filters',
  imports: [ReactiveFormsModule],
  host: { class: 'contents' },
  template: `
    <div
      id="search-panel"
      data-testid="search-panel"
      class="scroll-mt-(--header-height) z-40 w-full rounded-xl bg-surface-container-lowest/95 p-3 shadow-[0_12px_32px_-16px_rgba(24,26,25,0.12),0_2px_8px_rgba(0,0,0,0.04)] backdrop-blur-2xl md:sticky md:top-(--header-height)"
    >
      <div data-testid="primary-filters" class="flex flex-col gap-3 md:flex-row md:items-center">
        <div
          data-testid="search-group"
          class="relative flex h-11 min-w-0 flex-1 items-center rounded-lg border border-outline-variant bg-surface-container-lowest transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 md:max-w-xl"
        >
          <svg viewBox="0 0 24 24" class="pointer-events-none absolute left-3 h-5 w-5 text-on-surface-variant" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="m21 21-4.3-4.3M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <label for="hotel-search" class="sr-only">Search by name</label>
          <input
            id="hotel-search"
            data-testid="search-input"
            type="search"
            autocomplete="off"
            placeholder="Search hotels by name"
            class="h-full w-full min-w-0 rounded-lg bg-transparent pl-10 pr-3 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none"
            [formControl]="searchControl()"
          />
        </div>

        <div class="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" class="hidden text-sm text-on-surface-variant lg:inline">Rating</span>
          <div
            role="group"
            aria-label="Minimum rating"
            class="flex h-11 w-full min-w-0 items-center gap-1 overflow-x-auto rounded-lg bg-surface-container p-1 md:w-auto"
          >
            <button
              type="button"
              data-testid="rating-all"
              [class]="segmentClasses(minRating() === null)"
              [attr.aria-pressed]="minRating() === null"
              (click)="ratingChange.emit(null)"
            >
              All
            </button>
            @for (option of ratingOptions; track option.value) {
              <button
                type="button"
                [attr.data-testid]="'rating-' + option.value"
                [class]="segmentClasses(minRating() === option.value)"
                [attr.aria-pressed]="minRating() === option.value"
                (click)="ratingChange.emit(option.value)"
              >
                {{ option.label }}
              </button>
            }
          </div>
        </div>

        <div class="flex items-center gap-3 md:ml-auto">
          <button
            type="button"
            data-testid="more-filters"
            aria-controls="advanced-filters"
            class="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-outline-variant bg-transparent px-4 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:flex-none"
            [attr.aria-expanded]="advancedOpen()"
            (click)="toggleAdvanced()"
          >
            <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Filters
            <svg
              data-testid="filters-chevron"
              viewBox="0 0 24 24"
              class="h-4 w-4 text-on-surface-variant transition-transform"
              [class.rotate-180]="advancedOpen()"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          @if (hasAppliedFilters()) {
            <button
              type="button"
              data-testid="clear-filters"
              class="inline-flex h-11 items-center justify-center rounded-lg px-3 text-sm font-medium text-on-surface-variant transition-colors hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              (click)="cleared.emit()"
            >
              Reset
            </button>
          }
        </div>
      </div>
    </div>

    <div
      id="advanced-filters"
      class="mt-3 grid grid-cols-1 gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-[0_12px_32px_-16px_rgba(24,26,25,0.12),0_2px_8px_rgba(0,0,0,0.04)] sm:grid-cols-2 lg:grid-cols-3"
      [hidden]="!advancedOpen()"
    >
      <div data-testid="filter-group" class="flex flex-col gap-space-sm">
        <label for="filter-destination" class="text-sm font-medium text-on-surface">Destination</label>
        <input id="filter-destination" data-testid="filter-destination" type="text" placeholder="City or country" aria-describedby="note-destination" class="min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface placeholder:text-on-surface-variant focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" />
        <span id="note-destination" data-testid="unavailable-note" class="text-xs text-on-surface-variant">Not available yet</span>
      </div>

      <div data-testid="filter-group" class="flex flex-col gap-space-sm">
        <label for="filter-property-type" class="text-sm font-medium text-on-surface">Property type</label>
        <select id="filter-property-type" data-testid="filter-property-type" aria-describedby="note-property-type" class="min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface placeholder:text-on-surface-variant focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <option value="all" selected>All types</option>
        </select>
        <span id="note-property-type" data-testid="unavailable-note" class="text-xs text-on-surface-variant">Not available yet</span>
      </div>

      <div data-testid="filter-group" class="flex flex-col gap-space-sm">
        <label for="filter-price" class="text-sm font-medium text-on-surface">Minimum price per night</label>
        <input id="filter-price" data-testid="filter-price" type="range" min="0" max="100" value="0" aria-describedby="note-price" class="h-11 w-full accent-primary-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" />
        <span id="note-price" data-testid="unavailable-note" class="text-xs text-on-surface-variant">Not available yet</span>
      </div>

      <div data-testid="filter-group" role="group" aria-labelledby="categories-label" class="flex flex-col gap-space-sm sm:col-span-2 lg:col-span-3">
        <span id="categories-label" class="text-sm font-medium text-on-surface">Categories</span>
        <div class="flex flex-wrap gap-space-sm">
          <button type="button" data-testid="filter-category-all" aria-pressed="true" class="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary border-primary-container bg-primary-container text-on-primary">All</button>
          <button type="button" data-testid="filter-category-coastal" aria-pressed="false" class="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary border-outline-variant bg-transparent text-on-surface-variant hover:bg-surface-container">Coastal retreats</button>
          <button type="button" data-testid="filter-category-desert" aria-pressed="false" class="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary border-outline-variant bg-transparent text-on-surface-variant hover:bg-surface-container">Desert oasis</button>
          <button type="button" data-testid="filter-category-alpine" aria-pressed="false" class="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary border-outline-variant bg-transparent text-on-surface-variant hover:bg-surface-container">Alpine heights</button>
          <button type="button" data-testid="filter-category-heritage" aria-pressed="false" class="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary border-outline-variant bg-transparent text-on-surface-variant hover:bg-surface-container">Heritage sanctuary</button>
        </div>
        <span id="note-categories" data-testid="unavailable-note" class="text-xs text-on-surface-variant">Not available yet</span>
      </div>

      <div data-testid="filter-group" role="group" aria-labelledby="amenities-label" class="flex flex-col gap-space-sm sm:col-span-2 lg:col-span-3">
        <span id="amenities-label" class="text-sm font-medium text-on-surface">Amenities</span>
        <div class="grid grid-cols-1 gap-space-sm sm:grid-cols-2 lg:grid-cols-6">
          <label class="flex min-h-11 items-center gap-2 text-sm text-on-surface"><input type="checkbox" class="h-4 w-4 accent-primary-container" />Spa</label>
          <label class="flex min-h-11 items-center gap-2 text-sm text-on-surface"><input type="checkbox" class="h-4 w-4 accent-primary-container" />Pool</label>
          <label class="flex min-h-11 items-center gap-2 text-sm text-on-surface"><input type="checkbox" class="h-4 w-4 accent-primary-container" />Restaurant</label>
          <label class="flex min-h-11 items-center gap-2 text-sm text-on-surface"><input type="checkbox" class="h-4 w-4 accent-primary-container" />Wi-Fi</label>
          <label class="flex min-h-11 items-center gap-2 text-sm text-on-surface"><input type="checkbox" class="h-4 w-4 accent-primary-container" />Pet friendly</label>
          <label class="flex min-h-11 items-center gap-2 text-sm text-on-surface"><input type="checkbox" class="h-4 w-4 accent-primary-container" />Concierge</label>
        </div>
        <span id="note-amenities" data-testid="unavailable-note" class="text-xs text-on-surface-variant">Not available yet</span>
      </div>
    </div>
  `,
})
export class CatalogFilters {
  readonly searchControl = input.required<FormControl<string>>();
  readonly minRating = input.required<number | null>();
  readonly ratingChange = output<number | null>();
  readonly cleared = output<void>();

  protected readonly ratingOptions = ratingOptions;
  protected readonly advancedOpen = signal(false);
  private readonly searchText = signal('');
  protected readonly hasAppliedFilters = computed(() => this.searchText().trim() !== '' || this.minRating() !== null);

  constructor() {
    effect((onCleanup) => {
      const control = this.searchControl();
      let active = true;
      const track = (value: string) => {
        if (active) {
          this.searchText.set(value);
        }
      };
      track(control.value);
      control.registerOnChange(track);
      const subscription = control.valueChanges.subscribe(track);
      onCleanup(() => {
        active = false;
        subscription.unsubscribe();
      });
    });
  }

  protected segmentClasses(selected: boolean): string {
    const base =
      'inline-flex h-9 shrink-0 flex-1 items-center justify-center whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary md:flex-none';
    return selected
      ? `${base} bg-primary-container text-on-primary shadow-sm`
      : `${base} text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface`;
  }

  protected toggleAdvanced(): void {
    this.advancedOpen.update((open) => !open);
  }
}

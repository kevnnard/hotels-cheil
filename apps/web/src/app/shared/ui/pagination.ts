import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  template: `
    @if (totalPages() > 1) {
      <nav aria-label="Pagination" class="flex items-center justify-between gap-space-sm sm:gap-space-md">
        <button
          type="button"
          data-testid="pagination-previous"
          class="min-h-11 shrink-0 rounded-lg border border-outline-variant px-space-sm py-space-sm text-label-lg uppercase text-primary sm:px-space-md transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          [disabled]="!hasPrevious()"
          (click)="pageChange.emit(page() - 1)"
        >
          Previous
        </button>
        <span data-testid="pagination-summary" class="text-center text-body-sm text-on-surface-variant" aria-live="polite">
          Page {{ page() }} of {{ totalPages() }}
        </span>
        <button
          type="button"
          data-testid="pagination-next"
          class="min-h-11 shrink-0 rounded-lg border border-outline-variant px-space-sm py-space-sm text-label-lg uppercase text-primary sm:px-space-md transition-colors hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          [disabled]="!hasNext()"
          (click)="pageChange.emit(page() + 1)"
        >
          Next
        </button>
      </nav>
    }
  `,
})
export class Pagination {
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly pageChange = output<number>();

  protected readonly hasPrevious = computed(() => this.page() > 1);
  protected readonly hasNext = computed(() => this.page() < this.totalPages());
}

import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, computed, effect, inject, linkedSignal, signal, untracked, viewChild } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router, RouterOutlet } from '@angular/router';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { Pagination } from '../../shared/ui/pagination';
import { StatePanel } from '../../shared/ui/state-panel';
import { RatingOption } from '../hotels/data/catalog-query';
import { formatLocation } from '../hotels/data/hotel-location';
import { Hotel, HotelPage } from '../hotels/data/hotel.models';
import { HotelImageView } from '../hotels/ui/hotel-image-view';
import { HotelPrice } from '../hotels/ui/hotel-price';
import { AdminDirectoryRefresh } from './data/admin-directory-refresh';
import { adminRatingOptions, parseAdminHotelQuery, sameHotelQuery } from './data/admin-hotel-query';
import { AdminHotelsService } from './data/admin-hotels.service';

const filterDebounceMilliseconds = 300;
const deletedMessage = 'Hotel deleted.';
const deleteFailedMessage = 'We could not delete this hotel. Try again.';

function priceLimit(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value > 0 ? value : null;
}

function isPlainPrimaryClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
}

@Component({
  selector: 'app-dashboard-page',
  imports: [HotelImageView, HotelPrice, NgTemplateOutlet, Pagination, ReactiveFormsModule, RouterOutlet, StatePanel],
  templateUrl: './dashboard-page.html',
})
export class DashboardPage {
  private readonly hotelsApi = inject(AdminHotelsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly directoryRefresh = inject(AdminDirectoryRefresh);
  private handledChange = this.directoryRefresh.change()?.sequence ?? 0;
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');
  private readonly deleteDialog = viewChild.required<ElementRef<HTMLDialogElement>>('deleteDialog');
  private deleteOpener: HTMLElement | null = null;

  protected readonly placeholders = Array.from({ length: 4 }, (_, index) => index);

  protected readonly query = toSignal(
    this.route.queryParamMap.pipe(map(parseAdminHotelQuery), distinctUntilChanged(sameHotelQuery)),
    { initialValue: parseAdminHotelQuery(this.route.snapshot.queryParamMap) },
  );
  private readonly queryParams = toSignal(this.route.queryParams, { initialValue: this.route.snapshot.queryParams });

  protected readonly searchControl = new FormControl(this.query().name, { nonNullable: true });
  protected readonly ratingControl = new FormControl(this.ratingValue(this.query().minRating), { nonNullable: true });
  protected readonly maxPriceControl = new FormControl<number | null>(this.query().maxPrice ?? null);

  protected readonly ratingOptions = computed<readonly RatingOption[]>(() => {
    const selected = this.query().minRating;
    return selected === null || adminRatingOptions.some((option) => option.value === selected)
      ? adminRatingOptions
      : [...adminRatingOptions, { value: selected, label: `${selected} and up` }];
  });

  protected readonly hotels = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.hotelsApi.list(params),
  });

  protected readonly loadedPage = linkedSignal<HotelPage | undefined, HotelPage | null>({
    source: () => (this.hotels.hasValue() ? this.hotels.value() : undefined),
    computation: (page, previous) => page ?? previous?.value ?? null,
  });

  protected readonly hasFilters = computed(() => {
    const { name, minRating, maxPrice } = this.query();
    return name !== '' || minRating !== null || maxPrice != null;
  });

  protected readonly newHotelHref = computed(() => this.sheetHref(['/admin', 'hotels', 'new']));

  protected readonly pendingDelete = signal<Hotel | null>(null);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);
  protected readonly statusMessage = signal('');

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(filterDebounceMilliseconds), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((name) => this.applyQuery({ name: name.trim() || null, page: null }));

    this.ratingControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.applyQuery({ minRating: value || null, page: null }));

    this.maxPriceControl.valueChanges
      .pipe(map(priceLimit), debounceTime(filterDebounceMilliseconds), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((limit) => this.applyQuery({ maxPrice: limit, page: null }));

    effect(() => {
      const { name, minRating, maxPrice } = this.query();
      if (name !== this.searchControl.value.trim()) {
        this.searchControl.setValue(name, { emitEvent: false });
      }
      const rating = this.ratingValue(minRating);
      if (rating !== this.ratingControl.value) {
        this.ratingControl.setValue(rating, { emitEvent: false });
      }
      const limit = maxPrice ?? null;
      if (limit !== priceLimit(this.maxPriceControl.value)) {
        this.maxPriceControl.setValue(limit, { emitEvent: false });
      }
    });

    effect(() => {
      const change = this.directoryRefresh.change();
      if (change === null || change.sequence <= this.handledChange) {
        return;
      }
      this.handledChange = change.sequence;
      untracked(() => {
        if (change.message !== null) {
          this.statusMessage.set(change.message);
        }
        this.hotels.reload();
      });
    });
  }

  protected location(hotel: Hotel): string {
    return formatLocation(hotel.address);
  }

  protected hasThumbnail(hotel: Hotel): boolean {
    return hotel.images.some((image) => image.position === 0) || hotel.image !== null;
  }

  protected averageRating(hotel: Hotel): string | null {
    const { average, count } = hotel.rating;
    return average !== null && count > 0 ? average.toFixed(2) : null;
  }

  protected ratingCount(hotel: Hotel): string {
    const { count } = hotel.rating;
    return `${count} ${count === 1 ? 'rating' : 'ratings'}`;
  }

  protected editHref(hotel: Hotel): string {
    return this.sheetHref(['/admin', 'hotels', hotel.id, 'edit']);
  }

  protected openSheet(event: MouseEvent, href: string): void {
    if (!isPlainPrimaryClick(event)) {
      return;
    }
    event.preventDefault();
    void this.router.navigateByUrl(href, { scroll: 'manual' });
  }

  protected resetFilters(): void {
    this.applyQuery({ name: null, minRating: null, maxPrice: null, page: null });
  }

  protected goToPage(page: number): void {
    this.applyQuery({ page: page > 1 ? page : null });
  }

  protected retry(): void {
    this.hotels.reload();
  }

  protected askToDelete(hotel: Hotel, event: Event): void {
    this.deleteOpener = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.pendingDelete.set(hotel);
    this.deleteError.set(null);
    this.deleteDialog().nativeElement.showModal();
  }

  protected cancelDelete(): void {
    if (this.deleting()) {
      return;
    }
    this.closeDeleteDialog();
    this.deleteOpener?.focus();
  }

  protected onDeleteDialogCancel(event: Event): void {
    event.preventDefault();
    this.cancelDelete();
  }

  protected confirmDelete(): void {
    const hotel = this.pendingDelete();
    if (hotel === null || this.deleting()) {
      return;
    }
    this.deleting.set(true);
    this.deleteError.set(null);
    this.hotelsApi
      .delete(hotel.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.completeDelete(),
        error: (error: unknown) =>
          error instanceof HttpErrorResponse && error.status === 404 ? this.completeDelete() : this.failDelete(),
      });
  }

  private completeDelete(): void {
    const page = this.loadedPage();
    const removedLastOfPage = page !== null && page.items.length <= 1 && page.page > 1;
    this.deleting.set(false);
    this.closeDeleteDialog();
    this.statusMessage.set(deletedMessage);
    this.heading().nativeElement.focus();
    if (removedLastOfPage) {
      const previous = page.page - 1;
      this.navigate({ page: previous > 1 ? previous : null });
    } else {
      this.hotels.reload();
    }
  }

  private failDelete(): void {
    this.deleting.set(false);
    this.deleteError.set(deleteFailedMessage);
  }

  private closeDeleteDialog(): void {
    this.deleteDialog().nativeElement.close();
    this.pendingDelete.set(null);
    this.deleteError.set(null);
  }

  private ratingValue(minRating: number | null): string {
    return minRating === null ? '' : String(minRating);
  }

  private sheetHref(commands: string[]): string {
    return this.router.serializeUrl(this.router.createUrlTree(commands, { queryParams: this.queryParams() }));
  }

  private applyQuery(queryParams: Params): void {
    this.statusMessage.set('');
    this.navigate(queryParams);
  }

  private navigate(queryParams: Params): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      scroll: 'manual',
    });
  }
}

import { Component, DestroyRef, ElementRef, computed, effect, inject, linkedSignal, viewChild } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { Pagination } from '../../../shared/ui/pagination';
import { StatePanel } from '../../../shared/ui/state-panel';
import { catalogPageSize, parseCatalogQuery, priceRange } from '../data/catalog-query';
import { HotelCatalogService } from '../data/hotel-catalog.service';
import { HotelPage } from '../data/hotel.models';
import { CatalogFilters } from '../ui/catalog-filters';
import { FeaturedHotel } from '../ui/featured-hotel';
import { HotelCard } from '../ui/hotel-card';
import { ManifestoSection } from '../ui/manifesto-section';

const filterDebounceMilliseconds = 300;

function sliderPosition(maxPrice: number | null | undefined): number {
  return maxPrice ?? priceRange.max;
}

@Component({
  selector: 'app-catalog-page',
  imports: [CatalogFilters, FeaturedHotel, HotelCard, ManifestoSection, Pagination, StatePanel],
  templateUrl: './catalog-page.html',
})
export class CatalogPage {
  private readonly catalog = inject(HotelCatalogService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly collection = viewChild.required<ElementRef<HTMLElement>>('collection');

  protected readonly placeholders = Array.from({ length: 4 }, (_, index) => index);
  protected readonly pageSize = catalogPageSize;

  protected readonly query = toSignal(this.route.queryParamMap.pipe(map((params) => parseCatalogQuery(params))), {
    initialValue: parseCatalogQuery(this.route.snapshot.queryParamMap),
  });

  protected readonly searchControl = new FormControl(this.query().name, { nonNullable: true });
  protected readonly priceControl = new FormControl(sliderPosition(this.query().maxPrice), { nonNullable: true });

  protected readonly hotels = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.catalog.list(params),
  });

  protected readonly loadedPage = linkedSignal<HotelPage | undefined, HotelPage | null>({
    source: () => (this.hotels.hasValue() ? this.hotels.value() : undefined),
    computation: (page, previous) => page ?? previous?.value ?? null,
  });
  protected readonly featuredHotels = computed(() => this.loadedPage()?.items ?? []);
  protected readonly hasFilters = computed(
    () => this.query().name !== '' || this.query().minRating !== null || this.query().maxPrice != null,
  );

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(filterDebounceMilliseconds), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((name) => this.navigate({ name: name.trim() || null, page: null }));

    this.priceControl.valueChanges
      .pipe(debounceTime(filterDebounceMilliseconds), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((limit) => this.navigate({ maxPrice: limit < priceRange.max ? limit : null, page: null }));

    effect(() => {
      const name = this.query().name;
      if (name !== this.searchControl.value.trim()) {
        this.searchControl.setValue(name, { emitEvent: false });
      }
    });

    effect(() => {
      const position = sliderPosition(this.query().maxPrice);
      if (position !== this.priceControl.value) {
        this.priceControl.setValue(position, { emitEvent: false });
      }
    });
  }

  protected selectRating(minRating: number | null): void {
    this.navigate({ minRating, page: null });
  }

  protected clearFilters(): void {
    this.navigate({ name: null, minRating: null, maxPrice: null, page: null });
  }

  protected goToPage(page: number): void {
    this.collection().nativeElement.scrollIntoView();
    this.navigate({ page: page > 1 ? page : null });
  }

  protected retry(): void {
    this.hotels.reload();
  }

  private navigate(queryParams: Record<string, string | number | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      scroll: 'manual',
    });
  }
}

import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink, RouterOutlet } from '@angular/router';
import { HotelCatalogService } from '../features/hotels/data/hotel-catalog.service';
import { formatLocation } from '../features/hotels/data/hotel-location';
import { Hotel } from '../features/hotels/data/hotel.models';
import { SiteFooter } from '../shared/ui/site-footer';

const destinationsPageSize = 100;

function distinctDestinations(hotels: Hotel[]): string[] {
  const locations = hotels.map((hotel) => formatLocation(hotel.address)).filter((location) => location !== '');
  return [...new Set(locations)].sort((first, second) => first.localeCompare(second));
}

@Component({
  selector: 'app-public-layout',
  imports: [RouterLink, RouterOutlet, SiteFooter],
  template: `
    <div data-testid="public-layout" class="flex min-h-screen flex-col bg-background">
      <header
        class="fixed top-0 z-50 w-full bg-surface/90 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl"
      >
        <div
          class="flex w-full flex-wrap items-center justify-between px-margin-mobile md:h-20 md:flex-nowrap md:px-margin-tablet lg:px-margin-desktop"
        >
          <a
            routerLink="/"
            data-testid="brand-link"
            class="inline-flex min-h-11 items-center py-space-sm font-serif text-headline-sm uppercase tracking-widest text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            AUREA
          </a>
          <nav
            aria-label="Main"
            class="order-last flex w-full items-center gap-gutter border-t border-outline-variant/40 md:order-none md:w-auto md:gap-gutter-desktop md:border-t-0"
          >
            <a
              routerLink="/"
              class="inline-flex min-h-11 items-center text-label-lg uppercase text-on-surface-variant transition-colors hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Home
            </a>
            <a
              routerLink="/"
              fragment="collection"
              class="inline-flex min-h-11 items-center text-label-lg uppercase text-on-surface-variant transition-colors hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Hotel Collection
            </a>
          </nav>
          <div class="flex items-center gap-space-sm">
            <a
              routerLink="/"
              fragment="search-panel"
              data-testid="header-search"
              aria-label="Search hotels"
              class="flex h-11 w-11 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <svg
                viewBox="0 0 24 24"
                class="h-5 w-5"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path
                  d="m21 21-4.3-4.3M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </a>
            <a
              routerLink="/"
              fragment="collection"
              class="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary-container px-space-md py-space-sm text-label-lg uppercase text-on-primary transition-colors hover:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Explore Hotels
            </a>
          </div>
        </div>
      </header>
      <div class="flex-1 pt-(--header-height)">
        <router-outlet />
      </div>
      <app-site-footer [destinations]="destinations()" />
    </div>
  `,
})
export class PublicLayout {
  private readonly catalog = inject(HotelCatalogService);

  private readonly hotels = rxResource({
    stream: () => this.catalog.list({ name: '', minRating: null, page: 1, pageSize: destinationsPageSize }),
  });

  protected readonly destinations = computed(() =>
    this.hotels.hasValue() ? distinctDestinations(this.hotels.value().items) : [],
  );
}
